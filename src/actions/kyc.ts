"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/actions/auth";
import { levelAfterPhoneVerify } from "@/lib/kyc/levels";
import { issuePhoneOtp, verifyPhoneOtp } from "@/lib/kyc/phone-otp";
import { parseKycDocs, type KycDocEntry } from "@/lib/kyc/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import {
  RegisterKycDocumentSchema,
  RemoveKycDocumentSchema,
  RequestPhoneOtpSchema,
  VerifyPhoneOtpSchema,
} from "@/lib/validations/kyc";
import type { Json } from "@/types/database";

export async function getMyKycProfile(): Promise<
  ActionResult<{
    kycLevel: number;
    phone: string | null;
    phoneVerifiedAt: string | null;
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
    .select("kyc_level, kyc_docs, phone, phone_verified_at")
    .eq("id", user.id)
    .maybeSingle<{
      kyc_level: number;
      kyc_docs: Json;
      phone: string | null;
      phone_verified_at: string | null;
    }>();

  if (error) return { data: null, error: { message: error.message } };

  return {
    data: {
      kycLevel: data?.kyc_level ?? 0,
      phone: data?.phone ?? null,
      phoneVerifiedAt: data?.phone_verified_at ?? null,
      documents: parseKycDocs(data?.kyc_docs),
    },
    error: null,
  };
}

export async function requestPhoneOtp(
  input: z.infer<typeof RequestPhoneOtpSchema>
): Promise<ActionResult<{ sentViaSms: boolean; devCode?: string }>> {
  const parsed = RequestPhoneOtpSchema.safeParse(input);
  if (!parsed.success) {
    return { data: null, error: { message: "Invalid phone number format." } };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Not authenticated." } };

  const { error: phoneErr } = await supabase
    .from("profiles")
    .update({ phone: parsed.data.phone })
    .eq("id", user.id);

  if (phoneErr) return { data: null, error: { message: phoneErr.message } };

  try {
    const result = await issuePhoneOtp(user.id, parsed.data.phone);
    revalidatePath("/settings");
    revalidatePath("/settings/kyc");
    return {
      data: {
        sentViaSms: result.sentViaSms,
        ...(result.devCode ? { devCode: result.devCode } : {}),
      },
      error: null,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to send code.";
    return { data: null, error: { message } };
  }
}

export async function verifyPhoneOtpCode(
  input: z.infer<typeof VerifyPhoneOtpSchema>
): Promise<ActionResult<{ kycLevel: number }>> {
  const parsed = VerifyPhoneOtpSchema.safeParse(input);
  if (!parsed.success) {
    return { data: null, error: { message: "Invalid verification code." } };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Not authenticated." } };

  const { data: profile, error: readErr } = await supabase
    .from("profiles")
    .select("phone, kyc_level")
    .eq("id", user.id)
    .maybeSingle<{ phone: string | null; kyc_level: number }>();

  if (readErr) return { data: null, error: { message: readErr.message } };
  if (!profile?.phone?.trim()) {
    return { data: null, error: { message: "Add a phone number first." } };
  }

  const check = await verifyPhoneOtp(user.id, profile.phone, parsed.data.code);
  if (!check.ok) return { data: null, error: { message: check.message } };

  const nextLevel = levelAfterPhoneVerify(profile.kyc_level ?? 0);
  const verifiedAt = new Date().toISOString();

  // Service role: trigger blocks self-updates to kyc_level / phone_verified_at.
  const admin = createAdminClient();
  const { error: updateErr } = await admin
    .from("profiles")
    .update({
      phone_verified_at: verifiedAt,
      kyc_level: nextLevel,
    })
    .eq("id", user.id);

  if (updateErr) return { data: null, error: { message: updateErr.message } };

  const { data: saved, error: readBackErr } = await admin
    .from("profiles")
    .select("kyc_level, phone_verified_at")
    .eq("id", user.id)
    .maybeSingle<{ kyc_level: number; phone_verified_at: string | null }>();

  if (readBackErr) return { data: null, error: { message: readBackErr.message } };
  if (!saved?.phone_verified_at || (saved.kyc_level ?? 0) < 1) {
    return {
      data: null,
      error: {
        message:
          "Verification could not be saved. Please try again or contact support.",
      },
    };
  }

  revalidatePath("/settings");
  revalidatePath("/settings/kyc");
  revalidatePath("/admin/users");

  return { data: { kycLevel: saved.kyc_level }, error: null };
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
    status: "pending",
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
  revalidatePath("/admin/users");

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
  revalidatePath("/admin/users");

  return { data: true, error: null };
}
