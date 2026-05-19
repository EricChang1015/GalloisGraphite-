import "server-only";

import { cache } from "react";

import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findCommercialProfileGaps } from "@/lib/auth/commercial";

/**
 * Map of `orders.status` → which party (buyer / seller / admin / no-one) is
 * the next blocker. Used to compute "needs my action" counts and badges in
 * the sidebars + dashboards.
 *
 * Statuses that auto-advance (e.g. `contract_signed`, `customs_cleared`)
 * resolve to `"none"` — they should not normally linger in those values.
 * Quotation-phase statuses (`quotation_pending`, `quoted`, `negotiating`)
 * surface through the Inquiries page, not the Orders page, so they are
 * also `"none"` here.
 */
export type OrderActionOwner = "buyer" | "seller" | "admin" | "none";

const BUYER_ACTION_STATUSES = [
  "contract_pending", // approve / counter / sign
  "payment_pending", // submit payment (full_prepay OR net_after_arrival final)
  "arrived", // mark customs cleared
] as const;

const SELLER_ACTION_STATUSES = [
  "paid", // mark in production
  "in_production", // mark ready to ship
  "ready_to_ship", // mark shipped
  "shipped", // mark in transit / arrived
  "in_transit", // mark arrived
] as const;

const ADMIN_ACTION_STATUSES = ["disputed"] as const;

export function getOrderActionOwner(status: string): OrderActionOwner {
  if ((BUYER_ACTION_STATUSES as readonly string[]).includes(status)) return "buyer";
  if ((SELLER_ACTION_STATUSES as readonly string[]).includes(status)) return "seller";
  if ((ADMIN_ACTION_STATUSES as readonly string[]).includes(status)) return "admin";
  return "none";
}

/**
 * Short human label for the "Your turn / Awaiting other side" hint on the
 * Active Orders list in the dashboard. Returns null for statuses where no
 * single party is blocking.
 */
export function describeOrderAction(
  status: string,
  myRole: "buyer" | "seller"
): string | null {
  const owner = getOrderActionOwner(status);
  if (owner === "admin") return "Awaiting admin";
  if (owner === "none") return null;
  if (owner !== myRole) return "Awaiting counterparty";

  switch (status) {
    case "contract_pending":
      return myRole === "buyer" ? "Review the contract" : "Awaiting buyer review";
    case "payment_pending":
      return myRole === "buyer" ? "Submit payment" : "Awaiting buyer payment";
    case "arrived":
      return myRole === "buyer" ? "Confirm customs cleared" : "Awaiting customs";
    case "paid":
      return myRole === "seller" ? "Mark in production" : null;
    case "in_production":
      return myRole === "seller" ? "Mark ready to ship" : null;
    case "ready_to_ship":
      return myRole === "seller" ? "Ship + add B/L" : null;
    case "shipped":
      return myRole === "seller" ? "Mark in transit / arrived" : null;
    case "in_transit":
      return myRole === "seller" ? "Mark arrived" : null;
    default:
      return null;
  }
}

// =====================================================================
// User-side counts
// =====================================================================

export type UserActionCounts = {
  inquiriesNeedingMyResponse: number;
  ordersNeedingMyAction: number;
  ordersDisputed: number;
  profileIncomplete: boolean;
};

const EMPTY_USER_COUNTS: UserActionCounts = {
  inquiriesNeedingMyResponse: 0,
  ordersNeedingMyAction: 0,
  ordersDisputed: 0,
  profileIncomplete: false,
};

/**
 * Aggregate the four "needs my action" counters for the current user.
 * Memoized per request via `cache()` so the sidebar + dashboard share a
 * single round-trip.
 *
 * Inquiry logic (kept simple for v1; the latest quotation's `countered_by`
 * could refine this further, but the existing `inquiries.status` values
 * are already party-aware):
 *   - seller: count `inquiries` where seller_id=me AND status IN
 *     ('pending', 'negotiating') — pending = first quotation owed,
 *     negotiating = counter-offer to respond to.
 *   - buyer: count `inquiries` where buyer_id=me AND status IN
 *     ('quoted', 'negotiating') — quoted = seller's quotation awaiting
 *     buyer's accept/counter/reject.
 *
 * Order logic uses `getOrderActionOwner` per row.
 */
export const getUserActionCounts = cache(
  async (
    userId: string,
    role: "buyer" | "seller" | "admin" | "super_admin"
  ): Promise<UserActionCounts> => {
    if (!userId) return EMPTY_USER_COUNTS;

    const supabase = await createServerClient();

    const inquiryStatuses: ("pending" | "quoted" | "negotiating")[] =
      role === "buyer"
        ? ["quoted", "negotiating"]
        : role === "seller"
          ? ["pending", "negotiating"]
          : []; // admins don't have inquiries of their own
    const inquiryCol = role === "buyer" ? "buyer_id" : "seller_id";

    const inquiryPromise =
      inquiryStatuses.length > 0
        ? supabase
            .from("inquiries")
            .select("id", { count: "exact", head: true })
            .eq(inquiryCol, userId)
            .in("status", inquiryStatuses)
        : Promise.resolve({ count: 0 });

    const [inquiryRes, ordersRes, disputedRes, missing] = await Promise.all([
      inquiryPromise,
      supabase
        .from("orders")
        .select("status, buyer_id, seller_id")
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .in("status", [
          ...BUYER_ACTION_STATUSES,
          ...SELLER_ACTION_STATUSES,
        ])
        .returns<{ status: string; buyer_id: string; seller_id: string }[]>(),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .eq("status", "disputed"),
      findCommercialProfileGaps(userId),
    ]);

    let ordersNeedingMyAction = 0;
    for (const o of ordersRes.data ?? []) {
      if (
        o.buyer_id === userId &&
        (BUYER_ACTION_STATUSES as readonly string[]).includes(o.status)
      ) {
        ordersNeedingMyAction++;
      } else if (
        o.seller_id === userId &&
        (SELLER_ACTION_STATUSES as readonly string[]).includes(o.status)
      ) {
        ordersNeedingMyAction++;
      }
    }

    return {
      inquiriesNeedingMyResponse: inquiryRes.count ?? 0,
      ordersNeedingMyAction,
      ordersDisputed: disputedRes.count ?? 0,
      profileIncomplete: missing.length > 0,
    };
  }
);

// =====================================================================
// Admin-side counts
// =====================================================================

export type AdminActionCounts = {
  paymentsPending: number;
  ordersDisputed: number;
};

export const getAdminActionCounts = cache(async (): Promise<AdminActionCounts> => {
  const admin = createAdminClient();
  const [paymentsRes, disputedRes] = await Promise.all([
    admin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "disputed"),
  ]);
  return {
    paymentsPending: paymentsRes.count ?? 0,
    ordersDisputed: disputedRes.count ?? 0,
  };
});
