import { Metadata } from "next";

import { AiChat } from "@/components/chat/AiChat";

export const metadata: Metadata = {
  title: "AI Assistant",
  description:
    "Ask the Mada Graphite AI about graphite specs, applications, pricing, and the platform.",
};

export default function ChatPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col px-4 py-8 h-[calc(100vh-7rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">AI Assistant</h1>
        <p className="text-sm text-muted-foreground">
          Ask anything about graphite or the platform. To request a quote or
          place an order, please{" "}
          <a href="/login" className="text-foreground underline">
            log in
          </a>
          .
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <AiChat isAuthenticated={false} />
      </div>
    </div>
  );
}
