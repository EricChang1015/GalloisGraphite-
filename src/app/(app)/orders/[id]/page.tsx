import { notFound } from "next/navigation";
import Link from "next/link";

import { createServerClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { OrderProgressBar } from "@/components/order/OrderProgressBar";
import { ContractDraftForm } from "@/components/order/ContractDraftForm";
import { ContractApproveReject } from "@/components/order/ContractApproveReject";
import { SignedScanUploader } from "@/components/order/SignedScanUploader";
import { ContractPreview } from "@/components/order/ContractPreview";
import { ShipmentForm } from "@/components/order/ShipmentForm";
import { OrderPhaseActions } from "@/components/order/OrderPhaseActions";
import {
  OrderDocumentsTab,
  type OrderDocumentRow,
} from "@/components/order/OrderDocumentsTab";
import { OrderActions } from "@/components/order/OrderActions";
import {
  STATUS_LABEL,
  type OrderStatus,
  type PaymentTermsType,
} from "@/lib/order/stateMachine";
import type { DocumentType } from "@/lib/validations/document";

interface PageProps {
  params: Promise<{ id: string }>;
}

const statusColor: Record<string, string> = {
  quotation_pending: "text-muted-foreground border-border",
  draft: "text-muted-foreground border-border",
  quoted: "text-blue-400 border-blue-400/40",
  negotiating: "text-purple-400 border-purple-400/40",
  contract_pending: "text-blue-400 border-blue-400/40",
  contract_generated: "text-blue-400 border-blue-400/40",
  contract_signed: "text-purple-400 border-purple-400/40",
  payment_pending: "text-yellow-400 border-yellow-400/40",
  paid: "text-green-400 border-green-400/40",
  in_production: "text-orange-400 border-orange-400/40",
  ready_to_ship: "text-cyan-400 border-cyan-400/40",
  shipped: "text-cyan-400 border-cyan-400/40",
  in_transit: "text-cyan-400 border-cyan-400/40",
  arrived: "text-teal-400 border-teal-400/40",
  customs_cleared: "text-teal-400 border-teal-400/40",
  completed: "text-emerald-400 border-emerald-400/40",
  disputed: "text-red-400 border-red-400/40",
  cancelled: "text-muted-foreground border-border",
};

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return { title: `Order ${id.slice(0, 8).toUpperCase()} — Mada Graphite` };
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();

  const { data: order } = await supabase
    .from("orders")
    .select(`
      *,
      buyer:profiles!orders_buyer_id_fkey(full_name, company_name, email, country),
      seller:profiles!orders_seller_id_fkey(full_name, company_name, email, country),
      listings(title, origin_location, unit, incoterm, product_categories(name)),
      contracts(id, contract_no, content_html, buyer_signed_url, seller_signed_url, buyer_signed_at, seller_signed_at, buyer_approved_at, buyer_rejected_at, buyer_reject_reason, payment_terms, payment_due_days, revision_no),
      payments(id, method, amount, currency, tx_hash, proof_url, status, created_at, admin_note),
      current_quotation:quotations!orders_current_quotation_id_fkey(id, unit_price, currency, quantity, unit, incoterm, validity_until, notes, status)
    `)
    .eq("id", id)
    .single<{
      id: string;
      order_no: string;
      buyer_id: string;
      seller_id: string;
      inquiry_id: string | null;
      quantity: number;
      unit_price: number;
      total_amount: number;
      currency: string;
      destination: string | null;
      shipment_from: string | null;
      shipment_eta: string | null;
      payment_terms: PaymentTermsType | null;
      payment_due_days: number | null;
      payment_due_date: string | null;
      vessel_name: string | null;
      vessel_imo: string | null;
      container_numbers: string[] | null;
      bl_no: string | null;
      bl_date: string | null;
      etd: string | null;
      atd: string | null;
      ata: string | null;
      customs_cleared_at: string | null;
      current_quotation_id: string | null;
      status: OrderStatus;
      timeline: { event: string; at: string; by: string; from?: string; to?: string }[];
      created_at: string;
      buyer: { full_name: string; company_name: string; email: string; country: string } | null;
      seller: { full_name: string; company_name: string; email: string; country: string } | null;
      listings: {
        title: string;
        origin_location: string;
        unit: string;
        incoterm: string;
        product_categories: { name: string } | null;
      } | null;
      // PostgREST returns the embedded `contracts` row as a single
      // object (not an array) because `contracts.order_id` carries both
      // a foreign key and a UNIQUE constraint — i.e. a one-to-one
      // relationship. Treating it as an array silently broke the
      // contract preview / signature panes (every contract looked like
      // "No contract drafted yet" no matter how many times the seller
      // re-drafted it).
      contracts: {
        id: string;
        contract_no: string;
        content_html: string | null;
        buyer_signed_url: string | null;
        seller_signed_url: string | null;
        buyer_signed_at: string | null;
        seller_signed_at: string | null;
        buyer_approved_at: string | null;
        buyer_rejected_at: string | null;
        buyer_reject_reason: string | null;
        payment_terms: PaymentTermsType | null;
        payment_due_days: number | null;
        revision_no: number;
      } | null;
      payments: {
        id: string;
        method: string;
        amount: number;
        currency: string;
        tx_hash: string | null;
        proof_url: string | null;
        status: string;
        created_at: string;
        admin_note: string | null;
      }[] | null;
      current_quotation: {
        id: string;
        unit_price: number;
        currency: string;
        quantity: number;
        unit: string;
        incoterm: string;
        validity_until: string;
        notes: string | null;
        status: string;
      } | null;
    }>();

  if (!order) notFound();

  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
  const isBuyer = order.buyer_id === user.id;
  const isSeller = order.seller_id === user.id;
  if (!isAdmin && !isBuyer && !isSeller) notFound();

  const myRole: "buyer" | "seller" | "admin" = isBuyer
    ? "buyer"
    : isSeller
    ? "seller"
    : "admin";
  const contract = order.contracts ?? null;
  const payments = order.payments ?? [];

  // Fetch documents
  const { data: documentsRaw } = await supabase
    .from("order_documents")
    .select(
      "id, type, file_url, file_name, file_size_bytes, uploaded_by, uploaded_at, verified_by, verified_at, admin_note"
    )
    .eq("order_id", id)
    .order("uploaded_at", { ascending: false });

  const documents = (documentsRaw ?? []) as Array<OrderDocumentRow & { type: DocumentType }>;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{order.order_no}</h1>
          <p className="text-sm text-muted-foreground">
            Created {new Date(order.created_at).toLocaleDateString()}
            {order.inquiry_id && (
              <>
                {" · "}
                <Link href={`/inquiries/${order.inquiry_id}`} className="hover:text-foreground underline">
                  Source inquiry
                </Link>
              </>
            )}
          </p>
        </div>
        <Badge variant="outline" className={statusColor[order.status] ?? ""}>
          {STATUS_LABEL[order.status]}
        </Badge>
        {order.payment_terms && (
          <Badge variant="outline" className="text-xs">
            {order.payment_terms === "full_prepay" ? "Full Prepay" : "Net After Arrival"}
            {order.payment_due_days != null ? ` · ${order.payment_due_days}d` : ""}
          </Badge>
        )}
      </div>

      <OrderProgressBar status={order.status} paymentTerms={order.payment_terms} />

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="quotation">Quotation</TabsTrigger>
          <TabsTrigger value="contract">Contract</TabsTrigger>
          <TabsTrigger value="payment">Payment</TabsTrigger>
          <TabsTrigger value="shipment">Shipment</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4 space-y-1 text-sm">
              <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Buyer</p>
              <p className="font-medium">{order.buyer?.company_name ?? "—"}</p>
              <p className="text-muted-foreground text-xs">{order.buyer?.full_name} · {order.buyer?.email}</p>
              <p className="text-muted-foreground text-xs">{order.buyer?.country}</p>
            </div>
            <div className="rounded-lg border p-4 space-y-1 text-sm">
              <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Seller</p>
              <p className="font-medium">{order.seller?.company_name ?? "—"}</p>
              <p className="text-muted-foreground text-xs">{order.seller?.full_name} · {order.seller?.email}</p>
              <p className="text-muted-foreground text-xs">{order.seller?.country}</p>
            </div>
          </div>

          <div className="rounded-lg border divide-y text-sm">
            {[
              ["Product", order.listings?.product_categories?.name ?? "—"],
              ["Listing", order.listings?.title ?? "—"],
              ["Quantity", `${order.quantity} ${order.listings?.unit ?? "MT"}`],
              ["Unit Price", `${order.unit_price} ${order.currency}`],
              ["Total", `${order.total_amount} ${order.currency}`],
              ["Incoterm", order.listings?.incoterm ?? "—"],
              ["Destination", order.destination ?? "—"],
              ["Origin", order.listings?.origin_location ?? "—"],
              ["Payment Terms", order.payment_terms
                ? order.payment_terms === "full_prepay"
                  ? `Full Prepay`
                  : `Net ${order.payment_due_days ?? "—"} days after arrival`
                : "—"],
              ["Payment Due Date", order.payment_due_date ?? "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start px-4 py-2">
                <span className="w-40 text-muted-foreground shrink-0">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </div>

          {!isAdmin && (
            <OrderPhaseActions
              orderId={order.id}
              status={order.status}
              role={myRole}
              ata={order.ata}
            />
          )}
        </TabsContent>

        {/* Quotation */}
        <TabsContent value="quotation" className="mt-4 space-y-3">
          {!order.current_quotation ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
              This order was created without a quotation reference.
            </div>
          ) : (
            <div className="rounded-lg border p-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium">Accepted Quotation</p>
                <Badge variant="outline" className="text-emerald-400 border-emerald-400/40">
                  {order.current_quotation.status}
                </Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Quantity</p>
                  <p className="font-medium">{order.current_quotation.quantity} {order.current_quotation.unit}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Unit Price</p>
                  <p className="font-medium">{order.current_quotation.unit_price} {order.current_quotation.currency}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Incoterm</p>
                  <p className="font-medium">{order.current_quotation.incoterm}</p>
                </div>
                <div className="col-span-3">
                  <p className="text-muted-foreground">Valid until</p>
                  <p className="font-medium">{new Date(order.current_quotation.validity_until).toLocaleString()}</p>
                </div>
              </div>
              {order.current_quotation.notes && (
                <>
                  <Separator />
                  <p className="text-xs whitespace-pre-wrap text-muted-foreground">
                    {order.current_quotation.notes}
                  </p>
                </>
              )}
              {order.inquiry_id && (
                <Link
                  href={`/inquiries/${order.inquiry_id}`}
                  className="text-xs text-primary underline inline-block"
                >
                  View full negotiation history →
                </Link>
              )}
            </div>
          )}
        </TabsContent>

        {/* Contract */}
        <TabsContent value="contract" className="mt-4 space-y-4">
          {/* Seller draft / re-draft */}
          {isSeller && !contract && order.status === "contract_pending" && (
            <ContractDraftForm orderId={order.id} />
          )}
          {isSeller && contract && contract.buyer_rejected_at && (
            <div className="rounded-lg border border-red-400/30 bg-red-500/5 p-3 text-sm">
              <p className="font-medium text-red-400">Buyer requested revision</p>
              {contract.buyer_reject_reason && (
                <p className="text-xs text-muted-foreground mt-1">{contract.buyer_reject_reason}</p>
              )}
            </div>
          )}
          {isSeller && contract && contract.buyer_rejected_at && order.status === "contract_pending" && (
            <ContractDraftForm
              orderId={order.id}
              currentPaymentTerms={contract.payment_terms}
              currentPaymentDueDays={contract.payment_due_days}
              currentRevision={contract.revision_no}
            />
          )}

          {/* Buyer review */}
          {isBuyer && contract && order.status === "contract_pending" && (
            <ContractApproveReject
              orderId={order.id}
              alreadyApproved={!!contract.buyer_approved_at}
            />
          )}

          {!contract ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
              No contract drafted yet.
              {isBuyer && order.status === "contract_pending" && (
                <p className="mt-2 text-xs">Waiting for the seller to draft the contract.</p>
              )}
            </div>
          ) : (
            <>
              <ContractPreview
                contractNo={contract.contract_no}
                revision={contract.revision_no}
                contentHtml={contract.content_html}
              />

              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded border p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">Buyer Signature</p>
                  {contract.buyer_signed_url ? (
                    <a href={contract.buyer_signed_url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs">
                      View scan
                    </a>
                  ) : isBuyer ? (
                    <SignedScanUploader
                      orderId={order.id}
                      role="buyer"
                      blockedNeedApproval={!contract.buyer_approved_at}
                    />
                  ) : (
                    <p className="text-muted-foreground text-xs">Not uploaded</p>
                  )}
                </div>
                <div className="rounded border p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">Seller Signature</p>
                  {contract.seller_signed_url ? (
                    <a href={contract.seller_signed_url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs">
                      View scan
                    </a>
                  ) : isSeller ? (
                    <SignedScanUploader
                      orderId={order.id}
                      role="seller"
                      blockedNeedApproval={!contract.buyer_approved_at}
                    />
                  ) : (
                    <p className="text-muted-foreground text-xs">Not uploaded</p>
                  )}
                </div>
              </div>
            </>
          )}
        </TabsContent>

        {/* Payment */}
        <TabsContent value="payment" className="mt-4 space-y-4">
          {order.payment_terms && (
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium">
                {order.payment_terms === "full_prepay"
                  ? "Full Prepay"
                  : `Net ${order.payment_due_days ?? "—"} days after arrival`}
              </p>
              {order.payment_terms === "net_after_arrival" && order.payment_due_date && (
                <p className="text-xs text-muted-foreground mt-1">
                  Final payment due by{" "}
                  <span className="font-medium text-foreground">{order.payment_due_date}</span>
                </p>
              )}
              {order.payment_terms === "full_prepay" && order.status === "contract_signed" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Buyer must submit payment to begin production.
                </p>
              )}
            </div>
          )}

          {payments.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
              No payment submitted yet.
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((p) => (
                <div key={p.id} className="rounded-lg border p-4 text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{p.amount} {p.currency} — {p.method.replace(/_/g, " ")}</span>
                    <Badge
                      variant="outline"
                      className={
                        p.status === "verified"
                          ? "text-green-400 border-green-400/40"
                          : p.status === "rejected"
                          ? "text-red-400 border-red-400/40"
                          : "text-yellow-400 border-yellow-400/40"
                      }
                    >
                      {p.status}
                    </Badge>
                  </div>
                  {p.tx_hash && <p className="text-muted-foreground text-xs font-mono">TX: {p.tx_hash}</p>}
                  {p.proof_url && (
                    <a href={p.proof_url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs">
                      View proof
                    </a>
                  )}
                  {p.admin_note && <p className="text-xs text-muted-foreground">Admin: {p.admin_note}</p>}
                  <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}

          {(order.status === "payment_pending" || order.status === "contract_signed") && isBuyer && (
            <OrderActions
              orderId={order.id}
              status={order.status}
              role="buyer"
              totalAmount={order.total_amount}
              currency={order.currency}
            />
          )}
        </TabsContent>

        {/* Shipment */}
        <TabsContent value="shipment" className="mt-4 space-y-4">
          <div className="rounded-lg border divide-y text-sm">
            {[
              ["B/L No.", order.bl_no ?? "—"],
              ["B/L Date", order.bl_date ?? "—"],
              ["Vessel", order.vessel_name ? `${order.vessel_name}${order.vessel_imo ? ` (IMO ${order.vessel_imo})` : ""}` : "—"],
              ["Containers", order.container_numbers?.length ? order.container_numbers.join(", ") : "—"],
              ["Departure Port", order.shipment_from ?? "—"],
              ["Destination Port", order.destination ?? "—"],
              ["ETD", order.etd ?? "—"],
              ["ATD", order.atd ?? "—"],
              ["ETA", order.shipment_eta ?? "—"],
              ["ATA", order.ata ?? "—"],
              ["Customs Cleared", order.customs_cleared_at ? new Date(order.customs_cleared_at).toLocaleDateString() : "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start px-4 py-2">
                <span className="w-40 text-muted-foreground shrink-0">{label}</span>
                <span className="font-medium break-all">{value}</span>
              </div>
            ))}
          </div>

          {isSeller && order.status === "ready_to_ship" && (
            <ShipmentForm orderId={order.id} />
          )}
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents" className="mt-4">
          <OrderDocumentsTab
            orderId={order.id}
            documents={documents}
            isAdmin={isAdmin}
            canUpload={isBuyer || isSeller || isAdmin}
          />
        </TabsContent>

        {/* Timeline */}
        <TabsContent value="timeline" className="mt-4">
          {(!order.timeline || order.timeline.length === 0) ? (
            <p className="text-sm text-muted-foreground">No timeline events yet.</p>
          ) : (
            <ol className="relative border-l border-border ml-3 space-y-4">
              {[...order.timeline].reverse().map((item, idx) => (
                <li key={idx} className="ml-4">
                  <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-border bg-background" />
                  <p className="text-sm font-medium capitalize">{item.event.replace(/_/g, " ")}</p>
                  {item.from && item.to && (
                    <p className="text-[10px] text-muted-foreground">
                      {item.from} → {item.to}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
