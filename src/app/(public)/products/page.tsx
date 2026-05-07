export const metadata = { title: "Products" };

export default function ProductsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16 space-y-6">
      <h1 className="text-3xl font-semibold">Product Catalogue</h1>
      <p className="text-muted-foreground">
        Loaded from <code>product_categories</code> in Supabase. TODO: replace
        this stub with a server-rendered table once Supabase is connected.
      </p>
    </div>
  );
}
