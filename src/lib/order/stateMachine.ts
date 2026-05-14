import type { Database } from "@/types/database";

export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type PaymentTermsType = Database["public"]["Enums"]["payment_terms_type"];

/**
 * Forward transitions that are valid regardless of payment_terms.
 *
 * The "after-signed" branch is intentionally OMITTED here — see
 * `getBranchTransitions()` for branch-specific rules that depend on
 * `orders.payment_terms`.
 */
const COMMON_FORWARD: Partial<Record<OrderStatus, OrderStatus[]>> = {
  // Quotation phase
  quotation_pending: ["quoted", "cancelled"],
  draft: ["quoted", "contract_pending", "cancelled"],
  quoted: ["negotiating", "contract_pending", "rejected" as OrderStatus, "cancelled"],
  negotiating: ["quoted", "contract_pending", "cancelled"],

  // Contract phase (re-draft loop allowed: contract_pending → contract_pending
  // is modeled by bumping `contracts.revision_no` rather than a self-edge).
  contract_pending: ["contract_signed", "cancelled"],

  // Legacy alias retained for any historical rows that may still hold the
  // old `contract_generated` value.
  contract_generated: ["contract_signed", "cancelled"],

  // Shipping / arrival phase (shared by both branches)
  in_production: ["ready_to_ship", "disputed", "cancelled"],
  ready_to_ship: ["shipped", "disputed", "cancelled"],
  shipped: ["in_transit", "arrived", "disputed"],
  in_transit: ["arrived", "disputed"],
  arrived: ["customs_cleared", "disputed"],

  // Terminal states
  completed: [],
  disputed: ["cancelled", "completed"],
  cancelled: [],
};

/**
 * Branch-specific transitions for states that appear at different positions
 * depending on `payment_terms`:
 *   - full_prepay:        contract_signed → payment_pending → paid → in_production
 *                          customs_cleared → completed
 *   - net_after_arrival:  contract_signed → in_production
 *                          customs_cleared → payment_pending → paid → completed
 */
function getBranchTransitions(
  paymentTerms: PaymentTermsType | null | undefined
): Partial<Record<OrderStatus, OrderStatus[]>> {
  if (paymentTerms === "net_after_arrival") {
    return {
      contract_signed: ["in_production", "disputed", "cancelled"],
      customs_cleared: ["payment_pending", "completed", "disputed"],
      payment_pending: ["paid", "disputed", "cancelled"],
      paid: ["completed", "disputed"],
    };
  }
  // Default: full_prepay (or unknown — treat as prepay for safety)
  return {
    contract_signed: ["payment_pending", "disputed", "cancelled"],
    payment_pending: ["paid", "disputed", "cancelled"],
    paid: ["in_production", "disputed"],
    customs_cleared: ["completed", "disputed"],
  };
}

/**
 * Check whether an order may transition from `from` to `to`. When the
 * transition depends on payment terms (e.g. contract_signed →
 * payment_pending vs in_production), pass the order's `payment_terms`.
 */
export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  paymentTerms?: PaymentTermsType | null
): boolean {
  const branch = getBranchTransitions(paymentTerms);
  const allowed = branch[from] ?? COMMON_FORWARD[from] ?? [];
  return allowed.includes(to);
}

/**
 * Returns the next legal status after `current` for an order with the given
 * `payment_terms`, or `null` if `current` is terminal / requires user choice.
 *
 * Used by server actions that auto-advance (e.g. uploadSignedScan after both
 * scans uploaded → next state depends on payment_terms).
 */
export function nextAfter(
  current: OrderStatus,
  paymentTerms: PaymentTermsType | null | undefined
): OrderStatus | null {
  switch (current) {
    case "contract_signed":
      return paymentTerms === "net_after_arrival" ? "in_production" : "payment_pending";
    case "paid":
      return paymentTerms === "net_after_arrival" ? "completed" : "in_production";
    case "customs_cleared":
      return paymentTerms === "net_after_arrival" ? "payment_pending" : "completed";
    default:
      return null;
  }
}

/**
 * Ordered list of stages used by the progress bar UI. Disputed / cancelled
 * are not included as they are non-linear branches.
 */
export function getProgressStages(
  paymentTerms: PaymentTermsType | null | undefined
): OrderStatus[] {
  const pre: OrderStatus[] = [
    "quotation_pending",
    "quoted",
    "negotiating",
    "contract_pending",
    "contract_signed",
  ];
  const shipping: OrderStatus[] = [
    "in_production",
    "ready_to_ship",
    "shipped",
    "in_transit",
    "arrived",
    "customs_cleared",
  ];
  if (paymentTerms === "net_after_arrival") {
    return [...pre, ...shipping, "payment_pending", "paid", "completed"];
  }
  return [...pre, "payment_pending", "paid", ...shipping, "completed"];
}

/**
 * Index of `status` in the ordered stage list for the given payment terms.
 * Returns -1 for terminal off-track states (disputed, cancelled, draft).
 */
export function getStageIndex(
  status: OrderStatus,
  paymentTerms: PaymentTermsType | null | undefined
): number {
  return getProgressStages(paymentTerms).indexOf(status);
}

/**
 * Human-readable label for each status, suitable for badges and progress steps.
 */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  quotation_pending: "Quotation Pending",
  draft: "Draft",
  quoted: "Quoted",
  negotiating: "Negotiating",
  contract_pending: "Contract Review",
  contract_generated: "Contract Generated",
  contract_signed: "Contract Signed",
  payment_pending: "Payment Pending",
  paid: "Paid",
  in_production: "In Production",
  ready_to_ship: "Ready to Ship",
  shipped: "Shipped",
  in_transit: "In Transit",
  arrived: "Arrived at Port",
  customs_cleared: "Customs Cleared",
  completed: "Completed",
  disputed: "Disputed",
  cancelled: "Cancelled",
};

export const TERMINAL_STATUSES: OrderStatus[] = ["completed", "cancelled"];
