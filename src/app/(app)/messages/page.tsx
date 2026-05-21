import { redirect } from "next/navigation";

import { listMyChatRooms } from "@/actions/chat";
import { ChatRoomList } from "@/components/messages/ChatRoomList";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/messages");

  const result = await listMyChatRooms();
  const rooms = result.data?.rooms ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Messages</h1>
        <p className="text-sm text-muted-foreground">
          Order conversations with your trading partners. Open a room from an
          active order to chat in real time.
        </p>
      </div>
      {result.error ? (
        <p className="text-sm text-destructive">{result.error.message}</p>
      ) : null}
      <ChatRoomList rooms={rooms} />
    </div>
  );
}
