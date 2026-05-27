"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("orders.signedScan");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [, startTransition] = useTransition();

  if (alreadyUploaded) {
    return (
      <p className="text-xs text-emerald-400">{t("alreadyUploaded")}</p>
    );
  }

  if (blockedNeedApproval) {
    return (
      <p className="text-xs text-muted-foreground">{t("blockedNeedApproval")}</p>
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
        toast.error(t("toast.uploadFailed", { msg: uploadError.message }));
        setIsUploading(false);
        return;
      }

      const { data: signed, error: signErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 60 * 60 * 24 * 365);

      if (signErr || !signed?.signedUrl) {
        toast.error(t("toast.signFailed"));
        setIsUploading(false);
        return;
      }

      startTransition(async () => {
        const result = await uploadSignedScan(orderId, role, signed.signedUrl);
        if (result.error) {
          toast.error(result.error.message);
        } else {
          toast.success(t("toast.uploaded"));
          setFile(null);
          router.refresh();
        }
        setIsUploading(false);
      });
    } catch (err) {
      const m = err instanceof Error ? err.message : t("toast.uploadError");
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
        {isUploading ? t("uploadingLabel") : t("uploadLabel")}
      </Button>
    </div>
  );
}
