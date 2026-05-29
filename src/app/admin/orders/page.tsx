import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export async function generateMetadata() {
  const t = await getTranslations("admin");
  return { title: `${t("meta.orders")} — Mada Graphite` };
}

const statusColor: Record<string, string> = {
  draft: "text-muted-foreground",
  contract_generated: "text-blue-400 border-blue-400/40",
  signed: "text-purple-400 border-purple-400/40",
  payment_pending: "text-yellow-400 border-yellow-400/40",
  paid: "text-green-400 border-green-400/40",
  shipped: "text-cyan-400 border-cyan-400/40",
  delivered: "text-teal-400 border-teal-400/40",
  completed: "text-emerald-400 border-emerald-400/40",
  disputed: "text-red-400 border-red-400/40",
  cancelled: "text-muted-foreground",
};

export default async function AdminOrdersPage() {
  const t = await getTranslations("admin");
  const tEnums = await getTranslations("enums");
  const admin = createAdminClient();

  const { data: orders } = await admin
    .from("orders")
    .select(
      "id, order_no, total_amount, currency, status, created_at, buyer:profiles!orders_buyer_id_fkey(company_name), seller:profiles!orders_seller_id_fkey(company_name)"
    )
    .order("created_at", { ascending: false })
    .returns<{
      id: string;
      order_no: string;
      total_amount: number;
      currency: string;
      status: string;
      created_at: string;
      buyer: { company_name: string } | null;
      seller: { company_name: string } | null;
    }[]>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("orders.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("orders.subtitle")}</p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("orders.table.orderNo")}</TableHead>
              <TableHead>{t("orders.table.buyer")}</TableHead>
              <TableHead>{t("orders.table.seller")}</TableHead>
              <TableHead className="text-right">{t("orders.table.amount")}</TableHead>
              <TableHead>{t("orders.table.status")}</TableHead>
              <TableHead>{t("orders.table.created")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(orders ?? []).map((o) => (
              <TableRow key={o.id}>
                <TableCell>
                  <Link href={`/admin/orders/${o.id}`} className="text-primary underline text-sm font-mono">
                    {o.order_no}
                  </Link>
                </TableCell>
                <TableCell className="text-sm">{o.buyer?.company_name ?? "—"}</TableCell>
                <TableCell className="text-sm">{o.seller?.company_name ?? "—"}</TableCell>
                <TableCell className="text-right font-semibold">
                  {o.total_amount} {o.currency}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusColor[o.status] ?? ""}>
                    {tEnums(`order.status.${o.status as "draft"}`)}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(o.created_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
