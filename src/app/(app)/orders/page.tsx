import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Orders — Mada Graphite" };

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

export default async function OrdersPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, order_no, total_amount, currency, status, created_at, buyer:profiles!orders_buyer_id_fkey(company_name), seller:profiles!orders_seller_id_fkey(company_name)"
    )
    .or(`buyer_id.eq.${user!.id},seller_id.eq.${user!.id}`)
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
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
        <p className="text-sm text-muted-foreground mt-1">
          All your buy and sell orders. Click to view details, contract, and payment.
        </p>
      </div>

      {!orders?.length ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          No orders yet. Browse the{" "}
          <Link href="/market" className="underline text-primary">
            market
          </Link>{" "}
          to get started.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order No</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <Link
                      href={`/orders/${o.id}`}
                      className="font-mono text-xs text-primary underline"
                    >
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
                      {o.status.replace(/_/g, " ")}
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
      )}
    </div>
  );
}
