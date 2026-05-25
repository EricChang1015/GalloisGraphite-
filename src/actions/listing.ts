"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase/server";
import {
  describeCommercialGap,
  findCommercialProfileGaps,
} from "@/lib/auth/commercial";
import { checkKycGate } from "@/lib/kyc/gate";
import { describeKycGateFailure } from "@/lib/kyc/messages";
import { ListingInputSchema, type ListingInput } from "@/lib/validations/forms";
import type { ActionResult } from "./auth";

type ListingStatus = "active" | "paused" | "sold_out";

async function requireSellerLikeUser() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false as const,
      error: { message: "Not authenticated." },
    };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle<{ role: string; status: string }>();
  if (!profile || profile.status !== "active") {
    return {
      ok: false as const,
      error: { message: "Account not active." },
    };
  }
  if (
    profile.role !== "seller" &&
    profile.role !== "admin" &&
    profile.role !== "super_admin"
  ) {
    return {
      ok: false as const,
      error: { message: "Only sellers can manage listings." },
    };
  }
  return {
    ok: true as const,
    user,
    role: profile.role as "seller" | "admin" | "super_admin",
    supabase,
  };
}

export async function createListing(
  input: ListingInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = ListingInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: {
        message: "Invalid input.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
          string,
          string[]
        >,
      },
    };
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Not authenticated." } };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .single<{ role: string; status: string }>();

  if (!profile || profile.status !== "active") {
    return { data: null, error: { message: "Account not active." } };
  }
  if (profile.role !== "seller" && profile.role !== "admin" && profile.role !== "super_admin") {
    return { data: null, error: { message: "Only sellers can create listings." } };
  }

  // Admins/super-admins can list on behalf of others without filling in
  // their own commercial profile (e.g. seeding test data); the gate
  // only applies to real sellers.
  if (profile.role === "seller") {
    const missing = await findCommercialProfileGaps(user.id);
    if (missing.length > 0) {
      return {
        data: null,
        error: {
          message: describeCommercialGap(missing),
          code: "PROFILE_INCOMPLETE",
          fields: missing,
        },
      };
    }

    const kycGate = await checkKycGate(user.id, "create_listing");
    if (!kycGate.ok) {
      return {
        data: null,
        error: {
          message: describeKycGateFailure(
            kycGate.requiredLevel,
            kycGate.currentLevel,
            kycGate.action
          ),
          code: "KYC_REQUIRED",
          requiredLevel: kycGate.requiredLevel,
          currentLevel: kycGate.currentLevel,
        },
      };
    }
  }

  const availableFrom = parsed.data.available_from?.trim() || null;
  const availableTo = parsed.data.available_to?.trim() || null;
  // Normalize optional MOQ: undefined -> null so the DB column stays NULL
  // rather than receiving the undefined sentinel.
  const minOrderQuantity =
    typeof parsed.data.min_order_quantity === "number"
      ? parsed.data.min_order_quantity
      : null;

  const { data, error } = await supabase
    .from("listings")
    .insert({
      seller_id: user.id,
      ...parsed.data,
      specs: parsed.data.specs as unknown as import("@/types/database").Json,
      images: parsed.data.images as unknown as import("@/types/database").Json,
      available_from: availableFrom,
      available_to: availableTo,
      min_order_quantity: minOrderQuantity,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) return { data: null, error: { message: error.message } };

  revalidatePath("/listings");
  revalidatePath("/market");

  return { data: { id: data.id }, error: null };
}

/**
 * Update a listing. Two callers:
 *   1. Status-only toggles (`pauseListing` / `resumeListing` / mark sold-out)
 *      — pass `{ status }` alone, no validation runs.
 *   2. Full-form edit (`/listings/[id]/edit`) — pass the full `ListingInput`
 *      and the same `ListingInputSchema` runs that `createListing` uses.
 *
 * Ownership is enforced by `seller_id = auth.uid()` in the WHERE clause.
 * Admins/super-admins can edit anyone's listing.
 */
