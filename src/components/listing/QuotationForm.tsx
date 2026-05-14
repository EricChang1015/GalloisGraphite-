"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";

import { submitQuotation, counterQuotation } from "@/actions/quotation";
import { QuotationInputSchema } from "@/lib/validations/quotation";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type QuotationInput = z.infer<typeof QuotationInputSchema>;

interface QuotationFormProps {
  inquiryId: string;
  /** When provided, this form acts as a counter-offer rooted at the parent. */
  parentQuotationId?: string;
  defaults?: Partial<QuotationInput>;
  onDone?: () => void;
}

export function QuotationForm({
  inquiryId,
  parentQuotationId,
  defaults,
  onDone,
}: QuotationFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Default validity: 14 days from now (datetime-local format)
  const defaultValidity = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 16);
  })();

  const form = useForm<QuotationInput>({
    resolver: zodResolver(QuotationInputSchema) as unknown as Resolver<QuotationInput>,
    defaultValues: {
      inquiry_id: inquiryId,
      unit_price: defaults?.unit_price ?? 0,
      currency: defaults?.currency ?? "USDT",
      quantity: defaults?.quantity ?? 0,
      unit: defaults?.unit ?? "MT",
      incoterm: defaults?.incoterm ?? "CFR",
      origin_port: defaults?.origin_port ?? "",
      destination_port: defaults?.destination_port ?? "",
      validity_until: defaults?.validity_until ?? defaultValidity,
      specs_confirmed: defaults?.specs_confirmed ?? {},
      shipping_window_from: defaults?.shipping_window_from ?? "",
      shipping_window_to: defaults?.shipping_window_to ?? "",
      notes: defaults?.notes ?? "",
    },
  });

  function onSubmit(values: QuotationInput) {
    startTransition(async () => {
      const result = parentQuotationId
        ? await counterQuotation({ ...values, parent_quotation_id: parentQuotationId })
        : await submitQuotation(values);

      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success(parentQuotationId ? "Counter-offer sent." : "Quotation sent.");
      onDone?.();
      router.refresh();
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step={0.001}
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="MT">MT</SelectItem>
                    <SelectItem value="KG">KG</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="unit_price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit Price</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step={0.01}
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="incoterm"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Incoterm</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="FOB">FOB</SelectItem>
                  <SelectItem value="CFR">CFR</SelectItem>
                  <SelectItem value="CIF">CIF</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="origin_port"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Origin Port</FormLabel>
                <FormControl>
                  <Input placeholder="Toamasina, Madagascar" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="destination_port"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Destination Port</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Shanghai" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="shipping_window_from"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ship Window From</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="shipping_window_to"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ship Window To</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="validity_until"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quotation Valid Until</FormLabel>
              <FormControl>
                <Input type="datetime-local" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (optional)</FormLabel>
              <FormControl>
                <Textarea rows={3} placeholder="Specs notes, packaging, payment expectations…" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" size="sm" disabled={isPending}>
          {isPending
            ? "Sending…"
            : parentQuotationId
            ? "Send Counter-offer"
            : "Send Quotation"}
        </Button>
      </form>
    </Form>
  );
}
