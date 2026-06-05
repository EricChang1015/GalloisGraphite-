"use server";

import "server-only";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  PARTNERS_BUCKET,
  PARTNER_ICON_ALLOWED_MIME,
  PARTNER_ICON_MAX_BYTES,
  partnerIconPath,
  partnerPublicUrl,
} from "@/lib/partners/images";
import type { ActionResult } from "./auth";
import {
  requireAdmin,
  writeAuditLog,
} from "./mine-photos-admin-internal";
import { revalidatePath } from "next/cache";

const PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export async function uploadPartnerIcon(
  formData: FormData
): Promise<ActionResult<{ icon_url: string }>> {
  const { user, error: authError } = await requireAdmin();
  if (!user) return { data: null, error: { message: authError! } };

  const partnerId = String(formData.get("partner_id") ?? "");
  const idParsed = z.string().uuid().safeParse(partnerId);
  if (!idParsed.success) return { data: null, error: { message: "Invalid partner id." } };

  const file = formData.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return { data: null, error: { message: "No file provided." } };
  }
  if (file.size > PARTNER_ICON_MAX_BYTES) {
    return { data: null, error: { message: "File too large (max 2 MB)." } };
  }
  const mime = file.type || "application/octet-stream";
  if (!PARTNER_ICON_ALLOWED_MIME.has(mime)) {
    return { data: null, error: { message: "Unsupported image type." } };
  }

  const admin = createAdminClient();
  const { data: partner } = await admin
    .from("partners")
    .select("slug, storage_path")
    .eq("id", partnerId)
    .maybeSingle<{ slug: string; storage_path: string | null }>();
  if (!partner) return { data: null, error: { message: "Partner not found." } };

  const path = partnerIconPath(partner.slug, mime);
  const buf = Buffer.from(await file.arrayBuffer());

  if (partner.storage_path && partner.storage_path !== path) {
    await admin.storage.from(PARTNERS_BUCKET).remove([partner.storage_path]);
  }

  const { error: upErr } = await admin.storage
    .from(PARTNERS_BUCKET)
    .upload(path, buf, { contentType: mime, upsert: true });
  if (upErr) return { data: null, error: { message: upErr.message } };

  const icon_url = partnerPublicUrl(PUBLIC_SUPABASE_URL, path);
  const { error: dbErr } = await admin
    .from("partners")
    .update({
      icon_url,
      storage_path: path,
      updated_at: new Date().toISOString(),
    })
    .eq("id", partnerId);
  if (dbErr) return { data: null, error: { message: dbErr.message } };

  await writeAuditLog(user.id, "partner.icon", "partner", partnerId);
  try {
    revalidatePath("/");
  } catch {
    // ignore
  }
  return { data: { icon_url }, error: null };
}
