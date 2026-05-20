"use client";

/**
 * Historically this file owned the "Generate Contract" / "Submit Payment"
 * / "Update Shipment" / "Confirm Receipt" CTAs. Post-014 cutover:
 *
 * - Contract drafting moved into <ContractDraftForm /> on the Contract tab
 * - Payment submission moved into the per-row <PaymentScheduleTable /> dialog
 *   on the Payment tab
 * - Shipment update moved into <ShipmentForm /> on the Shipment tab
 * - "Confirm receipt" → "Customs cleared" lives in <OrderPhaseActions />
 *
 * The component is kept as an intentionally empty re-export shim so any
 * older callers that import `OrderActions` still resolve until they're
 * cleaned up. New code should import the focused components directly.
 */
export function OrderActions(_: {
  orderId: string;
  status: string;
  role: "buyer" | "seller" | "other";
  totalAmount: number;
  currency: string;
}) {
  return null;
}
