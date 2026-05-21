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
  SmsNotificationsToggleSchema,
  SetUserKycLevelSchema,
  UpdateKycThresholdsSchema,
} from "@/lib/validations/admin";
import { ApproveKycDocumentsSchema } from "@/lib/validations/kyc";
import { levelAfterDocumentApproval } from "@/lib/kyc/levels";
import {
  parseKycDocs,
  summarizeKycDocs,
  type KycDocEntry,
} from "@/lib/kyc/types";
import {
  SMS_NOTIFICATIONS_KEY,
  KYC_MIN_LEVEL_INQUIRY_KEY,
  KYC_MIN_LEVEL_LISTING_KEY,
  isSmsGatewayConfigured,
} from "@/lib/platform/settings";
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

/**
 * Send a one-off test email through the configured SMTP transport.
 * Used by the admin Settings page to verify SES credentials / domain
 * verification without having to run a full order flow.
 */
export async function sendTestEmail(): Promise<
  ActionResult<{ messageId: string | null; to: string }>
> {
  const { user, error: authError } = await requireAdmin();
  if (!user) return { data: null, error: { message: authError! } };

  // Lazy import to keep nodemailer out of any client-bundled path. The
  // outer file is "use server" so this is purely defensive.
  const { sendEmail, verifySmtp } = await import("@/lib/email/smtp");

  // Surface connection errors clearly before attempting send.
  const verify = await verifySmtp();
  if (!verify.ok) {
    return {
      data: null,
      error: { message: `SMTP verify failed: ${verify.error}` },
    };
  }

  const supabase = await createServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", user.id)
    .single<{ email: string | null; full_name: string | null }>();

  const adminEmail = process.env.ADMIN_EMAIL || profile?.email;
  if (!adminEmail) {
    return {
      data: null,
      error: { message: "Neither ADMIN_EMAIL nor your profile email is set." },
    };
  }

  try {
    const info = await sendEmail({
      to: adminEmail,
      subject: "Mada Graphite — SMTP test email",
      html: `
        <p>Hi ${profile?.full_name || "Admin"},</p>
        <p>This is a test email from the Mada Graphite platform confirming
           that the SMTP transport is configured correctly.</p>
        <p>Sent at: <strong>${new Date().toISOString()}</strong></p>
        <p>If you received this, transactional notifications will reach
           buyers / sellers / admin from now on.</p>
      `,
    });

    await writeAuditLog(user.id, "send_test_email", "platform_settings", user.id, {
      to: adminEmail,
      messageId: info.messageId ?? null,
    });

    return {
      data: { messageId: info.messageId ?? null, to: adminEmail },
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown SMTP error.";
    return { data: null, error: { message: `Send failed: ${message}` } };
  }
}

export async function updateSmsNotificationsEnabled(
  input: z.infer<typeof SmsNotificationsToggleSchema>
): Promise<ActionResult<true>> {
  const { user, error: authError } = await requireAdmin();
  if (!user) return { data: null, error: { message: authError! } };

  const parsed = SmsNotificationsToggleSchema.safeParse(input);
  if (!parsed.success) return { data: null, error: { message: "Invalid input." } };

  if (parsed.data.enabled && !isSmsGatewayConfigured()) {
    return {
      data: null,
      error: {
        message:
          "SMS gateway is not configured. Set SMS_BASE_URL and SMS_APP_ID in environment variables first.",
      },
    };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("platform_settings").upsert({
    key: SMS_NOTIFICATIONS_KEY,
    value: parsed.data.enabled,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  });

  if (error) return { data: null, error: { message: error.message } };

  await writeAuditLog(user.id, "update_sms_notifications", "platform_settings", user.id, {
    key: SMS_NOTIFICATIONS_KEY,
    enabled: parsed.data.enabled,
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin");

  return { data: true, error: null };
}

export async function updateKycThresholds(
  input: z.infer<typeof UpdateKycThresholdsSchema>
): Promise<ActionResult<true>> {
  const { user, error: authError } = await requireAdmin();
  if (!user) return { data: null, error: { message: authError! } };

  const parsed = UpdateKycThresholdsSchema.safeParse(input);
  if (!parsed.success) return { data: null, error: { message: "Invalid input." } };

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const rows = [
    {
      key: KYC_MIN_LEVEL_INQUIRY_KEY,
      value: parsed.data.inquiryMinLevel,
      updated_at: now,
      updated_by: user.id,
    },
    {
      key: KYC_MIN_LEVEL_LISTING_KEY,
      value: parsed.data.listingMinLevel,
      updated_at: now,
      updated_by: user.id,
    },
  ];

  const { error } = await admin.from("platform_settings").upsert(rows);
  if (error) return { data: null, error: { message: error.message } };

  await writeAuditLog(user.id, "update_kyc_thresholds", "platform_settings", user.id, {
    inquiryMinLevel: parsed.data.inquiryMinLevel,
    listingMinLevel: parsed.data.listingMinLevel,
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/users");

  return { data: true, error: null };
}

export async function setUserKycLevel(
  input: z.infer<typeof SetUserKycLevelSchema>
): Promise<ActionResult<true>> {
  const { user, error: authError } = await requireAdmin();
  if (!user) return { data: null, error: { message: authError! } };

  const parsed = SetUserKycLevelSchema.safeParse(input);
  if (!parsed.success) return { data: null, error: { message: "Invalid input." } };

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("kyc_level, email")
    .eq("id", parsed.data.userId)
    .maybeSingle<{ kyc_level: number; email: string }>();

  if (!target) return { data: null, error: { message: "User not found." } };

  const { error } = await admin
    .from("profiles")
    .update({ kyc_level: parsed.data.kycLevel })
    .eq("id", parsed.data.userId);

  if (error) return { data: null, error: { message: error.message } };

  await writeAuditLog(user.id, "set_user_kyc_level", "profile", parsed.data.userId, {
    from: target.kyc_level,
    to: parsed.data.kycLevel,
    note: parsed.data.note ?? null,
  });

  revalidatePath("/admin/users");
  revalidatePath("/settings");

  return { data: true, error: null };
}

export async function approveKycDocuments(
  input: z.infer<typeof ApproveKycDocumentsSchema>
): Promise<ActionResult<{ kycLevel: number }>> {
  const { user, error: authError } = await requireAdmin();
  if (!user) return { data: null, error: { message: authError! } };

  const parsed = ApproveKycDocumentsSchema.safeParse(input);
  if (!parsed.success) return { data: null, error: { message: "Invalid input." } };

  const admin = createAdminClient();
  const { data: profile, error: readErr } = await admin
    .from("profiles")
    .select("kyc_level, kyc_docs")
    .eq("id", parsed.data.userId)
    .maybeSingle<{ kyc_level: number; kyc_docs: import("@/types/database").Json }>();

  if (readErr) return { data: null, error: { message: readErr.message } };
  if (!profile) return { data: null, error: { message: "User not found." } };

  const docs = parseKycDocs(profile.kyc_docs);
  const pending = docs.filter((d) => (d.status ?? "pending") === "pending");
  if (pending.length === 0) {
    return { data: null, error: { message: "No pending documents to approve." } };
  }

  const now = new Date().toISOString();
  const updated = docs.map((d) =>
    (d.status ?? "pending") === "pending"
      ? {
          ...d,
          status: "approved" as const,
          reviewed_at: now,
          reviewed_by: user.id,
        }
      : d
  );

  const nextLevel = levelAfterDocumentApproval(profile.kyc_level);
  const { error: updateErr } = await admin
    .from("profiles")
    .update({
      kyc_docs: updated as unknown as import("@/types/database").Json,
      kyc_level: nextLevel,
    })
    .eq("id", parsed.data.userId);

  if (updateErr) return { data: null, error: { message: updateErr.message } };

  await writeAuditLog(user.id, "approve_kyc_documents", "profile", parsed.data.userId, {
    from: profile.kyc_level,
    to: nextLevel,
    approvedCount: pending.length,
    note: parsed.data.note ?? null,
  });

  revalidatePath("/admin/users");
  revalidatePath("/settings/kyc");

  return { data: { kycLevel: nextLevel }, error: null };
}

export async function getUserKycForAdmin(userId: string): Promise<
  ActionResult<{
    kycLevel: number;
    phone: string | null;
    phoneVerifiedAt: string | null;
    docSummary: ReturnType<typeof summarizeKycDocs>;
    documents: Array<KycDocEntry & { signedUrl: string | null }>;
  }>
> {
  const { user, error: authError } = await requireAdmin();
  if (!user) return { data: null, error: { message: authError! } };

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("kyc_level, kyc_docs, phone, phone_verified_at")
    .eq("id", userId)
    .maybeSingle<{
      kyc_level: number;
      kyc_docs: import("@/types/database").Json;
      phone: string | null;
      phone_verified_at: string | null;
    }>();

  if (error) return { data: null, error: { message: error.message } };
  if (!profile) return { data: null, error: { message: "User not found." } };

  const docs = parseKycDocs(profile.kyc_docs);
  const withUrls: Array<KycDocEntry & { signedUrl: string | null }> = [];

  for (const doc of docs) {
    const { data: signed } = await admin.storage
      .from("kyc")
      .createSignedUrl(doc.storage_path, 60 * 60);
    withUrls.push({ ...doc, signedUrl: signed?.signedUrl ?? null });
  }

  return {
    data: {
      kycLevel: profile.kyc_level,
      phone: profile.phone,
      phoneVerifiedAt: profile.phone_verified_at,
      docSummary: summarizeKycDocs(docs),
      documents: withUrls,
    },
    error: null,
  };
}
