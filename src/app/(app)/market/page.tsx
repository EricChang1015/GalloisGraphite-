import { createServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  MarketListingCard,
  type MarketListingItem,
} from "@/components/market/MarketListingCard";

export const metadata = { title: "Market — [REDACTED]" };

export default async function MarketPage() {
  const user = await getCurrentUser();
  const supabase = await createServerClient();

  const { data: listings } = await supabase
    .from("listings")
    .select(
      `id, title, quantity, unit, unit_price, currency, incoterm, origin_location,
       available_from, available_to, seller_id,
       product_categories(name),
       seller:profiles!listings_seller_id_fkey(id, full_name, company_name, country)`
    )
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .returns<
      {
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
        seller_id: string;
        product_categories: { name: string } | null;
        seller: {
          id: string;
          full_name: string | null;
          company_name: string | null;
          country: string | null;
        } | null;
      }[]
    >();

  const items: MarketListingItem[] = (listings ?? []).map((l) => ({
    id: l.id,
    title: l.title,
    quantity: l.quantity,
    unit: l.unit,
    unit_price: l.unit_price,
    currency: l.currency,
    incoterm: l.incoterm,
    origin_location: l.origin_location,
    available_from: l.available_from,
    available_to: l.available_to,
    categoryName: l.product_categories?.name ?? "—",
    seller: {
      id: l.seller?.id ?? l.seller_id,
      full_name: l.seller?.full_name ?? null,
      company_name: l.seller?.company_name ?? null,
      country: l.seller?.country ?? null,
    },
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Market</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse active graphite listings. Message sellers directly or open a
          listing to inquire.
        </p>
      </div>

      {!items.length ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          No active listings at the moment. Check back soon.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((l) => (
            <MarketListingCard
              key={l.id}
              listing={l}
              currentUserId={user?.id ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
