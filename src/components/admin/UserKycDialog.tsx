"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { getUserKycForAdmin, setUserKycLevel } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KYC_LEVEL_LABELS, type KycDocEntry } from "@/lib/kyc/types";

interface Props {
  userId: string;
  userLabel: string;
  currentKycLevel: number;
}

type DocWithUrl = KycDocEntry & { signedUrl: string | null };

export function UserKycDialog({ userId, userLabel, currentKycLevel }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kycLevel, setKycLevel] = useState(String(currentKycLevel));
  const [documents, setDocuments] = useState<DocWithUrl[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setKycLevel(String(currentKycLevel));
    setLoading(true);
    void getUserKycForAdmin(userId).then((result) => {
      setLoading(false);
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      setDocuments(result.data?.documents ?? []);
      setKycLevel(String(result.data?.kycLevel ?? currentKycLevel));
    });
  }, [open, userId, currentKycLevel]);

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" />
        }
      >
        <ShieldCheck className="size-3" />
        KYC
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>KYC — {userLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
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
                {[0, 1, 2].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} — {KYC_LEVEL_LABELS[n]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Skip document review by setting level 1 or 2 directly. All
              changes are written to audit_logs.
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
                    <p className="font-medium">{doc.file_name}</p>
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
