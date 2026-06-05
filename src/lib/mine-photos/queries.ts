import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type {
  MinePhotoCategoryRow,
  MinePhotoCategoryWithPhotos,
  MinePhotoRow,
} from "@/lib/mine-photos/types";
export { resolveCategoryCoverUrl } from "@/lib/mine-photos/types";

import type {
  MinePhotoCategoryRow,
  MinePhotoCategoryWithPhotos,
  MinePhotoRow,
} from "@/lib/mine-photos/types";

/** Public gallery — published categories + photos only (RLS). */
export async function getPublishedMinePhotoGallery(): Promise<
  MinePhotoCategoryWithPhotos[]
> {
  const supabase = await createServerClient();
  const { data: categories } = await supabase
    .from("mine_photo_categories")
    .select(
      "id, legacy_cid, slug, title_en, title_zh_cn, cover_url, cover_photo_id, sort_order, is_published"
    )
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .returns<MinePhotoCategoryRow[]>();

  if (!categories?.length) return [];

  const { data: photos } = await supabase
    .from("mine_photos")
    .select(
      "id, category_id, thumb_url, full_url, storage_path_thumb, storage_path_full, alt_en, alt_zh_cn, sort_order, is_published"
    )
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .returns<MinePhotoRow[]>();

  const byCategory = new Map<string, MinePhotoRow[]>();
  for (const p of photos ?? []) {
    const list = byCategory.get(p.category_id) ?? [];
    list.push(p);
    byCategory.set(p.category_id, list);
  }

  return categories.map((c) => ({
    ...c,
    photos: byCategory.get(c.id) ?? [],
  }));
}

/** Admin console — all categories + photos (service role). */
export async function getAdminMinePhotoGallery(): Promise<
  MinePhotoCategoryWithPhotos[]
> {
  const admin = createAdminClient();
  const { data: categories } = await admin
    .from("mine_photo_categories")
    .select(
      "id, legacy_cid, slug, title_en, title_zh_cn, cover_url, cover_photo_id, sort_order, is_published"
    )
    .order("sort_order", { ascending: true })
    .returns<MinePhotoCategoryRow[]>();

  const { data: photos } = await admin
    .from("mine_photos")
    .select(
      "id, category_id, thumb_url, full_url, storage_path_thumb, storage_path_full, alt_en, alt_zh_cn, sort_order, is_published"
    )
    .order("sort_order", { ascending: true })
    .returns<MinePhotoRow[]>();

  const byCategory = new Map<string, MinePhotoRow[]>();
  for (const p of photos ?? []) {
    const list = byCategory.get(p.category_id) ?? [];
    list.push(p);
    byCategory.set(p.category_id, list);
  }

  return (categories ?? []).map((c) => ({
    ...c,
    photos: byCategory.get(c.id) ?? [],
  }));
}
