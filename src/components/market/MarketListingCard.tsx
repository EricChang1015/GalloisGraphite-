"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CounterpartyCard } from "@/components/messages/CounterpartyCard";
import { MessageCounterpartyButton } from "@/components/messages/MessageCounterpartyButton";
import type { CounterpartyProfile } from "@/lib/chat/display";

export type MarketListingItem = {
  id: string;
  title: string;
  quantity: number;
  unit: string;
  unit_price: number;
  currency: string;
  incoterm: string;
  origin_location: string;
  available_from: string | null;
  available_to: string | null;
  categoryName: string;
  seller: CounterpartyProfile;
};

interface Props {
  listing: MarketListingItem;
  currentUserId: string | null;
}

export function MarketListingCard({ listing, currentUserId }: Props) {
  return (
    <Card className="h-full flex flex-col transition-colors hover:border-primary/50 hover:bg-card/80">
      <Link href={`/market/${listing.id}`} className="flex-1 flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-snug">{listing.title}</CardTitle>
            <Badge variant="secondary" className="shrink-0 text-xs">
              {listing.categoryName}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm flex-1">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Qty</span>
            <span className="font-medium">
              {listing.quantity.toLocaleString()} {listing.unit}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Price</span>
            <span className="font-semibold text-amber-400">
              {listing.unit_price} {listing.currency}/{listing.unit}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Incoterm</span>
            <span>{listing.incoterm}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Origin</span>
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
