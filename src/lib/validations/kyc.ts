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
  kycLevel: z.coerce.number().int().min(0).max(3),
  note: z.string().max(500).optional(),
});

export const UpdateKycThresholdsSchema = z.object({
  inquiryMinLevel: z.coerce.number().int().min(0).max(3),
  listingMinLevel: z.coerce.number().int().min(0).max(3),
});

export const RequestPhoneOtpSchema = z.object({
  phone: z
    .string()
    .min(8)
    .max(20)
    .regex(/^\+[1-9]\d{7,18}$/, "Use international format, e.g. +261341234567"),
});

export const VerifyPhoneOtpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const ApproveKycDocumentsSchema = z.object({
  userId: z.string().uuid(),
  note: z.string().max(500).optional(),
});
