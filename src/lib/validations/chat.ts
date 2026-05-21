import { z } from "zod";

const ContextTypeSchema = z.enum(["listing", "inquiry", "order"]);

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
    contextType: ContextTypeSchema.optional(),
    contextId: z.string().uuid().optional(),
  })
  .refine((v) => Boolean(v.content) || Boolean(v.attachmentUrl), {
    message: "Message must have text or an attachment.",
  })
  .refine(
    (v) =>
      (!v.contextType && !v.contextId) ||
      (Boolean(v.contextType) && Boolean(v.contextId)),
    { message: "Context type and id must be provided together." }
  );

export const GetMessagesSchema = z.object({
  roomId: z.string().uuid(),
  before: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

export const OpenPartyChatSchema = z.object({
  counterpartyId: z.string().uuid(),
});
