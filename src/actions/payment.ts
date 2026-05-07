"use server";

import { z } from "zod";

export const SubmitPaymentSchema = z.object({
  order_id: z.string().uuid(),
  method: z.enum([
    "usdt_trc20",
    "usdt_erc20",
    "usdi",
    "mup",
    "bank_transfer",
  ]),
  amount: z.number().positive(),
  currency: z.string().min(2),
  tx_hash: z.string().optional(),
  proof_url: z.string().url().optional(),
  note: z.string().max(500).optional(),
});

export type SubmitPaymentInput = z.infer<typeof SubmitPaymentSchema>;

// TODO: implement
//   - submitPayment(input): buyer-only, when order.status='signed' →
//     insert payments(status='pending'), order.status='payment_pending'.
//   - verifyPayment(paymentId, decision): admin-only,
//     verified → orders.status='paid' + audit_log + email seller;
//     rejected → audit_log + email buyer.
//   - markReleased(orderId): admin-only, after buyer confirmed receipt,
//     mark order completed and create audit_log("released_to_seller", ...).
