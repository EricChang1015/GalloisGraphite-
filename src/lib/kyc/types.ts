export const KYC_DOC_TYPES = [
  "business_registration",
  "id_document",
  "other",
] as const;

export type KycDocType = (typeof KYC_DOC_TYPES)[number];

export const KYC_DOC_STATUSES = ["pending", "approved", "rejected"] as const;
export type KycDocStatus = (typeof KYC_DOC_STATUSES)[number];

export type KycDocEntry = {
  id: string;
  type: KycDocType;
  storage_path: string;
  file_name: string;
  uploaded_at: string;
  status?: KycDocStatus;
  reviewed_at?: string;
  reviewed_by?: string;
};

/** Highest assignable KYC level (level 3 = admin-only premium / listing). */
export const KYC_MAX_LEVEL = 3;

export const KYC_LEVEL_LABELS: Record<number, string> = {
  0: "Email verified (account login)",
  1: "Phone verified",
  2: "Identity / documents verified",
  3: "Premium (admin — e.g. seller listing)",
};

export function parseKycDocs(raw: unknown): KycDocEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: KycDocEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (
      typeof row.id !== "string" ||
      typeof row.type !== "string" ||
      typeof row.storage_path !== "string" ||
      typeof row.file_name !== "string" ||
      typeof row.uploaded_at !== "string"
    ) {
      continue;
    }
    if (!KYC_DOC_TYPES.includes(row.type as KycDocType)) continue;
    const status =
      typeof row.status === "string" &&
      KYC_DOC_STATUSES.includes(row.status as KycDocStatus)
        ? (row.status as KycDocStatus)
        : "pending";
    out.push({
      id: row.id,
      type: row.type as KycDocType,
      storage_path: row.storage_path,
      file_name: row.file_name,
      uploaded_at: row.uploaded_at,
      status,
      reviewed_at:
        typeof row.reviewed_at === "string" ? row.reviewed_at : undefined,
      reviewed_by:
        typeof row.reviewed_by === "string" ? row.reviewed_by : undefined,
    });
  }
  return out;
}

export function summarizeKycDocs(docs: KycDocEntry[]) {
  const pending = docs.filter((d) => (d.status ?? "pending") === "pending").length;
  const approved = docs.filter((d) => d.status === "approved").length;
  const rejected = docs.filter((d) => d.status === "rejected").length;
  return { total: docs.length, pending, approved, rejected };
}
