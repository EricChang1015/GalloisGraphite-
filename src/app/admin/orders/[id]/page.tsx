import { notFound } from "next/navigation";
import Link from "next/link";

import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { OrderProgressBar } from "@/components/order/OrderProgressBar";
import {
  OrderDocumentsTab,
  type OrderDocumentRow,
} from "@/components/order/OrderDocumentsTab";
import { AdminOrderActions } from "@/components/admin/AdminOrderActions";
import {
  STATUS_LABEL,
  type OrderStatus,
  type PaymentTermsType,
} from "@/lib/order/stateMachine";
import type { DocumentType } from "@/lib/validations/document";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return { title: `Admin · Order ${id.slice(0, 8).toUpperCase()}` };
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();

  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    notFound();
  }

  // Use admin client to bypass RLS — admin sees everything
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select(`
      *,
      buyer:profiles!orders_buyer_id_fkey(id, full_name, company_name, email, country),
      seller:profiles!orders_seller_id_fkey(id, full_name, company_name, email, country),
      listings(title, origin_location, unit, incoterm, product_categories(name)),
      contracts(id, contract_no, buyer_signed_url, seller_signed_url, buyer_approved_at, buyer_rejected_at, buyer_reject_reason, payment_terms, payment_due_days, revision_no),
      payments(id, method, amount, currency, status, created_at, admin_note, reviewed_by, reviewed_at)
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
      payment_terms: PaymentTermsType | null;
      payment_due_days: number | null;
      payment_due_date: string | null;
      bl_no: string | null;
      vessel_name: string | null;
      ata: string | null;
      status: OrderStatus;
      timeline: { event: string; at: string; by: string; from?: string; to?: string; reason?: string }[];
      created_at: string;
      buyer: { id: string; full_name: string; company_name: string; email: string; country: string } | null;
      seller: { id: string; full_name: string; company_name: string; email: string; country: string } | null;
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
        buyer_signed_url: string | null;
        seller_signed_url: string | null;
        buyer_approved_at: string | null;
        buyer_rejected_at: string | null;
        buyer_reject_reason: string | null;
        payment_terms: PaymentTermsType | null;
        payment_due_days: number | null;
        revision_no: number;
      }[] | null;
      payments: {
        id: string;
        method: string;
        amount: number;
        currency: string;
        status: string;
        created_at: string;
        admin_note: string | null;
        reviewed_by: string | null;
        reviewed_at: string | null;
      }[] | null;
    }>();

  if (!order) notFound();

  const { data: documentsRaw } = await admin
    .from("order_documents")
    .select(
      "id, type, file_url, file_name, file_size_bytes, uploaded_by, uploaded_at, verified_by, verified_at, admin_note"
    )
    .eq("order_id", id)
    .order("uploaded_at", { ascending: false });

  const documents = (documentsRaw ?? []) as Array<OrderDocumentRow & { type: DocumentType }>;

  const { data: auditLogs } = await admin
    .from("audit_logs")
    .select("id, actor_id, action, metadata, created_at")
    .eq("target_type", "order")
    .eq("target_id", id)
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<{
      id: string;
      actor_id: string | null;
      action: string;
      metadata: Record<string, unknown>;
      created_at: string;
    }[]>();

  const contract = order.contracts?.[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">
          <Link href="/admin/orders" className="hover:text-foreground">
            All Orders
          </Link>{" "}
          / {order.order_no}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{order.order_no}</h1>
          <Badge variant="outline">{STATUS_LABEL[order.status]}</Badge>
          {order.payment_terms && (
            <Badge variant="outline" className="text-xs">
              {order.payment_terms === "full_prepay" ? "Full Prepay" : `Net ${order.payment_due_days ?? "—"}d`}
            </Badge>
          )}
          <Link
            href={`/orders/${id}`}
            className="text-xs text-primary underline ml-auto"
          >
            View as party
          </Link>
        </div>
      </div>

      <OrderProgressBar status={order.status} paymentTerms={order.payment_terms} />

      <AdminOrderActions
        orderId={order.id}
        currentStatus={order.status}
        paymentTerms={order.payment_terms}
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="rounded-lg border p-4 space-y-1 text-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Buyer</p>
          <p className="font-medium">{order.buyer?.company_name ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{order.buyer?.full_name}</p>
          <p className="text-xs text-muted-foreground">{order.buyer?.email}</p>
          <p className="text-xs text-muted-foreground">{order.buyer?.country}</p>
        </div>
        <div className="rounded-lg border p-4 space-y-1 text-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Seller</p>
          <p className="font-medium">{order.seller?.company_name ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{order.seller?.full_name}</p>
          <p className="text-xs text-muted-foreground">{order.seller?.email}</p>
          <p className="text-xs text-muted-foreground">{order.seller?.country}</p>
        </div>
        <div className="rounded-lg border p-4 space-y-1 text-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Order</p>
          <p className="text-xs">Qty: <span className="font-medium">{order.quantity}</span></p>
          <p className="text-xs">Total: <span className="font-medium">{order.total_amount} {order.currency}</span></p>
          <p className="text-xs">Created: {new Date(order.created_at).toLocaleDateString()}</p>
          {order.payment_due_date && (
            <p className="text-xs">Due: <span className="font-medium">{order.payment_due_date}</span></p>
          )}
        </div>
      </div>

      <Separator />

      {/* Contract revisions */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Contract</h2>
        {!contract ? (
          <p className="text-xs text-muted-foreground">No contract yet.</p>
        ) : (
          <div className="rounded-lg border p-3 text-sm space-y-1">
            <p className="font-medium">{contract.contract_no} (revision {contract.revision_no})</p>
            {contract.payment_terms && (
              <p className="text-xs text-muted-foreground">
                Terms: {contract.payment_terms} · {contract.payment_due_days}d
              </p>
            )}
            <p className="text-xs">
              Buyer signed: {contract.buyer_signed_url ? "✓" : "—"} ·
              {" "}Seller signed: {contract.seller_signed_url ? "✓" : "—"} ·
              {" "}Buyer approved: {contract.buyer_approved_at ? "✓" : "—"}
            </p>
            {contract.buyer_rejected_at && (
              <p className="text-xs text-red-400">
                Rejected: {contract.buyer_reject_reason}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Payments */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Payments</h2>
        {(order.payments ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">None.</p>
        ) : (
          <ul className="space-y-2">
            {(order.payments ?? []).map((p) => (
              <li key={p.id} className="rounded border p-2 text-xs flex items-center justify-between">
                <span>
                  {p.amount} {p.currency} · {p.method.replace(/_/g, " ")}
                </span>
                <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Shipment summary */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Shipment</h2>
        <div className="rounded border p-3 text-xs grid grid-cols-2 gap-2">
          <div>B/L: <span className="font-medium">{order.bl_no ?? "—"}</span></div>
          <div>Vessel: <span className="font-medium">{order.vessel_name ?? "—"}</span></div>
          <div>ATA: <span className="font-medium">{order.ata ?? "—"}</span></div>
          <div>Destination: <span className="font-medium">{order.destination ?? "—"}</span></div>
        </div>
      </section>

      {/* Documents */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Documents</h2>
        <OrderDocumentsTab
          orderId={order.id}
          documents={documents}
          isAdmin
          canUpload
        />
      </section>

      {/* Audit log */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Audit Log</h2>
        {!auditLogs || auditLogs.length === 0 ? (
          <p className="text-xs text-muted-foreground">No admin actions logged.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {auditLogs.map((log) => (
              <li key={log.id} className="rounded border p-2">
                <p>
                  <span className="font-mono">{log.action}</span> ·{" "}
                  {new Date(log.created_at).toLocaleString()}
                </p>
                {Object.keys(log.metadata ?? {}).length > 0 && (
                  <pre className="mt-1 text-[10px] text-muted-foreground whitespace-pre-wrap">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Timeline */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Order Timeline</h2>
        <ol className="space-y-1 text-xs">
          {[...(order.timeline ?? [])].reverse().map((item, idx) => (
            <li key={idx} className="rounded border p-2">
              <p className="font-medium capitalize">{item.event.replace(/_/g, " ")}</p>
              {item.from && item.to && (
                <p className="text-muted-foreground">{item.from} → {item.to}</p>
              )}
              {item.reason && (
                <p className="text-muted-foreground">{item.reason}</p>
              )}
              <p className="text-muted-foreground">{new Date(item.at).toLocaleString()}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
