"use server";

import "server-only";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  MINE_PHOTO_ALLOWED_MIME,
  MINE_PHOTO_MAX_BYTES,
  MINE_PHOTOS_BUCKET,
  minePhotoObjectPath,
  minePhotoPublicUrl,
} from "@/lib/mine-photos/images";
import type { ActionResult } from "./auth";
import {
  requireAdmin,
  revalidateAllMinePhotos,
  writeAuditLog,
} from "./mine-photos-admin-internal";

const PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export async function uploadMinePhoto(
  formData: FormData
): Promise<ActionResult<{ id: string; thumb_url: string; full_url: string }>> {
  const { user, error: authError } = await requireAdmin();
  if (!user) return { data: null, error: { message: authError! } };

  const categoryId = String(formData.get("category_id") ?? "");
  const idParsed = z.string().uuid().safeParse(categoryId);
  if (!idParsed.success) return { data: null, error: { message: "Invalid category id." } };

  const file = formData.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return { data: null, error: { message: "No file provided." } };
  }
  if (file.size > MINE_PHOTO_MAX_BYTES) {
    return { data: null, error: { message: "File too large (max 5 MB)." } };
  }
  const mime = file.type || "application/octet-stream";
  if (!MINE_PHOTO_ALLOWED_MIME.has(mime)) {
    return { data: null, error: { message: "Unsupported image type." } };
  }

  const admin = createAdminClient();
  const { data: cat } = await admin
    .from("mine_photo_categories")
    .select("slug")
    .eq("id", categoryId)
    .maybeSingle<{ slug: string }>();
  if (!cat) return { data: null, error: { message: "Category not found." } };

  const { resizeMinePhoto } = await import("@/lib/images/resize-mine-photo");
  const inputBuf = Buffer.from(await file.arrayBuffer());
  const resized = await resizeMinePhoto(inputBuf);
  const photoId = randomUUID();
  const fullPath = minePhotoObjectPath(cat.slug, photoId, "full");
  const thumbPath = minePhotoObjectPath(cat.slug, photoId, "thumb");

  const { error: fullErr } = await admin.storage
    .from(MINE_PHOTOS_BUCKET)
    .upload(fullPath, resized.fullBuffer, {
      contentType: "image/jpeg",
      upsert: false,
    });
  if (fullErr) return { data: null, error: { message: fullErr.message } };

  const { error: thumbErr } = await admin.storage
    .from(MINE_PHOTOS_BUCKET)
    .upload(thumbPath, resized.thumbBuffer, {
      contentType: "image/webp",
      upsert: false,
    });
  if (thumbErr) {
    await admin.storage.from(MINE_PHOTOS_BUCKET).remove([fullPath]);
    return { data: null, error: { message: thumbErr.message } };
  }

  const sortOrder = Number(formData.get("sort_order") ?? 0) || 0;
  const thumb_url = minePhotoPublicUrl(PUBLIC_SUPABASE_URL, thumbPath);
  const full_url = minePhotoPublicUrl(PUBLIC_SUPABASE_URL, fullPath);

  const { error: insErr } = await admin.from("mine_photos").insert({
    id: photoId,
    category_id: categoryId,
    thumb_url,
    full_url,
    storage_path_thumb: thumbPath,
    storage_path_full: fullPath,
    alt_en: String(formData.get("alt_en") ?? ""),
    alt_zh_cn: String(formData.get("alt_zh_cn") ?? ""),
    sort_order: sortOrder,
    is_published: true,
  });
  if (insErr) {
    await admin.storage.from(MINE_PHOTOS_BUCKET).remove([fullPath, thumbPath]);
    return { data: null, error: { message: insErr.message } };
  }

  await writeAuditLog(user.id, "mine_photo.create", "mine_photo", photoId, {
    category_id: categoryId,
  });
  revalidateAllMinePhotos();
  return { data: { id: photoId, thumb_url, full_url }, error: null };
}
