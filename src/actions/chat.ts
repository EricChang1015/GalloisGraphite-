"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ensureOrderChatRoom } from "@/lib/chat/ensure-room";
import type { ChatMessageRow, ChatRoomSummary } from "@/lib/chat/types";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GetMessagesSchema, SendMessageSchema } from "@/lib/validations/chat";
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

export async function getOrderChatRoom(
  orderId: string
): Promise<ActionResult<{ roomId: string }>> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Not authenticated." } };

  const { data: order } = await supabase
    .from("orders")
    .select("id, buyer_id, seller_id")
    .eq("id", orderId)
    .maybeSingle<{ id: string; buyer_id: string; seller_id: string }>();

  if (!order) return { data: null, error: { message: "Order not found." } };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string }>();

  const isParty = order.buyer_id === user.id || order.seller_id === user.id;
  const isAdmin =
    profile?.role === "admin" || profile?.role === "super_admin";
  if (!isParty && !isAdmin) {
    return { data: null, error: { message: "Access denied." } };
  }

  const ensured = await ensureOrderChatRoom(orderId);
  if ("error" in ensured) {
    return { data: null, error: { message: ensured.error } };
  }

  return { data: { roomId: ensured.roomId }, error: null };
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
      "id, room_id, sender_id, content, attachment_url, created_at, sender:profiles(full_name, company_name)"
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
    })
    .select(
      "id, room_id, sender_id, content, attachment_url, created_at, sender:profiles(full_name, company_name)"
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

  const { data: room } = await admin
    .from("chat_rooms")
    .select("order_id")
    .eq("id", parsed.data.roomId)
    .maybeSingle<{ order_id: string | null }>();

  if (room?.order_id) {
    revalidatePath(`/orders/${room.order_id}`);
    revalidatePath("/messages");
  }

  return { data: { message: row }, error: null };
}

export async function listMyChatRooms(): Promise<
  ActionResult<{ rooms: ChatRoomSummary[] }>
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
        order_id,
        last_message_at,
        last_message_preview,
        orders!inner (
          id,
          order_no,
          status,
          buyer_id,
          seller_id,
          buyer:profiles!orders_buyer_id_fkey (full_name, company_name),
          seller:profiles!orders_seller_id_fkey (full_name, company_name)
        )
      )
    `
    )
    .eq("user_id", user.id);

  if (error) return { data: null, error: { message: error.message } };

  type Row = {
    room_id: string;
    chat_rooms: {
      id: string;
      order_id: string | null;
      last_message_at: string | null;
      last_message_preview: string | null;
      orders: {
        id: string;
        order_no: string;
        status: string;
        buyer_id: string;
        seller_id: string;
        buyer: { full_name: string | null; company_name: string | null } | null;
        seller: { full_name: string | null; company_name: string | null } | null;
      } | null;
    };
  };

  const rooms: ChatRoomSummary[] = [];

  for (const m of (memberships ?? []) as Row[]) {
    const cr = m.chat_rooms;
    const order = cr.orders;
    if (!cr.order_id || !order) continue;

    const isBuyer = order.buyer_id === user.id;
    const party = isBuyer ? order.seller : order.buyer;
    const counterpartyLabel =
      party?.company_name?.trim() ||
      party?.full_name?.trim() ||
      (isBuyer ? "Seller" : "Buyer");

    rooms.push({
      roomId: cr.id,
      orderId: order.id,
      orderNo: order.order_no,
      orderStatus: order.status,
      counterpartyLabel,
      lastMessageAt: cr.last_message_at,
      lastMessagePreview: cr.last_message_preview,
    });
  }

  rooms.sort((a, b) => {
    const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return tb - ta;
  });

  return { data: { rooms }, error: null };
}
