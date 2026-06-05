/** Public storage bucket for mining-site photo galleries. */
export const MINE_PHOTOS_BUCKET = "mine-photos";

/** Full-size cap — longest edge scaled to fit inside this box. */
export const MINE_PHOTO_MAX_WIDTH = 1920;
export const MINE_PHOTO_MAX_HEIGHT = 1080;

/** Thumbnail longest edge (WebP). */
export const MINE_PHOTO_THUMB_MAX_EDGE = 480;

/** Per-object cap aligned with migration 031 bucket limit. */
export const MINE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export const MINE_PHOTO_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function minePhotoObjectPath(
  categorySlug: string,
  photoId: string,
  variant: "full" | "thumb"
): string {
  const ext = variant === "full" ? "jpg" : "webp";
  return `${categorySlug}/${photoId}/${variant}.${ext}`;
}

export function minePhotoPublicUrl(
  supabaseUrl: string,
  path: string
): string {
  const base = supabaseUrl.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${MINE_PHOTOS_BUCKET}/${path}`;
}

export function minePhotoCoverPath(categorySlug: string): string {
  return `${categorySlug}/cover.jpg`;
}
