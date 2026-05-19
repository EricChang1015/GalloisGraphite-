import "server-only";

import { createServerClient } from "@/lib/supabase/server";

export type CommercialProfileGap = {
  /** Field names that are still missing on `profiles`. */
  fields: ("company_name" | "country")[];
};

/**
 * Inspect a user's `profiles` row and return the list of commercial fields
 * that still need to be filled in before they can transact (submit an
 * inquiry, create a listing, or make a payment).
 *
 * Google OAuth users land with `company_name=''` and `country=''` because
 * Google's ID token doesn't include those — we deliberately defer the
 * collection to the first commercial action (lazy-collect, see
 * ROADMAP §A6).
 *
 * Returns an empty list when nothing is missing.
 */
export async function findCommercialProfileGaps(
  userId: string
): Promise<CommercialProfileGap["fields"]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("company_name, country")
    .eq("id", userId)
    .maybeSingle<{ company_name: string | null; country: string | null }>();

  if (!data) return ["company_name", "country"];

  const missing: CommercialProfileGap["fields"] = [];
  if (!data.company_name || data.company_name.trim() === "") {
    missing.push("company_name");
  }
  if (!data.country || data.country.trim() === "") {
    missing.push("country");
  }
  return missing;
}

/**
 * Convenience message used by server actions when the gate fails. Tells
 * the user exactly which fields are missing and where to fill them in.
 */
export function describeCommercialGap(
  missing: CommercialProfileGap["fields"]
): string {
  if (missing.length === 0) return "";
  const labels = missing.map((f) =>
    f === "company_name" ? "company name" : "country"
  );
  const list = labels.length === 1 ? labels[0] : labels.join(" and ");
  return `Please add your ${list} on the Settings page before continuing.`;
}
