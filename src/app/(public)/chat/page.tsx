import { Metadata } from "next";

import { ChatPageBody } from "@/components/chat/ChatPageBody";
import { PinAiToggle } from "@/components/chat/PinAiToggle";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/session";
import type { AiChatUserAvatar } from "@/lib/profile/avatar";

export const metadata: Metadata = {
  title: "AI Assistant",
  description:
    "Ask the Mada Graphite AI about graphite specs, applications, pricing, and the platform.",
};

export default async function ChatPage() {
  const user = await getCurrentUser();
  const profile = await getCurrentProfile();
  const isAuthenticated = Boolean(user);

  let userAvatar: AiChatUserAvatar | null = null;
  if (user && profile) {
    userAvatar = {
      full_name: profile.full_name,
      company_name: profile.company_name,
      avatar_url: profile.avatar_url,
    };
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col px-4 py-8 h-[calc(100vh-7rem)]">
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
      <ChatPageBody
        isAuthenticated={isAuthenticated}
        userAvatar={userAvatar}
      />
    </div>
  );
}
