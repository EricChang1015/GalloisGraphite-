"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { CheckIcon, XIcon } from "lucide-react";

import { acceptInquiry, rejectInquiry } from "@/actions/inquiry";
import { Button } from "@/components/ui/button";

export function InquiryActions({ inquiryId }: { inquiryId: string }) {
  const router = useRouter();
  const t = useTranslations("listings.inquiryActions");
  const [isPending, startTransition] = useTransition();

  function handleAccept() {
    startTransition(async () => {
      const result = await acceptInquiry(inquiryId);
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success(t("toast.accepted"));
      router.push(`/inquiries/${inquiryId}`);
    });
  }

  function handleReject() {
    startTransition(async () => {
      const result = await rejectInquiry(inquiryId);
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success(t("toast.rejected"));
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={handleAccept} disabled={isPending}>
        <CheckIcon className="w-3 h-3 mr-1" />
        {t("accept")}
      </Button>
      <Button size="sm" variant="destructive" onClick={handleReject} disabled={isPending}>
        <XIcon className="w-3 h-3 mr-1" />
        {t("reject")}
      </Button>
    </div>
  );
}
