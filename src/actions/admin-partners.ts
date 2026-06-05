"use server";

import "server-only";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { PARTNERS_BUCKET } from "@/lib/partners/images";
import type { ActionResult } from "./auth";
import {
  requireAdmin,
  writeAuditLog,
} from "./mine-photos-admin-internal";
import { revalidatePath } from "next/cache";

function revalidatePartners() {
  try {
    revalidatePath("/");
  } catch {
    // ignore
  }
}

const PartnerInputSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1).max(200),
  href: z.string().max(500).optional(),
  sort_order: z.coerce.number().int().min(0).max(999),
  is_published: z.coerce.boolean(),
});

export async function upsertPartner(
  input: z.infer<typeof PartnerInputSchema>
): Promise<ActionResult<{ id: string }>> {
  const { user, error: authError } = await requireAdmin();
  if (!user) return { data: null, error: { message: authError! } };

  const parsed = PartnerInputSchema.safeParse(input);
  if (!parsed.success) return { data: null, error: { message: "Invalid input." } };

  const admin = createAdminClient();
  const row = {
    slug: parsed.data.slug,
    name: parsed.data.name,
    href: parsed.data.href ?? "",
    sort_order: parsed.data.sort_order,
    is_published: parsed.data.is_published,
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.id) {
    const { error } = await admin
      .from("partners")
      .update(row)
      .eq("id", parsed.data.id);
    if (error) return { data: null, error: { message: error.message } };
    await writeAuditLog(user.id, "partner.update", "partner", parsed.data.id, row);
    revalidatePartners();
    return { data: { id: parsed.data.id }, error: null };
  }

  const { data, error } = await admin
    .from("partners")
    .insert(row)
    .select("id")
    .single<{ id: string }>();
  if (error) return { data: null, error: { message: error.message } };
  await writeAuditLog(user.id, "partner.create", "partner", data.id, row);
  revalidatePartners();
  return { data: { id: data.id }, error: null };
}

export async function deletePartner(partnerId: string): Promise<ActionResult<true>> {
  const { user, error: authError } = await requireAdmin();
  if (!user) return { data: null, error: { message: authError! } };

  const idParsed = z.string().uuid().safeParse(partnerId);
  if (!idParsed.success) return { data: null, error: { message: "Invalid partner id." } };

  const admin = createAdminClient();
  const { data: partner } = await admin
    .from("partners")
    .select("storage_path")
    .eq("id", partnerId)
    .maybeSingle<{ storage_path: string | null }>();
  if (!partner) return { data: null, error: { message: "Partner not found." } };

  if (partner.storage_path) {
    await admin.storage.from(PARTNERS_BUCKET).remove([partner.storage_path]);
  }

  const { error } = await admin.from("partners").delete().eq("id", partnerId);
  if (error) return { data: null, error: { message: error.message } };

  await writeAuditLog(user.id, "partner.delete", "partner", partnerId);
  revalidatePartners();
  return { data: true, error: null };
}
