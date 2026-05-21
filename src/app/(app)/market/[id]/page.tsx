import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { InquiryDialog } from "@/components/listing/InquiryDialog";
import { CounterpartyCard } from "@/components/messages/CounterpartyCard";
import { MessageCounterpartyButton } from "@/components/messages/MessageCounterpartyButton";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("listings")
    .select("title")
    .eq("id", id)
    .single<{ title: string }>();
  return { title: data?.title ? `${data.title} — Market` : "Listing" };
}

export default async function ListingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getCurrentUser();
  const supabase = await createServerClient();

  const { data: listing } = await supabase
    .from("listings")
    .select(
      `id, seller_id, category_id, title, specs, quantity, unit, unit_price, currency,
       incoterm, origin_location, available_from, available_to, description, images, status,
       product_categories(name),
       profiles!listings_seller_id_fkey(id, full_name, company_name, country)`
    )
    .eq("id", id)
    .single<{
      id: string;
      seller_id: string;
      category_id: string;
      title: string;
      specs: Record<string, unknown>;
      quantity: number;
      unit: string;
      unit_price: number;
      currency: string;
      incoterm: string;
      origin_location: string;
      available_from: string | null;
      available_to: string | null;
      description: string | null;
      images: string[] | null;
      status: string;
      product_categories: { name: string } | null;
      profiles: {
        id: string;
        full_name: string | null;
        company_name: string | null;
        country: string | null;
      } | null;
    }>();

  if (!listing || listing.status !== "active") notFound();

  const specEntries = Object.entries(listing.specs ?? {});

  return (
    <div className="max-w-3xl space-y-8">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{listing.product_categories?.name ?? "Graphite"}</Badge>
          <Badge variant="outline" className="text-green-400 border-green-400/40">
            Active
          </Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{listing.title}</h1>
      </div>

      {listing.profiles && user ? (
        <CounterpartyCard profile={listing.profiles} subtitle="Seller">
          <MessageCounterpartyButton
            counterparty={listing.profiles}
            currentUserId={user.id}
            variant="card"
            context={{
              type: "listing",
              id: listing.id,
              label: listing.title,
            }}
          />
        </CounterpartyCard>
      ) : (
        <p className="text-muted-foreground text-sm">
          Seller: {listing.profiles?.company_name ?? "—"} ·{" "}
          {listing.profiles?.country ?? ""}
        </p>
      )}

      {(listing.images ?? []).length > 0 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={(listing.images ?? [])[0]}
          alt={listing.title}
          className="w-full rounded-lg object-cover max-h-64"
        />
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 text-sm">
        {[
          ["Quantity", `${listing.quantity.toLocaleString()} ${listing.unit}`],
          ["Unit Price", `${listing.unit_price} ${listing.currency}/${listing.unit}`],
          ["Incoterm", listing.incoterm],
          ["Origin", listing.origin_location],
          listing.available_from
            ? ["Available From", listing.available_from]
            : null,
          listing.available_to
            ? ["Available To", listing.available_to]
            : null,
        ]
          .filter((item): item is [string, string] => item !== null)
          .map(([label, value]) => (
            <div key={label} className="rounded-md border bg-card p-3">
              <p className="text-muted-foreground text-xs mb-1">{label}</p>
              <p className="font-semibold">{value}</p>
            </div>
          ))}
      </div>

      {specEntries.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Specifications
          </h2>
          <div className="rounded-md border divide-y text-sm">
            {specEntries.map(([key, val]) => (
              <div key={key} className="flex items-center px-4 py-2">
                <span className="w-40 text-muted-foreground shrink-0">{key}</span>
                <span>{String(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {listing.description && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Description
          </h2>
          <p className="text-sm leading-relaxed">{listing.description}</p>
        </div>
      )}

      <Separator />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold text-amber-400">
            {listing.unit_price} {listing.currency}
            <span className="text-base font-normal text-muted-foreground">/{listing.unit}</span>
          </p>
          <p className="text-xs text-muted-foreground">{listing.incoterm} — price subject to negotiation</p>
        </div>
        <InquiryDialog
          listing={{
            id: listing.id,
            seller_id: listing.seller_id,
            category_id: listing.category_id,
            unit_price: listing.unit_price,
            currency: listing.currency,
            unit: listing.unit,
          }}
        />
      </div>
    </div>
  );
}
