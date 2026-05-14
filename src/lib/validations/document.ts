import { z } from "zod";

export const DOCUMENT_TYPES = [
  "contract_signed_buyer",
  "contract_signed_seller",
  "proforma_invoice",
  "commercial_invoice",
  "packing_list",
  "bill_of_lading",
  "coa_sgs",
  "cert_of_origin",
  "insurance_policy",
  "customs_declaration",
  "payment_proof",
  "inspection_report",
  "other",
] as const;

export const DocumentTypeSchema = z.enum(DOCUMENT_TYPES);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;

export const DocumentUploadSchema = z.object({
  order_id: z.string().uuid(),
  type: DocumentTypeSchema,
  file_url: z.string().url(),
  file_name: z.string().max(200).optional(),
  file_size_bytes: z.number().int().positive().optional(),
  mime_type: z.string().max(120).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type DocumentUploadInput = z.infer<typeof DocumentUploadSchema>;

export const VerifyDocumentSchema = z.object({
  document_id: z.string().uuid(),
  note: z.string().max(500).optional(),
});

/** Human-readable labels grouped for UI. */
export const DOCUMENT_GROUPS: Record<string, DocumentType[]> = {
  Contract: ["contract_signed_buyer", "contract_signed_seller"],
  Invoice: ["proforma_invoice", "commercial_invoice"],
  Logistics: ["packing_list", "bill_of_lading", "insurance_policy"],
  Inspection: ["coa_sgs", "inspection_report"],
  Customs: ["cert_of_origin", "customs_declaration"],
  Payment: ["payment_proof"],
  Other: ["other"],
};

export const DOCUMENT_LABEL: Record<DocumentType, string> = {
  contract_signed_buyer: "Buyer Signed Contract",
  contract_signed_seller: "Seller Signed Contract",
  proforma_invoice: "Proforma Invoice",
  commercial_invoice: "Commercial Invoice",
  packing_list: "Packing List",
  bill_of_lading: "Bill of Lading (B/L)",
  coa_sgs: "COA / SGS Report",
  cert_of_origin: "Certificate of Origin",
  insurance_policy: "Insurance Policy",
  customs_declaration: "Customs Declaration",
  payment_proof: "Payment Proof",
  inspection_report: "Inspection Report",
  other: "Other",
};
