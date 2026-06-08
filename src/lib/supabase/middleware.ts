import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database";
import {
  isRecoverableAuthError,
  SERVER_AUTH_OPTIONS,
} from "@/lib/supabase/auth-config";

type RawCookie = { name: string; value: string };

const AUTH_CHUNK_PATTERN = /^(sb-.+-auth-token)(?:\.(\d+))?$/;

/**
 * Validate Supabase auth cookies by *grouping chunks first* and then
 * inspecting the combined value. Large sessions are split across
 * `sb-…-auth-token.0`, `.1`, `.2`… — only the first chunk carries the
 * `base64-` prefix, so individual chunks **cannot** be validated in
 * isolation (doing so was an earlier bug that broke OAuth sign-in).
 *
 * Returns the cookies that should be forwarded to Supabase and the names
 * of every cookie that belongs to a corrupt group (so we can clear them
 * from both the incoming request and the outgoing response).
 *
 * Healthy combined values are either the new `base64-…` envelope or a
 * raw JSON document. Anything else triggers the "Unexpected non-whitespace
 * character after JSON …" rejection deep inside `@supabase/ssr`.
 */
function sanitizeSupabaseCookies(cookies: RawCookie[]): {
  safe: RawCookie[];
  corruptNames: string[];
} {
  const groups = new Map<string, RawCookie[]>();
  const safe: RawCookie[] = [];

  for (const cookie of cookies) {
    const match = AUTH_CHUNK_PATTERN.exec(cookie.name);
    if (!match) {
      safe.push(cookie);
      continue;
    }
    const base = match[1];
    const list = groups.get(base) ?? [];
    list.push(cookie);
    groups.set(base, list);
  }

  const corruptNames: string[] = [];

  for (const [, chunks] of groups) {
    chunks.sort((a, b) => {
      const ai = Number(AUTH_CHUNK_PATTERN.exec(a.name)?.[2] ?? -1);
      const bi = Number(AUTH_CHUNK_PATTERN.exec(b.name)?.[2] ?? -1);
      return ai - bi;
    });
    const combined = chunks.map((c) => c.value).join("");

    let ok = false;
    if (combined.startsWith("base64-")) {
      ok = true;
    } else if (combined.startsWith("{") || combined.startsWith("[")) {
      try {
        JSON.parse(combined);
        ok = true;
      } catch {
        ok = false;
      }
    }

    if (ok) {
      safe.push(...chunks);
    } else {
      for (const c of chunks) corruptNames.push(c.name);
    }
  }

  return { safe, corruptNames };
}

/**
 * Refreshes the Supabase session cookie for every request.
 *
 * Called from the top-level `src/proxy.ts` (formerly `middleware.ts` in older
 * Next.js versions).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Allow the project to boot even before .env.local is populated. This is
  // useful during scaffolding — the proxy simply becomes a no-op.
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !anonKey) {
    return { response, user: null, supabase: null as never };
  }

  // Strip corrupt auth cookies before passing them to Supabase so its
  // internal background refresh doesn't throw an unhandled JSON.parse
  // rejection. Chunked cookies are grouped + re-assembled first so we
  // don't accidentally drop legitimate `.1`, `.2`… chunks (which on
  // their own are just opaque base64 tail bytes).
  const { safe: safeCookies, corruptNames } = sanitizeSupabaseCookies(
    request.cookies.getAll().map((c) => ({ name: c.name, value: c.value }))
  );
  for (const name of corruptNames) {
    request.cookies.delete(name);
    response.cookies.delete(name);
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey,
    {
      auth: SERVER_AUTH_OPTIONS,
      cookies: {
        getAll() {
          return safeCookies;
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Touch the session so cookies are refreshed when needed.
  // Wrap in try/catch: malformed session cookies or non-JSON Supabase
  // responses (e.g. network errors, expired JWTs with corrupt payloads)
  // would otherwise surface as an unhandledRejection and crash the request.
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] =
    null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      if (isRecoverableAuthError(error)) {
        try {
          await supabase.auth.signOut();
        } catch {
          // ignore sign-out failures
        }
      }
      user = null;
    } else {
      user = data.user;
    }
  } catch {
    // Treat any auth error as "not authenticated" — the user will be
    // redirected to /login and can sign in again to get a fresh session.
    user = null;
  }

  return { response, user, supabase };
}
