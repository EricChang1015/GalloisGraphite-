"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

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
  type KycDocEntry,
  type KycDocType,
} from "@/lib/kyc/types";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "kyc";
const MAX_BYTES = 5 * 1024 * 1024;

interface Props {
  userId: string;
  kycLevel: number;
  initialDocuments: KycDocEntry[];
}

export function KycUploadForm({ userId, kycLevel, initialDocuments }: Props) {
  const router = useRouter();
  const t = useTranslations("kyc.documents");
  const tEnums = useTranslations("enums");
  const [documents, setDocuments] = useState(initialDocuments);
  const [docType, setDocType] = useState<KycDocType>("business_registration");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function docTypeLabel(type: KycDocType): string {
    return t(`types.${type}`);
  }

  function levelLabel(level: number): string {
    if (level >= 0 && level <= 3) {
      return tEnums(`kyc.level.${level as 0 | 1 | 2 | 3}`);
    }
    return t("currentLevelFallback", { level });
  }

  async function handleUpload() {
    if (!file) {
      toast.error(t("toast.chooseFile"));
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(t("toast.tooBig"));
      return;
    }
    const allowed =
      file.type.startsWith("image/") || file.type === "application/pdf";
    if (!allowed) {
      toast.error(t("toast.badType"));
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
      toast.success(t("toast.uploaded"));
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
      toast.success(t("toast.removed"));
      router.refresh();
    });
  }

  const canRemove = kycLevel < 2;

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-border bg-muted/30 p-4 text-sm">
        <p className="font-medium text-foreground">
          {t("currentStatus", { label: levelLabel(kycLevel) })}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("levelsExplainer")}
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
                  {t("lineSecondary", {
                    type: docTypeLabel(doc.type),
                    status: doc.status ?? t("statusFallback"),
                    at: new Date(doc.uploaded_at).toLocaleString(),
                  })}
                </p>
              </div>
              {canRemove ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("removeAria")}
                  onClick={() => handleRemove(doc.id)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      )}

      <div className="space-y-3 rounded-lg border p-4">
        <h3 className="text-sm font-semibold">{t("uploadHeading")}</h3>
        <div className="space-y-2">
          <Label htmlFor="kyc-doc-type">{t("typeLabel")}</Label>
          <Select
            value={docType}
            onValueChange={(v) => {
              if (v != null) setDocType(v as KycDocType);
            }}
          >
            <SelectTrigger id="kyc-doc-type" className="w-full">
              <SelectValue>
                {(value) =>
                  docTypeLabel((value as KycDocType) ?? docType)
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {KYC_DOC_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {docTypeLabel(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="kyc-file">{t("fileLabel")}</Label>
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
          {t("uploadButton")}
        </Button>
      </div>
    </div>
  );
}
