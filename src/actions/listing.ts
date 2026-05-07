"use server";

import { z } from "zod";

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

// TODO: implement createListing / updateListing / pauseListing / resumeListing.
// Steps:
//   1. createServerClient
//   2. supabase.auth.getUser() — must exist
//   3. read profile, ensure role === 'seller' (or admin)
//   4. validate input with ListingInputSchema
//   5. insert/update listings; revalidatePath('/listings'); return { data, error }
