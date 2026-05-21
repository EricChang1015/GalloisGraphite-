import { redirect } from "next/navigation";

import { listMyConversations } from "@/actions/chat";
import { ConversationList } from "@/components/messages/ConversationList";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/messages");

  const result = await listMyConversations();
  const conversations = result.data?.conversations ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Messages</h1>
        <p className="text-sm text-muted-foreground">
          One conversation per trading partner. Open a listing or order to message
          someone new.
        </p>
      </div>
      {result.error ? (
        <p className="text-sm text-destructive">{result.error.message}</p>
      ) : null}
      <ConversationList conversations={conversations} />
    </div>
  );
}
