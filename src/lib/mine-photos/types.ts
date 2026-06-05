export type MinePhotoCategoryRow = {
  id: string;
  legacy_cid: number | null;
  slug: string;
  title_en: string;
  title_zh_cn: string;
  cover_url: string | null;
  cover_photo_id: string | null;
  sort_order: number;
  is_published: boolean;
};

export type MinePhotoRow = {
  id: string;
  category_id: string;
  thumb_url: string;
  full_url: string;
  storage_path_thumb: string;
  storage_path_full: string;
  alt_en: string;
  alt_zh_cn: string;
  sort_order: number;
  is_published: boolean;
};

export type MinePhotoCategoryWithPhotos = MinePhotoCategoryRow & {
  photos: MinePhotoRow[];
};

/** Resolve display cover URL from selected photo or legacy cover_url. */
export function resolveCategoryCoverUrl(
  category: Pick<MinePhotoCategoryRow, "cover_url" | "cover_photo_id">,
  photos: Pick<MinePhotoRow, "id" | "thumb_url">[]
): string | null {
  if (category.cover_photo_id) {
    const selected = photos.find((p) => p.id === category.cover_photo_id);
    if (selected) return selected.thumb_url;
  }
  if (category.cover_url) return category.cover_url;
  return photos[0]?.thumb_url ?? null;
}
