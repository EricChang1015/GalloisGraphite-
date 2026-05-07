import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Market — Mada Graphite" };

export default async function MarketPage() {
  const supabase = await createServerClient();

  const { data: listings } = await supabase
    .from("listings")
    .select(
      "id, title, quantity, unit, unit_price, currency, incoterm, origin_location, available_from, available_to, product_categories(name)"
    )
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .returns<{
      id: string;
      title: string;
      quantity: number;
      unit: string;
      unit_price: number;
      currency: string;
      incoterm: string;
      origin_location: string;
      available_from: string | null;
      available_to: string | null;
      product_categories: { name: string } | null;
    }[]>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Market</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse active graphite listings. Click any listing to inquire.
        </p>
      </div>

      {!listings?.length ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          No active listings at the moment. Check back soon.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <Link key={l.id} href={`/market/${l.id}`}>
              <Card className="h-full transition-colors hover:border-primary/50 hover:bg-card/80 cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">{l.title}</CardTitle>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {l.product_categories?.name ?? "—"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Qty</span>
                    <span className="font-medium">
                      {l.quantity.toLocaleString()} {l.unit}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Price</span>
                    <span className="font-semibold text-amber-400">
                      {l.unit_price} {l.currency}/{l.unit}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Incoterm</span>
                    <span>{l.incoterm}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Origin</span>
                    <span>{l.origin_location}</span>
                  </div>
                  {l.available_from && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Available</span>
                      <span>
                        {l.available_from}
                        {l.available_to ? ` – ${l.available_to}` : ""}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
