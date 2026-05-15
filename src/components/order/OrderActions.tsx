"use client";

import { useState, useTransition } from "react";
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
import { createClient } from "@/lib/supabase/client";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

const BUCKET = "order-documents";
/** Payment methods that always need a proof image (no on-chain hash). */
const PROOF_REQUIRED_METHODS = new Set(["bank_transfer", "usdi", "mup"]);
/** Payment methods that go through public blockchains where a tx hash
 *  is the canonical receipt. */
const HASH_REQUIRED_METHODS = new Set(["usdt_trc20", "usdt_erc20"]);
const METHOD_LABEL: Record<string, string> = {
  usdt_trc20: "USDT (TRC20)",
  usdt_erc20: "USDT (ERC20)",
  usdi: "USDI",
  mup: "MUP",
  bank_transfer: "Bank Transfer",
};

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

  // Buyer's payment triggers:
  //  - full_prepay flow: order.status === "contract_signed" (legacy "signed")
  //  - net_after_arrival flow: order.status === "payment_pending" (after customs cleared)
  const showPayment =
    role === "buyer" &&
    (status === "signed" || status === "contract_signed" || status === "payment_pending");

  return (
    <div className="space-y-6">
      {status === "draft" && (
        <div className="rounded-lg border p-4 space-y-2">
          <p className="text-sm font-medium">Generate Contract</p>
          <p className="text-xs text-muted-foreground">
            Generate a default sales contract (full prepay, 5-day window). For richer
            terms, use the Contract tab&apos;s draft form.
          </p>
          <Button onClick={handleGenerateContract} disabled={isPending} size="sm">
            Generate Contract
          </Button>
        </div>
      )}

      {showPayment && (
        <PaymentForm orderId={orderId} amount={totalAmount} currency={currency} />
      )}

      {/* Legacy fallback only — new shipment UI lives in <ShipmentForm /> on the
         Shipment tab. Kept here for any orders still on the old "paid → shipped"
         shortcut. */}
      {status === "paid" && role === "seller" && (
        <ShipmentForm orderId={orderId} />
      )}

      {status === "delivered" && role === "buyer" && (
        <div className="rounded-lg border p-4 space-y-2">
          <p className="text-sm font-medium">Confirm Receipt</p>
          <p className="text-xs text-muted-foreground">
            Confirm you have received the goods. This will complete the order.
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
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [proofUrl, setProofUrl] = useState<string>("");

  const form = useForm<PaymentInput>({
    resolver: zodResolver(SubmitPaymentSchema),
    defaultValues: {
      order_id: orderId,
      method: "usdt_trc20",
      amount,
      currency,
      tx_hash: "",
      proof_url: undefined,
      note: "",
    },
  });

  const method = form.watch("method");
  const needsProof = PROOF_REQUIRED_METHODS.has(method);
  const needsHash = HASH_REQUIRED_METHODS.has(method);

  async function handleUploadProof() {
    if (!proofFile) return;
    setIsUploading(true);
    try {
      const supabase = createClient();
      const ext = proofFile.name.split(".").pop() ?? "bin";
      const path = `${orderId}/payment_proof/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, proofFile, { cacheControl: "3600", upsert: false });
      if (upErr) {
        toast.error(`Upload failed: ${upErr.message}`);
        return;
      }
      const { data: signed, error: signErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signErr || !signed?.signedUrl) {
        toast.error("Could not generate signed URL.");
        return;
      }
      setProofUrl(signed.signedUrl);
      form.setValue("proof_url", signed.signedUrl, { shouldValidate: true });
      toast.success("Proof uploaded.");
    } catch (err) {
      const m = err instanceof Error ? err.message : "Upload error.";
      toast.error(m);
    } finally {
      setIsUploading(false);
    }
  }

  function onSubmit(values: PaymentInput) {
    // Guard rails the schema can't express on its own.
    if (needsHash && !values.tx_hash) {
      form.setError("tx_hash", { message: "Transaction hash is required for on-chain payments." });
      return;
    }
    if (needsProof && !values.proof_url) {
      toast.error("Please upload a remittance proof before submitting.");
      return;
    }
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
      <div>
        <p className="text-sm font-medium">Submit Payment</p>
        <p className="text-xs text-muted-foreground">
          On-chain payments are verified via the transaction hash. Bank transfer, USDI
          and MUP also require a scanned remittance receipt.
        </p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="method"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Method</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(value) =>
                          METHOD_LABEL[value as string] ?? "Select a method"
                        }
                      </SelectValue>
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
          {needsHash && (
            <FormField
              control={form.control}
              name="tx_hash"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transaction Hash</FormLabel>
                  <FormControl>
                    <Input placeholder="0x..." {...field} />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Paste the on-chain transaction hash (the admin will verify it on a
                    block explorer).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          {needsProof && (
            <FormItem>
              <FormLabel>Remittance Proof</FormLabel>
              <FormDescription className="text-xs">
                Upload the bank wire / remittance slip (PDF or image, ≤ 20 MB). The
                admin will compare it against the contracted amount.
              </FormDescription>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                  className="text-xs flex-1 min-w-[180px]"
                  disabled={isUploading}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleUploadProof}
                  disabled={!proofFile || isUploading}
                >
                  {isUploading ? "Uploading…" : proofUrl ? "Replace" : "Upload"}
                </Button>
              </div>
              {proofUrl && (
                <p className="text-xs text-emerald-400">
                  Proof attached.{" "}
                  <a
                    href={proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Preview
                  </a>
                </p>
              )}
              {/* keep the form value mirrored even though the input is not a FormField */}
              <input type="hidden" {...form.register("proof_url")} />
            </FormItem>
          )}
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
