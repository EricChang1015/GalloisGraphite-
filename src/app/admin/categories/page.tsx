import { getTranslations } from "next-intl/server";

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
import {
  CategoryFormDialog,
  DeleteCategoryButton,
  ReactivateCategoryButton,
} from "@/components/admin/CategoryActions";
import {
  parseCategorySpec,
  type CategorySpec,
} from "@/lib/categories/spec";

export async function generateMetadata() {
  const t = await getTranslations("admin");
  return { title: `${t("meta.categories")} — Mada Graphite` };
}

function describeCategorySpecLocalized(
  spec: CategorySpec,
  t: Awaited<ReturnType<typeof getTranslations<"admin">>>
): string {
  const parts: string[] = [];
  if (spec.is_custom) {
    parts.push(t("categories.spec.customMesh"));
  } else if (spec.mesh_size) {
    parts.push(t("categories.spec.mesh", { size: spec.mesh_size }));
  }
  parts.push(
    t("categories.spec.carbon", {
      min: spec.fixed_carbon_min,
      max: spec.fixed_carbon_max,
    })
  );
  parts.push(t("categories.spec.moisture", { max: spec.moisture_max }));
  return parts.join(" · ");
}

export default async function AdminCategoriesPage() {
  const t = await getTranslations("admin");
  const tEnums = await getTranslations("enums");
  const admin = createAdminClient();

  const { data: categories } = await admin
    .from("product_categories")
    .select("id, name, description, spec_schema, is_active, created_at")
    .order("is_active", { ascending: false })
    .order("name")
    .returns<{
      id: string;
      name: string;
      description: string | null;
      spec_schema: Record<string, unknown> | null;
      is_active: boolean;
      created_at: string;
    }[]>();

  const categoryIds = (categories ?? []).map((c) => c.id);
  const listingCounts = new Map<string, number>();
  if (categoryIds.length > 0) {
    const { data: countRows } = await admin
      .from("listings")
      .select("category_id")
      .in("category_id", categoryIds);
    for (const row of countRows ?? []) {
      const id = (row as { category_id: string }).category_id;
      listingCounts.set(id, (listingCounts.get(id) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("categories.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("categories.subtitle")}</p>
        </div>
        <CategoryFormDialog />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("categories.table.name")}</TableHead>
              <TableHead>{t("categories.table.specification")}</TableHead>
              <TableHead className="text-right">{t("categories.table.listings")}</TableHead>
              <TableHead>{t("categories.table.description")}</TableHead>
              <TableHead>{t("categories.table.status")}</TableHead>
              <TableHead>{t("categories.table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(categories ?? []).map((c) => {
              const spec = parseCategorySpec(c.spec_schema);
              const usageCount = listingCounts.get(c.id) ?? 0;
              return (
                <TableRow
                  key={c.id}
                  className={c.is_active ? "" : "opacity-60"}
                >
                  <TableCell className="font-medium align-top">
                    {c.name}
                    {spec.is_custom && (
                      <Badge
                        variant="outline"
                        className="ml-2 text-amber-400 border-amber-400/40"
                      >
                        {t("categories.customBadge")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground align-top">
                    {describeCategorySpecLocalized(spec, t)}
                    <div className="text-[10px] mt-1 text-muted-foreground/70">
                      {t("categories.spec.meshMatch", {
                        pct: spec.size_distribution_min_pct,
                      })}
                    </div>
                  </TableCell>
                  <TableCell className="text-right align-top tabular-nums">
                    {usageCount > 0 ? (
                      <span
                        className={
                          usageCount > 0 && c.is_active
                            ? "font-medium"
                            : "text-muted-foreground"
                        }
                        title={t("categories.listingsCountTitle", { count: usageCount })}
                      >
                        {usageCount}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate align-top">
                    {c.description ?? "—"}
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge
                      variant="outline"
                      className={
                        c.is_active
                          ? "text-green-400 border-green-400/40"
                          : "text-muted-foreground"
                      }
                    >
                      {c.is_active
                        ? tEnums("category.active")
                        : tEnums("category.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex gap-1">
                      <CategoryFormDialog existing={c} />
                      {c.is_active ? (
                        <DeleteCategoryButton categoryId={c.id} />
                      ) : (
                        <ReactivateCategoryButton categoryId={c.id} />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
