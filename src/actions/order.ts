"use server";

import { z } from "zod";

import type { Database } from "@/types/database";

type OrderStatus = Database["public"]["Enums"]["order_status"];

/**
 * Allowed forward state transitions for an order.
 * `disputed` and `cancelled` are reachable from any state by buyer/seller/admin.
 */
const FORWARD_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ["contract_generated", "cancelled"],
  contract_generated: ["signed", "cancelled"],
  signed: ["payment_pending", "cancelled"],
  payment_pending: ["paid", "disputed", "cancelled"],
  paid: ["shipped", "disputed"],
  shipped: ["delivered", "disputed"],
  delivered: ["completed", "disputed"],
  completed: [],
  disputed: ["cancelled", "completed"], // admin resolves
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return FORWARD_TRANSITIONS[from]?.includes(to) ?? false;
}

export const ShipmentUpdateSchema = z.object({
  order_id: z.string().uuid(),
  shipment_from: z.string().min(1),
  shipment_eta: z.string(),
  note: z.string().optional(),
});

export const ConfirmReceiptSchema = z.object({
  order_id: z.string().uuid(),
});

// TODO: implement
//   - generateContract(orderId): seller/buyer triggers — render HTML and
//     persist to contracts table; transition draft → contract_generated.
//   - uploadSignedScan(orderId, role, fileUrl): updates contracts.{buyer|seller}_signed_url.
//     when both present → transition signed → payment_pending.
//   - updateShipment(input): seller, when status='paid' → 'shipped', append timeline.
//   - markDelivered(orderId): seller, status='shipped' → 'delivered'.
//   - confirmReceipt(orderId): buyer, status='delivered' → 'completed', notify admin.
//   - dispute / cancel: bookkeeping helpers.
