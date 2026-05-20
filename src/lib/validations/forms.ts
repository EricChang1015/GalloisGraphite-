import { z } from "zod";

import {
  IncotermSchema,
  PaymentScheduleArraySchema,
} from "./payment-schedule";

export const SubmitPaymentSchema = z.object({
  order_id: z.string().uuid(),
  /** Required: which schedule installment this payment settles. */
  schedule_id: z.string().uuid(),
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

export const ShipmentUpdateSchema = z.object({
  order_id: z.string().uuid(),
  shipment_from: z.string().min(1),
  shipment_eta: z.string(),
  note: z.string().optional(),
  // Optional B/L + vessel details captured when seller marks shipped
  bl_no: z.string().max(80).optional(),
  bl_date: z.string().optional(),
  vessel_name: z.string().max(120).optional(),
  vessel_imo: z.string().max(20).optional(),
  container_numbers: z.array(z.string().max(40)).optional(),
  etd: z.string().optional(),
  atd: z.string().optional(),
});

export const DraftContractSchema = z.object({
  order_id: z.string().uuid(),
  incoterm: IncotermSchema,
  payment_schedule: PaymentScheduleArraySchema,
});

export type DraftContractInput = z.infer<typeof DraftContractSchema>;

export const RejectContractSchema = z.object({
  order_id: z.string().uuid(),
  reason: z.string().min(1).max(1000),
});

export const MarkArrivedSchema = z.object({
  order_id: z.string().uuid(),
  ata: z.string(), // ISO date
  note: z.string().max(500).optional(),
});

export const MarkInTransitSchema = z.object({
  order_id: z.string().uuid(),
  note: z.string().max(500).optional(),
});

export const RaiseDisputeSchema = z.object({
  order_id: z.string().uuid(),
  reason: z.string().min(10).max(2000),
});

export const CancelOrderSchema = z.object({
  order_id: z.string().uuid(),
  reason: z.string().min(1).max(1000),
});

export const ListingInputSchema = z.object({
  category_id: z.string().uuid(),
  title: z.string().min(3).max(200),
  specs: z.record(z.string(), z.unknown()).default({}),
  quantity: z.number().positive(),
  unit: z.enum(["MT", "KG"]).default("MT"),
  origin_location: z.string().min(1),
  available_from: z.string().optional(),
  available_to: z.string().optional(),
  unit_price: z.number().positive(),
  currency: z.string().default("USDT"),
  incoterm: IncotermSchema.default("CFR"),
  description: z.string().optional(),
  images: z.array(z.string().url()).default([]),
});

export type ListingInput = z.infer<typeof ListingInputSchema>;
