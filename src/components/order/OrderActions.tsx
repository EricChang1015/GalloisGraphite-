"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import {
  generateContract,
  updateShipment,
  confirmReceipt,
} from "@/actions/order";
import { submitPayment } from "@/actions/payment";
import { ShipmentUpdateSchema } from "@/lib/validations/forms";
import { SubmitPaymentSchema } from "@/lib/validations/forms";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

type ShipmentInput = z.infer<typeof ShipmentUpdateSchema>;
type PaymentInput = z.infer<typeof SubmitPaymentSchema>;

interface OrderActionsProps {
  orderId: string;
  status: string;
  role: "buyer" | "seller" | "other";
  totalAmount: number;
  currency: string;
}

export function OrderActions({ orderId, status, role, totalAmount, currency }: OrderActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleGenerateContract() {
    startTransition(async () => {
      const result = await generateContract(orderId);
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Contract generated.");
      router.refresh();
    });
  }

  function handleConfirmReceipt() {
    startTransition(async () => {
      const result = await confirmReceipt(orderId);
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Receipt confirmed. Order completed!");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {status === "draft" && (
        <div className="rounded-lg border p-4 space-y-2">
          <p className="text-sm font-medium">Generate Contract</p>
          <p className="text-xs text-muted-foreground">
            Generate the sales contract PDF for both parties to review and sign.
          </p>
          <Button onClick={handleGenerateContract} disabled={isPending} size="sm">
            Generate Contract
          </Button>
        </div>
      )}

      {status === "signed" && role === "buyer" && (
        <PaymentForm orderId={orderId} amount={totalAmount} currency={currency} />
      )}

      {status === "paid" && role === "seller" && (
        <ShipmentForm orderId={orderId} />
      )}

      {status === "delivered" && role === "buyer" && (
        <div className="rounded-lg border p-4 space-y-2">
          <p className="text-sm font-medium">Confirm Receipt</p>
          <p className="text-xs text-muted-foreground">
            Confirm you have received the goods. This will release payment to the seller.
          </p>
          <Button onClick={handleConfirmReceipt} disabled={isPending} size="sm">
            Confirm Receipt
          </Button>
        </div>
      )}
    </div>
  );
}

function PaymentForm({
  orderId,
  amount,
  currency,
}: {
  orderId: string;
  amount: number;
  currency: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<PaymentInput>({
    resolver: zodResolver(SubmitPaymentSchema),
    defaultValues: {
      order_id: orderId,
      method: "usdt_trc20",
      amount,
      currency,
      tx_hash: "",
      note: "",
    },
  });

  function onSubmit(values: PaymentInput) {
    startTransition(async () => {
      const result = await submitPayment(values);
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Payment submitted. Pending admin review.");
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <p className="text-sm font-medium">Submit Payment</p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="method"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Method</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="usdt_trc20">USDT (TRC20)</SelectItem>
                    <SelectItem value="usdt_erc20">USDT (ERC20)</SelectItem>
                    <SelectItem value="usdi">USDI</SelectItem>
                    <SelectItem value="mup">MUP</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
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
            name="tx_hash"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Transaction Hash</FormLabel>
                <FormControl>
                  <Input placeholder="0x..." {...field} />
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
            {isPending ? "Submitting…" : "Submit Payment"}
          </Button>
        </form>
      </Form>
    </div>
  );
}

function ShipmentForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<ShipmentInput>({
    resolver: zodResolver(ShipmentUpdateSchema),
    defaultValues: {
      order_id: orderId,
      shipment_from: "",
      shipment_eta: "",
      note: "",
    },
  });

  function onSubmit(values: ShipmentInput) {
    startTransition(async () => {
      const result = await updateShipment(values);
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Shipment details updated.");
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <p className="text-sm font-medium">Update Shipment</p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="shipment_from"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Shipment From</FormLabel>
                <FormControl>
                  <Input placeholder="Toamasina, Madagascar" {...field} />
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
                <FormLabel>Estimated Arrival (ETA)</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Separator />
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Saving…" : "Mark as Shipped"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
