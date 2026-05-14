"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

import { verifyOrderDocument } from "@/actions/document";
import { Button } from "@/components/ui/button";

export function DocumentVerifyButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handle() {
    startTransition(async () => {
      const result = await verifyOrderDocument({ document_id: documentId });
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Document verified.");
      router.refresh();
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={handle} disabled={isPending}>
      <ShieldCheck className="size-3.5 mr-1" />
      Verify
    </Button>
  );
}
