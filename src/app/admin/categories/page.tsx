export const metadata = { title: "Admin · Categories" };

export default function AdminCategoriesPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Product categories</h1>
      <p className="text-sm text-muted-foreground">
        CRUD for <code>product_categories</code>. <code>spec_schema</code> is a
        JSON object describing per-category fields.
      </p>
    </div>
  );
}
