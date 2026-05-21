"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileCheck, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import {
  approveKycDocuments,
  getUserKycForAdmin,
  setUserKycLevel,
} from "@/actions/admin";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KYC_LEVEL_LABELS, KYC_MAX_LEVEL } from "@/lib/kyc/types";

interface Props {
  userId: string;
  userLabel: string;
  currentKycLevel: number;
  pendingDocCount: number;
}

type DocWithUrl = {
  id: string;
  type: string;
  file_name: string;
  status?: string;
  signedUrl: string | null;
};

export function UserKycDialog({
  userId,
  userLabel,
  currentKycLevel,
  pendingDocCount,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kycLevel, setKycLevel] = useState(String(currentKycLevel));
  const [documents, setDocuments] = useState<DocWithUrl[]>([]);
  const [phone, setPhone] = useState<string | null>(null);
  const [phoneVerifiedAt, setPhoneVerifiedAt] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(pendingDocCount);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;
    setLoading(true);
    setDocuments([]);
    void getUserKycForAdmin(userId).then((result) => {
      setLoading(false);
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      setDocuments(result.data?.documents ?? []);
      setKycLevel(String(result.data?.kycLevel ?? currentKycLevel));
      setPhone(result.data?.phone ?? null);
      setPhoneVerifiedAt(result.data?.phoneVerifiedAt ?? null);
      setPendingCount(result.data?.docSummary.pending ?? 0);
    });
  }

  function handleSave() {
    startTransition(async () => {
      const result = await setUserKycLevel({
        userId,
        kycLevel: Number(kycLevel),
        note: "Adjusted from admin users table",
      });
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success("KYC level updated.");
      setOpen(false);
      router.refresh();
    });
  }

  function handleApproveDocs() {
    startTransition(async () => {
      const result = await approveKycDocuments({
        userId,
        note: "Documents approved from admin KYC dialog",
      });
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success(`Documents approved. User is now level ${result.data?.kycLevel ?? 2}.`);
      setOpen(false);
      router.refresh();
    });
  }

  const triggerVariant = pendingDocCount > 0 ? "default" : "outline";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant={triggerVariant}
            size="sm"
            className="h-7 text-xs gap-1"
          />
        }
      >
        <ShieldCheck className="size-3" />
        KYC
        {pendingDocCount > 0 ? ` (${pendingDocCount})` : ""}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>KYC — {userLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {pendingCount > 0 ? (
            <div className="rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm">
              <p className="font-medium text-amber-200">
                {pendingCount} document{pendingCount > 1 ? "s" : ""} awaiting review
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Approve to grant Level 2 (identity verified). Phone verification
                is not required first.
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-2 gap-1"
                disabled={isPending}
                onClick={handleApproveDocs}
              >
                <FileCheck className="size-3" />
                Approve documents → Level 2
              </Button>
            </div>
          ) : null}

          <div className="text-sm space-y-1 rounded-md border px-3 py-2">
            <p>
              <span className="text-muted-foreground">Phone:</span>{" "}
              {phone ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Phone verified:</span>{" "}
              {phoneVerifiedAt
                ? new Date(phoneVerifiedAt).toLocaleString()
                : "No"}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`kyc-level-${userId}`}>KYC level (admin override)</Label>
            <Select
              value={kycLevel}
              onValueChange={(v) => {
                if (v != null) setKycLevel(v);
              }}
            >
              <SelectTrigger id={`kyc-level-${userId}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: KYC_MAX_LEVEL + 1 }, (_, n) => n).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} — {KYC_LEVEL_LABELS[n]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Level 3 is for trusted sellers (e.g. listing gate). Document
              approval sets level 2; phone OTP sets level 1. All changes are
              logged in audit_logs.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Uploaded documents</Label>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents on file.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {documents.map((doc) => (
                  <li key={doc.id} className="rounded border px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{doc.file_name}</p>
                      <span className="text-[10px] uppercase text-muted-foreground">
                        {doc.status ?? "pending"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{doc.type}</p>
                    {doc.signedUrl ? (
                      <a
                        href={doc.signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary underline underline-offset-4"
                      >
                        View file
                      </a>
                    ) : (
                      <p className="text-xs text-amber-400">Signed URL unavailable</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Button type="button" onClick={handleSave} disabled={isPending}>
            Save KYC level
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
