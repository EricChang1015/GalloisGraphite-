import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { canonicalPartyPair } from "@/lib/chat/party";

/**
 * Idempotently ensure a party DM thread exists for two users (one room per pair).
 */
export async function ensurePartyChat(
  userA: string,
  userB: string
): Promise<{ roomId: string } | { error: string }> {
  let low: string;
  let high: string;
  try {
    ({ low, high } = canonicalPartyPair(userA, userB));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invalid party pair." };
  }

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("chat_rooms")
    .select("id")
    .eq("type", "party")
    .eq("party_user_low", low)
    .eq("party_user_high", high)
    .maybeSingle<{ id: string }>();

  if (existing?.id) {
    await ensureMembers(admin, existing.id, low, high);
    return { roomId: existing.id };
  }

  const { data: room, error: roomErr } = await admin
    .from("chat_rooms")
    .insert({
      type: "party",
      party_user_low: low,
      party_user_high: high,
    })
    .select("id")
    .single<{ id: string }>();

  if (roomErr) {
    if (roomErr.code === "23505") {
      const { data: raced } = await admin
        .from("chat_rooms")
        .select("id")
        .eq("type", "party")
        .eq("party_user_low", low)
        .eq("party_user_high", high)
        .single<{ id: string }>();
      if (raced?.id) {
        await ensureMembers(admin, raced.id, low, high);
        return { roomId: raced.id };
      }
    }
    return { error: roomErr.message };
  }

  await ensureMembers(admin, room.id, low, high);
  return { roomId: room.id };
}

async function ensureMembers(
  admin: ReturnType<typeof createAdminClient>,
  roomId: string,
  userLow: string,
  userHigh: string
) {
  for (const userId of [userLow, userHigh]) {
    const { error } = await admin.from("chat_members").insert({
      room_id: roomId,
      user_id: userId,
    });
    if (error && error.code !== "23505") {
      throw new Error(error.message);
    }
  }
}
