"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase/server";
import {
  describeCommercialGap,
  findCommercialProfileGaps,
} from "@/lib/auth/commercial";
import { ListingInputSchema, type ListingInput } from "@/lib/validations/forms";
import type { ActionResult } from "./auth";

export async function createListing(
  input: ListingInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = ListingInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: { message: "Invalid input.", fieldErrors: z.flattenError(parsed.error).fieldErrors },
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
  }

  const { data, error } = await supabase
    .from("listings")
    .insert({
      seller_id: user.id,
      ...parsed.data,
      specs: parsed.data.specs as unknown as import("@/types/database").Json,
      images: parsed.data.images as unknown as import("@/types/database").Json,
      available_from: parsed.data.available_from ?? null,
      available_to: parsed.data.available_to ?? null,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) return { data: null, error: { message: error.message } };

  revalidatePath("/listings");
  revalidatePath("/market");

  return { data: { id: data.id }, error: null };
}

export async function updateListing(
  id: string,
  input: Partial<ListingInput> & { status?: "active" | "paused" | "sold_out" }
): Promise<ActionResult<true>> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Not authenticated." } };

  const { error } = await supabase
    .from("listings")
    .update({
      ...input,
      specs: input.specs as unknown as import("@/types/database").Json | undefined,
      images: input.images as unknown as import("@/types/database").Json | undefined,
    })
    .eq("id", id)
    .eq("seller_id", user.id);

  if (error) return { data: null, error: { message: error.message } };

  revalidatePath("/listings");
  revalidatePath(`/market/${id}`);

  return { data: true, error: null };
}

export async function pauseListing(id: string): Promise<ActionResult<true>> {
  return updateListing(id, { status: "paused" });
}

export async function resumeListing(id: string): Promise<ActionResult<true>> {
  return updateListing(id, { status: "active" });
}
