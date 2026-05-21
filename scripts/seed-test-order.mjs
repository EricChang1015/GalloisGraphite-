#!/usr/bin/env node
// Seed a contract_pending order between +seller@ and +buyer@
// so we can verify the Draft Contract fix end-to-end without going
// through the whole listing/inquiry/quotation UI flow.
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
const ref = new URL(url).hostname.split(".")[0];

async function q(sql) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query: sql }),
    }
  );
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body}`);
  return JSON.parse(body);
}

const SELLER = "c73251fe-f0bf-47a7-a308-82134929c8dd"; // +seller@
const BUYER = "c67b3042-dbac-42a1-9a46-e093faea62dc"; // +buyer@
const CATEGORY = "1f135ab2-7017-433d-95f6-247ee5278c86"; // MADA1 — +100 Mesh

// Create unique IDs for this run
const listingId = randomUUID();
const inquiryId = randomUUID();
const quotationId = randomUUID();
const orderId = randomUUID();
const validity = new Date();
validity.setDate(validity.getDate() + 14);

console.log("Seeding test data for contract_pending order...");

// 1) Listing
await q(`
  insert into public.listings (id, seller_id, category_id, title, specs, quantity, unit, origin_location, unit_price, currency, incoterm, description, status)
  values (
    '${listingId}', '${SELLER}', '${CATEGORY}',
    'TEST · MADA1 +100 Mesh · 50 MT',
    '{"fixed_carbon":"95-97%","ash":"<3%","moisture":"<0.5%"}'::jsonb,
    50, 'MT', 'Toamasina, Madagascar',
    4500, 'USDT', 'CFR',
    'End-to-end test listing seeded by scripts/seed-test-order.mjs',
    'active'
  );
`);
console.log("✓ listing:", listingId);

// 2) Inquiry
await q(`
  insert into public.inquiries (id, buyer_id, seller_id, listing_id, category_id, requested_qty, target_price, destination, message, status)
  values (
    '${inquiryId}', '${BUYER}', '${SELLER}', '${listingId}', '${CATEGORY}',
    50, 4200, 'Macau Port', 'Pls quote CFR Macau for July loading.', 'quoted'
  );
`);
console.log("✓ inquiry:", inquiryId);

// 3) Quotation (already accepted - we'll create the order separately)
await q(`
  insert into public.quotations (id, inquiry_id, seller_id, buyer_id, listing_id, unit_price, currency, quantity, unit, incoterm, origin_port, destination_port, validity_until, status, responded_at, countered_by)
  values (
    '${quotationId}', '${inquiryId}', '${SELLER}', '${BUYER}', '${listingId}',
    4300, 'USDT', 50, 'MT', 'CFR', 'Toamasina', 'Macau Port',
    '${validity.toISOString()}', 'accepted', now(), '${BUYER}'
  );
`);
console.log("✓ quotation (accepted):", quotationId);

// 4) Order in contract_pending state
await q(`
  insert into public.orders (id, order_no, buyer_id, seller_id, listing_id, inquiry_id, current_quotation_id, quantity, unit_price, total_amount, currency, destination, status, timeline)
  values (
    '${orderId}',
    'ORD-TEST-${Date.now().toString(36).toUpperCase()}',
    '${BUYER}', '${SELLER}', '${listingId}', '${inquiryId}', '${quotationId}',
    50, 4300, 215000, 'USDT', 'Macau Port',
    'contract_pending',
    '[{"event":"quotation_accepted","at":"${new Date().toISOString()}","by":"${BUYER}","quotation_id":"${quotationId}"}]'::jsonb
  );
`);
console.log("✓ order (contract_pending):", orderId);

// 4b) Party DM thread (one per buyer+seller pair)
const low = BUYER < SELLER ? BUYER : SELLER;
const high = BUYER < SELLER ? SELLER : BUYER;
const existingRoom = await q(`
  select id from public.chat_rooms
   where type = 'party' and party_user_low = '${low}' and party_user_high = '${high}'
   limit 1;
`);
const roomId = existingRoom[0]?.id ?? randomUUID();
if (!existingRoom[0]?.id) {
  await q(`
    insert into public.chat_rooms (id, type, party_user_low, party_user_high)
    values ('${roomId}', 'party', '${low}', '${high}');
    insert into public.chat_members (room_id, user_id)
    values ('${roomId}', '${BUYER}'), ('${roomId}', '${SELLER}')
    on conflict do nothing;
  `);
}
console.log("✓ party chat:", roomId);

// 5) Mark inquiry as converted
await q(`update public.inquiries set status = 'converted' where id = '${inquiryId}';`);

console.log("\n=== TEST ORDER READY ===");
console.log(`Order URL (local):  http://localhost:3000/orders/${orderId}`);
console.log(`Order URL (prod):   https://galloisgraphite.vercel.app/orders/${orderId}`);
console.log(`Admin URL (local):  http://localhost:3000/admin/orders/${orderId}`);
console.log("\nLogin accounts:");
console.log("  +seller@: eric.chang.1015+seller@gmail.com / a1234567");
console.log("  +buyer@:  eric.chang.1015+buyer@gmail.com  / a1234567");
console.log("  +admin@:  eric.chang.1015+admin@gmail.com  / a1234567");
