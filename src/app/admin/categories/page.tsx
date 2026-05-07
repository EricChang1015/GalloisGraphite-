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
import { CategoryFormDialog, DeleteCategoryButton } from "@/components/admin/CategoryActions";

export const metadata = { title: "Admin · Categories" };

export default async function AdminCategoriesPage() {
  const admin = createAdminClient();

  const { data: categories } = await admin
    .from("product_categories")
    .select("id, name, description, spec_schema, is_active, created_at")
    .order("name")
    .returns<{
      id: string;
      name: string;
      description: string | null;
      spec_schema: Record<string, unknown>;
      is_active: boolean;
      created_at: string;
    }[]>();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Product Categories</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage product categories and their specification schemas.
          </p>
        </div>
        <CategoryFormDialog />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Spec Fields</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(categories ?? []).map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                  {c.description ?? "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {Object.keys(c.spec_schema ?? {}).join(", ") || "none"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={c.is_active ? "text-green-400 border-green-400/40" : "text-muted-foreground"}
                  >
                    {c.is_active ? "active" : "inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <CategoryFormDialog existing={c} />
                    {c.is_active && <DeleteCategoryButton categoryId={c.id} />}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
