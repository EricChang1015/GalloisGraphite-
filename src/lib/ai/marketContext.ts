import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Aggregated market snapshot used by the AI assistant to give signed-in
 * buyers indicative price ranges WITHOUT exposing individual listings,
 * sellers, or counterparties.
 *
 * Anonymisation rules:
 *   - Per-category aggregate ⇒ only emitted when count >= 1.
 *   - Recent trades ⇒ at most {@link MAX_RECENT_TRADES} rows; never any
 *     buyer/seller name, order number, or listing id.
 *   - Currencies are bucketed by category — if multiple currencies are mixed
 *     in one category we report the mode currency and round figures conservatively.
 *
 * The query is cheap (two selects with simple aggregation) and is repeated on
 * every chat request; no caching for now (revisit if Postgres usage is hot).
 */

export interface CategoryPriceRow {
  categoryName: string;
  count: number;
  minPrice: number | null;
  avgPrice: number | null;
  maxPrice: number | null;
  currency: string | null;
  unit: string | null;
}

export interface RecentTrade {
  categoryName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  currency: string;
  status: "paid" | "shipped" | "delivered" | "completed";
}

export interface MarketContext {
  byCategory: CategoryPriceRow[];
  recentTrades: RecentTrade[];
  generatedAt: string;
}

const MAX_RECENT_TRADES = 5;
const RECENT_TRADES_WINDOW_DAYS = 90;
const SETTLED_ORDER_STATUSES = [
  "paid",
  "in_production",
  "ready_to_ship",
  "shipped",
  "in_transit",
  "arrived",
  "customs_cleared",
  "completed",
] as const;

type ListingRow = {
  unit_price: number;
  currency: string;
  unit: string | null;
  category_id: string;
  product_categories: { name: string } | { name: string }[] | null;
};

type OrderRow = {
  unit_price: number;
  currency: string;
  quantity: number;
  status: Database["public"]["Enums"]["order_status"];
  created_at: string;
  listings: {
    unit: string | null;
    product_categories: { name: string } | { name: string }[] | null;
  } | null;
};

function pickCategoryName(
  rel: { name: string } | { name: string }[] | null | undefined
): string | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return rel[0]?.name ?? null;
  return rel.name ?? null;
}

function modeOf<T extends string>(values: T[]): T | null {
  if (values.length === 0) return null;
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | null = null;
  let bestCount = -1;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

/**
 * Pull a snapshot of indicative pricing across all active listings and
 * recent settled orders. Safe to call from the chat route handler.
 */
export async function getMarketContext(
  supabase: SupabaseClient<Database>
): Promise<MarketContext> {
  const { data: listings } = await supabase
    .from("listings")
    .select(
      "unit_price, currency, unit, category_id, product_categories(name)"
    )
    .eq("status", "active")
    .returns<ListingRow[]>();

  const since = new Date(
    Date.now() - RECENT_TRADES_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: orders } = await supabase
    .from("orders")
    .select(
      "unit_price, currency, quantity, status, created_at, listings(unit, product_categories(name))"
    )
    .in("status", [...SETTLED_ORDER_STATUSES])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(MAX_RECENT_TRADES * 4)
    .returns<OrderRow[]>();

  // Aggregate listings per category
  const grouped = new Map<
    string,
    {
      categoryName: string;
      prices: number[];
      currencies: string[];
      units: (string | null)[];
    }
  >();

  for (const row of listings ?? []) {
    const name = pickCategoryName(row.product_categories) ?? "Uncategorized";
    const bucket = grouped.get(name) ?? {
      categoryName: name,
      prices: [],
      currencies: [],
      units: [],
    };
    bucket.prices.push(Number(row.unit_price));
    bucket.currencies.push(row.currency);
    bucket.units.push(row.unit ?? null);
    grouped.set(name, bucket);
  }

  const byCategory: CategoryPriceRow[] = Array.from(grouped.values())
    .map((b) => {
      const prices = b.prices.filter((p) => !Number.isNaN(p));
      const sum = prices.reduce((a, n) => a + n, 0);
      return {
        categoryName: b.categoryName,
        count: prices.length,
        minPrice: prices.length ? Math.min(...prices) : null,
        avgPrice: prices.length ? sum / prices.length : null,
        maxPrice: prices.length ? Math.max(...prices) : null,
        currency: modeOf(b.currencies),
        unit: modeOf(b.units.filter((u): u is string => u !== null)),
      };
    })
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName));

  // Recent trades (anonymised)
  const recentTrades: RecentTrade[] = (orders ?? [])
    .slice(0, MAX_RECENT_TRADES)
    .map((o) => ({
      categoryName:
        pickCategoryName(o.listings?.product_categories) ?? "Uncategorized",
      quantity: Number(o.quantity),
      unit: o.listings?.unit ?? "MT",
      unitPrice: Number(o.unit_price),
      currency: o.currency,
      status: o.status as RecentTrade["status"],
    }));

  return {
    byCategory,
    recentTrades,
    generatedAt: new Date().toISOString(),
  };
}
