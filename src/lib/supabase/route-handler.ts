import "server-only";

import { createServerClient as createSSRServerClient } from "@supabase/ssr";
import type { NextResponse } from "next/server";
import type { cookies } from "next/headers";

import type { Database } from "@/types/database";
import { SERVER_AUTH_OPTIONS } from "@/lib/supabase/auth-config";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

/**
 * Supabase client for Route Handlers that mutate auth (OAuth callback, etc.).
 *
 * Cookies must be written onto the same `NextResponse` we return — especially
 * redirects. Using `cookies().set()` then `NextResponse.redirect()` drops the
 * session Set-Cookie headers.
 *
 * Do not sanitize PKCE / auth cookies here; the callback needs the raw
 * `*-code-verifier` cookie from the browser OAuth start.
 */
export function createRouteHandlerClient(
  cookieStore: CookieStore,
  response: NextResponse,
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createSSRServerClient<Database>(supabaseUrl, anonKey, {
    auth: SERVER_AUTH_OPTIONS,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}
