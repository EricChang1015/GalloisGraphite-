import { notFound, redirect } from "next/navigation";

import { getPartyChatWithUser } from "@/actions/chat";
import { CounterpartyCard } from "@/components/messages/CounterpartyCard";
import { PartyChatPanel } from "@/components/messages/PartyChatPanel";
import { getCurrentUser } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";

interface PageProps {
  params: Promise<{ userId: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { userId } = await params;
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("company_name, full_name")
    .eq("id", userId)
    .maybeSingle<{ company_name: string | null; full_name: string | null }>();
  const name = data?.company_name || data?.full_name || "Partner";
  return { title: `Message ${name}` };
}

export default async function MessageThreadPage({ params }: PageProps) {
  const { userId: counterpartyId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/messages/${counterpartyId}`)}`);

  if (counterpartyId === user.id) {
    redirect("/messages");
  }

  const supabase = await createServerClient();
  const { data: counterparty } = await supabase
    .from("profiles")
    .select("id, full_name, company_name, country")
    .eq("id", counterpartyId)
    .maybeSingle<{
      id: string;
      full_name: string | null;
      company_name: string | null;
      country: string | null;
    }>();

  if (!counterparty) notFound();

  const chat = await getPartyChatWithUser(counterpartyId);
  if (chat.error || !chat.data) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Messages</h1>
        <p className="text-sm text-destructive">
          {chat.error?.message ?? "Could not open conversation."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Messages</h1>
        <p className="text-sm text-muted-foreground">
          Direct line with your trading partner
        </p>
      </div>
      <CounterpartyCard profile={counterparty} />
      <PartyChatPanel
        roomId={chat.data.roomId}
        currentUserId={user.id}
        initialMessages={chat.data.messages}
      />
    </div>
  );
}
