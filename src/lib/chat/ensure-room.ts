import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Idempotently ensure an order-bound chat room exists with buyer + seller members.
 */
export async function ensureOrderChatRoom(
  orderId: string
): Promise<{ roomId: string } | { error: string }> {
  const admin = createAdminClient();

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select("id, buyer_id, seller_id")
    .eq("id", orderId)
    .maybeSingle<{ id: string; buyer_id: string; seller_id: string }>();

  if (orderErr) return { error: orderErr.message };
  if (!order) return { error: "Order not found." };

  const { data: existing } = await admin
    .from("chat_rooms")
    .select("id")
    .eq("order_id", orderId)
    .eq("type", "order")
    .maybeSingle<{ id: string }>();

  if (existing?.id) {
    await ensureMembers(admin, existing.id, order.buyer_id, order.seller_id);
    return { roomId: existing.id };
  }

  const { data: room, error: roomErr } = await admin
    .from("chat_rooms")
    .insert({ type: "order", order_id: orderId })
    .select("id")
    .single<{ id: string }>();

  if (roomErr) {
    if (roomErr.code === "23505") {
      const { data: raced } = await admin
        .from("chat_rooms")
        .select("id")
        .eq("order_id", orderId)
        .eq("type", "order")
        .single<{ id: string }>();
      if (raced?.id) {
        await ensureMembers(admin, raced.id, order.buyer_id, order.seller_id);
        return { roomId: raced.id };
      }
    }
    return { error: roomErr.message };
  }

  await ensureMembers(admin, room.id, order.buyer_id, order.seller_id);
  return { roomId: room.id };
}

async function ensureMembers(
  admin: ReturnType<typeof createAdminClient>,
  roomId: string,
  buyerId: string,
  sellerId: string
) {
  const rows = [
    { room_id: roomId, user_id: buyerId },
    { room_id: roomId, user_id: sellerId },
  ];
  for (const row of rows) {
    const { error } = await admin.from("chat_members").insert(row);
    if (error && error.code !== "23505") {
      throw new Error(error.message);
    }
  }
}
