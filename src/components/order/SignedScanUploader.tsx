"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { uploadSignedScan } from "@/actions/order";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

interface Props {
  orderId: string;
  role: "buyer" | "seller";
  alreadyUploaded?: boolean;
  /** when true, shows a message that buyer must approve first */
  blockedNeedApproval?: boolean;
}

const BUCKET = "order-documents";

export function SignedScanUploader({
  orderId,
  role,
  alreadyUploaded,
  blockedNeedApproval,
}: Props) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [, startTransition] = useTransition();

  if (alreadyUploaded) {
    return (
      <p className="text-xs text-emerald-400">
        Your signed scan has been uploaded.
      </p>
    );
  }

  if (blockedNeedApproval) {
    return (
      <p className="text-xs text-muted-foreground">
        Waiting for buyer to approve the contract before signature uploads are unlocked.
      </p>
    );
  }

  async function handleUpload() {
    if (!file) return;
    setIsUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${orderId}/contract_signed_${role}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (uploadError) {
        toast.error(`Upload failed: ${uploadError.message}`);
        setIsUploading(false);
        return;
      }

      const { data: signed, error: signErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 60 * 60 * 24 * 365);

      if (signErr || !signed?.signedUrl) {
        toast.error("Could not generate signed URL.");
        setIsUploading(false);
        return;
      }

      startTransition(async () => {
        const result = await uploadSignedScan(orderId, role, signed.signedUrl);
        if (result.error) {
          toast.error(result.error.message);
        } else {
          toast.success("Signed scan uploaded.");
          setFile(null);
          router.refresh();
        }
        setIsUploading(false);
      });
    } catch (err) {
      const m = err instanceof Error ? err.message : "Upload error.";
      toast.error(m);
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Input
        type="file"
        accept="image/*,application/pdf"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="text-xs"
      />
      <Button size="sm" disabled={!file || isUploading} onClick={handleUpload}>
        {isUploading ? "Uploading…" : "Upload signed scan"}
      </Button>
    </div>
  );
}
