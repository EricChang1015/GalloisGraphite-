#!/usr/bin/env node
// 為瀏覽器走訪 seed 兩條訂單：
//   1) contract_pending  -> 賣家走訪 Draft Contract (FOB)
//   2) contract_signed   -> 買家走訪 Payment Schedule + Submit Payment
//                            (CFR 30/40/30 三段)
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
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];

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
  return body ? JSON.parse(body) : [];
}
const esc = (v) =>
  v === null || v === undefined ? "null" : typeof v === "number" || typeof v === "boolean"
    ? String(v) : `'${String(v).replace(/'/g, "''")}'`;

const SELLER = "c73251fe-f0bf-47a7-a308-82134929c8dd";
const BUYER = "c67b3042-dbac-42a1-9a46-e093faea62dc";
const CATEGORY = "1f135ab2-7017-433d-95f6-247ee5278c86";

async function makeOrder({ tag, incoterm, status, totalAmount, withSchedule }) {
  const listingId = randomUUID();
  const inquiryId = randomUUID();
  const quotationId = randomUUID();
  const orderId = randomUUID();
  const validity = new Date();
  validity.setDate(validity.getDate() + 14);
  const orderNo = `ORD-${tag}-${Date.now().toString(36).toUpperCase()}`;

  await q(`
    insert into public.listings (id, seller_id, category_id, title, specs, quantity, unit,
      origin_location, unit_price, currency, incoterm, description, status)
    values (${esc(listingId)}, ${esc(SELLER)}, ${esc(CATEGORY)},
      ${esc(`BROWSER · ${tag} · 50 MT`)},
      '{"fixed_carbon":"95-97%","ash":"<3%"}'::jsonb,
      50, 'MT', 'Toamasina, Madagascar',
      ${totalAmount / 50}, 'USDT', ${esc(incoterm)},
      'Browser smoke listing seeded by scripts/seed-browser-orders.mjs', 'active');
  `);
  await q(`
    insert into public.inquiries (id, buyer_id, seller_id, listing_id, category_id,
      requested_qty, target_price, destination, message, status)
    values (${esc(inquiryId)}, ${esc(BUYER)}, ${esc(SELLER)},
      ${esc(listingId)}, ${esc(CATEGORY)}, 50, ${totalAmount / 50},
      'Macau Port', 'Browser walk-through inquiry', 'quoted');
  `);
  await q(`
    insert into public.quotations (id, inquiry_id, seller_id, buyer_id, created_by, listing_id,
      unit_price, currency, quantity, unit, incoterm, origin_port, destination_port,
      validity_until, status, responded_at, countered_by)
    values (${esc(quotationId)}, ${esc(inquiryId)}, ${esc(SELLER)},
      ${esc(BUYER)}, ${esc(SELLER)}, ${esc(listingId)}, ${totalAmount / 50}, 'USDT', 50, 'MT', ${esc(incoterm)},
      'Toamasina', 'Macau Port', ${esc(validity.toISOString())}, 'accepted', now(), ${esc(BUYER)});
  `);
  await q(`
    insert into public.orders (id, order_no, buyer_id, seller_id, listing_id, inquiry_id,
      current_quotation_id, quantity, unit_price, total_amount, currency, destination,
      incoterm, status, timeline)
    values (${esc(orderId)}, ${esc(orderNo)}, ${esc(BUYER)}, ${esc(SELLER)},
      ${esc(listingId)}, ${esc(inquiryId)}, ${esc(quotationId)},
      50, ${totalAmount / 50}, ${totalAmount}, 'USDT', 'Macau Port',
      ${esc(incoterm)}, ${esc(status)},
      '[{"event":"${status}","at":"${new Date().toISOString()}","by":"${BUYER}"}]'::jsonb);
  `);
  await q(`update public.inquiries set status = 'converted' where id = ${esc(inquiryId)};`);

  if (withSchedule) {
    for (const row of withSchedule) {
      const amount = (totalAmount * Number(row.percentage)) / 100;
      await q(`
        insert into public.payment_schedules (order_id, sequence, category, milestone,
          percentage, amount, currency, bl_offset_days, status)
        values (${esc(orderId)}, ${row.sequence}, ${esc(row.category)},
          ${esc(row.milestone)}, ${row.percentage}, ${amount}, 'USDT',
          ${row.bl_offset_days == null ? "null" : row.bl_offset_days}, ${esc(row.status ?? "scheduled")});
      `);
    }
  }
  return { orderId, orderNo, status, incoterm };
}

const results = [];
results.push(
  await makeOrder({
    tag: "BROWSE-FOB-DRAFT",
    incoterm: "FOB",
    status: "contract_pending",
    totalAmount: 215_000,
    // no schedule yet — seller will create one via Draft Contract
  })
);
results.push(
  await makeOrder({
    tag: "BROWSE-CFR-SIGNED",
    incoterm: "CFR",
    status: "contract_signed",
    totalAmount: 240_000,
    withSchedule: [
      { sequence: 0, category: "prepayment", milestone: "contract_signed", percentage: 30, status: "due" },
      { sequence: 1, category: "regular_payment", milestone: "loaded_onto_vessel", percentage: 40, status: "scheduled" },
      { sequence: 2, category: "postpayment", milestone: "arrived_at_port", percentage: 30, status: "scheduled" },
    ],
  })
);

console.log("\n=== Seeded orders ===");
for (const r of results) {
  console.log(`  ${r.status.padEnd(20)} ${r.incoterm}  ${r.orderId}`);
  console.log(`    seller: http://localhost:3406/orders/${r.orderId}`);
  console.log(`    buyer : http://localhost:3406/orders/${r.orderId}`);
  console.log(`    admin : http://localhost:3406/admin/orders/${r.orderId}`);
}
console.log("\nAccounts:");
console.log("  +seller@: eric.chang.1015+seller@gmail.com / a1234567");
console.log("  +buyer@:  eric.chang.1015+buyer@gmail.com  / a1234567");
console.log("  +admin@:  eric.chang.1015+admin@gmail.com  / a1234567");
