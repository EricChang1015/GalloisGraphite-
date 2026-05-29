import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

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
import { type OrderStatus } from "@/lib/order/stateMachine";
import {
  type PaymentCategory,
  type PaymentMilestone,
  type PaymentScheduleStatus,
} from "@/lib/validations/payment-schedule";
import type { DocumentType } from "@/lib/validations/document";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const t = await getTranslations("admin");
  return { title: `${t("meta.orderDetail")} ${id.slice(0, 8).toUpperCase()} — Mada Graphite` };
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const t = await getTranslations("admin");
  const tEnums = await getTranslations("enums");

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

  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select(`
      *,
      buyer:profiles!orders_buyer_id_fkey(id, full_name, company_name, email, country),
      seller:profiles!orders_seller_id_fkey(id, full_name, company_name, email, country),
      listings(title, origin_location, unit, incoterm, product_categories(name)),
      contracts(id, contract_no, buyer_signed_url, seller_signed_url, buyer_approved_at, buyer_rejected_at, buyer_reject_reason, revision_no),
      payments(id, method, amount, currency, status, created_at, admin_note, reviewed_by, reviewed_at, schedule_id),
      payment_schedules(id, sequence, category, milestone, percentage, amount, currency, due_date, status, paid_payment_id)
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
      incoterm: string | null;
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
        revision_no: number;
      } | null;
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
        schedule_id: string | null;
      }[] | null;
      payment_schedules: {
        id: string;
        sequence: number;
        category: PaymentCategory;
        milestone: PaymentMilestone;
        percentage: number;
        amount: number;
        currency: string;
        due_date: string | null;
        status: PaymentScheduleStatus;
        paid_payment_id: string | null;
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

  const contract = order.contracts ?? null;
  const yes = "✓";
  const no = "—";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">
          <Link href="/admin/orders" className="hover:text-foreground">
            {t("orders.detail.breadcrumb")}
          </Link>{" "}
          / {order.order_no}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{order.order_no}</h1>
          <Badge variant="outline">
            {tEnums(`order.status.${order.status}`)}
          </Badge>
          {order.incoterm && (
            <Badge variant="outline" className="text-xs">
              {order.incoterm}
            </Badge>
          )}
          <Link
            href={`/orders/${id}`}
            className="text-xs text-primary underline ml-auto"
          >
            {t("orders.detail.viewAsParty")}
          </Link>
        </div>
      </div>

      <OrderProgressBar
        status={order.status}
        paymentsSummary={{
          paid: (order.payment_schedules ?? []).filter((s) => s.status === "paid").length,
          total: (order.payment_schedules ?? []).length,
        }}
      />

      <AdminOrderActions orderId={order.id} currentStatus={order.status} />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="rounded-lg border p-4 space-y-1 text-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            {t("orders.detail.buyer")}
          </p>
          <p className="font-medium">{order.buyer?.company_name ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{order.buyer?.full_name}</p>
          <p className="text-xs text-muted-foreground">{order.buyer?.email}</p>
          <p className="text-xs text-muted-foreground">{order.buyer?.country}</p>
        </div>
        <div className="rounded-lg border p-4 space-y-1 text-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            {t("orders.detail.seller")}
          </p>
          <p className="font-medium">{order.seller?.company_name ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{order.seller?.full_name}</p>
          <p className="text-xs text-muted-foreground">{order.seller?.email}</p>
          <p className="text-xs text-muted-foreground">{order.seller?.country}</p>
        </div>
        <div className="rounded-lg border p-4 space-y-1 text-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            {t("orders.detail.order")}
          </p>
          <p className="text-xs">
            {t("orders.detail.qty")}{" "}
            <span className="font-medium">{order.quantity}</span>
          </p>
          <p className="text-xs">
            {t("orders.detail.total")}{" "}
            <span className="font-medium">
              {order.total_amount} {order.currency}
            </span>
          </p>
          <p className="text-xs">
            {t("orders.detail.created")}{" "}
            {new Date(order.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      <Separator />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("orders.detail.contract")}</h2>
        {!contract ? (
          <p className="text-xs text-muted-foreground">{t("orders.detail.noContract")}</p>
        ) : (
          <div className="rounded-lg border p-3 text-sm space-y-1">
            <p className="font-medium">
              {t("orders.detail.revision", {
                contractNo: contract.contract_no,
                revision: contract.revision_no,
              })}
            </p>
            <p className="text-xs">
              {t("orders.detail.buyerSigned")}{" "}
              {contract.buyer_signed_url ? yes : no} ·{" "}
              {t("orders.detail.sellerSigned")}{" "}
              {contract.seller_signed_url ? yes : no} ·{" "}
              {t("orders.detail.buyerApproved")}{" "}
              {contract.buyer_approved_at ? yes : no}
            </p>
            {contract.buyer_rejected_at && (
              <p className="text-xs text-red-400">
                {t("orders.detail.rejected", {
                  reason: contract.buyer_reject_reason ?? "",
                })}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("orders.detail.paymentSchedule")}</h2>
        {!order.payment_schedules || order.payment_schedules.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("orders.detail.noSchedule")}</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 w-8">#</th>
                  <th className="text-left px-3 py-2">
                    {t("orders.detail.scheduleTable.category")}
                  </th>
                  <th className="text-left px-3 py-2">
                    {t("orders.detail.scheduleTable.milestone")}
                  </th>
                  <th className="text-right px-3 py-2">%</th>
                  <th className="text-right px-3 py-2">
                    {t("orders.table.amount")}
                  </th>
                  <th className="text-left px-3 py-2">
                    {t("orders.detail.scheduleTable.due")}
                  </th>
                  <th className="text-left px-3 py-2">
                    {t("orders.detail.scheduleTable.status")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...order.payment_schedules]
                  .sort((a, b) => a.sequence - b.sequence)
                  .map((s) => (
                    <tr key={s.id} className="border-t border-border/50">
                      <td className="px-3 py-2 text-muted-foreground">{s.sequence + 1}</td>
                      <td className="px-3 py-2">
                        {tEnums(`payment.category.${s.category}`)}
                      </td>
                      <td className="px-3 py-2">
                        {tEnums(`payment.milestone.${s.milestone}`)}
                      </td>
                      <td className="px-3 py-2 text-right">{s.percentage.toFixed(2)}%</td>
                      <td className="px-3 py-2 text-right">
                        {s.amount.toFixed(2)} {s.currency}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{s.due_date ?? "—"}</td>
                      <td className="px-3 py-2">
                        {tEnums(`payment.scheduleStatus.${s.status}`)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("orders.detail.payments")}</h2>
        {(order.payments ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("orders.detail.none")}</p>
        ) : (
          <ul className="space-y-2">
            {(order.payments ?? []).map((p) => (
              <li key={p.id} className="rounded border p-2 text-xs flex items-center justify-between">
                <span>
                  {p.amount} {p.currency} · {p.method.replace(/_/g, " ")}
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {tEnums(`payment.status.${p.status as "pending" | "verified" | "rejected"}`)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("orders.detail.shipment")}</h2>
        <div className="rounded border p-3 text-xs grid grid-cols-2 gap-2">
          <div>
            {t("orders.detail.bl")}{" "}
            <span className="font-medium">{order.bl_no ?? "—"}</span>
          </div>
          <div>
            {t("orders.detail.vessel")}{" "}
            <span className="font-medium">{order.vessel_name ?? "—"}</span>
          </div>
          <div>
            {t("orders.detail.ata")}{" "}
            <span className="font-medium">{order.ata ?? "—"}</span>
          </div>
          <div>
            {t("orders.detail.destination")}{" "}
            <span className="font-medium">{order.destination ?? "—"}</span>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("orders.detail.documents")}</h2>
        <OrderDocumentsTab
          orderId={order.id}
          documents={documents}
          isAdmin
          canUpload
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("orders.detail.auditLog")}</h2>
        {!auditLogs || auditLogs.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("orders.detail.noAudit")}</p>
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

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("orders.detail.timeline")}</h2>
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
