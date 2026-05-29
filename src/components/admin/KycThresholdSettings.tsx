"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { updateKycThresholds } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  inquiryMinLevel: number;
  listingMinLevel: number;
}

export function KycThresholdSettings({
  inquiryMinLevel,
  listingMinLevel,
}: Props) {
  const router = useRouter();
  const t = useTranslations("admin");
  const tEnums = useTranslations("enums");
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
      toast.success(t("settings.kycGates.updated"));
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("settings.kycGates.intro")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="inquiryMinLevel">{t("settings.kycGates.inquiry")}</Label>
          <Input
            id="inquiryMinLevel"
            name="inquiryMinLevel"
            type="number"
            min={0}
            max={3}
            defaultValue={inquiryMinLevel}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="listingMinLevel">{t("settings.kycGates.listing")}</Label>
          <Input
            id="listingMinLevel"
            name="listingMinLevel"
            type="number"
            min={0}
            max={3}
            defaultValue={listingMinLevel}
            required
          />
        </div>
      </div>
      <ul className="text-xs text-muted-foreground space-y-1">
        {([0, 1, 2, 3] as const).map((level) => (
          <li key={level}>
            {t("settings.kycGates.levelLine", {
              level,
              label: tEnums(`kyc.level.${level}`),
            })}
          </li>
        ))}
      </ul>
      <Button type="submit" disabled={isPending}>
        {t("settings.kycGates.save")}
      </Button>
    </form>
  );
}
