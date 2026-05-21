"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { createInquiry } from "@/actions/inquiry";
import { InquiryInputSchema, type InquiryInput } from "@/lib/validations/inquiry";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface InquiryDialogProps {
  listing: {
    id: string;
    seller_id: string;
    category_id: string;
    unit_price: number;
    currency: string;
    unit: string;
  };
}

export function InquiryDialog({ listing }: InquiryDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<InquiryInput>({
    resolver: zodResolver(InquiryInputSchema) as never,
    defaultValues: {
      listing_id: listing.id,
      category_id: listing.category_id,
      seller_id: listing.seller_id,
      requested_qty: 1,
      target_price: listing.unit_price,
      destination: "",
      message: "",
    },
  });

  function onSubmit(values: InquiryInput) {
    startTransition(async () => {
      const result = await createInquiry(values);
      if (result.error) {
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
      <DialogTrigger render={<Button size="lg" className="bg-amber-500 hover:bg-amber-400 text-black font-semibold" />}>
        Submit Inquiry
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Submit an Inquiry</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="requested_qty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity ({listing.unit})</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0.001}
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
              name="target_price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Price ({listing.currency}/{listing.unit}) — optional</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
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
              name="destination"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Destination Port / Country</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Rotterdam, Netherlands" {...field} />
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
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
