export const AVATAR_BUCKET = "avatars";

/** Max upload size enforced by the `avatars` bucket (2 MB). */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export const AVATAR_ALLOWED_MIME = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export type AvatarProfileFields = {
  id?: string;
  full_name: string | null;
  company_name: string | null;
  avatar_url?: string | null;
};

/** Subset passed from server layouts into AI chat UI. */
export type AiChatUserAvatar = Pick<
  AvatarProfileFields,
  "full_name" | "company_name" | "avatar_url"
>;

/** Stable object path: `<userId>/avatar.<ext>` */
export function avatarObjectPath(userId: string, fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "jpg";
  return `${userId}/avatar.${ext}`;
}

/**
 * Public URL for an object in the avatars bucket.
 * Caller must pass the same Supabase project URL as NEXT_PUBLIC_SUPABASE_URL.
 */
export function avatarPublicUrl(supabaseUrl: string, objectPath: string): string {
  const base = supabaseUrl.replace(/\/$/, "");
  const segments = objectPath.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/${AVATAR_BUCKET}/${segments}`;
}

/** Accept Supabase public avatars URLs or known OAuth provider photo hosts. */
export function isAllowedAvatarUrl(url: string, supabaseUrl: string): boolean {
  try {
    const parsed = new URL(url);
    const base = supabaseUrl.replace(/\/$/, "");
    const storagePrefix = `${base}/storage/v1/object/public/${AVATAR_BUCKET}/`;
    if (parsed.href.startsWith(storagePrefix)) return true;
    const host = parsed.hostname;
    return (
      host === "lh3.googleusercontent.com" ||
      host.endsWith(".googleusercontent.com")
    );
  } catch {
    return false;
  }
}
