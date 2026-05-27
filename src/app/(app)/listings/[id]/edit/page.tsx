import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  ListingForm,
  type ExistingListing,
} from "@/components/listing/ListingForm";

export async function generateMetadata() {
  const t = await getTranslations("listings");
  return { title: t("metaTitleEdit") };
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditListingPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=/listings/${id}/edit`);
  }

  const supabase = await createServerClient();

  const { data: listing } = await supabase
    .from("listings")
    .select(
      `id, seller_id, category_id, title, specs, quantity, min_order_quantity,
       unit, origin_location, available_from, available_to, unit_price,
       currency, incoterm, description, images, status`
    )
    .eq("id", id)
    .maybeSingle<
      ExistingListing & { seller_id: string; status: string }
    >();

  if (!listing) notFound();

  // Sellers can only edit their own listings; admins can edit anything.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string }>();
  const isAdmin =
    profile?.role === "admin" || profile?.role === "super_admin";
  if (!isAdmin && listing.seller_id !== user.id) {
    notFound();
  }

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

  // If the listing references a deactivated category, include it in the
  // dropdown so the form doesn't render an empty Select (the seller can
  // still re-save with a different one).
  const inactiveCatId = listing.category_id;
  if (
    inactiveCatId &&
    !(categories ?? []).some((c) => c.id === inactiveCatId)
  ) {
    const { data: legacy } = await supabase
      .from("product_categories")
      .select("id, name, description, spec_schema")
      .eq("id", inactiveCatId)
      .maybeSingle<{
        id: string;
        name: string;
        description: string | null;
        spec_schema: Record<string, unknown> | null;
      }>();
    if (legacy) (categories ?? []).unshift(legacy);
  }

  const t = await getTranslations("listings.edit");
  const tEnums = await getTranslations("enums");
  const statusKey = (listing.status === "active" ||
    listing.status === "paused" ||
    listing.status === "sold_out")
    ? listing.status
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("heading")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("statusLine")}
          <span className="text-foreground font-medium">
            {statusKey ? tEnums(`listing.status.${statusKey}`) : listing.status}
          </span>
          {" · "}
          <span
            dangerouslySetInnerHTML={{ __html: t("statusInstruction") }}
          />
        </p>
      </div>
      <ListingForm
        categories={categories ?? []}
        existing={{
          id: listing.id,
          category_id: listing.category_id,
          title: listing.title,
          specs: listing.specs,
          quantity: listing.quantity,
          min_order_quantity: listing.min_order_quantity,
          unit: listing.unit,
          origin_location: listing.origin_location,
          available_from: listing.available_from,
          available_to: listing.available_to,
          unit_price: listing.unit_price,
          currency: listing.currency,
          incoterm: listing.incoterm,
          description: listing.description,
          images: listing.images,
        }}
      />
    </div>
  );
}
