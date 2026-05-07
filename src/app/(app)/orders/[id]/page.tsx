import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { OrderActions } from "@/components/order/OrderActions";

interface PageProps {
  params: Promise<{ id: string }>;
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

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return { title: `Order ${id.slice(0, 8).toUpperCase()} — Mada Graphite` };
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single<{ role: string }>();

  const { data: order } = await supabase
    .from("orders")
    .select(`
      *,
      buyer:profiles!orders_buyer_id_fkey(full_name, company_name, email, country),
      seller:profiles!orders_seller_id_fkey(full_name, company_name, email, country),
      listings(title, origin_location, unit, incoterm, product_categories(name)),
      contracts(id, contract_no, content_html, buyer_signed_url, seller_signed_url),
      payments(id, method, amount, currency, tx_hash, proof_url, status, created_at, admin_note)
    `)
    .eq("id", id)
    .single<{
      id: string;
      order_no: string;
      buyer_id: string;
      seller_id: string;
      quantity: number;
      unit_price: number;
      total_amount: number;
      currency: string;
      destination: string | null;
      shipment_from: string | null;
      shipment_eta: string | null;
      status: string;
      timeline: { event: string; at: string; by: string }[];
      created_at: string;
      buyer: { full_name: string; company_name: string; email: string; country: string } | null;
      seller: { full_name: string; company_name: string; email: string; country: string } | null;
      listings: { title: string; origin_location: string; unit: string; incoterm: string; product_categories: { name: string } | null } | null;
      contracts: { id: string; contract_no: string; content_html: string; buyer_signed_url: string | null; seller_signed_url: string | null }[] | null;
      payments: { id: string; method: string; amount: number; currency: string; tx_hash: string | null; proof_url: string | null; status: string; created_at: string; admin_note: string | null }[] | null;
    }>();

  if (!order) notFound();

  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
  const isBuyer = order.buyer_id === user!.id;
  const isSeller = order.seller_id === user!.id;

  if (!isAdmin && !isBuyer && !isSeller) notFound();

  const myRole: "buyer" | "seller" | "other" = isBuyer ? "buyer" : isSeller ? "seller" : "other";
  const contract = order.contracts?.[0] ?? null;
  const payments = order.payments ?? [];

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{order.order_no}</h1>
          <p className="text-sm text-muted-foreground">
            Created {new Date(order.created_at).toLocaleDateString()}
          </p>
        </div>
        <Badge variant="outline" className={statusColor[order.status] ?? ""}>
          {order.status.replace(/_/g, " ")}
        </Badge>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contract">Contract</TabsTrigger>
          <TabsTrigger value="payment">Payment</TabsTrigger>
          <TabsTrigger value="shipment">Shipment</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4 space-y-2 text-sm">
              <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Buyer</p>
              <p className="font-medium">{order.buyer?.company_name ?? "—"}</p>
              <p className="text-muted-foreground">{order.buyer?.full_name} · {order.buyer?.email}</p>
              <p className="text-muted-foreground">{order.buyer?.country}</p>
            </div>
            <div className="rounded-lg border p-4 space-y-2 text-sm">
              <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Seller</p>
              <p className="font-medium">{order.seller?.company_name ?? "—"}</p>
              <p className="text-muted-foreground">{order.seller?.full_name} · {order.seller?.email}</p>
              <p className="text-muted-foreground">{order.seller?.country}</p>
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
            ].map(([label, value]) => (
              <div key={label} className="flex items-center px-4 py-2">
                <span className="w-36 text-muted-foreground shrink-0">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </div>

          {!isAdmin && (
            <OrderActions
              orderId={order.id}
              status={order.status}
              role={myRole}
              totalAmount={order.total_amount}
              currency={order.currency}
            />
          )}
        </TabsContent>

        {/* Contract */}
        <TabsContent value="contract" className="mt-4 space-y-4">
          {!contract ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
              No contract generated yet.
              {order.status === "draft" && !isAdmin && (
                <p className="mt-2 text-xs">Use the Overview tab to generate the contract.</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{contract.contract_no}</p>
                <button
                  onClick={() => {
                    const win = window.open("", "_blank");
                    win?.document.write(contract.content_html);
                    win?.document.close();
                    win?.print();
                  }}
                  className="text-xs text-primary underline"
                >
                  Download / Print PDF
                </button>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded border p-3">
                  <p className="text-xs text-muted-foreground mb-1">Buyer Signature</p>
                  {contract.buyer_signed_url ? (
                    <a href={contract.buyer_signed_url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs">
                      View scan
                    </a>
                  ) : (
                    <p className="text-muted-foreground text-xs">Not uploaded</p>
                  )}
                </div>
                <div className="rounded border p-3">
                  <p className="text-xs text-muted-foreground mb-1">Seller Signature</p>
                  {contract.seller_signed_url ? (
                    <a href={contract.seller_signed_url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs">
                      View scan
                    </a>
                  ) : (
                    <p className="text-muted-foreground text-xs">Not uploaded</p>
                  )}
                </div>
              </div>

              <div
                className="rounded border bg-white text-black p-4 text-xs max-h-96 overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: contract.content_html }}
              />
            </div>
          )}
        </TabsContent>

        {/* Payment */}
        <TabsContent value="payment" className="mt-4 space-y-4">
          {payments.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
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

          {order.status === "signed" && isBuyer && (
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
              ["Shipment From", order.shipment_from ?? "—"],
              ["ETA", order.shipment_eta ?? "—"],
              ["Destination", order.destination ?? "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center px-4 py-2">
                <span className="w-36 text-muted-foreground shrink-0">{label}</span>
                <span>{value}</span>
              </div>
            ))}
          </div>

          {order.status === "paid" && isSeller && (
            <OrderActions
              orderId={order.id}
              status={order.status}
              role="seller"
              totalAmount={order.total_amount}
              currency={order.currency}
            />
          )}
          {order.status === "delivered" && isBuyer && (
            <OrderActions
              orderId={order.id}
              status={order.status}
              role="buyer"
              totalAmount={order.total_amount}
              currency={order.currency}
            />
          )}
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
