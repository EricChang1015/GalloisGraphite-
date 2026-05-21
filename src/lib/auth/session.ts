import "server-only";

import { cache } from "react";

import { createServerClient } from "@/lib/supabase/server";
import { isRecoverableAuthError } from "@/lib/supabase/auth-config";
import type { Database } from "@/types/database";

export type AuthUser = Awaited<
  ReturnType<
    Awaited<ReturnType<typeof createServerClient>>["auth"]["getUser"]
  >
>["data"]["user"];

export type SessionProfile = {
  role: Database["public"]["Enums"]["user_role"];
  status: Database["public"]["Enums"]["user_status"];
  full_name: string | null;
  company_name: string | null;
  avatar_url: string | null;
};

/**
 * Per-request memoized accessor for the Supabase auth user. Wrapping
 * `auth.getUser()` in `cache()` lets multiple server components in the
 * same render share a single auth round-trip — handy for layouts plus
 * pages that both need the session.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser> => {
  const supabase = await createServerClient();
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      if (isRecoverableAuthError(error)) {
        try {
          await supabase.auth.signOut();
        } catch {
          // ignore
        }
      }
      return null;
    }
    return data.user;
  } catch {
    return null;
  }
});

/**
 * Per-request memoized profile lookup. Returns `null` for anonymous
 * users or when the row hasn't been provisioned yet (e.g. just-after
 * OAuth signup before the trigger fires) — `maybeSingle()` keeps that
 * case from logging a "no rows" error.
 */
export const getCurrentProfile = cache(
  async (): Promise<SessionProfile | null> => {
    const user = await getCurrentUser();
    if (!user) return null;
    const supabase = await createServerClient();
    const { data } = await supabase
      .from("profiles")
      .select("role, status, full_name, company_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle<SessionProfile>();
    return data;
  }
);

export function isAdminRole(
  role: Database["public"]["Enums"]["user_role"] | null | undefined
): boolean {
  return role === "admin" || role === "super_admin";
}
