"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  FreezeUserSchema,
  SetUserRoleSchema,
  CategoryInputSchema,
  NewsInputSchema,
} from "@/lib/validations/admin";
import type { ActionResult } from "./auth";

async function requireAdmin() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, error: "Not authenticated." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();
  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    return { user: null, error: "Admin access required." };
  }
  return { user, error: null };
}

async function writeAuditLog(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata?: Record<string, unknown>
) {
  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata: (metadata ?? {}) as import("@/types/database").Json,
  });
}

export async function freezeUser(
  input: z.infer<typeof FreezeUserSchema>
): Promise<ActionResult<true>> {
  const { user, error: authError } = await requireAdmin();
  if (!user) return { data: null, error: { message: authError! } };

  const parsed = FreezeUserSchema.safeParse(input);
  if (!parsed.success) return { data: null, error: { message: "Invalid input." } };

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ status: "frozen" })
    .eq("id", parsed.data.user_id);

  if (error) return { data: null, error: { message: error.message } };

  await writeAuditLog(user.id, "freeze_user", "profile", parsed.data.user_id, {
    reason: parsed.data.reason,
  });

  revalidatePath("/admin/users");

  return { data: true, error: null };
}

export async function unfreezeUser(userId: string): Promise<ActionResult<true>> {
  const { user, error: authError } = await requireAdmin();
  if (!user) return { data: null, error: { message: authError! } };

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ status: "active" })
    .eq("id", userId);

  if (error) return { data: null, error: { message: error.message } };

  await writeAuditLog(user.id, "unfreeze_user", "profile", userId);

  revalidatePath("/admin/users");

  return { data: true, error: null };
}

export async function setUserRole(
  input: z.infer<typeof SetUserRoleSchema>
): Promise<ActionResult<true>> {
  const { user, error: authError } = await requireAdmin();
  if (!user) return { data: null, error: { message: authError! } };

  // Only super_admin can promote to admin
  const supabase = await createServerClient();
  const { data: actorProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();

  if (input.role === "admin" && actorProfile?.role !== "super_admin") {
    return { data: null, error: { message: "Only super_admin can set admin role." } };
  }

  const parsed = SetUserRoleSchema.safeParse(input);
  if (!parsed.success) return { data: null, error: { message: "Invalid input." } };

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.user_id);

  if (error) return { data: null, error: { message: error.message } };

  await writeAuditLog(user.id, "set_user_role", "profile", parsed.data.user_id, {
    role: parsed.data.role,
  });

  revalidatePath("/admin/users");

  return { data: true, error: null };
}

export async function upsertCategory(
  input: z.infer<typeof CategoryInputSchema>
): Promise<ActionResult<{ id: string }>> {
  const { user, error: authError } = await requireAdmin();
  if (!user) return { data: null, error: { message: authError! } };

  const parsed = CategoryInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: { message: "Invalid input.", fieldErrors: z.flattenError(parsed.error).fieldErrors },
    };
  }

  const admin = createAdminClient();
  const { id, ...fields } = parsed.data;
  const dbFields = {
    ...fields,
    spec_schema: fields.spec_schema as import("@/types/database").Json,
  };

  let result: { id: string } | null = null;
  let dbError: { message: string } | null = null;

  if (id) {
    const { error } = await admin
      .from("product_categories")
      .update(dbFields)
      .eq("id", id);
    if (error) dbError = { message: error.message };
    else result = { id };
  } else {
    const { data, error } = await admin
      .from("product_categories")
      .insert(dbFields)
      .select("id")
      .single<{ id: string }>();
    if (error) dbError = { message: error.message };
    else result = { id: data.id };
  }

  if (dbError || !result) return { data: null, error: dbError! };

  await writeAuditLog(user.id, id ? "update_category" : "create_category", "category", result.id);

  revalidatePath("/admin/categories");
  revalidatePath("/market");

  return { data: result, error: null };
}

export async function deleteCategory(categoryId: string): Promise<ActionResult<true>> {
  const { user, error: authError } = await requireAdmin();
  if (!user) return { data: null, error: { message: authError! } };

  const admin = createAdminClient();
  const { error } = await admin
    .from("product_categories")
    .update({ is_active: false })
    .eq("id", categoryId);

  if (error) return { data: null, error: { message: error.message } };

  await writeAuditLog(user.id, "deactivate_category", "category", categoryId);

  revalidatePath("/admin/categories");

  return { data: true, error: null };
}

export async function upsertNews(
  input: z.infer<typeof NewsInputSchema>
): Promise<ActionResult<{ id: string }>> {
  const { user, error: authError } = await requireAdmin();
  if (!user) return { data: null, error: { message: authError! } };

  const parsed = NewsInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: { message: "Invalid input.", fieldErrors: z.flattenError(parsed.error).fieldErrors },
    };
  }

  const admin = createAdminClient();
  const { id, ...fields } = parsed.data;
  const payload = {
    ...fields,
    cover_image_url: fields.cover_image_url || null,
    published_at: fields.is_published ? new Date().toISOString() : null,
    author_id: user.id,
  };

  let result: { id: string } | null = null;
  let dbError: { message: string } | null = null;

  if (id) {
    const { error } = await admin.from("news").update(payload).eq("id", id);
    if (error) dbError = { message: error.message };
    else result = { id };
  } else {
    const { data, error } = await admin
      .from("news")
      .insert(payload)
      .select("id")
      .single<{ id: string }>();
    if (error) dbError = { message: error.message };
    else result = { id: data.id };
  }

  if (dbError || !result) return { data: null, error: dbError! };

  await writeAuditLog(user.id, id ? "update_news" : "create_news", "news", result.id);

  revalidatePath("/admin/news");
  revalidatePath("/news");

  return { data: result, error: null };
}
