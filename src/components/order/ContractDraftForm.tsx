"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";

import { draftContract } from "@/actions/order";
import { DraftContractSchema } from "@/lib/validations/forms";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Input = z.infer<typeof DraftContractSchema>;

interface ContractDraftFormProps {
  orderId: string;
  /** existing payment_terms; renders re-draft mode if defined */
  currentPaymentTerms?: "full_prepay" | "net_after_arrival" | null;
  currentPaymentDueDays?: number | null;
  /** when re-drafting, current revision number to show */
  currentRevision?: number;
}

export function ContractDraftForm({
  orderId,
  currentPaymentTerms,
  currentPaymentDueDays,
  currentRevision,
}: ContractDraftFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isRedraft = (currentRevision ?? 0) >= 1;

  const form = useForm<Input>({
    resolver: zodResolver(DraftContractSchema),
    defaultValues: {
      order_id: orderId,
      payment_terms: currentPaymentTerms ?? "full_prepay",
      payment_due_days: currentPaymentDueDays ?? 0,
    },
  });

  const watchedTerms = form.watch("payment_terms");

  function onSubmit(values: Input) {
    startTransition(async () => {
      const result = await draftContract(values);
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success(
        isRedraft
          ? `Contract revision ${result.data!.revision} drafted.`
          : "Contract drafted. Buyer can now review."
      );
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div>
        <p className="text-sm font-medium">
          {isRedraft ? `Re-draft Contract (Revision ${(currentRevision ?? 0) + 1})` : "Draft Contract"}
        </p>
        <p className="text-xs text-muted-foreground">
          Choose payment terms before generating the contract. The buyer must approve
          the terms before either party can upload signed scans.
        </p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="payment_terms"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Terms</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="full_prepay">Full prepay (100% before production)</SelectItem>
                    <SelectItem value="net_after_arrival">Net after arrival (pay N days after vessel ATA)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="payment_due_days"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {watchedTerms === "net_after_arrival" ? "Days after arrival" : "Days to pay (window)"}
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={180}
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value || "0", 10))}
                  />
                </FormControl>
                <FormDescription className="text-xs">
                  {watchedTerms === "net_after_arrival"
                    ? "e.g. 5 / 30 — payment_due_date will be computed when ATA is recorded."
                    : "Buyer must submit payment within this many days of contract signing."}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending
              ? "Drafting…"
              : isRedraft
              ? "Re-draft Contract"
              : "Draft Contract"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
