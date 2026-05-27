import "server-only";

import { cookies, headers } from "next/headers";
import { cache } from "react";

import { createServerClient } from "@/lib/supabase/server";

import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  LOCALE_COOKIE,
  pickAcceptLanguage,
  type Locale,
} from "./config";

/**
 * Resolve the current request's locale.
 *
 * Priority:
 *   1. Cookie  `mg-locale` — user explicitly chose, survives navigation
 *   2. DB      `profiles.locale` — survives device changes (only when signed in)
 *   3. Header  `Accept-Language` — first-time visit fallback
 *   4. Default `en`
 *
 * Cached per request so layout + page + components all see the same value
 * without re-running the Supabase round-trip.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isSupportedLocale(cookieValue)) return cookieValue;

  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("locale")
        .eq("id", user.id)
        .maybeSingle<{ locale: string | null }>();
      if (data?.locale && isSupportedLocale(data.locale)) return data.locale;
    }
  } catch {
    // Don't let auth/DB problems block rendering — fall through to header.
  }

  const headerStore = await headers();
  const fromHeader = pickAcceptLanguage(headerStore.get("accept-language"));
  if (fromHeader) return fromHeader;

  return DEFAULT_LOCALE;
});
