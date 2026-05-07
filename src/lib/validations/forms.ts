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

export const ShipmentUpdateSchema = z.object({
  order_id: z.string().uuid(),
  shipment_from: z.string().min(1),
  shipment_eta: z.string(),
  note: z.string().optional(),
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
  incoterm: z.string().default("CFR"),
  description: z.string().optional(),
  images: z.array(z.string().url()).default([]),
});

export type ListingInput = z.infer<typeof ListingInputSchema>;
