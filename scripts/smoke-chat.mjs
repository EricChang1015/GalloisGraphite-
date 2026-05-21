#!/usr/bin/env node
// Smoke test: order chat room creation + buyer/seller messages.
// Usage:
//   node scripts/smoke-chat.mjs
//   node scripts/smoke-chat.mjs --cleanup
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

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

const token = env.SUPABASE_ACCESS_TOKEN;
const url = env.NEXT_PUBLIC_SUPABASE_URL;
if (!token || !url) {
  console.error("✗ Missing SUPABASE_ACCESS_TOKEN or NEXT_PUBLIC_SUPABASE_URL");
  process.exit(2);
}
const ref = new URL(url).hostname.split(".")[0];
const CLEANUP = process.argv.includes("--cleanup");

const SELLER = "c73251fe-f0bf-47a7-a308-82134929c8dd";
const BUYER = "c67b3042-dbac-42a1-9a46-e093faea62dc";
const CATEGORY = "1f135ab2-7017-433d-95f6-247ee5278c86";

async function q(sql) {
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

function escape(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return `'${String(v).replace(/'/g, "''")}'`;
}

let pass = 0;
let fail = 0;
function check(cond, label) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}`);
  }
}

async function main() {
  const orderId = randomUUID();
  const listingId = randomUUID();
  const roomId = randomUUID();
  const msgBuyer = randomUUID();
  const msgSeller = randomUUID();

  console.log("=== smoke-chat: setup order + room ===");
  await q(`
    insert into public.listings (
      id, seller_id, category_id, title, specs, quantity, unit,
      origin_location, unit_price, currency, incoterm, description, status
    ) values (
      ${escape(listingId)}, ${escape(SELLER)}, ${escape(CATEGORY)},
      'SMOKE CHAT listing', '{}'::jsonb, 10, 'MT', 'Toamasina',
      1000, 'USD', 'FOB', 'Chat smoke test', 'active'
    );
  `);

  await q(`
    insert into public.orders (
      id, buyer_id, seller_id, listing_id, quantity, unit_price, total_amount,
      currency, status, timeline
    ) values (
      ${escape(orderId)}, ${escape(BUYER)}, ${escape(SELLER)}, ${escape(listingId)},
      10, 1000, 10000, 'USD', 'contract_pending', '[]'::jsonb
    );
  `);

  await q(`
    insert into public.chat_rooms (id, type, order_id, last_message_at, last_message_preview)
    values (${escape(roomId)}, 'order', ${escape(orderId)}, null, null);
  `);

  await q(`
    insert into public.chat_members (room_id, user_id)
    values (${escape(roomId)}, ${escape(BUYER)}), (${escape(roomId)}, ${escape(SELLER)});
  `);

  const rooms = await q(`
    select id from public.chat_rooms where order_id = ${escape(orderId)} and type = 'order';
  `);
  check(rooms.length === 1, "one order chat room exists");

  console.log("\n=== smoke-chat: messages + denorm ===");
  const now = new Date().toISOString();
  await q(`
    insert into public.messages (id, room_id, sender_id, content, created_at)
    values (${escape(msgBuyer)}, ${escape(roomId)}, ${escape(BUYER)}, 'Hello from buyer', ${escape(now)});
  `);
  await q(`
    update public.chat_rooms
       set last_message_at = ${escape(now)},
           last_message_preview = 'Hello from buyer'
     where id = ${escape(roomId)};
  `);

  await q(`
    insert into public.messages (id, room_id, sender_id, content, created_at)
    values (${escape(msgSeller)}, ${escape(roomId)}, ${escape(SELLER)}, 'Reply from seller', ${escape(now)});
  `);

  const msgs = await q(`
    select count(*)::int as c from public.messages where room_id = ${escape(roomId)};
  `);
  check(msgs[0].c === 2, "two messages stored");

  const preview = await q(`
    select last_message_preview from public.chat_rooms where id = ${escape(roomId)};
  `);
  check(
    preview[0]?.last_message_preview === "Hello from buyer",
    "last_message_preview denormalized on room"
  );

  if (CLEANUP) {
    console.log("\n=== cleanup ===");
    await q(`delete from public.orders where id = ${escape(orderId)};`);
    await q(`delete from public.listings where id = ${escape(listingId)};`);
    console.log("  ✓ removed test order + listing (cascade chat)");
  }

  console.log(`\n==== ${pass} passed · ${fail} failed ====`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(2);
});
