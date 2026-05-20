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
 * Short human label for the "Your turn / Awaiting other side" hint on the
 * Active Orders list in the dashboard. Returns null for statuses where no
 * single party is blocking. Payment-related rows now surface separately
 * via the schedule count, so they're not handled here.
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

    const inquiryStatuses: ("pending" | "quoted" | "negotiating")[] =
      role === "buyer"
        ? ["quoted", "negotiating"]
        : role === "seller"
          ? ["pending", "negotiating"]
          : [];
    const inquiryCol = role === "buyer" ? "buyer_id" : "seller_id";

    const inquiryPromise =
      inquiryStatuses.length > 0
        ? supabase
            .from("inquiries")
            .select("id", { count: "exact", head: true })
            .eq(inquiryCol, userId)
            .in("status", inquiryStatuses)
        : Promise.resolve({ count: 0 });

    // Outstanding payment installments only apply to buyers (sellers
    // don't submit payment). We count distinct orders so multiple due
    // installments on one order still only ping once.
    const duePaymentOrdersPromise =
      role === "buyer"
        ? supabase
            .from("payment_schedules")
            .select("order_id, orders!inner(buyer_id)")
            .in("status", ["due", "overdue"])
            .eq("orders.buyer_id", userId)
            .returns<{ order_id: string }[]>()
        : Promise.resolve({ data: [] as { order_id: string }[] });

    const [inquiryRes, ordersRes, disputedRes, missing, duePayments] = await Promise.all([
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
