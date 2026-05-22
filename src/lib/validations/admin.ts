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
