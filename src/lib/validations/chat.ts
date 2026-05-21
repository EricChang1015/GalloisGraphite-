import { z } from "zod";

export const SendMessageSchema = z
  .object({
    roomId: z.string().uuid(),
    content: z
      .string()
      .trim()
      .max(4000)
      .optional()
      .transform((v) => (v === "" ? undefined : v)),
    attachmentUrl: z.string().url().max(2048).optional(),
  })
  .refine((v) => Boolean(v.content) || Boolean(v.attachmentUrl), {
    message: "Message must have text or an attachment.",
  });

export const GetMessagesSchema = z.object({
  roomId: z.string().uuid(),
  before: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});
