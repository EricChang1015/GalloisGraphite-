import { createServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  MarketListingCard,
  type MarketListingItem,
} from "@/components/market/MarketListingCard";
import {
  parseCategorySpec,
  parseListingSpecs,
  resolveListingSpecs,
} from "@/lib/categories/spec";

export const metadata = { title: "Market — [REDACTED]" };

export default async function MarketPage() {
  const user = await getCurrentUser();
  const supabase = await createServerClient();

  const { data: listings } = await supabase
    .from("listings")
    .select(
      `id, title, quantity, min_order_quantity, unit, unit_price, currency, incoterm, origin_location,
       available_from, available_to, seller_id, specs, images,
       product_categories(name, spec_schema),
       seller:profiles!listings_seller_id_fkey(id, full_name, company_name, country)`
    )
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .returns<
      {
        id: string;
        title: string;
        quantity: number;
        min_order_quantity: number | null;
        unit: string;
        unit_price: number;
        currency: string;
        incoterm: string;
        origin_location: string;
        available_from: string | null;
        available_to: string | null;
        seller_id: string;
        specs: Record<string, unknown> | null;
        images: string[] | null;
        product_categories: {
          name: string;
          spec_schema: Record<string, unknown> | null;
        } | null;
        seller: {
          id: string;
          full_name: string | null;
          company_name: string | null;
          country: string | null;
        } | null;
      }[]
    >();

  const items: MarketListingItem[] = (listings ?? []).map((l) => {
    const spec = parseCategorySpec(l.product_categories?.spec_schema);
    const overrides = parseListingSpecs(l.specs);
    const resolved = resolveListingSpecs(spec, overrides);
    // Compact "+100 Mesh · 94% C" chip for the card.
    const specChip = `${resolved.mesh_size} · ${resolved.fixed_carbon} C`;
    return {
      id: l.id,
      title: l.title,
      quantity: l.quantity,
      min_order_quantity: l.min_order_quantity,
      unit: l.unit,
      unit_price: l.unit_price,
      currency: l.currency,
      incoterm: l.incoterm,
      origin_location: l.origin_location,
      available_from: l.available_from,
      available_to: l.available_to,
      categoryName: l.product_categories?.name ?? "—",
      specChip,
      coverImage: (l.images ?? [])[0] ?? null,
      seller: {
        id: l.seller?.id ?? l.seller_id,
        full_name: l.seller?.full_name ?? null,
        company_name: l.seller?.company_name ?? null,
        country: l.seller?.country ?? null,
      },
    };
  });

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
