"use server";

import "server-only";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { MINE_PHOTOS_BUCKET } from "@/lib/mine-photos/images";
import type { ActionResult } from "./auth";
import {
  requireAdmin,
  revalidateAllMinePhotos,
  revalidatePublicMinePhotos,
  writeAuditLog,
} from "./mine-photos-admin-internal";

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
    revalidateAllMinePhotos();
    return { data: { id: parsed.data.id }, error: null };
  }

  const { data, error } = await admin
    .from("mine_photo_categories")
    .insert(row)
    .select("id")
    .single<{ id: string }>();
  if (error) return { data: null, error: { message: error.message } };
  await writeAuditLog(user.id, "mine_photo_category.create", "mine_photo_category", data.id, row);
  revalidateAllMinePhotos();
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

  const { error } = await admin
    .from("mine_photo_categories")
    .delete()
    .eq("id", categoryId);
  if (error) return { data: null, error: { message: error.message } };

  await writeAuditLog(user.id, "mine_photo_category.delete", "mine_photo_category", categoryId);
  revalidateAllMinePhotos();
  return { data: true, error: null };
}

export async function setMinePhotoCategoryCover(
  categoryId: string,
  photoId: string
): Promise<ActionResult<{ cover_url: string }>> {
  const { user, error: authError } = await requireAdmin();
  if (!user) return { data: null, error: { message: authError! } };

  const catParsed = z.string().uuid().safeParse(categoryId);
  const photoParsed = z.string().uuid().safeParse(photoId);
  if (!catParsed.success || !photoParsed.success) {
    return { data: null, error: { message: "Invalid id." } };
  }

  const admin = createAdminClient();
  const { data: photo } = await admin
    .from("mine_photos")
    .select("category_id, thumb_url")
    .eq("id", photoId)
    .maybeSingle<{ category_id: string; thumb_url: string }>();
  if (!photo || photo.category_id !== categoryId) {
    return { data: null, error: { message: "Photo not found in this category." } };
  }

  const { error } = await admin
    .from("mine_photo_categories")
    .update({
      cover_photo_id: photoId,
      cover_url: photo.thumb_url,
      updated_at: new Date().toISOString(),
    })
    .eq("id", categoryId);
  if (error) return { data: null, error: { message: error.message } };

  await writeAuditLog(user.id, "mine_photo_category.cover", "mine_photo_category", categoryId, {
    cover_photo_id: photoId,
  });
  revalidatePublicMinePhotos();
  return { data: { cover_url: photo.thumb_url }, error: null };
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
  revalidatePublicMinePhotos();
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
    .select("category_id, storage_path_thumb, storage_path_full")
    .eq("id", photoId)
    .maybeSingle<{
      category_id: string;
      storage_path_thumb: string;
      storage_path_full: string;
    }>();
  if (!photo) return { data: null, error: { message: "Photo not found." } };

  await admin.storage
    .from(MINE_PHOTOS_BUCKET)
    .remove([photo.storage_path_thumb, photo.storage_path_full]);

  const { error } = await admin.from("mine_photos").delete().eq("id", photoId);
  if (error) return { data: null, error: { message: error.message } };

  await admin
    .from("mine_photo_categories")
    .update({ cover_photo_id: null, updated_at: new Date().toISOString() })
    .eq("cover_photo_id", photoId);

  const { data: siblings } = await admin
    .from("mine_photos")
    .select("thumb_url")
    .eq("category_id", photo.category_id)
    .order("sort_order", { ascending: true })
    .limit(1)
    .returns<{ thumb_url: string }[]>();
  if (siblings?.[0]) {
    await admin
      .from("mine_photo_categories")
      .update({ cover_url: siblings[0].thumb_url, updated_at: new Date().toISOString() })
      .eq("id", photo.category_id)
      .is("cover_photo_id", null);
  }

  await writeAuditLog(user.id, "mine_photo.delete", "mine_photo", photoId);
  revalidatePublicMinePhotos();
  return { data: true, error: null };
}
