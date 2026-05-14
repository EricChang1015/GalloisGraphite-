"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, XIcon } from "lucide-react";

import { acceptInquiry, rejectInquiry } from "@/actions/inquiry";
import { Button } from "@/components/ui/button";

export function InquiryActions({ inquiryId }: { inquiryId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleAccept() {
    startTransition(async () => {
      const result = await acceptInquiry(inquiryId);
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Default quotation sent. Buyer can accept, counter or decline.");
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
      toast.success("Inquiry rejected.");
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={handleAccept} disabled={isPending}>
        <CheckIcon className="w-3 h-3 mr-1" />
        Accept
      </Button>
      <Button size="sm" variant="destructive" onClick={handleReject} disabled={isPending}>
        <XIcon className="w-3 h-3 mr-1" />
        Reject
      </Button>
    </div>
  );
}
