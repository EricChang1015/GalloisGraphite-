"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { createServerClient } from "@/lib/supabase/server";
import {
  LISTINGS_BUCKET,
  LISTING_IMAGE_ALLOWED_MIME,
  LISTING_IMAGE_MAX_BYTES,
  extFromMime,
  listingImageObjectPath,
  listingImagePublicUrl,
  objectPathFromListingImageUrl,
  ownerFromListingImagePath,
} from "@/lib/listings/images";
import type { ActionResult } from "./auth";

const PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

type SellerRole = "seller" | "admin" | "super_admin";

async function requireSellerLikeUser(): Promise<
  | {
      ok: true;
      userId: string;
      role: SellerRole;
      supabase: Awaited<ReturnType<typeof createServerClient>>;
    }
  | { ok: false; error: { message: string; code?: string } }
> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: { message: "Not authenticated." } };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle<{ role: string; status: string }>();
  if (!profile || profile.status !== "active") {
    return { ok: false, error: { message: "Account not active." } };
  }
  const allowed: ReadonlySet<string> = new Set([
    "seller",
    "admin",
    "super_admin",
  ]);
  if (!allowed.has(profile.role)) {
    return {
      ok: false,
      error: { message: "Only sellers can manage listing images." },
    };
  }
  return {
    ok: true,
    userId: user.id,
    role: profile.role as SellerRole,
    supabase,
  };
}

/**
 * Upload one image to the `listings` bucket. The client is expected to
 * have run `compressTo720pWebp` already so the payload should be small.
 *
 * formData fields:
 *   - file: Blob (the compressed image)
 *
 * Returns the public URL + storage path on success.
 */
export async function uploadListingImage(
  formData: FormData
): Promise<ActionResult<{ url: string; path: string; size: number }>> {
  const auth = await requireSellerLikeUser();
  if (!auth.ok) return { data: null, error: auth.error };
  const { userId, supabase } = auth;

  const raw = formData.get("file");
  if (!(raw instanceof Blob)) {
    return {
      data: null,
      error: { message: "Missing `file` upload." },
    };
  }
  const file = raw;
  if (file.size === 0) {
    return { data: null, error: { message: "File is empty." } };
  }
  if (file.size > LISTING_IMAGE_MAX_BYTES) {
    return {
      data: null,
      error: {
        message: `File is too large (${file.size} bytes, max ${LISTING_IMAGE_MAX_BYTES}).`,
        code: "FILE_TOO_LARGE",
      },
    };
  }
  const mime = (file.type || "").toLowerCase();
  if (!(LISTING_IMAGE_ALLOWED_MIME as readonly string[]).includes(mime)) {
    return {
      data: null,
      error: {
        message: `Unsupported file type "${file.type || "unknown"}". Expected jpeg / png / webp.`,
        code: "UNSUPPORTED_MIME",
      },
    };
  }

  const ext = extFromMime(mime);
  const path = listingImageObjectPath(userId, ext);

  // The RLS policy `listings:owner insert` already enforces
  // path[1] === auth.uid(), so the user-scoped server client is the
  // right principal here. No service role needed.
  const { error: uploadError } = await supabase.storage
    .from(LISTINGS_BUCKET)
    .upload(path, file, {
      contentType: mime,
      cacheControl: "31536000, immutable",
      upsert: false,
    });
  if (uploadError) {
    return {
      data: null,
      error: { message: uploadError.message, code: "STORAGE_UPLOAD_FAILED" },
    };
  }

  const url = listingImagePublicUrl(PUBLIC_SUPABASE_URL, path);
  return { data: { url, path, size: file.size }, error: null };
}

/**
 * Delete a listing image from storage *and* scrub it from any of the
 * caller's `listings.images` arrays. Admins / super_admins may delete
 * anyone's image (for moderation).
 */
export async function deleteListingImage(
  pathOrUrl: string
): Promise<ActionResult<true>> {
  const auth = await requireSellerLikeUser();
  if (!auth.ok) return { data: null, error: auth.error };
  const { userId, role, supabase } = auth;

  const path =
    objectPathFromListingImageUrl(PUBLIC_SUPABASE_URL, pathOrUrl) ?? pathOrUrl;
  const owner = ownerFromListingImagePath(path);
  if (!owner) {
    return { data: null, error: { message: "Invalid image path." } };
  }
  if (owner !== userId && role !== "admin" && role !== "super_admin") {
    return {
      data: null,
      error: { message: "You can only remove your own images." },
    };
  }

  const { error: removeError } = await supabase.storage
    .from(LISTINGS_BUCKET)
    .remove([path]);
  if (removeError) {
    return {
      data: null,
      error: { message: removeError.message, code: "STORAGE_DELETE_FAILED" },
    };
  }

  // Best-effort: pull the URL out of any listings that referenced it.
  // We only touch rows owned by the caller (admins handle moderation
  // through a different surface — out of scope here).
  const publicUrl = listingImagePublicUrl(PUBLIC_SUPABASE_URL, path);
  const { data: refs } = await supabase
    .from("listings")
    .select("id, images")
    .eq("seller_id", userId)
    .returns<{ id: string; images: string[] | null }[]>();
  for (const row of refs ?? []) {
    const next = (row.images ?? []).filter((u) => u !== publicUrl);
    if (next.length !== (row.images ?? []).length) {
      await supabase
        .from("listings")
        .update({
          images: next as unknown as import("@/types/database").Json,
        })
        .eq("id", row.id);
      revalidatePath(`/market/${row.id}`);
    }
  }
  revalidatePath("/listings");
  revalidatePath("/market");

  return { data: true, error: null };
}

/**
 * List every image the caller has uploaded to the `listings` bucket.
 * Backs the "From your library" tab in `<ListingImageUploader />` so
 * sellers can re-use previously uploaded photos without re-uploading.
 *
 * RLS doesn't restrict storage.list, but we scope by path prefix
 * `{userId}/` so the response only contains the caller's own files.
 */
export async function listMyListingImages(): Promise<
  ActionResult<{
    images: Array<{
      path: string;
      url: string;
      size: number;
      uploaded_at: string;
    }>;
  }>
> {
  const auth = await requireSellerLikeUser();
  if (!auth.ok) return { data: null, error: auth.error };
  const { userId, supabase } = auth;

  const { data, error } = await supabase.storage
    .from(LISTINGS_BUCKET)
    .list(userId, {
      limit: 200,
      sortBy: { column: "created_at", order: "desc" },
    });
  if (error) {
    return {
      data: null,
      error: { message: error.message, code: "STORAGE_LIST_FAILED" },
    };
  }
  const images = (data ?? [])
    // Supabase returns synthetic .emptyFolderPlaceholder rows we don't want.
    .filter((row) => row.name && !row.name.startsWith("."))
    .map((row) => {
      const path = `${userId}/${row.name}`;
      return {
        path,
        url: listingImagePublicUrl(PUBLIC_SUPABASE_URL, path),
        size:
          typeof row.metadata?.size === "number"
            ? row.metadata.size
            : 0,
        uploaded_at: row.created_at ?? row.updated_at ?? "",
      };
    });
  return { data: { images }, error: null };
}
