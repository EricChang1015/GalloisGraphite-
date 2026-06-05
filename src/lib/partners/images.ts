export const PARTNERS_BUCKET = "partners";
export const PARTNER_ICON_MAX_BYTES = 2 * 1024 * 1024;

export const PARTNER_ICON_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
]);

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export function partnerIconPath(slug: string, mime: string): string {
  const ext = MIME_EXT[mime] ?? "bin";
  return `${slug}/icon.${ext}`;
}

export function partnerPublicUrl(supabaseUrl: string, path: string): string {
  const base = supabaseUrl.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${PARTNERS_BUCKET}/${path}`;
}
