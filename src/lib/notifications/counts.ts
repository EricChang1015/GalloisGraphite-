import "server-only";

import { cache } from "react";

import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findCommercialProfileGaps } from "@/lib/auth/commercial";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Map of `orders.status` → which party (buyer / seller / admin / no-one) is
 * the next blocker. Used to compute "needs my action" counts and badges in
 * the sidebars + dashboards.
 *
 * Post-014 cutover: payment is no longer a state on the order timeline.
 * `payment_pending` / `paid` were removed from the buyer/seller action
 * sets — outstanding payments are counted separately by querying
 * `payment_schedules` rows in `due` / `overdue` status.
 */
export type OrderActionOwner = "buyer" | "seller" | "admin" | "none";

const BUYER_ACTION_STATUSES = [
  "contract_pending", // approve / counter / sign
  "arrived", // mark customs cleared
] as const;

const SELLER_ACTION_STATUSES = [
  "contract_signed", // mark in production (auto in most flows, but fallback)
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
 * Translation key (relative to the `enums` namespace) describing the next
 * action on an order from `myRole`'s perspective. Returns `null` when no
 * party is currently blocking from this side.
 *
 * Use with `useTranslations('enums')` / `getTranslations('enums')`:
 *
 *   const key = describeOrderActionKey(o.status, role);
 *   const label = key ? t(key) : null;
 *
 * Centralised here so the dashboard, sidebar badges, mobile drawer, and
 * any future channel (email, push) share the same logic and translation
 * surface. The string-returning variant `describeOrderAction` is kept as a
 * thin wrapper for legacy callers and English-only fallbacks.
 */
export type OrderActionKey =
  | "order.action.awaitingAdmin"
  | "order.action.awaitingCounterparty"
  | "order.action.reviewContract"
  | "order.action.awaitingBuyerReview"
  | "order.action.confirmCustomsCleared"
  | "order.action.awaitingCustoms"
  | "order.action.markInProduction"
  | "order.action.markReadyToShip"
  | "order.action.shipAndAddBL"
  | "order.action.markInTransitOrArrived"
  | "order.action.markArrived";

export function describeOrderActionKey(
  status: string,
  myRole: "buyer" | "seller"
): OrderActionKey | null {
  const owner = getOrderActionOwner(status);
  if (owner === "admin") return "order.action.awaitingAdmin";
  if (owner === "none") return null;
  if (owner !== myRole) return "order.action.awaitingCounterparty";

  switch (status) {
    case "contract_pending":
      return myRole === "buyer"
        ? "order.action.reviewContract"
        : "order.action.awaitingBuyerReview";
    case "arrived":
      return myRole === "buyer"
        ? "order.action.confirmCustomsCleared"
        : "order.action.awaitingCustoms";
    case "contract_signed":
      return myRole === "seller" ? "order.action.markInProduction" : null;
    case "in_production":
      return myRole === "seller" ? "order.action.markReadyToShip" : null;
    case "ready_to_ship":
      return myRole === "seller" ? "order.action.shipAndAddBL" : null;
    case "shipped":
      return myRole === "seller" ? "order.action.markInTransitOrArrived" : null;
    case "in_transit":
      return myRole === "seller" ? "order.action.markArrived" : null;
    default:
      return null;
  }
}

/**
 * @deprecated Prefer `describeOrderActionKey` + i18n. Kept temporarily for
 * legacy English-only callers (e.g. server-side email body assembly which is
 * intentionally English per docs/I18N_PLAN.md).
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
    case "arrived":
      return myRole === "buyer" ? "Confirm customs cleared" : "Awaiting customs";
    case "contract_signed":
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
// Inquiry actor logic — single source of truth
// =====================================================================

/**
 * Returns the set of inquiry IDs where it is currently `userId`'s turn to
 * respond, given their `role`. Combines two sources:
 *
 *   1. `inquiries.status = 'pending'` AND no quotation yet → seller's turn
 *      (only counted when `role === 'seller'`).
 *   2. `inquiries.status IN ('quoted','negotiating')` with a live quotation
 *      whose `created_by` is the OTHER party → my turn (counted for both
 *      buyer and seller).
 *
 * Driven by `quotations.created_by` (added in 027). The previous
 * status-only logic was wrong: `status='negotiating'` only tells us a
 * negotiation is in progress, not who is currently waiting on whom. After
 * 027 we always have an unambiguous answer.
 */
export async function getInquiriesNeedingMyResponse(
  supabase: SupabaseClient<Database>,
  userId: string,
  role: "buyer" | "seller" | "admin" | "super_admin"
): Promise<Set<string>> {
  if (role !== "buyer" && role !== "seller") return new Set();
  const ids = new Set<string>();

  if (role === "seller") {
    const { data } = await supabase
      .from("inquiries")
      .select("id")
      .eq("seller_id", userId)
      .eq("status", "pending")
      .returns<{ id: string }[]>();
    for (const row of data ?? []) ids.add(row.id);
  }

  const liveCol = role === "buyer" ? "buyer_id" : "seller_id";
  const { data: liveQs } = await supabase
    .from("quotations")
    .select("inquiry_id, inquiries!inner(status)")
    .eq("status", "sent")
    .eq(liveCol, userId)
    .neq("created_by", userId)
    .in("inquiries.status", ["quoted", "negotiating"])
    .returns<{ inquiry_id: string }[]>();
  for (const row of liveQs ?? []) {
    if (row.inquiry_id) ids.add(row.inquiry_id);
  }

  return ids;
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

export const getUserActionCounts = cache(
  async (
    userId: string,
    role: "buyer" | "seller" | "admin" | "super_admin"
  ): Promise<UserActionCounts> => {
    if (!userId) return EMPTY_USER_COUNTS;

    const supabase = await createServerClient();

    const inquiryPromise = getInquiriesNeedingMyResponse(supabase, userId, role).then(
      (ids) => ({ count: ids.size })
    );

    // Outstanding payment installments only apply to buyers (sellers
    // don't submit payment). We count distinct orders so multiple due
    // installments on one order still only ping once.
    const duePaymentOrdersPromise =
      role === "buyer"
        ? supabase
            .from("payment_schedules")
            .select("order_id, orders!inner(buyer_id, status)")
            .in("status", ["due", "overdue"])
            .eq("orders.buyer_id", userId)
            .not("orders.status", "in", "(cancelled,completed)")
            .returns<{ order_id: string }[]>()
        : Promise.resolve({ data: [] as { order_id: string }[] });

    // Payments awaiting seller review (seller is now primary reviewer
    // post-015). Count distinct orders so a multi-payment order pings
    // once. Skip cancelled / completed orders — they no longer need action.
    const sellerPaymentReviewPromise =
      role === "seller"
        ? supabase
            .from("payments")
            .select("order_id, orders!inner(seller_id, status)")
            .eq("status", "pending")
            .eq("orders.seller_id", userId)
            .not("orders.status", "in", "(cancelled,completed)")
            .returns<{ order_id: string }[]>()
        : Promise.resolve({ data: [] as { order_id: string }[] });

    const [
      inquiryRes,
      ordersRes,
      disputedRes,
      missing,
      duePayments,
      sellerPaymentReviews,
    ] = await Promise.all([
      inquiryPromise,
      supabase
        .from("orders")
        .select("status, buyer_id, seller_id")
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .in("status", [...BUYER_ACTION_STATUSES, ...SELLER_ACTION_STATUSES])
        .returns<{ status: string; buyer_id: string; seller_id: string }[]>(),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .eq("status", "disputed"),
      findCommercialProfileGaps(userId),
      duePaymentOrdersPromise,
      sellerPaymentReviewPromise,
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

    if (role === "buyer") {
      const orderIds = new Set((duePayments.data ?? []).map((r) => r.order_id));
      ordersNeedingMyAction += orderIds.size;
    }

    if (role === "seller") {
      const orderIds = new Set((sellerPaymentReviews.data ?? []).map((r) => r.order_id));
      ordersNeedingMyAction += orderIds.size;
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
