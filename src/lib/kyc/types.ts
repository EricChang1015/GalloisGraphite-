export const KYC_DOC_TYPES = [
  "business_registration",
  "id_document",
  "other",
] as const;

export type KycDocType = (typeof KYC_DOC_TYPES)[number];

export type KycDocEntry = {
  id: string;
  type: KycDocType;
  storage_path: string;
  file_name: string;
  uploaded_at: string;
};

export const KYC_LEVEL_LABELS: Record<number, string> = {
  0: "Email verified only",
  1: "Documents submitted",
  2: "Verified by admin",
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
    out.push({
      id: row.id,
      type: row.type as KycDocType,
      storage_path: row.storage_path,
      file_name: row.file_name,
      uploaded_at: row.uploaded_at,
    });
  }
  return out;
}
