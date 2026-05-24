/**
 * Shared constants and helpers for the listing-images pipeline.
 *
 * Storage layout (enforced by `024_listings_bucket.sql`):
 *
 *     listings/{seller_user_id}/{uuid}.{ext}
 *
 * Bucket is public; URLs are stable; deletion goes through the
 * `deleteListingImage` server action so we can scrub references in
 * `listings.images` jsonb arrays.
 */

export const LISTINGS_BUCKET = "listings";

/** Per-file cap enforced by the bucket. Keep in sync with migration 024. */
export const LISTING_IMAGE_MAX_BYTES = 2 * 1024 * 1024; // 2 MiB

/**
 * Pre-compression cap. Sellers can drag in larger files; the browser
 * resizes them to 720p WebP before upload. 12 MiB is plenty for a
 * modern phone photo and stops 50 MB ProRes nonsense early.
 */
export const LISTING_IMAGE_RAW_MAX_BYTES = 12 * 1024 * 1024;

/** MIME types accepted by the storage bucket *after* client-side compression. */
export const LISTING_IMAGE_ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/**
 * MIME types we'll accept *before* compression on the client side. We
 * intentionally include common phone formats (HEIC etc.) — the
 * compressor downgrades them to WebP before they reach the bucket.
 */
export const LISTING_IMAGE_CLIENT_ACCEPT = [
  ...LISTING_IMAGE_ALLOWED_MIME,
  "image/heic",
  "image/heif",
  "image/jpg", // some browsers report this
] as const;

/** Max images a seller may attach to a single listing. */
export const LISTING_IMAGES_PER_LISTING = 5;

/** Path under the bucket: `{uid}/{uuid}.{ext}`. */
export function listingImageObjectPath(userId: string, ext: string): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "webp";
  return `${userId}/${crypto.randomUUID()}.${safeExt}`;
}

/** Public URL for an object in the listings bucket. */
export function listingImagePublicUrl(
  supabaseUrl: string,
  objectPath: string
): string {
  const base = supabaseUrl.replace(/\/$/, "");
  const segments = objectPath.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/${LISTINGS_BUCKET}/${segments}`;
}

/**
 * Reverse: given a public URL, return the object path under the bucket
 * (`{uid}/{uuid}.{ext}`) — or null if the URL doesn't look like one of
 * our listings-bucket objects.
 */
export function objectPathFromListingImageUrl(
  supabaseUrl: string,
  url: string
): string | null {
  if (!url) return null;
  const base = supabaseUrl.replace(/\/$/, "");
  const prefix = `${base}/storage/v1/object/public/${LISTINGS_BUCKET}/`;
  if (!url.startsWith(prefix)) return null;
  try {
    return url
      .slice(prefix.length)
      .split("/")
      .map(decodeURIComponent)
      .join("/");
  } catch {
    return null;
  }
}

/**
 * Extract the owner segment from a stored object path. Returns null if
 * the path isn't in the `{uid}/{uuid}.{ext}` shape.
 */
export function ownerFromListingImagePath(path: string): string | null {
  const seg = path.split("/")[0];
  return seg && seg.length > 0 ? seg : null;
}

/** Guess an extension from a MIME type for object naming. */
export function extFromMime(mime: string): string {
  switch (mime.toLowerCase()) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "webp";
  }
}
