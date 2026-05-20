import type { Database } from "@/types/database";

export type OrderStatus = Database["public"]["Enums"]["order_status"];

/**
 * Forward transitions for the order lifecycle. Payment is **not** part
 * of the order timeline anymore — every order takes the same path from
 * contract signing through customs clearance. Outstanding payment
 * installments live on `payment_schedules` and are surfaced as a side
 * panel rather than gating order progression.
 *
 * The `completed` transition out of `customs_cleared` is allowed
 * unconditionally here; server actions are responsible for blocking it
 * (or surfacing a warning) when one or more schedules are still unpaid.
 */
const FORWARD: Partial<Record<OrderStatus, OrderStatus[]>> = {
  // Quotation phase
  quotation_pending: ["quoted", "cancelled"],
  quoted: ["negotiating", "contract_pending", "rejected" as OrderStatus, "cancelled"],
  negotiating: ["quoted", "contract_pending", "cancelled"],

  // Contract phase (re-draft loop is modelled by bumping
  // `contracts.revision_no` rather than a self-edge.)
  contract_pending: ["contract_signed", "cancelled"],
  contract_signed: ["in_production", "disputed", "cancelled"],

  // Production / shipping / arrival phase
  in_production: ["ready_to_ship", "disputed", "cancelled"],
  ready_to_ship: ["shipped", "disputed", "cancelled"],
  shipped: ["in_transit", "arrived", "disputed"],
  in_transit: ["arrived", "disputed"],
  arrived: ["customs_cleared", "disputed"],
  customs_cleared: ["completed", "disputed"],

  // Terminal / off-track
  completed: [],
  disputed: ["cancelled", "completed"],
  cancelled: [],

  // ---- Legacy enum values retained for historical timeline rows. ----
  // No code path produces these post-014 cutover; the entries below
  // exist so admin "force transition" actions on archived orders still
  // resolve.
  draft: ["quoted", "contract_pending", "cancelled"],
  contract_generated: ["contract_signed", "cancelled"],
  payment_pending: ["paid", "in_production", "disputed", "cancelled"],
  paid: ["in_production", "disputed"],
};

/** Check whether an order may transition from `from` to `to`. */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return (FORWARD[from] ?? []).includes(to);
}

/**
 * Returns the next legal status after `current`, or `null` if `current`
 * is terminal / requires user choice. Used by server actions that
 * auto-advance after composite events (e.g. both signed scans uploaded
 * → contract_signed → in_production).
 */
export function nextAfter(current: OrderStatus): OrderStatus | null {
  switch (current) {
    case "contract_signed":
      return "in_production";
    case "customs_cleared":
      // Auto-completion only happens when all payment schedules are
      // paid; the server action checks that condition before calling
      // `nextAfter` to advance into `completed`.
      return "completed";
    default:
      return null;
  }
}

/**
 * Ordered list of stages used by the progress bar UI. Disputed /
 * cancelled and the legacy payment_pending/paid values are not
 * included as they are off-timeline.
 */
const PROGRESS_STAGES: OrderStatus[] = [
  "quotation_pending",
  "quoted",
  "negotiating",
  "contract_pending",
  "contract_signed",
  "in_production",
  "ready_to_ship",
  "shipped",
  "in_transit",
  "arrived",
  "customs_cleared",
  "completed",
];

export function getProgressStages(): OrderStatus[] {
  return PROGRESS_STAGES;
}

/**
 * Index of `status` in the ordered stage list. Returns -1 for terminal
 * off-track states (disputed, cancelled, draft) and the dormant
 * payment_pending / paid values.
 */
export function getStageIndex(status: OrderStatus): number {
  return PROGRESS_STAGES.indexOf(status);
}

/**
 * Human-readable label for each status, suitable for badges and
 * progress steps. Legacy values are retained so historical timeline
 * entries still render in human-readable form.
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
