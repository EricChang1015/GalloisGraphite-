"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/actions/auth";
import { parseKycDocs, type KycDocEntry } from "@/lib/kyc/types";
import { createServerClient } from "@/lib/supabase/server";
import {
  RegisterKycDocumentSchema,
  RemoveKycDocumentSchema,
} from "@/lib/validations/kyc";
import type { Json } from "@/types/database";

export async function getMyKycProfile(): Promise<
  ActionResult<{
    kycLevel: number;
    documents: KycDocEntry[];
  }>
> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Not authenticated." } };

  const { data, error } = await supabase
    .from("profiles")
    .select("kyc_level, kyc_docs")
    .eq("id", user.id)
    .maybeSingle<{ kyc_level: number; kyc_docs: Json }>();

  if (error) return { data: null, error: { message: error.message } };

  return {
    data: {
      kycLevel: data?.kyc_level ?? 0,
      documents: parseKycDocs(data?.kyc_docs),
    },
    error: null,
  };
}

export async function registerKycDocument(
  input: z.infer<typeof RegisterKycDocumentSchema>
): Promise<ActionResult<{ document: KycDocEntry }>> {
  const parsed = RegisterKycDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return { data: null, error: { message: "Invalid input." } };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Not authenticated." } };

  const prefix = `${user.id}/`;
  if (!parsed.data.storagePath.startsWith(prefix)) {
    return { data: null, error: { message: "Invalid storage path." } };
  }

  const { data: profile, error: readErr } = await supabase
    .from("profiles")
    .select("kyc_docs")
    .eq("id", user.id)
    .maybeSingle<{ kyc_docs: Json }>();

  if (readErr) return { data: null, error: { message: readErr.message } };

  const docs = parseKycDocs(profile?.kyc_docs);
  const entry: KycDocEntry = {
    id: crypto.randomUUID(),
    type: parsed.data.docType,
    storage_path: parsed.data.storagePath,
    file_name: parsed.data.fileName,
    uploaded_at: new Date().toISOString(),
  };

  const { error: updateErr } = await supabase
    .from("profiles")
    .update({
      kyc_docs: [...docs, entry] as unknown as Json,
    })
    .eq("id", user.id);

  if (updateErr) return { data: null, error: { message: updateErr.message } };

  revalidatePath("/settings");
  revalidatePath("/settings/kyc");

  return { data: { document: entry }, error: null };
}

export async function removeKycDocument(
  input: z.infer<typeof RemoveKycDocumentSchema>
): Promise<ActionResult<true>> {
  const parsed = RemoveKycDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return { data: null, error: { message: "Invalid input." } };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Not authenticated." } };

  const { data: profile, error: readErr } = await supabase
    .from("profiles")
    .select("kyc_docs, kyc_level")
    .eq("id", user.id)
    .maybeSingle<{ kyc_docs: Json; kyc_level: number }>();

  if (readErr) return { data: null, error: { message: readErr.message } };

  if ((profile?.kyc_level ?? 0) >= 2) {
    return {
      data: null,
      error: {
        message:
          "Documents cannot be removed after admin verification. Contact support if you need changes.",
      },
    };
  }

  const docs = parseKycDocs(profile?.kyc_docs);
  const target = docs.find((d) => d.id === parsed.data.docId);
  if (!target) {
    return { data: null, error: { message: "Document not found." } };
  }

  const remaining = docs.filter((d) => d.id !== parsed.data.docId);
  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ kyc_docs: remaining as unknown as Json })
    .eq("id", user.id);

  if (updateErr) return { data: null, error: { message: updateErr.message } };

  await supabase.storage.from("kyc").remove([target.storage_path]);

  revalidatePath("/settings");
  revalidatePath("/settings/kyc");

  return { data: true, error: null };
}
