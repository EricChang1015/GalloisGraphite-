"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { registerKycDocument, removeKycDocument } from "@/actions/kyc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  KYC_DOC_TYPES,
  KYC_LEVEL_LABELS,
  type KycDocEntry,
  type KycDocType,
} from "@/lib/kyc/types";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "kyc";
const MAX_BYTES = 5 * 1024 * 1024;

const DOC_LABELS: Record<KycDocType, string> = {
  business_registration: "Business registration",
  id_document: "ID / passport (authorized signatory)",
  other: "Other supporting document",
};

interface Props {
  userId: string;
  kycLevel: number;
  initialDocuments: KycDocEntry[];
}

export function KycUploadForm({ userId, kycLevel, initialDocuments }: Props) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  const [docType, setDocType] = useState<KycDocType>("business_registration");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!file) {
      toast.error("Choose a file to upload.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("File must be 5 MB or smaller.");
      return;
    }
    const allowed =
      file.type.startsWith("image/") || file.type === "application/pdf";
    if (!allowed) {
      toast.error("Only images and PDF files are allowed.");
      return;
    }

    setIsUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${userId}/${docType}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (uploadError) {
        toast.error(uploadError.message);
        return;
      }

      const result = await registerKycDocument({
        docType,
        storagePath: path,
        fileName: file.name,
      });

      if (result.error) {
        toast.error(result.error.message);
        await supabase.storage.from(BUCKET).remove([path]);
        return;
      }

      setDocuments((prev) => [...prev, result.data!.document]);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      toast.success("Document uploaded — pending admin review for Level 2.");
      router.refresh();
    } finally {
      setIsUploading(false);
    }
  }

  function handleRemove(docId: string) {
    startTransition(async () => {
      const result = await removeKycDocument({ docId });
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      toast.success("Document removed.");
      router.refresh();
    });
  }

  const canRemove = kycLevel < 2;

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-border bg-muted/30 p-4 text-sm">
        <p className="font-medium text-foreground">
          Current status: {KYC_LEVEL_LABELS[kycLevel] ?? `Level ${kycLevel}`}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Level 0 — email login. Level 1 — phone verified. Level 2 — ID /
          documents approved by admin. Level 3 — premium (admin only). Uploads
          stay pending until an admin approves; phone verification is optional
          and separate.
        </p>
      </div>

      {documents.length > 0 ? (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{doc.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {DOC_LABELS[doc.type]} · {doc.status ?? "pending"} ·{" "}
                  {new Date(doc.uploaded_at).toLocaleString()}
                </p>
              </div>
              {canRemove ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove document"
                  onClick={() => handleRemove(doc.id)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No documents uploaded yet.
        </p>
      )}

      <div className="space-y-3 rounded-lg border p-4">
        <h3 className="text-sm font-semibold">Upload a document</h3>
        <div className="space-y-2">
          <Label htmlFor="kyc-doc-type">Document type</Label>
          <Select
            value={docType}
            onValueChange={(v) => {
              if (v != null) setDocType(v as KycDocType);
            }}
          >
            <SelectTrigger id="kyc-doc-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KYC_DOC_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {DOC_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="kyc-file">File (PDF or image, max 5 MB)</Label>
          <Input
            id="kyc-file"
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <Button
          type="button"
          className="gap-2"
          disabled={isUploading || !file}
          onClick={() => void handleUpload()}
        >
          <FileUp className="size-4" />
          Upload
        </Button>
      </div>
    </div>
  );
}
