import { z } from "zod";

import type { Database } from "@/types/database";

export type PaymentCategory = Database["public"]["Enums"]["payment_category"];
export type PaymentMilestone = Database["public"]["Enums"]["payment_milestone"];
export type PaymentScheduleStatus =
  Database["public"]["Enums"]["payment_schedule_status"];

export const INCOTERMS = ["FOB", "CFR", "CIF"] as const;
export type Incoterm = (typeof INCOTERMS)[number];
export const IncotermSchema = z.enum(INCOTERMS);

// ---------------------------------------------------------------------
// Milestone catalogue
// ---------------------------------------------------------------------

/** Common prepayment milestones (available regardless of Incoterm). */
const PREPAYMENT_MILESTONES = [
  "contract_signed",
  "before_production",
  "before_shipment",
  "before_loading",
] as const satisfies readonly PaymentMilestone[];

/** Common postpayment milestones (available regardless of Incoterm). */
const POSTPAYMENT_MILESTONES = [
  "arrived_at_port",
  "goods_picked_up",
  "accepted_by_buyer",
  "bl_date_plus_30",
  "bl_date_plus_60",
  "bl_date_plus_90",
] as const satisfies readonly PaymentMilestone[];

/** Regular-payment milestones, keyed by Incoterm. */
const REGULAR_MILESTONES_BY_INCOTERM: Record<Incoterm, readonly PaymentMilestone[]> = {
  FOB: ["loaded_onto_vessel", "bl_received"],
  CFR: ["loaded_onto_vessel", "bl_received", "shipping_docs_received"],
  CIF: ["loaded_onto_vessel", "bl_plus_insurance_received"],
};

/**
 * Returns the milestones permitted for a given category + Incoterm.
 * Used by the schedule builder UI to filter the dropdown.
 */
export function getMilestonesForCategory(
  category: PaymentCategory,
  incoterm: Incoterm
): readonly PaymentMilestone[] {
  switch (category) {
    case "prepayment":
      return PREPAYMENT_MILESTONES;
    case "regular_payment":
      return REGULAR_MILESTONES_BY_INCOTERM[incoterm];
    case "postpayment":
      return POSTPAYMENT_MILESTONES;
  }
}

/** Set of milestones that require a `bl_offset_days` value. */
export const TIME_BASED_MILESTONES = new Set<PaymentMilestone>([
  "bl_date_plus_30",
  "bl_date_plus_60",
  "bl_date_plus_90",
]);

/**
 * Default offset for the three bl_date_plus_N milestones, used by the
 * schedule builder when the user picks one and by the cron job when
 * back-filling missing `due_date`s.
 */
export const BL_OFFSET_DAYS: Record<
  "bl_date_plus_30" | "bl_date_plus_60" | "bl_date_plus_90",
  number
> = {
  bl_date_plus_30: 30,
  bl_date_plus_60: 60,
  bl_date_plus_90: 90,
};

// ---------------------------------------------------------------------
// Human labels (kept here so server + client UI share one source).
// ---------------------------------------------------------------------

export const MILESTONE_LABEL: Record<PaymentMilestone, string> = {
  contract_signed: "Contract Signed",
  before_production: "Before Production",
  before_shipment: "Before Shipment",
  before_loading: "Before Loading",
  loaded_onto_vessel: "Loaded onto Vessel",
  bl_received: "B/L Received",
  shipping_docs_received: "Shipping Documents Received",
  bl_plus_insurance_received: "B/L + Insurance Received",
  arrived_at_port: "Arrived at Port",
  goods_picked_up: "Goods Picked Up",
  accepted_by_buyer: "Accepted by Buyer",
  bl_date_plus_30: "B/L Date + 30 days",
  bl_date_plus_60: "B/L Date + 60 days",
  bl_date_plus_90: "B/L Date + 90 days",
};

export const CATEGORY_LABEL: Record<PaymentCategory, string> = {
  prepayment: "Prepayment",
  regular_payment: "Regular Payment",
  postpayment: "Postpayment",
};

export const SCHEDULE_STATUS_LABEL: Record<PaymentScheduleStatus, string> = {
  scheduled: "Scheduled",
  due: "Due",
  awaiting_review: "Awaiting Review",
  paid: "Paid",
  overdue: "Overdue",
  waived: "Waived",
};

// ---------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------

const PaymentMilestoneSchema = z.enum([
  "contract_signed",
  "before_production",
  "before_shipment",
  "before_loading",
  "loaded_onto_vessel",
  "bl_received",
  "shipping_docs_received",
  "bl_plus_insurance_received",
  "arrived_at_port",
  "goods_picked_up",
  "accepted_by_buyer",
  "bl_date_plus_30",
  "bl_date_plus_60",
  "bl_date_plus_90",
]) satisfies z.ZodType<PaymentMilestone>;

const PaymentCategorySchema = z.enum([
  "prepayment",
  "regular_payment",
  "postpayment",
]) satisfies z.ZodType<PaymentCategory>;

export const PaymentScheduleEntrySchema = z.object({
  category: PaymentCategorySchema,
  milestone: PaymentMilestoneSchema,
  /** 0 < percentage <= 100, two decimal places. */
  percentage: z.number().positive().max(100),
  /** Optional override of the canonical bl_offset_days (only meaningful for time-based milestones). */
  bl_offset_days: z.number().int().min(0).max(365).optional(),
  notes: z.string().max(500).optional(),
});

export type PaymentScheduleEntry = z.infer<typeof PaymentScheduleEntrySchema>;

/**
 * Validates an array of schedule entries:
 *  - 1..10 entries
 *  - sum(percentage) must equal 100 within a 0.01 tolerance
 *  - no duplicate milestone within the same category
 *  - bl_date_plus_N milestones must carry bl_offset_days (or default
 *    by the helper at server-action time)
 *
 * Incoterm compatibility is enforced separately via
 * `assertSchedulesCompatibleWithIncoterm()` because the array schema
 * doesn't know which incoterm was chosen.
 */
export const PaymentScheduleArraySchema = z
  .array(PaymentScheduleEntrySchema)
  .min(1, "At least one payment installment is required.")
  .max(10, "Too many payment installments (max 10).")
  .superRefine((entries, ctx) => {
    const total = entries.reduce((acc, e) => acc + e.percentage, 0);
    if (Math.abs(total - 100) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Payment percentages must sum to 100 (currently ${total.toFixed(2)}).`,
      });
    }
    const seen = new Set<string>();
    entries.forEach((e, idx) => {
      const key = `${e.category}:${e.milestone}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [idx, "milestone"],
          message: `Duplicate milestone "${e.milestone}" within ${e.category}.`,
        });
      }
      seen.add(key);
    });
  });

export type PaymentScheduleArray = z.infer<typeof PaymentScheduleArraySchema>;

/**
 * Throws (returns a string) if any entry uses a milestone that isn't
 * valid for the chosen Incoterm. Returns null when all good.
 */
export function assertSchedulesCompatibleWithIncoterm(
  schedules: PaymentScheduleEntry[],
  incoterm: Incoterm
): string | null {
  for (const s of schedules) {
    const allowed = getMilestonesForCategory(s.category, incoterm);
    if (!allowed.includes(s.milestone)) {
      return `Milestone "${MILESTONE_LABEL[s.milestone]}" is not available for ${incoterm} ${CATEGORY_LABEL[s.category]}.`;
    }
  }
  return null;
}
