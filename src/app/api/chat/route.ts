import { NextResponse } from "next/server";

import { createServerClient } from "@/lib/supabase/server";
import { buildSystemPrompt } from "@/lib/ai/prompt";

/**
 * POST /api/chat
 *
 * Streaming endpoint for the AI assistant. This is a stub — the next prompt
 * should wire it up to the Vercel AI SDK + Anthropic Claude with the proper
 * system prompt selected from the user's auth state.
 *
 * Outline:
 *   const { messages } = await req.json();
 *   const supabase = await createServerClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 *   const system = buildSystemPrompt(user ? "user" : "guest");
 *   const result = await streamText({
 *     model: anthropic(process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5"),
 *     system, messages,
 *   });
 *   return result.toAIStreamResponse();
 */
export async function POST(_req: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Reference imports so they're not pruned in lint:
  void buildSystemPrompt(user ? "user" : "guest");

  return NextResponse.json(
    {
      ok: false,
      message: "AI chat endpoint not yet implemented. See route.ts for outline.",
    },
    { status: 501 }
  );
}
