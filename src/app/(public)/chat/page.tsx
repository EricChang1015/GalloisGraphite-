import { Metadata } from "next";

import { AiChat } from "@/components/chat/AiChat";
import { PinAiToggle } from "@/components/chat/PinAiToggle";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "AI Assistant",
  description:
    "Ask the Mada Graphite AI about graphite specs, applications, pricing, and the platform.",
};

export default async function ChatPage() {
  let isAuthenticated = false;
  try {
    const supabase = await createServerClient();
    const { data } = await supabase.auth.getUser();
    isAuthenticated = Boolean(data.user);
  } catch {
    isAuthenticated = false;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col px-4 py-8 h-[calc(100vh-7rem)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">AI Assistant</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask anything about graphite or the platform.{" "}
            {isAuthenticated ? (
              <span>
                Pricing answers use indicative ranges from active listings &
                recent settled orders — formal quotes still come from the
                seller.
              </span>
            ) : (
              <span>
                To request a quote or place an order, please{" "}
                <a href="/login" className="text-foreground underline">
                  log in
                </a>
                .
              </span>
            )}
          </p>
        </div>
        <PinAiToggle />
      </div>
      <div className="flex-1 overflow-hidden">
        <AiChat isAuthenticated={isAuthenticated} />
      </div>
    </div>
  );
}
