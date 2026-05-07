import "server-only";

import { createServerClient as createSSRServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/database";

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
          return cookieStore.getAll();
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
