import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { listMyConversations } from "@/actions/chat";
import { ConversationList } from "@/components/messages/ConversationList";
import { getCurrentUser } from "@/lib/auth/session";

export async function generateMetadata() {
  const t = await getTranslations("messages");
  return { title: t("metaTitle") };
}

export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/messages");

  const t = await getTranslations("messages");
  const result = await listMyConversations();
  const conversations = result.data?.conversations ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("heading")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>
      {result.error ? (
        <p className="text-sm text-destructive">{result.error.message}</p>
      ) : null}
      <ConversationList conversations={conversations} />
    </div>
  );
}
