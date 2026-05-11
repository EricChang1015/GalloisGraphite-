import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

import { createServerClient } from "@/lib/supabase/server";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import { getMarketContext, type MarketContext } from "@/lib/ai/marketContext";
import { logChatTurn, readChatRequestMetadata } from "@/lib/ai/logging";

/**
 * POST /api/chat  (AI SDK v6 UIMessageStream format)
 *
 * Powered by POE's OpenAI-compatible API. Switch model by changing
 * POE_MODEL in .env.local.
 *
 * For signed-in users we additionally inject a market snapshot (active
 * listings + recent settled orders, aggregated per category) so the model
 * can give indicative price ranges without hallucinating.
 *
 * Both the latest user prompt and the streamed assistant reply are written
 * to `public.ai_chat_logs` (server-side audit trail) keyed by the session
 * id the client sends in the `x-mada-session` header. Audit failures never
 * break the user experience.
 */

const poe = createOpenAI({
  apiKey: process.env.POE_API_KEY ?? "",
  baseURL: process.env.POE_BASE_URL ?? "https://api.poe.com/v1",
});

function stripProviderMetadata(messages: UIMessage[]): UIMessage[] {
  // Avoid forwarding provider-specific continuation ids (e.g. OpenAI itemId)
  // because they are not available for Zero Data Retention orgs.
  return JSON.parse(
    JSON.stringify(messages, (key, value) =>
      key === "providerMetadata" ? undefined : value
    )
  ) as UIMessage[];
}

function getMessageText(
  parts: Array<{ type: string; text?: string }>
): string {
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export async function POST(req: Request) {
  if (!process.env.POE_API_KEY) {
    return new Response(
      JSON.stringify({ error: "POE_API_KEY is not configured." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  // AI SDK v6: body contains { id, messages: UIMessage[] }
  const { messages } = (await req.json()) as { messages: UIMessage[] };

  if (!Array.isArray(messages)) {
    return new Response(
      JSON.stringify({ error: "messages array is required." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Resolve auth state and (when signed in) the live market snapshot.
  // Both calls are best-effort — failures fall back to guest mode without
  // market context so the assistant always responds.
  let userId: string | null = null;
  let marketContext: MarketContext | null = null;

  try {
    const supabase = await createServerClient();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;

    if (userId) {
      try {
        marketContext = await getMarketContext(supabase);
      } catch {
        // Soft-fail: prompt will say no market context is available.
        marketContext = null;
      }
    }
  } catch {
    userId = null;
  }

  const meta = readChatRequestMetadata(req, userId);

  // Audit: log the latest user message before streaming begins. We log only
  // the most recent user turn so the audit table doesn't accumulate
  // duplicate history every time the conversation is replayed by the SDK.
  const lastUser = [...messages]
    .reverse()
    .find((m) => m.role === "user");
  if (lastUser) {
    const text = getMessageText(
      (lastUser.parts ?? []) as Array<{ type: string; text?: string }>
    );
    // Fire-and-forget; logChatTurn already swallows its own errors.
    void logChatTurn({ ...meta, role: "user", content: text });
  }

  const system = buildSystemPrompt({
    mode: userId ? "user" : "guest",
    marketContext,
  });
  const model = process.env.POE_MODEL ?? "claude-3-5-sonnet";

  const modelMessages = await convertToModelMessages(
    stripProviderMetadata(messages)
  );

  const result = streamText({
    model: poe(model),
    system,
    messages: modelMessages,
    maxOutputTokens: 1024,
    temperature: 0.7,
    onFinish: ({ text }) => {
      void logChatTurn({ ...meta, role: "assistant", content: text });
    },
  });

  return result.toUIMessageStreamResponse();
}
