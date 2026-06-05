"use server";

import "server-only";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resizeMinePhoto, resizeMinePhotoCover } from "@/lib/images/resize-mine-photo";
import {
  MINE_PHOTO_ALLOWED_MIME,
  MINE_PHOTO_MAX_BYTES,
  MINE_PHOTOS_BUCKET,
  minePhotoCoverPath,
  minePhotoObjectPath,
  minePhotoPublicUrl,
} from "@/lib/mine-photos/images";
import type { ActionResult } from "./auth";

const PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

async function requireAdmin() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

function revalidateMinePhotos() {
  revalidatePath("/mining-photos");
  revalidatePath("/about");
  revalidatePath("/");
  revalidatePath("/admin/mine-photos");
}

const CategoryInputSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title_en: z.string().min(1).max(200),
  title_zh_cn: z.string().max(200).optional(),
  sort_order: z.coerce.number().int().min(0).max(999),
  is_published: z.coerce.boolean(),
});

const PhotoMetaSchema = z.object({
  id: z.string().uuid(),
  alt_en: z.string().max(300).optional(),
  alt_zh_cn: z.string().max(300).optional(),
  sort_order: z.coerce.number().int().min(0).max(9999),
  is_published: z.coerce.boolean(),
});

export async function upsertMinePhotoCategory(
  input: z.infer<typeof CategoryInputSchema>
): Promise<ActionResult<{ id: string }>> {
  const { user, error: authError } = await requireAdmin();
  if (!user) return { data: null, error: { message: authError! } };

  const parsed = CategoryInputSchema.safeParse(input);
  if (!parsed.success) return { data: null, error: { message: "Invalid input." } };

  const admin = createAdminClient();
  const row = {
    slug: parsed.data.slug,
    title_en: parsed.data.title_en,
    title_zh_cn: parsed.data.title_zh_cn ?? "",
    sort_order: parsed.data.sort_order,
    is_published: parsed.data.is_published,
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.id) {
    const { error } = await admin
      .from("mine_photo_categories")
      .update(row)
      .eq("id", parsed.data.id);
    if (error) return { data: null, error: { message: error.message } };
    await writeAuditLog(user.id, "mine_photo_category.update", "mine_photo_category", parsed.data.id, row);
    revalidateMinePhotos();
    return { data: { id: parsed.data.id }, error: null };
  }

  const { data, error } = await admin
    .from("mine_photo_categories")
    .insert(row)
    .select("id")
    .single<{ id: string }>();
  if (error) return { data: null, error: { message: error.message } };
  await writeAuditLog(user.id, "mine_photo_category.create", "mine_photo_category", data.id, row);
  revalidateMinePhotos();
  return { data: { id: data.id }, error: null };
}

export async function deleteMinePhotoCategory(
  categoryId: string
): Promise<ActionResult<true>> {
  const { user, error: authError } = await requireAdmin();
  if (!user) return { data: null, error: { message: authError! } };

  const idParsed = z.string().uuid().safeParse(categoryId);
  if (!idParsed.success) return { data: null, error: { message: "Invalid category id." } };

  const admin = createAdminClient();
  const { data: photos } = await admin
    .from("mine_photos")
    .select("storage_path_thumb, storage_path_full")
    .eq("category_id", categoryId);

  const paths = (photos ?? []).flatMap((p) => [
    p.storage_path_thumb,
    p.storage_path_full,
  ]);
  if (paths.length) {
    await admin.storage.from(MINE_PHOTOS_BUCKET).remove(paths);
  }

  const { data: cat } = await admin
    .from("mine_photo_categories")
    .select("slug")
    .eq("id", categoryId)
    .maybeSingle<{ slug: string }>();
  if (cat?.slug) {
    await admin.storage
      .from(MINE_PHOTOS_BUCKET)
      .remove([minePhotoCoverPath(cat.slug)]);
  }

  const { error } = await admin
    .from("mine_photo_categories")
    .delete()
    .eq("id", categoryId);
  if (error) return { data: null, error: { message: error.message } };

  await writeAuditLog(user.id, "mine_photo_category.delete", "mine_photo_category", categoryId);
  revalidateMinePhotos();
  return { data: true, error: null };
}

export async function uploadMinePhotoCover(
  formData: FormData
): Promise<ActionResult<{ cover_url: string }>> {
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

  const inputBuf = Buffer.from(await file.arrayBuffer());
  const coverBuf = await resizeMinePhotoCover(inputBuf);
  const path = minePhotoCoverPath(cat.slug);

  const { error: upErr } = await admin.storage
    .from(MINE_PHOTOS_BUCKET)
    .upload(path, coverBuf, { contentType: "image/jpeg", upsert: true });
  if (upErr) return { data: null, error: { message: upErr.message } };

  const cover_url = minePhotoPublicUrl(PUBLIC_SUPABASE_URL, path);
  const { error: dbErr } = await admin
    .from("mine_photo_categories")
    .update({ cover_url, updated_at: new Date().toISOString() })
    .eq("id", categoryId);
  if (dbErr) return { data: null, error: { message: dbErr.message } };

  await writeAuditLog(user.id, "mine_photo_category.cover", "mine_photo_category", categoryId);
  revalidateMinePhotos();
  return { data: { cover_url }, error: null };
}

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
  revalidateMinePhotos();
  return { data: { id: photoId, thumb_url, full_url }, error: null };
}

export async function updateMinePhoto(
  input: z.infer<typeof PhotoMetaSchema>
): Promise<ActionResult<true>> {
  const { user, error: authError } = await requireAdmin();
  if (!user) return { data: null, error: { message: authError! } };

  const parsed = PhotoMetaSchema.safeParse(input);
  if (!parsed.success) return { data: null, error: { message: "Invalid input." } };

  const admin = createAdminClient();
  const { error } = await admin
    .from("mine_photos")
    .update({
      alt_en: parsed.data.alt_en ?? "",
      alt_zh_cn: parsed.data.alt_zh_cn ?? "",
      sort_order: parsed.data.sort_order,
      is_published: parsed.data.is_published,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id);
  if (error) return { data: null, error: { message: error.message } };

  await writeAuditLog(user.id, "mine_photo.update", "mine_photo", parsed.data.id);
  revalidateMinePhotos();
  return { data: true, error: null };
}

export async function deleteMinePhoto(photoId: string): Promise<ActionResult<true>> {
  const { user, error: authError } = await requireAdmin();
  if (!user) return { data: null, error: { message: authError! } };

  const idParsed = z.string().uuid().safeParse(photoId);
  if (!idParsed.success) return { data: null, error: { message: "Invalid photo id." } };

  const admin = createAdminClient();
  const { data: photo } = await admin
    .from("mine_photos")
    .select("storage_path_thumb, storage_path_full")
    .eq("id", photoId)
    .maybeSingle<{ storage_path_thumb: string; storage_path_full: string }>();
  if (!photo) return { data: null, error: { message: "Photo not found." } };

  await admin.storage
    .from(MINE_PHOTOS_BUCKET)
    .remove([photo.storage_path_thumb, photo.storage_path_full]);

  const { error } = await admin.from("mine_photos").delete().eq("id", photoId);
  if (error) return { data: null, error: { message: error.message } };

  await writeAuditLog(user.id, "mine_photo.delete", "mine_photo", photoId);
  revalidateMinePhotos();
  return { data: true, error: null };
}
