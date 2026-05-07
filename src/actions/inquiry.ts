"use server";

import { z } from "zod";

export const InquiryInputSchema = z.object({
  listing_id: z.string().uuid().optional(),
  category_id: z.string().uuid(),
  seller_id: z.string().uuid(),
  requested_qty: z.number().positive(),
  target_price: z.number().positive().optional(),
  destination: z.string().optional(),
  message: z.string().max(2000).optional(),
});

export type InquiryInput = z.infer<typeof InquiryInputSchema>;

// TODO: implement
//   - createInquiry(input): buyer → insert inquiries row, send email to seller
//   - acceptInquiry(id): seller-only, create order (status='draft'), update
//     inquiry.status='converted', append timeline entry
//   - rejectInquiry(id): seller-only, set status='rejected'
