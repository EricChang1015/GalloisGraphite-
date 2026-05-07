export const metadata = { title: "AI Assistant" };

export default function ChatPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 space-y-6">
      <h1 className="text-3xl font-semibold">Mada Graphite AI Assistant</h1>
      <p className="text-muted-foreground">
        Ask anything about graphite, our products, or the platform. To request
        a quote or place an order, please log in first.
      </p>
      <div className="rounded-lg border border-neutral-200 bg-card p-6 dark:border-neutral-800">
        <p className="text-sm text-muted-foreground">
          🛠 <strong>TODO</strong>: drop in <code>&lt;AiChat /&gt;</code> from
          <code> src/components/chat/AiChat.tsx</code> once the
          <code> /api/chat</code> route is implemented.
        </p>
      </div>
    </div>
  );
}
