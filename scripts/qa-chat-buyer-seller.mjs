#!/usr/bin/env node
// QA: Buyer ↔ Seller party DM via Supabase Auth + RLS (one thread per pair).
// Usage: node scripts/qa-chat-buyer-seller.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      let v = l.slice(i + 1).trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      return [l.slice(0, i).trim(), v];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const token = env.SUPABASE_ACCESS_TOKEN;
if (!url || !anon || !token) {
  console.error("✗ Missing Supabase env in .env.local");
  process.exit(2);
}

const BUYER_EMAIL = "eric.chang.1015+buyer@gmail.com";
const SELLER_EMAIL = "eric.chang.1015+seller@gmail.com";
const PASSWORD = "a1234567";

const ref = new URL(url).hostname.split(".")[0];

async function adminQuery(sql) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body}`);
  return body ? JSON.parse(body) : [];
}

function client() {
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(email) {
  const sb = client();
  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  return { sb, userId: data.user.id };
}

let pass = 0;
let fail = 0;
function check(cond, id, label, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${id} ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${id} ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function canonicalPair(a, b) {
  return a < b ? { low: a, high: b } : { low: b, high: a };
}

async function main() {
  const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, "");
  const buyerText = `QA-BUYER-${stamp}`;
  const sellerText = `QA-SELLER-${stamp}`;

  console.log("=== QA 站內信：Party DM（Buyer ↔ Seller）===\n");

  const { userId: buyerId } = await signIn(BUYER_EMAIL);
  const { userId: sellerId } = await signIn(SELLER_EMAIL);
  const { low, high } = canonicalPair(buyerId, sellerId);

  // TC-IM-00: Ensure exactly one party room for this pair
  console.log("--- TC-IM-00 單一 party thread ---");
  const existing = await adminQuery(`
    select id from public.chat_rooms
     where type = 'party'
       and party_user_low = '${low}'
       and party_user_high = '${high}';
  `);
  let roomId = existing[0]?.id;
  if (!roomId) {
    roomId = crypto.randomUUID();
    await adminQuery(`
      insert into public.chat_rooms (id, type, party_user_low, party_user_high)
      values ('${roomId}', 'party', '${low}', '${high}');
      insert into public.chat_members (room_id, user_id)
      values ('${roomId}', '${low}'), ('${roomId}', '${high}')
      on conflict do nothing;
    `);
    console.log("  (admin) created party room:", roomId);
  } else {
    console.log("  Room:", roomId);
  }

  const dupes = await adminQuery(`
    select count(*)::int as n from public.chat_rooms
     where type = 'party'
       and party_user_low = '${low}'
       and party_user_high = '${high}';
  `);
  check(dupes[0]?.n === 1, "TC-IM-00", "One party room per buyer+seller pair");

  const orderRooms = await adminQuery(`
    select count(*)::int as n from public.chat_rooms
     where type = 'order'
       and order_id in (
         select id from public.orders
          where buyer_id = '${buyerId}' and seller_id = '${sellerId}'
       );
  `);
  check(orderRooms[0]?.n === 0, "TC-IM-00b", "No legacy type=order rooms for pair");

  // TC-IM-01: Buyer sends (optional listing context)
  console.log("\n--- TC-IM-01 Buyer 發送 ---");
  const { sb: buyerSb } = await signIn(BUYER_EMAIL);
  const listing = await adminQuery(`
    select id from public.listings where seller_id = '${sellerId}' and status = 'active' limit 1;
  `);
  const listingId = listing[0]?.id ?? null;

  const { data: buyerMsg, error: buyerErr } = await buyerSb
    .from("messages")
    .insert({
      room_id: roomId,
      sender_id: buyerId,
      content: buyerText,
      ...(listingId
        ? { context_type: "listing", context_id: listingId }
        : {}),
    })
    .select("id, content, sender_id, context_type, context_id")
    .single();

  check(
    !buyerErr && buyerMsg?.content === buyerText,
    "TC-IM-01",
    "Buyer insert message via RLS",
    buyerErr?.message
  );

  await adminQuery(`
    update public.chat_rooms
       set last_message_at = now(), last_message_preview = '${buyerText.replace(/'/g, "''")}'
     where id = '${roomId}';
  `);

  // TC-IM-02: Seller reads + replies
  console.log("\n--- TC-IM-02 Seller 讀取並回覆 ---");
  const { sb: sellerSb, userId: sellerId2 } = await signIn(SELLER_EMAIL);

  const { data: sellerView, error: sellerReadErr } = await sellerSb
    .from("messages")
    .select("id, content, sender_id, context_type")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });

  const sawBuyer = (sellerView ?? []).some((m) => m.content === buyerText);
  check(
    !sellerReadErr && sawBuyer,
    "TC-IM-02a",
    "Seller sees buyer message",
    sellerReadErr?.message
  );

  const { data: sellerMsg, error: sellerErr } = await sellerSb
    .from("messages")
    .insert({
      room_id: roomId,
      sender_id: sellerId2,
      content: sellerText,
    })
    .select("id, content")
    .single();

  check(
    !sellerErr && sellerMsg?.content === sellerText,
    "TC-IM-02b",
    "Seller insert reply",
    sellerErr?.message
  );

  // TC-IM-03: Buyer sees seller reply
  console.log("\n--- TC-IM-03 Buyer 看到 Seller 回覆 ---");
  const { sb: buyerSb2 } = await signIn(BUYER_EMAIL);
  const { data: buyerView, error: buyerReadErr } = await buyerSb2
    .from("messages")
    .select("content, sender_id")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });

  const sawSeller = (buyerView ?? []).some((m) => m.content === sellerText);
  const msgCount = buyerView?.length ?? 0;
  check(
    !buyerReadErr && sawSeller && msgCount >= 2,
    "TC-IM-03",
    `Buyer sees seller reply (${msgCount} msgs)`,
    buyerReadErr?.message
  );

  // TC-IM-04: Conversation list denorm (party room, no order_id)
  console.log("\n--- TC-IM-04 對話列表欄位 ---");
  const { data: roomRow, error: roomErr } = await buyerSb2
    .from("chat_rooms")
    .select("id, type, last_message_preview, party_user_low, party_user_high, order_id")
    .eq("id", roomId)
    .single();

  check(
    !roomErr &&
      roomRow?.type === "party" &&
      roomRow?.party_user_low &&
      roomRow?.party_user_high &&
      !roomRow?.order_id &&
      roomRow?.last_message_preview?.includes("QA-BUYER"),
    "TC-IM-04",
    "party chat_rooms denorm fields",
    roomErr?.message
  );

  console.log("\n=== 訊息內容 ===");
  console.log(`  Buyer:  ${buyerText}`);
  console.log(`  Seller: ${sellerText}`);
  console.log(`\n==== ${pass} passed · ${fail} failed ====`);

  if (fail === 0) {
    console.log("\n手動 UI 走測（建議）：");
    console.log(`  Buyer:  ${BUYER_EMAIL}`);
    console.log(`  Seller: ${SELLER_EMAIL}`);
    console.log(`  Thread: /messages/${sellerId}`);
    console.log(`  List:   /messages`);
  }

  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(2);
});
