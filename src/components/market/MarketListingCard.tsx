"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CounterpartyCard } from "@/components/messages/CounterpartyCard";
import { MessageCounterpartyButton } from "@/components/messages/MessageCounterpartyButton";
import type { CounterpartyProfile } from "@/lib/chat/display";

export type MarketListingItem = {
  id: string;
  title: string;
  quantity: number;
  /** Optional MOQ (null when seller didn't set one). */
  min_order_quantity?: number | null;
  unit: string;
  unit_price: number;
  currency: string;
  incoterm: string;
  origin_location: string;
  available_from: string | null;
  available_to: string | null;
  categoryName: string;
  /** Compact spec chip e.g. "+100 Mesh · 94% C". */
  specChip?: string;
  /** First image URL from listings.images, if any. */
  coverImage?: string | null;
  seller: CounterpartyProfile;
};

interface Props {
  listing: MarketListingItem;
  currentUserId: string | null;
}

export function MarketListingCard({ listing, currentUserId }: Props) {
  const t = useTranslations("market.card");
  return (
    <Card className="h-full flex flex-col transition-colors hover:border-primary/50 hover:bg-card/80">
      <Link href={`/market/${listing.id}`} className="flex-1 flex flex-col">
        {listing.coverImage ? (
          <div className="relative aspect-[16/9] overflow-hidden rounded-t-lg bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={listing.coverImage}
              alt={listing.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        ) : null}
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-snug">{listing.title}</CardTitle>
            <Badge variant="secondary" className="shrink-0 text-xs">
              {listing.categoryName}
            </Badge>
          </div>
          {listing.specChip && (
            <p className="text-xs text-muted-foreground pt-1">
              {listing.specChip}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-2 text-sm flex-1">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("available")}</span>
            <span className="font-medium">
              {listing.quantity.toLocaleString()} {listing.unit}
            </span>
          </div>
          {listing.min_order_quantity != null && listing.min_order_quantity > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("minOrder")}</span>
              <span className="font-medium">
                {listing.min_order_quantity.toLocaleString()} {listing.unit}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("price")}</span>
            <span className="font-semibold text-amber-400">
              {listing.unit_price} {listing.currency}/{listing.unit}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("incoterm")}</span>
            <span>{listing.incoterm}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("origin")}</span>
            <span>{listing.origin_location}</span>
          </div>
        </CardContent>
      </Link>
      {currentUserId ? (
        <div
          className="px-4 pb-4 pt-0"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <CounterpartyCard
            profile={listing.seller}
            subtitle={listing.seller.country ?? undefined}
            className="border-dashed"
          >
            <MessageCounterpartyButton
              counterparty={listing.seller}
              currentUserId={currentUserId}
              variant="card"
              context={{
                type: "listing",
                id: listing.id,
                label: listing.title,
              }}
            />
          </CounterpartyCard>
        </div>
      ) : null}
    </Card>
  );
}
