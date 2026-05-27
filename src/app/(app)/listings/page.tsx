import Link from "next/link";
import { getTranslations } from "next-intl/server";
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
import { ListingRowActions } from "@/components/listing/ListingRowActions";

export async function generateMetadata() {
  const t = await getTranslations("listings");
  return { title: t("metaTitle") };
}

export default async function ListingsPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const t = await getTranslations("listings");
  const tEnums = await getTranslations("enums");
  // Middleware (`src/proxy.ts`) should have redirected unauthenticated
  // visitors before they ever hit this page. Belt-and-braces: bail out
  // cleanly if a stale session cookie sneaks through during a session
  // transition rather than letting `user!.id` throw a TypeError.
  if (!user) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
        {t("sessionExpired")}
      </div>
    );
  }

  const { data: listings } = await supabase
    .from("listings")
    .select(
      "id, title, quantity, min_order_quantity, unit, unit_price, currency, status, created_at, specs, images, product_categories(name, spec_schema)"
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
      images: string[] | null;
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
          <h1 className="text-2xl font-semibold tracking-tight">{t("heading")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("subheading")}
          </p>
        </div>
        <Button render={<Link href="/listings/new" />}>
          <PlusIcon className="w-4 h-4 mr-2" />
          {t("newButton")}
        </Button>
      </div>

      {!listings?.length ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          {t("emptyTitle")}{" "}
          <Link href="/listings/new" className="underline text-primary">
            {t("emptyCta")}
          </Link>
          .
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.title")}</TableHead>
                <TableHead>{t("columns.category")}</TableHead>
                <TableHead className="text-right">{t("columns.qty")}</TableHead>
                <TableHead className="text-right">{t("columns.price")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
                <TableHead>{t("columns.created")}</TableHead>
                <TableHead className="text-right">{t("columns.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listings.map((l) => {
                const spec = parseCategorySpec(l.product_categories?.spec_schema);
                const overrides = parseListingSpecs(l.specs);
                const resolved = resolveListingSpecs(spec, overrides);
                const cover = (l.images ?? [])[0] ?? null;
                const statusKey = (l.status === "active" ||
                  l.status === "paused" ||
                  l.status === "sold_out")
                  ? l.status
                  : null;
                return (
                  <TableRow key={l.id}>
                    <TableCell>
                      <div className="flex items-start gap-3">
                        {cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={cover}
                            alt=""
                            className="size-10 shrink-0 rounded object-cover bg-muted"
                          />
                        ) : (
                          <div
                            className="size-10 shrink-0 rounded bg-muted/40"
                            aria-hidden
                          />
                        )}
                        <div>
                          <Link
                            href={`/market/${l.id}`}
                            className="hover:underline font-medium"
                          >
                            {l.title}
                          </Link>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {resolved.mesh_size} · {resolved.fixed_carbon} C
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {l.product_categories?.name ?? t("row.noCategory")}
                    </TableCell>
                    <TableCell className="text-right">
                      {l.quantity.toLocaleString()} {l.unit}
                      {l.min_order_quantity != null &&
                        l.min_order_quantity > 0 && (
                          <p className="text-[10px] text-muted-foreground">
                            {t("row.minOrder", {
                              qty: `${l.min_order_quantity.toLocaleString()} ${l.unit}`,
                            })}
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
                        {statusKey
                          ? tEnums(`listing.status.${statusKey}`)
                          : l.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(l.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <ListingRowActions
                        listing={{
                          id: l.id,
                          title: l.title,
                          status: l.status,
                        }}
                      />
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
