#!/usr/bin/env node
// 清除本 session 走訪 / smoke test seed 的資料：
//   - listings.title LIKE 'SMOKE · %' 或 'BROWSER · %' 或 'TEST · MADA1%'
//   - 連帶 inquiries / quotations / orders / payments / payment_schedules / contracts
import { readFileSync } from "node:fs";

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

console.log("== Listing test rows that match prefix patterns ==");
const before = await q(`
  select id, title from public.listings
   where title like 'SMOKE · %'
      or title like 'BROWSER · %'
      or title like 'TEST · MADA1%';
`);
console.log(`  found ${before.length} listings`);
for (const l of before) console.log(`   - ${l.id}  ${l.title}`);

if (before.length === 0) {
  console.log("\nNothing to clean. Done.");
  process.exit(0);
}

const ids = before.map((l) => `'${l.id}'`).join(",");

console.log("\n== Cascading delete ==");

// Find dependent rows so the user can see what gets removed
const inquiries = await q(`select id from public.inquiries where listing_id in (${ids});`);
const inquiryIds = inquiries.map((r) => `'${r.id}'`).join(",") || "''";
const orders = await q(`select id, order_no from public.orders where listing_id in (${ids});`);
const orderIds = orders.map((r) => `'${r.id}'`).join(",") || "''";

console.log(`  inquiries:  ${inquiries.length}`);
console.log(`  orders:     ${orders.length}`);
for (const o of orders) console.log(`     - ${o.order_no}`);

// Delete in FK-safe order. ON DELETE CASCADE handles most, but be explicit.
if (orders.length > 0) {
  await q(`delete from public.payments where order_id in (${orderIds});`);
  await q(`delete from public.payment_schedules where order_id in (${orderIds});`);
  await q(`delete from public.contracts where order_id in (${orderIds});`);
  await q(`delete from public.order_documents where order_id in (${orderIds});`);
  await q(`delete from public.chat_rooms where order_id in (${orderIds});`);
  await q(`delete from public.orders where id in (${orderIds});`);
}
if (inquiries.length > 0) {
  await q(`delete from public.quotations where inquiry_id in (${inquiryIds});`);
  await q(`delete from public.inquiries where id in (${inquiryIds});`);
}
await q(`delete from public.listings where id in (${ids});`);

const after = await q(`
  select count(*)::int as count from public.listings
   where title like 'SMOKE · %'
      or title like 'BROWSER · %'
      or title like 'TEST · MADA1%';
`);
console.log(`\n✓ Done. listings remaining with test prefix: ${after[0].count}`);
