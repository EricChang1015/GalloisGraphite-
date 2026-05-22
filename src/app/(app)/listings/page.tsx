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
import {
  parseCategorySpec,
  parseListingSpecs,
  resolveListingSpecs,
} from "@/lib/categories/spec";

export const metadata = { title: "My Listings — Mada Graphite" };

export default async function ListingsPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Middleware (`src/proxy.ts`) should have redirected unauthenticated
  // visitors before they ever hit this page. Belt-and-braces: bail out
  // cleanly if a stale session cookie sneaks through during a session
  // transition rather than letting `user!.id` throw a TypeError.
  if (!user) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
        Your session expired. Please sign in again.
      </div>
    );
  }

  const { data: listings } = await supabase
    .from("listings")
    .select(
      "id, title, quantity, min_order_quantity, unit, unit_price, currency, status, created_at, specs, product_categories(name, spec_schema)"
    )
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false })
    .returns<{
      id: string;
      title: string;
      quantity: number;
      min_order_quantity: number | null;
      unit: string;
      unit_price: number;
      currency: string;
      status: string;
      created_at: string;
      specs: Record<string, unknown> | null;
      product_categories: {
        name: string;
        spec_schema: Record<string, unknown> | null;
      } | null;
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
              {listings.map((l) => {
                const spec = parseCategorySpec(l.product_categories?.spec_schema);
                const overrides = parseListingSpecs(l.specs);
                const resolved = resolveListingSpecs(spec, overrides);
                return (
                  <TableRow key={l.id}>
                    <TableCell>
                      <Link
                        href={`/market/${l.id}`}
                        className="hover:underline font-medium"
                      >
                        {l.title}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {resolved.mesh_size} · {resolved.fixed_carbon} C
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {l.product_categories?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {l.quantity.toLocaleString()} {l.unit}
                      {l.min_order_quantity != null &&
                        l.min_order_quantity > 0 && (
                          <p className="text-[10px] text-muted-foreground">
                            Min order:{" "}
                            {l.min_order_quantity.toLocaleString()} {l.unit}
                          </p>
                        )}
                    </TableCell>
                    <TableCell className="text-right text-amber-400 font-medium">
                      {l.unit_price} {l.currency}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusColor[l.status] ?? ""}
                      >
                        {l.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(l.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
