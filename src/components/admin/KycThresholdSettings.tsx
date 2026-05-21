"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateKycThresholds } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KYC_LEVEL_LABELS } from "@/lib/kyc/types";

interface Props {
  inquiryMinLevel: number;
  listingMinLevel: number;
}

export function KycThresholdSettings({
  inquiryMinLevel,
  listingMinLevel,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const inquiry = Number(form.get("inquiryMinLevel"));
    const listing = Number(form.get("listingMinLevel"));

    startTransition(async () => {
      const result = await updateKycThresholds({
        inquiryMinLevel: inquiry,
        listingMinLevel: listing,
      });
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success("KYC thresholds updated.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Minimum <code className="text-xs">profiles.kyc_level</code> required
        for each action. Set both to <strong>0</strong> during tuning so all
        active users can trade; raise to 1+ when you want documents on file.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="inquiryMinLevel">Submit inquiry (buyers)</Label>
          <Input
            id="inquiryMinLevel"
            name="inquiryMinLevel"
            type="number"
            min={0}
            max={2}
            defaultValue={inquiryMinLevel}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="listingMinLevel">Create listing (sellers)</Label>
          <Input
            id="listingMinLevel"
            name="listingMinLevel"
            type="number"
            min={0}
            max={2}
            defaultValue={listingMinLevel}
            required
          />
        </div>
      </div>
      <ul className="text-xs text-muted-foreground space-y-1">
        {Object.entries(KYC_LEVEL_LABELS).map(([level, label]) => (
          <li key={level}>
            Level {level}: {label}
          </li>
        ))}
      </ul>
      <Button type="submit" disabled={isPending}>
        Save KYC thresholds
      </Button>
    </form>
  );
}
