"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ensurePartyChat } from "@/lib/chat/ensure-room";
import { counterpartyFromPair } from "@/lib/chat/party";
import { counterpartyLabel } from "@/lib/chat/display";
import type { ChatMessageRow, ConversationSummary } from "@/lib/chat/types";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  GetMessagesSchema,
  OpenPartyChatSchema,
  SendMessageSchema,
} from "@/lib/validations/chat";
import type { ActionResult } from "./auth";

function messagePreview(content: string | null | undefined, hasAttachment: boolean): string {
  const trimmed = content?.trim();
  if (trimmed) return trimmed.slice(0, 120);
  if (hasAttachment) return "[Attachment]";
  return "";
}

async function assertRoomMember(roomId: string, userId: string): Promise<boolean> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("chat_members")
    .select("room_id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

/** Open (or create) the single DM thread with a counterparty. Works before inquiry/order. */
export async function openPartyChat(
  input: z.infer<typeof OpenPartyChatSchema>
): Promise<
  ActionResult<{
    roomId: string;
    counterpartyId: string;
  }>
> {
  const parsed = OpenPartyChatSchema.safeParse(input);
  if (!parsed.success) {
    return { data: null, error: { message: "Invalid input." } };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Not authenticated." } };

  if (parsed.data.counterpartyId === user.id) {
    return { data: null, error: { message: "You cannot message yourself." } };
  }

  const { data: counterparty } = await supabase
    .from("profiles")
    .select("id, status")
    .eq("id", parsed.data.counterpartyId)
    .maybeSingle<{ id: string; status: string }>();

  if (!counterparty) {
    return { data: null, error: { message: "User not found." } };
  }

  const ensured = await ensurePartyChat(user.id, parsed.data.counterpartyId);
  if ("error" in ensured) {
    return { data: null, error: { message: ensured.error } };
  }

  return {
    data: { roomId: ensured.roomId, counterpartyId: parsed.data.counterpartyId },
    error: null,
  };
}

export async function getPartyChatWithUser(
  counterpartyId: string
): Promise<
  ActionResult<{
    roomId: string;
    messages: ChatMessageRow[];
  }>
> {
  const opened = await openPartyChat({ counterpartyId });
  if (opened.error || !opened.data) {
    return { data: null, error: opened.error ?? { message: "Failed to open chat." } };
  }

  const messages = await getChatMessages({ roomId: opened.data.roomId, limit: 50 });
  if (messages.error || !messages.data) {
    return { data: null, error: messages.error ?? { message: "Failed to load messages." } };
  }

  return {
    data: { roomId: opened.data.roomId, messages: messages.data.messages },
    error: null,
  };
}

export async function getChatMessages(
  input: z.infer<typeof GetMessagesSchema>
): Promise<ActionResult<{ messages: ChatMessageRow[] }>> {
  const parsed = GetMessagesSchema.safeParse(input);
  if (!parsed.success) {
    return { data: null, error: { message: "Invalid input." } };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Not authenticated." } };

  const isMember = await assertRoomMember(parsed.data.roomId, user.id);
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string }>();
  const isAdmin =
    profile?.role === "admin" || profile?.role === "super_admin";

  if (!isMember && !isAdmin) {
    return { data: null, error: { message: "Access denied." } };
  }

  let query = supabase
    .from("messages")
    .select(
      "id, room_id, sender_id, content, attachment_url, context_type, context_id, created_at, sender:profiles(full_name, company_name, avatar_url)"
    )
    .eq("room_id", parsed.data.roomId)
    .order("created_at", { ascending: false })
    .limit(parsed.data.limit);

  if (parsed.data.before) {
    query = query.lt("created_at", parsed.data.before);
  }

  const { data, error } = await query;
  if (error) return { data: null, error: { message: error.message } };

  const messages = ((data ?? []) as ChatMessageRow[]).reverse();
  return { data: { messages }, error: null };
}

export async function sendChatMessage(
  input: z.infer<typeof SendMessageSchema>
): Promise<ActionResult<{ message: ChatMessageRow }>> {
  const parsed = SendMessageSchema.safeParse(input);
  if (!parsed.success) {
    return { data: null, error: { message: "Invalid input." } };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Not authenticated." } };

  const isMember = await assertRoomMember(parsed.data.roomId, user.id);
  if (!isMember) {
    return { data: null, error: { message: "Access denied." } };
  }

  const preview = messagePreview(
    parsed.data.content ?? null,
    Boolean(parsed.data.attachmentUrl)
  );
  const now = new Date().toISOString();

  const { data: row, error } = await supabase
    .from("messages")
    .insert({
      room_id: parsed.data.roomId,
      sender_id: user.id,
      content: parsed.data.content ?? null,
      attachment_url: parsed.data.attachmentUrl ?? null,
      context_type: parsed.data.contextType ?? null,
      context_id: parsed.data.contextId ?? null,
    })
    .select(
      "id, room_id, sender_id, content, attachment_url, context_type, context_id, created_at, sender:profiles(full_name, company_name, avatar_url)"
    )
    .single<ChatMessageRow>();

  if (error) return { data: null, error: { message: error.message } };

  const admin = createAdminClient();
  await admin
    .from("chat_rooms")
    .update({
      last_message_at: now,
      last_message_preview: preview || null,
    })
    .eq("id", parsed.data.roomId);

  revalidatePath("/messages");
  revalidatePath("/market");
  revalidatePath("/orders");

  return { data: { message: row }, error: null };
}

export async function listMyConversations(): Promise<
  ActionResult<{ conversations: ConversationSummary[] }>
> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Not authenticated." } };

  const { data: memberships, error } = await supabase
    .from("chat_members")
    .select(
      `
      room_id,
      chat_rooms!inner (
        id,
        type,
        party_user_low,
        party_user_high,
        last_message_at,
        last_message_preview
      )
    `
    )
    .eq("user_id", user.id);

  if (error) return { data: null, error: { message: error.message } };

  type Row = {
    room_id: string;
    chat_rooms: {
      id: string;
      type: string;
      party_user_low: string | null;
      party_user_high: string | null;
      last_message_at: string | null;
      last_message_preview: string | null;
    };
  };

  const conversations: ConversationSummary[] = [];

  for (const m of (memberships ?? []) as Row[]) {
    const cr = m.chat_rooms;
    if (cr.type !== "party" || !cr.party_user_low || !cr.party_user_high) {
      continue;
    }

    let counterpartyId: string;
    try {
      counterpartyId = counterpartyFromPair(
        cr.party_user_low,
        cr.party_user_high,
        user.id
      );
    } catch {
      continue;
    }

    const { data: cp } = await supabase
      .from("profiles")
      .select("id, full_name, company_name, country, avatar_url")
      .eq("id", counterpartyId)
      .maybeSingle<{
        id: string;
        full_name: string | null;
        company_name: string | null;
        country: string | null;
        avatar_url: string | null;
      }>();

    if (!cp) continue;

    conversations.push({
      roomId: cr.id,
      counterpartyId: cp.id,
      counterpartyLabel: counterpartyLabel(cp),
      counterpartyCountry: cp.country,
      counterpartyAvatarUrl: cp.avatar_url,
      lastMessageAt: cr.last_message_at,
      lastMessagePreview: cr.last_message_preview,
    });
  }

  conversations.sort((a, b) => {
    const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return tb - ta;
  });

  return { data: { conversations }, error: null };
}
