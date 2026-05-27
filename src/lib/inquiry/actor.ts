import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Snapshot of the currently-live (status='sent') quotation on an inquiry,
 * keyed by inquiry id. Used by list-style pages that need to render
 * actor-aware action buttons without round-tripping the detail page.
 *
 * `created_by` is the proposer (set by 027). For inquiries with no
 * quotation yet (status='pending'), there is no entry in the map — the
 * inquiry is implicitly seller-actionable.
 */
export type LiveQuotation = {
  id: string;
  inquiry_id: string;
  created_by: string;
  unit_price: number;
  currency: string;
};

/**
 * Fetch the live quotation for each of the given inquiry IDs. Returns a
 * map keyed by `inquiry_id`. Inquiries without a `sent` quotation are
 * absent from the map.
 *
 * Schema invariant: at most one `sent` quotation per inquiry — guaranteed
 * by `submitQuotation` / `counterQuotation` marking the prior live one
 * as `superseded` / `countered`.
 */
export async function getLiveQuotationsByInquiry(
  supabase: SupabaseClient<Database>,
  inquiryIds: string[]
): Promise<Map<string, LiveQuotation>> {
  if (inquiryIds.length === 0) return new Map();
  const { data } = await supabase
    .from("quotations")
    .select("id, inquiry_id, created_by, unit_price, currency")
    .in("inquiry_id", inquiryIds)
    .eq("status", "sent")
    .returns<
      {
        id: string;
        inquiry_id: string | null;
        created_by: string;
        unit_price: number;
        currency: string;
      }[]
    >();
  const map = new Map<string, LiveQuotation>();
  for (const row of data ?? []) {
    if (!row.inquiry_id) continue;
    map.set(row.inquiry_id, {
      id: row.id,
      inquiry_id: row.inquiry_id,
      created_by: row.created_by,
      unit_price: row.unit_price,
      currency: row.currency,
    });
  }
  return map;
}

export type InquiryTurn =
  /** Seller hasn't sent a first quotation yet — seller's turn to quote. */
  | "seller-quote"
  /** Live quotation exists; the OTHER party (me) needs to act. */
  | "my-review"
  /** Live quotation exists; I sent it — waiting for the other side. */
  | "their-review"
  /** Inquiry is closed — no actor. */
  | "none";

/**
 * Compute whose turn it is on a given inquiry from the perspective of
 * `userId`. Drives the action column on `/inquiries` and any other
 * list-style surface that mixes both sides of the negotiation.
 */
export function classifyInquiryTurn(
  inquiry: { status: string; seller_id: string; buyer_id: string },
  liveQuotation: LiveQuotation | undefined,
  userId: string
): InquiryTurn {
  if (
    inquiry.status === "rejected" ||
    inquiry.status === "converted" ||
    inquiry.status === "expired" ||
    inquiry.status === "accepted"
  ) {
    return "none";
  }
  if (!liveQuotation) {
    // No quotation yet → seller is owed the first response.
    return userId === inquiry.seller_id ? "seller-quote" : "their-review";
  }
  return liveQuotation.created_by === userId ? "their-review" : "my-review";
}
