"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";

import { markShipped } from "@/actions/order";
import { ShipmentUpdateSchema } from "@/lib/validations/forms";
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

type Input = z.infer<typeof ShipmentUpdateSchema>;

export function ShipmentForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<Input>({
    resolver: zodResolver(ShipmentUpdateSchema),
    defaultValues: {
      order_id: orderId,
      shipment_from: "",
      shipment_eta: "",
      bl_no: "",
      bl_date: "",
      vessel_name: "",
      vessel_imo: "",
      container_numbers: [],
      etd: "",
      atd: "",
      note: "",
    },
  });

  function onSubmit(values: Input) {
    startTransition(async () => {
      const result = await markShipped(values);
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Marked as shipped.");
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <p className="text-sm font-medium">Mark as Shipped</p>
      <p className="text-xs text-muted-foreground">
        Provide Bill of Lading & vessel details. The buyer will be notified.
      </p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="bl_no"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>B/L No.</FormLabel>
                  <FormControl>
                    <Input placeholder="MAEU123456789" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bl_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>B/L Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="vessel_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vessel Name</FormLabel>
                  <FormControl>
                    <Input placeholder="MAERSK SOUTH" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="vessel_imo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vessel IMO</FormLabel>
                  <FormControl>
                    <Input placeholder="9876543" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="shipment_from"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Departure Port</FormLabel>
                <FormControl>
                  <Input placeholder="Toamasina, Madagascar" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-3 gap-3">
            <FormField
              control={form.control}
              name="etd"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ETD</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="atd"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ATD</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="shipment_eta"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ETA</FormLabel>
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
            name="container_numbers"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Container Numbers (comma-separated)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="MSCU1234567, MSCU2345678"
                    onChange={(e) =>
                      field.onChange(
                        e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean)
                      )
                    }
                    defaultValue={(field.value ?? []).join(", ")}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="note"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Note (optional)</FormLabel>
                <FormControl>
                  <Textarea rows={2} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Saving…" : "Mark as Shipped"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
