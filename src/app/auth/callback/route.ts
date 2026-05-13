import { NextResponse } from "next/server";

import { createServerClient } from "@/lib/supabase/server";

/**
 * OAuth callback handler.
 *
 * Supabase redirects the browser here with `?code=...` after a successful
 * provider sign-in (Google, etc.). We exchange the code for a session,
 * which writes the auth cookies via the SSR client, then redirect to the
 * intended destination (`next` query param, defaulting to /dashboard).
 *
 * On error we send the user back to /login with an error hint.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=oauth_failed", url.origin)
  );
}
