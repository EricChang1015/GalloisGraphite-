"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { uploadOrderDocument } from "@/actions/document";
import type { DocumentType } from "@/lib/validations/document";

interface DocumentUploaderProps {
  orderId: string;
  type: DocumentType;
  /** Pretty label shown above the file input */
  label?: string;
  /** When true, render compact inline variant */
  compact?: boolean;
  /** Restrict accepted file types. Default: image + PDF */
  accept?: string;
  /** Max file size in MB. Default 10. */
  maxMb?: number;
  onUploaded?: () => void;
}

const BUCKET = "order-documents";

export function DocumentUploader({
  orderId,
  type,
  label,
  compact,
  accept = "image/*,application/pdf",
  maxMb = 10,
  onUploaded,
}: DocumentUploaderProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [, startTransition] = useTransition();

  function reset() {
    setFile(null);
    setIsUploading(false);
  }

  async function handleUpload() {
    if (!file) return;
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`File exceeds ${maxMb}MB limit.`);
      return;
    }

    setIsUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${orderId}/${type}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (uploadError) {
        toast.error(`Upload failed: ${uploadError.message}`);
        setIsUploading(false);
        return;
      }

      // Use a signed URL since the bucket is private
      const { data: signed, error: signErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 60 * 60 * 24 * 365);

      if (signErr || !signed?.signedUrl) {
        toast.error(`Could not generate signed URL.`);
        setIsUploading(false);
        return;
      }

      startTransition(async () => {
        const result = await uploadOrderDocument({
          order_id: orderId,
          type,
          file_url: signed.signedUrl,
          file_name: file.name,
          file_size_bytes: file.size,
          mime_type: file.type || undefined,
          metadata: { storage_path: path },
        });

        if (result.error) {
          toast.error(result.error.message);
        } else {
          toast.success("Document uploaded.");
          reset();
          onUploaded?.();
          router.refresh();
        }
        setIsUploading(false);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected upload error.";
      toast.error(message);
      setIsUploading(false);
    }
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Input
          type="file"
          accept={accept}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="h-8 text-xs"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!file || isUploading}
          onClick={handleUpload}
        >
          {isUploading ? "Uploading…" : "Upload"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {label && <Label className="text-xs">{label}</Label>}
      <div className="flex items-center gap-2">
        <Input
          type="file"
          accept={accept}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="cursor-pointer"
        />
        {file && (
          <Button size="icon" variant="ghost" onClick={reset} aria-label="Clear file">
            <X className="size-4" />
          </Button>
        )}
      </div>
      {file && (
        <div className="text-xs text-muted-foreground flex items-center justify-between">
          <span className="truncate max-w-[60%]">{file.name}</span>
          <Button
            size="sm"
            disabled={isUploading}
            onClick={handleUpload}
            className="gap-1.5"
          >
            <Upload className="size-3.5" />
            {isUploading ? "Uploading…" : "Upload"}
          </Button>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground">
        Max {maxMb}MB. Images or PDF.
      </p>
    </div>
  );
}
