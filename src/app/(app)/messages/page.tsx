export const metadata = { title: "Messages" };

export default function MessagesPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Messages</h1>
      <p className="text-sm text-muted-foreground">
        All chat rooms (one per order). Realtime via Supabase Realtime.
      </p>
    </div>
  );
}
