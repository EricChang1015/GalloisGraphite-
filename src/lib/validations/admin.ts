import { z } from "zod";

import { CategorySpecSchema } from "@/lib/categories/spec";

export const CategoryInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(120),
    description: z.string().optional(),
    spec_schema: CategorySpecSchema,
    is_active: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.spec_schema.fixed_carbon_min > value.spec_schema.fixed_carbon_max) {
      ctx.addIssue({
        code: "custom",
        path: ["spec_schema", "fixed_carbon_min"],
        message: "Fixed carbon min cannot exceed max.",
      });
    }
    if (
      !value.spec_schema.is_custom &&
      value.spec_schema.mesh_size === null
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["spec_schema", "mesh_size"],
        message: "Standard categories must pick a mesh size.",
      });
    }
  });

export const NewsInputSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200),
  summary: z.string().optional(),
  content_html: z.string().optional(),
  cover_image_url: z.string().url().optional().or(z.literal("")),
  is_published: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// News aggregation (admin-triggered fetch + review + translate)
// ---------------------------------------------------------------------------

export const FetchNewsCandidatesSchema = z.object({
  limit: z.number().int().min(3).max(25).optional(),
  lookback_days: z.number().int().min(1).max(30).optional(),
  topic_hints: z.array(z.string().min(1).max(60)).max(6).optional(),
});

export const NewsCandidateInputSchema = z.object({
  title: z.string().min(8).max(300),
  summary: z.string().min(20).max(2000),
  source_url: z.string().url(),
  source_name: z.string().min(1).max(120).optional().nullable(),
  published_at: z.string().min(4).max(40).optional().nullable(),
  relevance_score: z.number().min(0).max(1).optional().nullable(),
});

export const ImportNewsCandidatesSchema = z.object({
  batch_id: z.string().uuid(),
  candidates: z.array(NewsCandidateInputSchema).min(1).max(30),
});

export const RejectNewsArticleSchema = z.object({
  news_id: z.string().uuid(),
  reason: z.string().max(500).optional().nullable(),
});

export const ApproveNewsArticleSchema = z.object({
  news_id: z.string().uuid(),
});

export const TranslateNewsArticleSchema = z.object({
  news_id: z.string().uuid(),
  locale: z.string().min(2).max(10),
});

export const FreezeUserSchema = z.object({
  user_id: z.string().uuid(),
  reason: z.string().min(1),
});

export const SetUserRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["buyer", "seller", "admin"]),
});

export const SmsNotificationsToggleSchema = z.object({
  enabled: z.boolean(),
});

export { SetUserKycLevelSchema, UpdateKycThresholdsSchema } from "@/lib/validations/kyc";
