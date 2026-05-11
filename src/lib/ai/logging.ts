import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Server-side audit log for the AI assistant.
 *
 * Every Q&A turn is appended to `public.ai_chat_logs` (migration 006) using
 * the service-role admin client. RLS only allows admin / super_admin to
 * read the rows back. There is no insert / update / delete policy for
 * regular users — by design, all writes flow through this module.
 *
 * Failures are deliberately silent: a downed audit log MUST NOT break the
 * AI assistant for the visitor.
 */

export interface ChatRequestMetadata {
  sessionId: string;
  userId: string | null;
  ip: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  userAgent: string | null;
}

const SESSION_ID_REGEX = /^[a-f0-9]{20}$/;
const FALLBACK_SESSION_PREFIX = "srv-";
const MAX_CONTENT_CHARS = 16_000;

/**
 * Pull session id, IP, geo and User-Agent out of an incoming Request.
 *
 * - Session id arrives via the `x-mada-session` header set by the chat
 *   client. Anything that doesn't match `^[a-f0-9]{20}$` is rejected and a
 *   server-generated fallback id is used instead.
 * - IP / geo headers are populated automatically by Vercel
 *   (`x-vercel-ip-country`, `x-vercel-ip-city`, `x-vercel-ip-country-region`,
 *   `x-forwarded-for`). They are simply absent in local development.
 * - User-Agent is the raw header; we don't parse browser / OS in MVP.
 */
export function readChatRequestMetadata(
  req: Request,
  userId: string | null
): ChatRequestMetadata {
  const headers = req.headers;
  const rawSession = headers.get("x-mada-session") ?? "";
  const sessionId = SESSION_ID_REGEX.test(rawSession)
    ? rawSession
    : FALLBACK_SESSION_PREFIX +
      Math.random().toString(16).slice(2).padEnd(16, "0").slice(0, 16);

  const xff = headers.get("x-forwarded-for");
  const ip =
    xff?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    null;

  return {
    sessionId,
    userId,
    ip,
    country: headers.get("x-vercel-ip-country"),
    region: headers.get("x-vercel-ip-country-region"),
    city: headers.get("x-vercel-ip-city"),
    userAgent: headers.get("user-agent"),
  };
}

interface LogTurnArgs extends ChatRequestMetadata {
  role: "user" | "assistant";
  content: string;
}

export async function logChatTurn(args: LogTurnArgs): Promise<void> {
  const content = (args.content ?? "").slice(0, MAX_CONTENT_CHARS);
  if (!content.trim()) return; // Nothing useful to log.

  try {
    const supabase = createAdminClient();
    await supabase.from("ai_chat_logs").insert({
      session_id: args.sessionId,
      user_id: args.userId,
      role: args.role,
      content,
      ip: args.ip,
      country: args.country,
      region: args.region,
      city: args.city,
      user_agent: args.userAgent,
    });
  } catch {
    // Audit failures must not break the user experience. Consider wiring
    // these up to Sentry in Phase 2.
  }
}
