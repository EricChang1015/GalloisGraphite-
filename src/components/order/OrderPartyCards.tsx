"use client";

import { CounterpartyCard } from "@/components/messages/CounterpartyCard";
import { MessageCounterpartyButton } from "@/components/messages/MessageCounterpartyButton";
import type { ChatContext } from "@/lib/chat/types";
import type { CounterpartyProfile } from "@/lib/chat/display";

interface Party {
  profile: CounterpartyProfile;
  subtitle: string;
}

interface Props {
  buyer: Party;
  seller: Party;
  currentUserId: string;
  orderContext: ChatContext;
  canPost: boolean;
}

export function OrderPartyCards({
  buyer,
  seller,
  currentUserId,
  orderContext,
  canPost,
}: Props) {
  const showMessage = (profileId: string) =>
    canPost && profileId !== currentUserId;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CounterpartyCard profile={buyer.profile} subtitle={buyer.subtitle}>
        {showMessage(buyer.profile.id) ? (
          <MessageCounterpartyButton
            counterparty={buyer.profile}
            currentUserId={currentUserId}
            variant="card"
            context={orderContext}
          />
        ) : null}
      </CounterpartyCard>
      <CounterpartyCard profile={seller.profile} subtitle={seller.subtitle}>
        {showMessage(seller.profile.id) ? (
          <MessageCounterpartyButton
            counterparty={seller.profile}
            currentUserId={currentUserId}
            variant="card"
            context={orderContext}
          />
        ) : null}
      </CounterpartyCard>
    </div>
  );
}
