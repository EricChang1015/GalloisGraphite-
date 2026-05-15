import { NextResponse } from "next/server";

import { createServerClient } from "@/lib/supabase/server";

/**
 * Auth callback handler.
 *
 * Handles two flows that both arrive with `?code=...`:
 *  1. OAuth sign-in (Google) — redirect to `next` (default /dashboard).
 *  2. Password recovery (`?type=recovery`) — redirect to /reset-password so
 *     the user can choose a new password using the just-established session.
 *
 * In either case we call `exchangeCodeForSession` first, which sets the
 * Supabase auth cookies on this response via the SSR client.
 *
 * On failure: OAuth → /login?error=oauth_failed; recovery → /forgot-password
 * with an error hint so the user can request a new email.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const type = url.searchParams.get("type");
  const nextParam = url.searchParams.get("next");

  const isRecovery = type === "recovery";
  const fallbackNext = isRecovery ? "/reset-password" : "/dashboard";
  const next = nextParam ?? fallbackNext;

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  return NextResponse.redirect(
    new URL(
      isRecovery
        ? "/forgot-password?error=recovery_failed"
        : "/login?error=oauth_failed",
      url.origin
    )
  );
}
