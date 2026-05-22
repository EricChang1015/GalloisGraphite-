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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InquiryActions } from "@/components/listing/InquiryActions";

export const metadata = { title: "Inquiries — Mada Graphite" };

const statusColor: Record<string, string> = {
  pending: "text-yellow-400 border-yellow-400/40",
  quoted: "text-blue-400 border-blue-400/40",
  negotiating: "text-purple-400 border-purple-400/40",
  accepted: "text-cyan-400 border-cyan-400/40",
  rejected: "text-red-400 border-red-400/40",
  expired: "text-muted-foreground border-border",
  converted: "text-green-400 border-green-400/40",
};

export default async function InquiriesPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  // See ListingsPage for the rationale: middleware should have
  // redirected anonymous traffic; this is a defensive bail-out for the
  // edge case where a stale cookie slips through.
  if (!user) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
        Your session expired. Please sign in again.
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();

  const isSeller = profile?.role === "seller" || profile?.role === "admin" || profile?.role === "super_admin";

  const [{ data: asBuyer }, { data: asSeller }] = await Promise.all([
    supabase
      .from("inquiries")
      .select(
        "id, status, requested_qty, target_price, destination, message, created_at, product_categories(name), profiles!inquiries_seller_id_fkey(company_name)"
      )
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false })
      .returns<{
        id: string;
        status: string;
        requested_qty: number;
        target_price: number | null;
        destination: string | null;
        message: string | null;
        created_at: string;
        product_categories: { name: string } | null;
        profiles: { company_name: string } | null;
      }[]>(),
    isSeller
      ? supabase
          .from("inquiries")
          .select(
            "id, status, requested_qty, target_price, destination, message, created_at, product_categories(name), profiles!inquiries_buyer_id_fkey(company_name, country)"
          )
          .eq("seller_id", user.id)
          .order("created_at", { ascending: false })
          .returns<{
            id: string;
            status: string;
            requested_qty: number;
            target_price: number | null;
            destination: string | null;
            message: string | null;
            created_at: string;
            product_categories: { name: string } | null;
            profiles: { company_name: string; country: string } | null;
          }[]>()
      : { data: [] },
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inquiries</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track all inquiries you&apos;ve sent and received.
        </p>
      </div>

      <Tabs defaultValue="sent">
        <TabsList>
          <TabsTrigger value="sent">Sent ({asBuyer?.length ?? 0})</TabsTrigger>
          {isSeller && (
            <TabsTrigger value="received">
              Received ({asSeller?.length ?? 0})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="sent" className="mt-4">
          {!asBuyer?.length ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
              You haven&apos;t sent any inquiries yet.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Seller</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Target Price</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {asBuyer.map((inq) => (
                    <TableRow key={inq.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">
                        <Link href={`/inquiries/${inq.id}`} className="hover:underline">
                          {inq.product_categories?.name ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{inq.profiles?.company_name ?? "—"}</TableCell>
                      <TableCell className="text-right">{inq.requested_qty}</TableCell>
                      <TableCell className="text-right">{inq.target_price ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{inq.destination ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColor[inq.status] ?? ""}>
                          {inq.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(inq.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {isSeller && (
          <TabsContent value="received" className="mt-4">
            {!asSeller?.length ? (
              <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
                No inquiries received yet.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {asSeller.map((inq) => (
                      <TableRow key={inq.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">
                          <Link href={`/inquiries/${inq.id}`} className="hover:underline">
                            {inq.product_categories?.name ?? "—"}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{inq.profiles?.company_name ?? "—"}</TableCell>
                        <TableCell className="text-right">{inq.requested_qty}</TableCell>
                        <TableCell className="text-muted-foreground">{inq.destination ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate text-xs">
                          {inq.message ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusColor[inq.status] ?? ""}>
                            {inq.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {(inq.status === "pending" || inq.status === "negotiating") && (
                            <InquiryActions inquiryId={inq.id} />
                          )}
                          {(inq.status === "quoted" || inq.status === "negotiating") && (
                            <Link
                              href={`/inquiries/${inq.id}`}
                              className="text-xs text-primary underline ml-2"
                            >
                              Review
                            </Link>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
