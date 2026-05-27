import type { OrderStatus } from "@/lib/order/stateMachine";

export const ORDER_DETAIL_TABS = [
  "overview",
  "quotation",
  "contract",
  "payment",
  "shipment",
  "documents",
  "timeline",
] as const;

export type OrderDetailTab = (typeof ORDER_DETAIL_TABS)[number];

export function isOrderDetailTab(value: string | undefined): value is OrderDetailTab {
  return !!value && (ORDER_DETAIL_TABS as readonly string[]).includes(value);
}

export type SuggestedTabContract = {
  exists: boolean;
  buyer_approved_at: string | null;
  buyer_rejected_at: string | null;
  buyer_signed_url: string | null;
  seller_signed_url: string | null;
};

export type SuggestedTabInput = {
  status: OrderStatus;
  role: "buyer" | "seller" | "admin";
  contract: SuggestedTabContract | null;
  schedules: { id: string; status: string }[];
  payments: { status: string; schedule_id: string | null }[];
};

/**
 * Pick the tab where the current user most likely needs to act next.
 * Used when `/orders/[id]` is opened without an explicit `?tab=` query.
 */
export function getSuggestedOrderTab(input: SuggestedTabInput): OrderDetailTab {
  const { status, role, contract, schedules, payments } = input;

  if (status === "cancelled" || status === "completed") {
    return "overview";
  }

  if (role === "admin") {
    if (payments.some((p) => p.status === "pending")) return "payment";
    if (status === "disputed") return "overview";
    return "overview";
  }

  if (role === "seller") {
    if (
      payments.some((p) => p.status === "pending") ||
      schedules.some((s) => s.status === "awaiting_review")
    ) {
      return "payment";
    }

    if (status === "contract_pending") {
      if (!contract?.exists || contract.buyer_rejected_at) return "contract";
      if (contract.buyer_approved_at && !contract.seller_signed_url) return "contract";
    }

    if (status === "ready_to_ship") return "shipment";

    if (
      contract?.exists &&
      contract.buyer_approved_at &&
      (!contract.buyer_signed_url || !contract.seller_signed_url)
    ) {
      return "contract";
    }

    return "overview";
  }

  // buyer
  const hasPayableInstallment = schedules.some(
    (s) =>
      s.status === "due" ||
      s.status === "overdue" ||
      s.status === "scheduled"
  );
  if (hasPayableInstallment) return "payment";

  if (status === "contract_pending" && contract?.exists) {
    if (!contract.buyer_approved_at || contract.buyer_rejected_at) return "contract";
    if (!contract.buyer_signed_url) return "contract";
  }

  if (status === "arrived") return "overview";

  return "overview";
}

/** Schedules whose last submission was rejected and are open for buyer resubmit. */
export function getSchedulesNeedingPaymentResubmit(
  schedules: { id: string; status: string }[],
  payments: { status: string; schedule_id: string | null }[]
): string[] {
  const rejectedScheduleIds = new Set(
    payments
      .filter((p) => p.status === "rejected" && p.schedule_id)
      .map((p) => p.schedule_id as string)
  );
  return schedules
    .filter(
      (s) =>
        rejectedScheduleIds.has(s.id) &&
        (s.status === "due" || s.status === "overdue")
    )
    .map((s) => s.id);
}
