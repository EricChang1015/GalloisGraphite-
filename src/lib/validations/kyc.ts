import { z } from "zod";

import { KYC_DOC_TYPES } from "@/lib/kyc/types";

export const RegisterKycDocumentSchema = z.object({
  docType: z.enum(KYC_DOC_TYPES),
  storagePath: z.string().min(1),
  fileName: z.string().min(1).max(255),
});

export const RemoveKycDocumentSchema = z.object({
  docId: z.string().uuid(),
});

export const SetUserKycLevelSchema = z.object({
  userId: z.string().uuid(),
  kycLevel: z.coerce.number().int().min(0).max(2),
  note: z.string().max(500).optional(),
});

export const UpdateKycThresholdsSchema = z.object({
  inquiryMinLevel: z.coerce.number().int().min(0).max(2),
  listingMinLevel: z.coerce.number().int().min(0).max(2),
});
