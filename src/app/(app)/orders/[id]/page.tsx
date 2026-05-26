import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { OrderDetailTabs } from "@/components/order/OrderDetailTabs";
import { OrderPartyCards } from "@/components/order/OrderPartyCards";
import { getCurrentUser } from "@/lib/auth/session";
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
import { PaymentVerifyActions } from "@/components/order/PaymentVerifyActions";
import {
  OrderDocumentsTab,
  type OrderDocumentRow,
} from "@/components/order/OrderDocumentsTab";
import {
  PaymentScheduleTable,
  type ScheduleRow,
} from "@/components/order/PaymentScheduleTable";
import {
  STATUS_LABEL,
  type OrderStatus,
} from "@/lib/order/stateMachine";
import type { Incoterm, PaymentScheduleEntry } from "@/lib/validations/payment-schedule";
import type { DocumentType } from "@/lib/validations/document";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
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

const ORDER_DETAIL_SELECT = `
      *,
      buyer:profiles!orders_buyer_id_fkey(full_name, company_name, email, country),
      seller:profiles!orders_seller_id_fkey(full_name, company_name, email, country),
      listings(title, origin_location, unit, incoterm, product_categories(name)),
      contracts(id, contract_no, content_html, buyer_signed_url, seller_signed_url, buyer_signed_at, seller_signed_at, buyer_approved_at, buyer_rejected_at, buyer_reject_reason, revision_no),
      payments(id, method, amount, currency, tx_hash, proof_url, status, created_at, admin_note, schedule_id),
      payment_schedules(id, sequence, category, milestone, percentage, amount, currency, due_date, bl_offset_days, status, paid_payment_id, notes),
      current_quotation:quotations!orders_current_quotation_id_fkey(id, unit_price, currency, quantity, unit, incoterm, validity_until, notes, status)
    `;

type OrderDetailRow = {
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
  incoterm: Incoterm | null;
  vessel_name: string | null;
  vessel_imo: string | null;
  container_numbers: string[] | null;
  bl_no: string | null;
  bl_date: string | null;
  etd: string | null;
  atd: string | null;
  ata: string | null;
  customs_cleared_at: string | null;
  before_production_at: string | null;
  before_shipment_at: string | null;
  before_loading_at: string | null;
  loaded_at: string | null;
  bl_received_at: string | null;
  shipping_docs_received_at: string | null;
  bl_plus_insurance_received_at: string | null;
  picked_up_at: string | null;
  accepted_at: string | null;
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
    revision_no: number;
  } | null;
  payments:
    | {
        id: string;
        method: string;
        amount: number;
        currency: string;
        tx_hash: string | null;
        proof_url: string | null;
        status: string;
        created_at: string;
        admin_note: string | null;
        schedule_id: string | null;
      }[]
    | null;
  payment_schedules: ScheduleRow[] | null;
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
};

