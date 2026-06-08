import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getAppUrl } from "@/lib/app-url";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

/**
 * Auth callback handler.
 *
 * Handles two flows that both arrive with `?code=...`:
 *  1. OAuth sign-in (Google) — redirect to `next` (default /dashboard).
 *  2. Password recovery (`?type=recovery`) — redirect to /reset-password.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const appOrigin = getAppUrl();
  const code = url.searchParams.get("code");
  const type = url.searchParams.get("type");
  const nextParam = url.searchParams.get("next");

  const isRecovery = type === "recovery";
  const fallbackNext = isRecovery ? "/reset-password" : "/dashboard";
  const next = nextParam ?? fallbackNext;

  if (!code) {
    return redirectWithError(appOrigin, isRecovery);
  }

  const cookieStore = await cookies();
  const successUrl = new URL(next, appOrigin);
  let response = NextResponse.redirect(successUrl);

  const supabase = createRouteHandlerClient(cookieStore, response);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (!error) {
    return response;
  }

  // PKCE code is single-use; a duplicate /auth/callback (prefetch/retry) may
  // race and fail while the session cookies were already set on `response`.
  const recoverableCodes = new Set([
    "flow_state_not_found",
    "pkce_code_verifier_not_found",
    "invalid_grant",
  ]);
  if (error.code && recoverableCodes.has(error.code)) {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      return response;
    }
  }

  return redirectWithError(appOrigin, isRecovery);
}

function redirectWithError(appOrigin: string, isRecovery: boolean) {
  return NextResponse.redirect(
    new URL(
      isRecovery
        ? "/forgot-password?error=recovery_failed"
        : "/login?error=oauth_failed",
      appOrigin,
    ),
  );
}
