#!/usr/bin/env node
/**
 * 清除 Supabase 內所有 B2B 交易流程測試資料（listings → inquiries →
 * quotations → orders → payments / schedules / contracts / documents）。
 *
 * 保留：profiles、product_categories、news、platform_settings、audit_logs、
 * ai_chat_logs、support/ai chat rooms（無 order_id）。
 *
 * Usage:
 *   node scripts/cleanup-all-trading-data.mjs           # 執行清除
 *   node scripts/cleanup-all-trading-data.mjs --dry-run # 只印數量
 */
import { readFileSync } from "node:fs";

const DRY_RUN = process.argv.includes("--dry-run");

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
  console.error("Missing SUPABASE_ACCESS_TOKEN or NEXT_PUBLIC_SUPABASE_URL in .env.local");
  process.exit(2);
}
const ref = new URL(url).hostname.split(".")[0];

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

const TABLES = [
  "payment_schedules",
  "payments",
  "order_documents",
  "contracts",
  "orders",
  "quotations",
  "inquiries",
  "listings",
];

async function count(table) {
  const [{ count }] = await q(`select count(*)::int as count from public.${table};`);
  return count;
}

async function main() {
  console.log(`Project: ${ref}`);
  console.log(DRY_RUN ? "Mode: DRY RUN (no deletes)\n" : "Mode: DELETE ALL trading rows\n");

  console.log("== Before ==");
  const before = {};
  for (const t of TABLES) {
    before[t] = await count(t);
    console.log(`  ${t.padEnd(22)} ${before[t]}`);
  }

  const orderChatRooms = await q(`
    select count(*)::int as count from public.chat_rooms
     where order_id is not null or type = 'order';
  `);
  console.log(`  ${"chat_rooms (order)".padEnd(22)} ${orderChatRooms[0].count}`);

  const total =
    Object.values(before).reduce((a, b) => a + b, 0) + orderChatRooms[0].count;
  if (total === 0) {
    console.log("\nNothing to clean. Done.");
    return;
  }

  if (DRY_RUN) {
    console.log("\nDry run complete. Re-run without --dry-run to delete.");
    return;
  }

  console.log("\n== Deleting (FK-safe order) ==");

  // Order-linked chat (messages/members cascade from rooms)
  await q(`
    delete from public.chat_rooms
     where order_id is not null or type = 'order';
  `);
  console.log("  ✓ chat_rooms (order-linked)");

  // Same order as migration 014 hard cutover + inquiries + listings
  for (const t of [
    "payment_schedules",
    "payments",
    "order_documents",
    "contracts",
    "orders",
    "quotations",
    "inquiries",
    "listings",
  ]) {
    await q(`truncate table public.${t} cascade;`);
    console.log(`  ✓ truncate public.${t}`);
  }

  console.log("\n== After ==");
  for (const t of TABLES) {
    const n = await count(t);
    console.log(`  ${t.padEnd(22)} ${n}`);
  }
  const afterRooms = await q(`
    select count(*)::int as count from public.chat_rooms
     where order_id is not null or type = 'order';
  `);
  console.log(`  ${"chat_rooms (order)".padEnd(22)} ${afterRooms[0].count}`);

  console.log("\n✓ All listings / inquiries / orders trading data cleared.");
  console.log("  (profiles, categories, news, settings unchanged)");
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
