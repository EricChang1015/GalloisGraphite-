"use server";

import { z } from "zod";

export const FreezeUserSchema = z.object({
  user_id: z.string().uuid(),
  reason: z.string().min(1),
});

export const SetUserRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["buyer", "seller", "admin"]),
});

export const CategoryInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().optional(),
  spec_schema: z.record(z.string(), z.unknown()).default({}),
  is_active: z.boolean().default(true),
});

// TODO: implement
//   - freezeUser / unfreezeUser
//   - setUserRole (super_admin only)
//   - upsertCategory / deleteCategory
//   - publishNews / unpublishNews
// All admin actions MUST insert an `audit_logs` row with:
//   { actor_id, action, target_type, target_id, metadata }
