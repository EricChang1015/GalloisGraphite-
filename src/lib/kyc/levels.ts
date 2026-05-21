import "server-only";

import type { KycDocEntry } from "@/lib/kyc/types";
import { KYC_MAX_LEVEL } from "@/lib/kyc/types";

/** Levels are independent paths; use max() when granting a new milestone. */
export function mergeKycLevel(current: number, granted: number): number {
  const c = Math.max(0, Math.min(KYC_MAX_LEVEL, current));
  const g = Math.max(0, Math.min(KYC_MAX_LEVEL, granted));
  return Math.max(c, g);
}

export function levelAfterPhoneVerify(current: number): number {
  return mergeKycLevel(current, 1);
}

export function levelAfterDocumentApproval(current: number): number {
  return mergeKycLevel(current, 2);
}

export function hasPendingDocuments(docs: KycDocEntry[]): boolean {
  return docs.some((d) => (d.status ?? "pending") === "pending");
}

export function hasIdOrDocOnFile(docs: KycDocEntry[]): boolean {
  return docs.length > 0;
}
