import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlusIcon } from "lucide-react";

export const metadata = { title: "My Listings — Mada Graphite" };

export default async function ListingsPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: listings } = await supabase
    .from("listings")
    .select("id, title, quantity, unit, unit_price, currency, status, created_at, product_categories(name)")
    .eq("seller_id", user!.id)
    .order("created_at", { ascending: false })
    .returns<{
      id: string;
      title: string;
      quantity: number;
      unit: string;
      unit_price: number;
      currency: string;
      status: string;
      created_at: string;
      product_categories: { name: string } | null;
    }[]>();

  const statusColor: Record<string, string> = {
    active: "text-green-400 border-green-400/40",
    paused: "text-yellow-400 border-yellow-400/40",
    sold_out: "text-muted-foreground",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Listings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your active product listings.
          </p>
        </div>
        <Button render={<Link href="/listings/new" />}>
          <PlusIcon className="w-4 h-4 mr-2" />
          New Listing
        </Button>
      </div>

      {!listings?.length ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          You have no listings yet.{" "}
          <Link href="/listings/new" className="underline text-primary">
            Create your first listing
          </Link>
          .
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listings.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <Link href={`/market/${l.id}`} className="hover:underline font-medium">
                      {l.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {l.product_categories?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {l.quantity.toLocaleString()} {l.unit}
                  </TableCell>
                  <TableCell className="text-right text-amber-400 font-medium">
                    {l.unit_price} {l.currency}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColor[l.status] ?? ""}>
                      {l.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(l.created_at).toLocaleDateString()}
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
