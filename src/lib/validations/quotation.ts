import { z } from "zod";

export const QuotationInputSchema = z.object({
  inquiry_id: z.string().uuid(),
  listing_id: z.string().uuid().optional(),
  unit_price: z.number().positive(),
  currency: z.string().min(2).max(10),
  quantity: z.number().positive(),
  unit: z.enum(["MT", "KG"]).default("MT"),
  incoterm: z.enum(["FOB", "CFR", "CIF"]),
  origin_port: z.string().max(120).optional(),
  destination_port: z.string().max(120).optional(),
  validity_until: z.string().min(10), // ISO date or datetime
  specs_confirmed: z.record(z.string(), z.unknown()).default({}),
  shipping_window_from: z.string().optional(),
  shipping_window_to: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export type QuotationInput = z.infer<typeof QuotationInputSchema>;

/** Counter-offer reuses the same shape but is anchored to an existing quotation. */
export const CounterQuotationSchema = QuotationInputSchema.extend({
  parent_quotation_id: z.string().uuid(),
});

export type CounterQuotationInput = z.infer<typeof CounterQuotationSchema>;

export const RejectQuotationSchema = z.object({
  quotation_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});
