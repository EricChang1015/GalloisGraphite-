"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowedAvatarUrl } from "@/lib/profile/avatar";
import {
  CommercialProfileSchema,
  type CommercialProfileInput,
} from "@/lib/validations/auth";
import {
  isSupportedLocale,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  SUPPORTED_LOCALES,
  type Locale,
} from "@/i18n/config";
import type { ActionResult } from "./auth";

const AvatarUrlSchema = z.object({
  avatarUrl: z.string().url().max(2048),
});

const LocaleSchema = z.object({
  locale: z.enum(SUPPORTED_LOCALES as readonly [Locale, ...Locale[]]),
});

/**
 * Update the current user's commercial profile fields (full_name,
 * company_name, country, phone). Used by:
 *   - `/settings` page (canonical entry)
 *   - the lazy-collect prompt that fires when buyer / seller hits a
 *     gated server action with an incomplete profile (planned, see
 *     ROADMAP §A6)
 *
 * Email / role / status / kyc_level / kyc_docs are intentionally NOT
 * editable here — those go through admin actions.
 */
export async function updateCommercialProfile(
  input: CommercialProfileInput
): Promise<ActionResult<true>> {
  const parsed = CommercialProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: {
        message: "Please check the highlighted fields.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      },
    };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { data: null, error: { message: "Not authenticated." } };
  }

  // Use admin client so that we can update fields the regular RLS
  // policy ("profiles_self_update") may not cover historically.
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      company_name: parsed.data.company_name,
      country: parsed.data.country,
      phone: parsed.data.phone ?? null,
    })
    .eq("id", user.id);

  if (error) return { data: null, error: { message: error.message } };

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { data: true, error: null };
}

/**
 * Persist the public URL of the user's avatar (Supabase Storage or, for
 * OAuth-only users who have not uploaded yet, a provider photo URL synced
 * at signup).
 */
export async function updateProfileAvatar(
  avatarUrl: string
): Promise<ActionResult<true>> {
  const parsed = AvatarUrlSchema.safeParse({ avatarUrl });
  if (!parsed.success) {
    return { data: null, error: { message: "Invalid avatar URL." } };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { data: null, error: { message: "Not authenticated." } };
  }

  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!projectUrl) {
    return { data: null, error: { message: "Storage is not configured." } };
  }

  if (!isAllowedAvatarUrl(parsed.data.avatarUrl, projectUrl)) {
    return { data: null, error: { message: "Avatar URL is not allowed." } };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ avatar_url: parsed.data.avatarUrl })
    .eq("id", user.id);

  if (error) return { data: null, error: { message: error.message } };

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/messages");
  return { data: true, error: null };
}

/**
 * Persist the user's preferred UI language. Writes both `profiles.locale`
 * (survives device changes) and the `mg-locale` cookie (so unauthenticated
 * navigations on the same browser stay consistent until they log in
 * elsewhere).
 *
 * Decision (see docs/I18N_PLAN.md): contracts and email/SMS notifications
 * always render English, so this setting only impacts dashboard UI chrome.
 */
export async function updateProfileLocale(
  input: { locale: Locale }
): Promise<ActionResult<true>> {
  const parsed = LocaleSchema.safeParse(input);
  if (!parsed.success) {
    return { data: null, error: { message: "Unsupported locale." } };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { data: null, error: { message: "Not authenticated." } };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ locale: parsed.data.locale })
    .eq("id", user.id);

  if (error) return { data: null, error: { message: error.message } };

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, parsed.data.locale, {
    maxAge: LOCALE_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  revalidatePath("/", "layout");
  return { data: true, error: null };
}

/**
 * Helper used by client islands (e.g. an inline language switcher) when we
 * accept the locale as a raw string from a `<select>` value. Re-validates
 * via `LocaleSchema`. Re-uses `updateProfileLocale` for the write.
 */
export async function setLocaleFromString(
  value: string
): Promise<ActionResult<true>> {
  if (!isSupportedLocale(value)) {
    return { data: null, error: { message: "Unsupported locale." } };
  }
  return updateProfileLocale({ locale: value });
}

/**
 * Persist locale for public/guest surfaces only. Unlike
 * `updateProfileLocale`, this intentionally avoids touching `profiles.locale`
 * so unauthenticated visitors can switch language from the public navbar.
 */
export async function setLocaleCookieOnly(
  value: string
): Promise<ActionResult<true>> {
  const parsed = LocaleSchema.safeParse({ locale: value });
  if (!parsed.success) {
    return { data: null, error: { message: "Unsupported locale." } };
  }

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, parsed.data.locale, {
    maxAge: LOCALE_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  revalidatePath("/", "layout");
  return { data: true, error: null };
}

/** Remove custom avatar; initials fallback is shown in the UI. */
export async function clearProfileAvatar(): Promise<ActionResult<true>> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { data: null, error: { message: "Not authenticated." } };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", user.id);

  if (error) return { data: null, error: { message: error.message } };

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/messages");
  return { data: true, error: null };
}
