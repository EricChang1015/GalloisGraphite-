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
  describeCategorySpec,
  parseCategorySpec,
} from "@/lib/categories/spec";

export const metadata = { title: "Admin · Categories" };

export default async function AdminCategoriesPage() {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Product Categories</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage product categories and their specification defaults.
            Custom Grade categories let sellers fill in mesh and exact values
            per listing.
          </p>
        </div>
        <CategoryFormDialog />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Specification</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(categories ?? []).map((c) => {
              const spec = parseCategorySpec(c.spec_schema);
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
                        custom
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground align-top">
                    {describeCategorySpec(spec)}
                    <div className="text-[10px] mt-1 text-muted-foreground/70">
                      ≥ {spec.size_distribution_min_pct}% match mesh
                    </div>
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
                      {c.is_active ? "active" : "inactive"}
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
