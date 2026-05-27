import Link from "next/link";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { createServerClient } from "@/lib/supabase/server";
import { CollapsibleHistorySection } from "@/components/layout/CollapsibleHistorySection";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  isOrderHistoryStatus,
  STATUS_LABEL,
} from "@/lib/order/stateMachine";

export async function generateMetadata() {
  const t = await getTranslations("orders");
  return { title: t("metaTitle") };
}
export const dynamic = "force-dynamic";

type Translator = Awaited<ReturnType<typeof getTranslations<string>>>;

const statusColor: Record<string, string> = {
  draft: "text-muted-foreground",
  quotation_pending: "text-muted-foreground border-border",
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

type OrderRow = {
  id: string;
  order_no: string;
  total_amount: number;
  currency: string;
  status: string;
  created_at: string;
  buyer: { company_name: string } | null;
  seller: { company_name: string } | null;
};

function translateOrderStatus(status: string, tEnums: Translator): string {
  const known: ReadonlyArray<keyof typeof STATUS_LABEL> = [
    "quotation_pending",
    "draft",
    "quoted",
    "negotiating",
    "contract_pending",
    "contract_generated",
    "contract_signed",
    "payment_pending",
    "paid",
    "in_production",
    "ready_to_ship",
    "shipped",
    "in_transit",
    "arrived",
    "customs_cleared",
    "completed",
    "disputed",
    "cancelled",
  ];
  if ((known as readonly string[]).includes(status)) {
    return tEnums(`order.status.${status}`);
  }
  return status.replace(/_/g, " ");
}

function OrdersTable({
  rows,
  tCols,
  tRow,
  tEnums,
}: {
  rows: OrderRow[];
  tCols: Translator;
  tRow: Translator;
  tEnums: Translator;
}) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{tCols("orderNo")}</TableHead>
            <TableHead>{tCols("buyer")}</TableHead>
            <TableHead>{tCols("seller")}</TableHead>
            <TableHead className="text-right">{tCols("amount")}</TableHead>
            <TableHead>{tCols("status")}</TableHead>
            <TableHead>{tCols("created")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((o) => (
            <TableRow key={o.id}>
              <TableCell>
                <Link
                  href={`/orders/${o.id}`}
                  className="font-mono text-xs text-primary underline"
                >
                  {o.order_no}
                </Link>
              </TableCell>
              <TableCell className="text-sm">
                {o.buyer?.company_name ?? tRow("noValue")}
              </TableCell>
              <TableCell className="text-sm">
                {o.seller?.company_name ?? tRow("noValue")}
              </TableCell>
              <TableCell className="text-right font-semibold">
                {o.total_amount} {o.currency}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={statusColor[o.status] ?? ""}>
                  {translateOrderStatus(o.status, tEnums)}
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
  );
}

function parseHistoryOpen(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "open";
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ history?: string }>;
}) {
  const { history: historyParam } = await searchParams;
  const historyOpen = parseHistoryOpen(historyParam);

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const t = await getTranslations("orders");
  const tCols = await getTranslations("orders.columns");
  const tRow = await getTranslations("orders.row");
  const tEnums = await getTranslations("enums");

  if (!user) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
        {t("sessionExpired")}
      </div>
    );
  }

  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, order_no, total_amount, currency, status, created_at, buyer:profiles!orders_buyer_id_fkey(company_name), seller:profiles!orders_seller_id_fkey(company_name)"
    )
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .returns<OrderRow[]>();

  const allOrders = orders ?? [];
  const activeOrders = allOrders.filter((o) => !isOrderHistoryStatus(o.status));
  const historyOrders = allOrders.filter((o) => isOrderHistoryStatus(o.status));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("heading")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("subheading")}</p>
      </div>

      {!allOrders.length ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          {t("emptyTitle")}{" "}
          <Link href="/market" className="underline text-primary">
            {t("emptyCta")}
          </Link>{" "}
          {t("emptyTail")}
        </div>
      ) : (
        <>
          <section>
            <h2 className="text-base font-semibold mb-3">
              {t("activeHeading")}
              {activeOrders.length > 0 ? (
                <Badge variant="secondary" className="ml-2">
                  {activeOrders.length}
                </Badge>
              ) : null}
            </h2>
            {activeOrders.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                {t("activeEmpty")}
              </div>
            ) : (
              <OrdersTable rows={activeOrders} tCols={tCols} tRow={tRow} tEnums={tEnums} />
            )}
          </section>

          <Suspense fallback={null}>
            <CollapsibleHistorySection
              title={t("historyTitle")}
              count={historyOrders.length}
              defaultOpen={historyOpen}
            >
              <OrdersTable rows={historyOrders} tCols={tCols} tRow={tRow} tEnums={tEnums} />
            </CollapsibleHistorySection>
          </Suspense>
        </>
      )}
    </div>
  );
}
