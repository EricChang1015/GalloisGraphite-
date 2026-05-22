import { createServerClient } from "@/lib/supabase/server";
import { ListingForm } from "@/components/listing/ListingForm";

export const metadata = { title: "New Listing — Mada Graphite" };

export default async function NewListingPage() {
  const supabase = await createServerClient();

  const { data: categories } = await supabase
    .from("product_categories")
    .select("id, name, description, spec_schema")
    .eq("is_active", true)
    .order("name")
    .returns<{
      id: string;
      name: string;
      description: string | null;
      spec_schema: Record<string, unknown> | null;
    }[]>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New Listing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create a new product listing visible to all buyers on the market.
        </p>
      </div>
      <ListingForm categories={categories ?? []} />
    </div>
  );
}
