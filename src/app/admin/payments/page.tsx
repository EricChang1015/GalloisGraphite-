import Link from "next/link";
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
import { PaymentVerifyActions } from "@/components/admin/PaymentVerifyActions";

export const metadata = { title: "Admin · Payments" };

export default async function AdminPaymentsPage() {
  const admin = createAdminClient();

  // NOTE: the FK on `payments.buyer_id -> profiles.id` is named
  // `payments_payer_id_fkey` (legacy schema name from before the
  // `payer_id` -> `buyer_id` rename). Using the wrong hint silently
  // fails the JOIN and returns no rows, which is why the admin
  // dashboard could simultaneously show "1 Action needed" and an
  // empty list.
  const { data: payments, error: paymentsError } = await admin
    .from("payments")
    .select(
      "id, method, amount, currency, tx_hash, proof_url, note, status, admin_note, created_at, order_id, buyer_id, profiles!payments_payer_id_fkey(company_name, email, full_name)"
    )
    .order("created_at", { ascending: false })
    .returns<{
      id: string;
      method: string;
      amount: number;
      currency: string;
      tx_hash: string | null;
      proof_url: string | null;
      note: string | null;
      status: string;
      admin_note: string | null;
      created_at: string;
      order_id: string;
      buyer_id: string;
      profiles: {
        company_name: string | null;
        email: string | null;
        full_name: string | null;
      } | null;
    }[]>();

  const pending = payments?.filter((p) => p.status === "pending") ?? [];
  const reviewed = payments?.filter((p) => p.status !== "pending") ?? [];

  const statusColor: Record<string, string> = {
    pending: "text-yellow-400 border-yellow-400/40",
    verified: "text-green-400 border-green-400/40",
    rejected: "text-red-400 border-red-400/40",
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Payment Verification</h1>
        <p className="text-sm text-muted-foreground mt-1">
          ⭐ Core workflow: review pending payments and mark them verified or rejected.
        </p>
      </div>

      {paymentsError && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          <p className="font-medium">Failed to load payments.</p>
          <p className="text-xs opacity-80 mt-1 break-all">
            {paymentsError.message}
          </p>
        </div>
      )}

      <section>
        <h2 className="text-base font-semibold mb-3">
          Pending Review{" "}
          {pending.length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {pending.length}
            </Badge>
          )}
        </h2>
        {pending.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
            No pending payments. 🎉
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>TX / Proof</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-56">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {p.profiles?.company_name ?? p.profiles?.full_name ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {p.profiles?.email ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link href={`/orders/${p.order_id}`} className="text-primary text-xs underline">
                        {p.order_id.slice(0, 8)}…
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{p.method.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {p.amount} {p.currency}
                    </TableCell>
                    <TableCell className="text-xs space-y-1">
                      {p.tx_hash && (
                        <span
                          className="font-mono text-muted-foreground truncate block max-w-[180px]"
                          title={p.tx_hash}
                        >
                          {p.tx_hash}
                        </span>
                      )}
                      {p.proof_url && (
                        <a
                          href={p.proof_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline block"
                        >
                          View proof
                        </a>
                      )}
                      {p.note && (
                        <span
                          className="text-muted-foreground block max-w-[200px] truncate"
                          title={p.note}
                        >
                          {p.note}
                        </span>
                      )}
                      {!p.tx_hash && !p.proof_url && !p.note && "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <PaymentVerifyActions paymentId={p.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-base font-semibold mb-3">History</h2>
        {reviewed.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
            No reviewed payments yet.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Admin Note</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewed.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">
                      {p.profiles?.company_name ?? p.profiles?.full_name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Link href={`/orders/${p.order_id}`} className="text-primary text-xs underline">
                        {p.order_id.slice(0, 8)}…
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {p.amount} {p.currency}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColor[p.status] ?? ""}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.admin_note ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