export default async function OrderDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/orders/${id}`)}`);
  }

  const supabase = await createServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string }>();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(ORDER_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle<OrderDetailRow>();

  if (orderError) {
    if (process.env.NODE_ENV === "development") {
      console.error("[orders/[id]] load failed:", orderError.message);
    }
    notFound();
  }

  if (!order) {
    notFound();
  }

  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
  const isBuyer = order.buyer_id === user.id;
  const isSeller = order.seller_id === user.id;
  if (!isAdmin && !isBuyer && !isSeller) {
    notFound();
  }

  const myRole: "buyer" | "seller" | "admin" = isBuyer
    ? "buyer"
    : isSeller
      ? "seller"
      : "admin";
  const myRoleForChild: "buyer" | "seller" | "other" = isBuyer
    ? "buyer"
    : isSeller
      ? "seller"
      : "other";
  const canPostChat = isBuyer || isSeller;

  const contract = order.contracts ?? null;
  const payments = order.payments ?? [];

  const schedules = [...(order.payment_schedules ?? [])].sort(
    (a, b) => a.sequence - b.sequence
  );

  // Snapshot of schedule entries for re-draft (only `scheduled` rows
  // get rebuilt; we surface them so the seller can tweak unpaid
  // installments without losing already-paid ones).
  const scheduleAsEntries: PaymentScheduleEntry[] = schedules
    .filter((s) => s.status !== "paid" && s.status !== "waived")
    .map((s) => ({
      category: s.category,
      milestone: s.milestone,
      percentage: s.percentage,
      bl_offset_days: s.bl_offset_days ?? undefined,
      notes: s.notes ?? undefined,
    }));

  const paidCount = schedules.filter((s) => s.status === "paid").length;
  const paymentsSummary = { paid: paidCount, total: schedules.length };

  const milestoneTimestamps = {
    before_production_at: order.before_production_at,
    before_shipment_at: order.before_shipment_at,
    before_loading_at: order.before_loading_at,
    bl_received_at: order.bl_received_at,
    shipping_docs_received_at: order.shipping_docs_received_at,
    bl_plus_insurance_received_at: order.bl_plus_insurance_received_at,
    picked_up_at: order.picked_up_at,
  };

  const { data: documentsRaw } = await supabase
    .from("order_documents")
    .select(
      "id, type, file_url, file_name, file_size_bytes, uploaded_by, uploaded_at, verified_by, verified_at, admin_note"
    )
    .eq("order_id", id)
    .order("uploaded_at", { ascending: false });

  const documents = (documentsRaw ?? []) as Array<
    OrderDocumentRow & { type: DocumentType }
  >;

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
        {order.incoterm && (
          <Badge variant="outline" className="text-xs">
            {order.incoterm}
          </Badge>
        )}
      </div>

      <OrderProgressBar status={order.status} paymentsSummary={paymentsSummary} />

      <OrderDetailTabs initialTab={tabParam}>
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
          <OrderPartyCards
            buyer={{
              profile: {
                id: order.buyer_id,
                full_name: order.buyer?.full_name ?? null,
                company_name: order.buyer?.company_name ?? null,
                country: order.buyer?.country ?? null,
              },
              subtitle: `Buyer · ${order.buyer?.email ?? ""}`,
            }}
            seller={{
              profile: {
                id: order.seller_id,
                full_name: order.seller?.full_name ?? null,
                company_name: order.seller?.company_name ?? null,
                country: order.seller?.country ?? null,
              },
              subtitle: `Seller · ${order.seller?.email ?? ""}`,
            }}
            currentUserId={user.id}
            orderContext={{
              type: "order",
              id: order.id,
              label: order.order_no,
            }}
            canPost={canPostChat}
          />

          <div className="rounded-lg border divide-y text-sm">
            {[
              ["Product", order.listings?.product_categories?.name ?? "—"],
              ["Listing", order.listings?.title ?? "—"],
              ["Quantity", `${order.quantity} ${order.listings?.unit ?? "MT"}`],
              ["Unit Price", `${order.unit_price} ${order.currency}`],
              ["Total", `${order.total_amount} ${order.currency}`],
              ["Incoterm", order.incoterm ?? order.listings?.incoterm ?? "—"],
              ["Destination", order.destination ?? "—"],
              ["Origin", order.listings?.origin_location ?? "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start px-4 py-2">
                <span className="w-40 text-muted-foreground shrink-0">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </div>

          {schedules.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Payment Schedule</p>
                <p className="text-xs text-muted-foreground">
                  {paidCount} / {schedules.length} paid
                </p>
              </div>
              <PaymentScheduleTable
                orderId={order.id}
                schedules={schedules}
                role={myRoleForChild}
                orderClosed={order.status === "cancelled"}
                limit={3}
              />
            </div>
          )}

          {!isAdmin && (
            <OrderPhaseActions
              orderId={order.id}
              status={order.status}
              role={myRole}
              ata={order.ata}
              milestoneTimestamps={milestoneTimestamps}
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
          {isSeller && !contract && order.status === "contract_pending" && (
            <ContractDraftForm
              orderId={order.id}
              totalAmount={order.total_amount}
              currency={order.currency}
              currentIncoterm={
                order.incoterm ??
                (order.current_quotation?.incoterm as Incoterm | undefined) ??
                (order.listings?.incoterm as Incoterm | undefined) ??
                null
              }
              currentSchedule={scheduleAsEntries}
            />
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
              totalAmount={order.total_amount}
              currency={order.currency}
              currentIncoterm={
                order.incoterm ??
                (order.current_quotation?.incoterm as Incoterm | undefined) ??
                null
              }
              currentSchedule={scheduleAsEntries}
              currentRevision={contract.revision_no}
            />
          )}

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
                buyerSignedUrl={contract.buyer_signed_url}
                sellerSignedUrl={contract.seller_signed_url}
                buyerSignedAt={contract.buyer_signed_at}
                sellerSignedAt={contract.seller_signed_at}
              />

              {(!contract.buyer_signed_url || !contract.seller_signed_url) && (
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  {!contract.buyer_signed_url && (
                    <div className="rounded border p-3 space-y-2">
                      <p className="text-xs text-muted-foreground">Upload Buyer Signature</p>
                      {isBuyer ? (
                        <SignedScanUploader
                          orderId={order.id}
                          role="buyer"
                          blockedNeedApproval={!contract.buyer_approved_at}
                        />
                      ) : (
                        <p className="text-muted-foreground text-xs">
                          Waiting for the buyer to upload a signed scan.
                        </p>
                      )}
                    </div>
                  )}
                  {!contract.seller_signed_url && (
                    <div className="rounded border p-3 space-y-2">
                      <p className="text-xs text-muted-foreground">Upload Seller Signature</p>
                      {isSeller ? (
                        <SignedScanUploader
                          orderId={order.id}
                          role="seller"
                          blockedNeedApproval={!contract.buyer_approved_at}
                        />
                      ) : (
                        <p className="text-muted-foreground text-xs">
                          Waiting for the seller to upload a signed scan.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Payment */}
        <TabsContent value="payment" className="mt-4 space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium">Payment Schedule</p>
            <PaymentScheduleTable
              orderId={order.id}
              schedules={schedules}
              role={myRoleForChild}
              orderClosed={order.status === "cancelled"}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Payment History</p>
            {(isSeller || isAdmin) && payments.some((p) => p.status === "pending") && (
              <p className="text-xs text-muted-foreground">
                {isSeller
                  ? "Review the buyer's payment(s) below. Admin may intervene if needed."
                  : "Audit view — the seller is the primary reviewer."}
              </p>
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
                      <span className="font-medium">
                        {p.amount} {p.currency} — {p.method.replace(/_/g, " ")}
                      </span>
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
                    {p.tx_hash && (
                      <p className="text-muted-foreground text-xs font-mono">TX: {p.tx_hash}</p>
                    )}
                    {p.proof_url && (
                      <a
                        href={p.proof_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline text-xs"
                      >
                        View proof
                      </a>
                    )}
                    {p.admin_note && (
                      <p className="text-xs text-muted-foreground">
                        Reviewer note: {p.admin_note}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleString()}
                    </p>

                    {p.status === "pending" && (isSeller || isAdmin) && (
                      <div className="border-t pt-2">
                        <PaymentVerifyActions
                          paymentId={p.id}
                          reviewerLabel={isAdmin ? "Admin" : "Seller"}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Shipment */}
        <TabsContent value="shipment" className="mt-4 space-y-4">
          <div className="rounded-lg border divide-y text-sm">
            {[
              ["B/L No.", order.bl_no ?? "—"],
              ["B/L Date", order.bl_date ?? "—"],
              [
                "Vessel",
                order.vessel_name
                  ? `${order.vessel_name}${order.vessel_imo ? ` (IMO ${order.vessel_imo})` : ""}`
                  : "—",
              ],
              [
                "Containers",
                order.container_numbers?.length ? order.container_numbers.join(", ") : "—",
              ],
              ["Departure Port", order.shipment_from ?? "—"],
              ["Destination Port", order.destination ?? "—"],
              ["ETD", order.etd ?? "—"],
              ["ATD", order.atd ?? "—"],
              ["ETA", order.shipment_eta ?? "—"],
              ["ATA", order.ata ?? "—"],
              [
                "Loaded onto Vessel",
                order.loaded_at ? new Date(order.loaded_at).toLocaleDateString() : "—",
              ],
              [
                "B/L Received",
                order.bl_received_at
                  ? new Date(order.bl_received_at).toLocaleDateString()
                  : "—",
              ],
              [
                "Goods Picked Up",
                order.picked_up_at
                  ? new Date(order.picked_up_at).toLocaleDateString()
                  : "—",
              ],
              [
                "Accepted by Buyer",
                order.accepted_at
                  ? new Date(order.accepted_at).toLocaleDateString()
                  : "—",
              ],
              [
                "Customs Cleared",
                order.customs_cleared_at
                  ? new Date(order.customs_cleared_at).toLocaleDateString()
                  : "—",
              ],
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
      </OrderDetailTabs>
    </div>
  );
}
