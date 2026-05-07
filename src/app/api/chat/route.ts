import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

import { createServerClient } from "@/lib/supabase/server";
import { buildSystemPrompt } from "@/lib/ai/prompt";

/**
 * POST /api/chat  (AI SDK v6 UIMessageStream format)
 *
 * Powered by POE's OpenAI-compatible API.
 * Switch model by changing POE_MODEL in .env.local.
 * Supported: claude-3-5-sonnet, gpt-4o, gpt-4o-mini, gemini-2.0-flash, etc.
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

  // Determine mode from auth state
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const system = buildSystemPrompt(user ? "user" : "guest");
  const model = process.env.POE_MODEL ?? "claude-3-5-sonnet";

  // convertToModelMessages is async in AI SDK v6
  const modelMessages = await convertToModelMessages(
    stripProviderMetadata(messages)
  );

  const result = streamText({
    model: poe(model),
    system,
    messages: modelMessages,
    maxOutputTokens: 1024,
    temperature: 0.7,
  });

  // Return UI message stream (compatible with DefaultChatTransport)
  return result.toUIMessageStreamResponse();
}
