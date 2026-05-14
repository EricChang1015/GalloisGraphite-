import "server-only";

import { createServerClient as createSSRServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/database";

type RawCookie = { name: string; value: string };

const AUTH_CHUNK_PATTERN = /^(sb-.+-auth-token)(?:\.(\d+))?$/;

/**
 * Filter out Supabase auth cookies whose *combined* value would not parse
 * cleanly. Mirrors the helper in `middleware.ts`; kept duplicated to
 * avoid pulling `next/server` types into a server-only module.
 *
 * Critically, chunked cookies (`.0`, `.1`, …) are grouped together and
 * validated against their concatenation, because only the first chunk
 * carries the `base64-` envelope.
 */
function sanitizeSupabaseCookies(cookies: RawCookie[]): RawCookie[] {
  const groups = new Map<string, RawCookie[]>();
  const out: RawCookie[] = [];

  for (const cookie of cookies) {
    const match = AUTH_CHUNK_PATTERN.exec(cookie.name);
    if (!match) {
      out.push(cookie);
      continue;
    }
    const base = match[1];
    const list = groups.get(base) ?? [];
    list.push(cookie);
    groups.set(base, list);
  }

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
    if (ok) out.push(...chunks);
  }

  return out;
}

/**
 * Use this client inside Server Components, Server Actions, and Route
 * Handlers. It reads/writes auth cookies via Next.js `cookies()` API.
 */
export async function createServerClient() {
  const cookieStore = await cookies();

  return createSSRServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // Sanitize auth cookies (validate combined chunks) so
          // Supabase's background refresh never tries to JSON.parse
          // garbage values — that would surface as an
          // unhandledRejection in dev.
          return sanitizeSupabaseCookies(
            cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }))
          );
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Cookies cannot be set inside Server Components — that's fine,
            // the middleware refreshes the session in those cases.
          }
        },
      },
    }
  );
}