export async function updateListing(
  id: string,
  input:
    | (ListingInput & { status?: ListingStatus })
    | { status: ListingStatus }
    | Partial<ListingInput>
): Promise<ActionResult<true>> {
  const auth = await requireSellerLikeUser();
  if (!auth.ok) return { data: null, error: auth.error };
  const { user, role, supabase } = auth;

  // Detect whether this is the "full form edit" call shape — we look for
  // a category_id since that's required on the create schema. A bare
  // status-toggle call doesn't carry it.
  const isFullEdit =
    typeof (input as Partial<ListingInput>).category_id === "string" &&
    typeof (input as Partial<ListingInput>).title === "string";

  let updatePayload: Record<string, unknown>;
  if (isFullEdit) {
    const parsed = ListingInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        data: null,
        error: {
          message: "Invalid input.",
          fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
            string,
            string[]
          >,
        },
      };
    }
    if (role === "seller") {
      const missing = await findCommercialProfileGaps(user.id);
      if (missing.length > 0) {
        return {
          data: null,
          error: {
            message: describeCommercialGap(missing),
            code: "PROFILE_INCOMPLETE",
            fields: missing,
          },
        };
      }
      const kycGate = await checkKycGate(user.id, "create_listing");
      if (!kycGate.ok) {
        return {
          data: null,
          error: {
            message: describeKycGateFailure(
              kycGate.requiredLevel,
              kycGate.currentLevel,
              kycGate.action
            ),
            code: "KYC_REQUIRED",
            requiredLevel: kycGate.requiredLevel,
            currentLevel: kycGate.currentLevel,
          },
        };
      }
    }
    const availableFrom = parsed.data.available_from?.trim() || null;
    const availableTo = parsed.data.available_to?.trim() || null;
    const minOrderQuantity =
      typeof parsed.data.min_order_quantity === "number"
        ? parsed.data.min_order_quantity
        : null;
    const status = (input as { status?: ListingStatus }).status;
    updatePayload = {
      ...parsed.data,
      specs: parsed.data.specs as unknown as import("@/types/database").Json,
      images: parsed.data.images as unknown as import("@/types/database").Json,
      available_from: availableFrom,
      available_to: availableTo,
      min_order_quantity: minOrderQuantity,
      ...(status ? { status } : {}),
    };
  } else {
    // Status-toggle or partial update — pass through after light filtering.
    updatePayload = {
      ...(input as Partial<ListingInput> & { status?: ListingStatus }),
      specs:
        (input as Partial<ListingInput>).specs == null
          ? undefined
          : ((input as Partial<ListingInput>).specs as unknown as import(
              "@/types/database"
            ).Json),
      images:
        (input as Partial<ListingInput>).images == null
          ? undefined
          : ((input as Partial<ListingInput>).images as unknown as import(
              "@/types/database"
            ).Json),
    };
  }

  // Existence + ownership pre-check so we can return a clean error
  // instead of letting an empty update silently succeed.
  let ownershipQ = supabase
    .from("listings")
    .select("id")
    .eq("id", id);
  if (role === "seller") {
    ownershipQ = ownershipQ.eq("seller_id", user.id);
  }
  const { data: ownRow } = await ownershipQ.maybeSingle<{ id: string }>();
  if (!ownRow) {
    return {
      data: null,
      error: {
        message:
          "Listing not found or you don't have permission to edit it.",
        code: "NOT_FOUND_OR_FORBIDDEN",
      },
    };
  }

  type ListingUpdate =
    import("@/types/database").Database["public"]["Tables"]["listings"]["Update"];
  const { error } = await supabase
    .from("listings")
    .update(updatePayload as ListingUpdate)
    .eq("id", id);

  if (error) return { data: null, error: { message: error.message } };

  revalidatePath("/listings");
  revalidatePath("/market");
  revalidatePath(`/market/${id}`);

  return { data: true, error: null };
}

export async function pauseListing(id: string): Promise<ActionResult<true>> {
  return updateListing(id, { status: "paused" });
}

export async function resumeListing(id: string): Promise<ActionResult<true>> {
  return updateListing(id, { status: "active" });
}

export async function markListingSoldOut(
  id: string
): Promise<ActionResult<true>> {
  return updateListing(id, { status: "sold_out" });
}

/**
 * Hard-delete a listing. Refuses if any orders reference it (the
 * `orders.listing_id` FK is `NOT NULL` with no cascade — letting the DB
 * raise the FK violation would crash the request). `inquiries.listing_id`
 * and `quotations.listing_id` cascade to NULL so they don't block.
 *
 * Owner-only by default; admins can delete anything.
 */
export async function deleteListing(
  id: string
): Promise<ActionResult<true>> {
  const auth = await requireSellerLikeUser();
  if (!auth.ok) return { data: null, error: auth.error };
  const { user, role, supabase } = auth;

  // Load the listing first so we can scope the rest of the checks.
  const { data: listing } = await supabase
    .from("listings")
    .select("id, seller_id, status, title")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      seller_id: string;
      status: string;
      title: string;
    }>();
  if (!listing) {
    return {
      data: null,
      error: {
        message: "Listing not found.",
        code: "NOT_FOUND_OR_FORBIDDEN",
      },
    };
  }
  if (
    listing.seller_id !== user.id &&
    role !== "admin" &&
    role !== "super_admin"
  ) {
    return {
      data: null,
      error: {
        message: "You can only delete your own listings.",
        code: "NOT_FOUND_OR_FORBIDDEN",
      },
    };
  }

  // If any orders reference this listing, refuse — those are real
  // commercial events and the FK is `NOT NULL`. Suggest pausing or
  // marking sold-out instead.
  const { count: orderCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", id);
  if ((orderCount ?? 0) > 0) {
    return {
      data: null,
      error: {
        message: `Cannot delete — ${orderCount} order(s) reference this listing. Pause or mark it sold out instead.`,
        code: "LISTING_HAS_ORDERS",
      },
    };
  }

  const { error } = await supabase.from("listings").delete().eq("id", id);
  if (error) return { data: null, error: { message: error.message } };

  revalidatePath("/listings");
  revalidatePath("/market");
  return { data: true, error: null };
}
