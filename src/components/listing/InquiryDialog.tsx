"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { createInquiry } from "@/actions/inquiry";
import {
  InquiryInputSchema,
  type InquiryInput,
} from "@/lib/validations/inquiry";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface InquiryDialogProps {
  listing: {
    id: string;
    seller_id: string;
    category_id: string;
    title?: string | null;
    unit_price: number;
    currency: string;
    unit: string;
    quantity?: number;
    /** Optional Minimum Order Quantity, in `unit`. */
    min_order_quantity?: number | null;
    /** Short spec chip such as "+100 Mesh · 94% C" (already resolved). */
    spec_summary?: string | null;
    category_name?: string | null;
  };
}

function formatQty(n: number, unit: string): string {
  return `${n.toLocaleString()} ${unit}`;
}

export function InquiryDialog({ listing }: InquiryDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const moq =
    typeof listing.min_order_quantity === "number" &&
    listing.min_order_quantity > 0
      ? listing.min_order_quantity
      : null;

  const form = useForm<InquiryInput>({
    resolver: zodResolver(InquiryInputSchema) as never,
    defaultValues: {
      listing_id: listing.id,
      category_id: listing.category_id,
      seller_id: listing.seller_id,
      // Default to MOQ when set so the buyer doesn't have to remember it.
      requested_qty: moq ?? 1,
      // Leave target_price blank — pre-filling the listing price feels
      // coercive ("I accept this price as-is").
      target_price: undefined,
      destination: "",
      message: "",
    },
  });

  function onSubmit(values: InquiryInput) {
    // Client-side MOQ guard (the server enforces the same rule).
    if (moq != null && values.requested_qty < moq) {
      form.setError("requested_qty", {
        message: `Minimum order is ${formatQty(moq, listing.unit)} for this listing.`,
      });
      return;
    }
    startTransition(async () => {
      const result = await createInquiry(values);
      if (result.error) {
        if (result.error.fieldErrors) {
          for (const [field, messages] of Object.entries(
            result.error.fieldErrors
          )) {
            const msg = Array.isArray(messages) ? messages[0] : messages;
            if (msg)
              form.setError(field as keyof InquiryInput, {
                message: String(msg),
              });
          }
        }
        if (result.error.code === "PROFILE_INCOMPLETE") {
          toast.error(result.error.message, {
            duration: 8000,
            action: {
              label: "Open Settings",
              onClick: () => router.push("/settings?prompt=incomplete"),
            },
          });
        } else if (result.error.code === "KYC_REQUIRED") {
          toast.error(result.error.message, {
            duration: 8000,
            action: {
              label: "KYC page",
              onClick: () => router.push("/settings/kyc"),
            },
          });
        } else if (result.error.code === "BELOW_MOQ") {
          toast.error(result.error.message);
        } else {
          toast.error(result.error.message);
        }
        return;
      }
      toast.success("Inquiry submitted! The seller will respond shortly.");
      setOpen(false);
      router.push("/inquiries");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            size="lg"
            className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
          />
        }
      >
        Submit Inquiry
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Submit an Inquiry</DialogTitle>
        </DialogHeader>

        {/* Listing summary — gives the buyer the spec / commercial
            context without having to scroll back to the detail page. */}
        <div className="rounded-md border bg-card/40 p-3 text-xs space-y-1">
          {listing.title && (
            <p className="font-medium text-sm text-foreground line-clamp-2">
              {listing.title}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {listing.category_name && (
              <Badge variant="secondary" className="text-[10px]">
                {listing.category_name}
              </Badge>
            )}
            {listing.spec_summary && (
              <span className="text-muted-foreground">
                {listing.spec_summary}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-muted-foreground">
            {typeof listing.quantity === "number" && (
              <span>
                Available:{" "}
                <span className="text-foreground">
                  {formatQty(listing.quantity, listing.unit)}
                </span>
              </span>
            )}
            {moq != null && (
              <span>
                Min order:{" "}
                <span className="text-foreground">
                  {formatQty(moq, listing.unit)}
                </span>
              </span>
            )}
            <span>
              Asking:{" "}
              <span className="text-amber-400">
                {listing.unit_price} {listing.currency}/{listing.unit}
              </span>
            </span>
          </div>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 pt-2"
          >
            <FormField
              control={form.control}
              name="requested_qty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity ({listing.unit})</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={moq ?? 0.001}
                      step={0.001}
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseFloat(e.target.value))
                      }
                    />
                  </FormControl>
                  {moq != null && (
                    <p className="text-xs text-muted-foreground">
                      Minimum: {formatQty(moq, listing.unit)}.
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="target_price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Target Price ({listing.currency}/{listing.unit}) — optional
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder={`Listing asking ${listing.unit_price}`}
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        field.onChange(v === "" ? undefined : parseFloat(v));
                      }}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Leave blank to let the seller quote first.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="destination"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Destination Port / Country</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Rotterdam, Netherlands"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message to Seller</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Any special requirements, packaging preferences, certifications needed..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Submitting…" : "Submit Inquiry"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
