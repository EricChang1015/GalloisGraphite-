"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
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
import { DocumentUploader } from "./DocumentUploader";

type Input = z.infer<typeof ShipmentUpdateSchema>;

export function ShipmentForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const t = useTranslations("orders.shipmentForm");
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
      toast.success(t("toast.success"));
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <p className="text-sm font-medium">{t("heading")}</p>
      <p className="text-xs text-muted-foreground">{t("intro")}</p>

      <div className="rounded-md border bg-muted/20 p-3 space-y-3">
        <div>
          <p className="text-xs font-medium">{t("attachHeading")}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{t("attachIntro")}</p>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("blLabel")}
          </label>
          <DocumentUploader orderId={orderId} type="bill_of_lading" compact />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("inspectionLabel")}
          </label>
          <DocumentUploader orderId={orderId} type="inspection_report" compact />
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="bl_no"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("fields.blNo")}</FormLabel>
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
                  <FormLabel>{t("fields.blDate")}</FormLabel>
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
                  <FormLabel>{t("fields.vesselName")}</FormLabel>
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
                  <FormLabel>{t("fields.vesselImo")}</FormLabel>
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
                <FormLabel>{t("fields.departurePort")}</FormLabel>
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
                  <FormLabel>{t("fields.etd")}</FormLabel>
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
                  <FormLabel>{t("fields.atd")}</FormLabel>
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
                  <FormLabel>{t("fields.eta")}</FormLabel>
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
                <FormLabel>{t("fields.containers")}</FormLabel>
                <FormControl>
                  <Input
                    placeholder="MSCU1234567, MSCU2345678"
                    value={(field.value ?? []).join(", ")}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean)
                      )
                    }
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
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
                <FormLabel>{t("fields.note")}</FormLabel>
                <FormControl>
                  <Textarea rows={2} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? t("submitting") : t("submit")}
          </Button>
        </form>
      </Form>
    </div>
  );
}
