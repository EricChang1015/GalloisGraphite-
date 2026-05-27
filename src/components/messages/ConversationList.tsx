import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { UserAvatar } from "@/components/profile/UserAvatar";
import type { ConversationSummary } from "@/lib/chat/types";

interface Props {
  conversations: ConversationSummary[];
}

export async function ConversationList({ conversations }: Props) {
  const t = await getTranslations("messages.list");

  if (conversations.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
        <p>{t("empty")}</p>
        <p className="mt-2">{t("emptyHint")}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {conversations.map((c) => (
        <li key={c.roomId}>
          <Link
            href={`/messages/${c.counterpartyId}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
          >
            <UserAvatar
              size="lg"
              enlargeable
              profile={{
                id: c.counterpartyId,
                full_name: null,
                company_name: c.counterpartyLabel,
                country: c.counterpartyCountry,
                avatar_url: c.counterpartyAvatarUrl,
              }}
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{c.counterpartyLabel}</p>
              {c.counterpartyCountry ? (
                <p className="text-xs text-muted-foreground">{c.counterpartyCountry}</p>
              ) : null}
              {c.lastMessagePreview ? (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {c.lastMessagePreview}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground italic mt-0.5">
                  {t("noMessagesYet")}
                </p>
              )}
            </div>
            {c.lastMessageAt ? (
              <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                {new Date(c.lastMessageAt).toLocaleString()}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
