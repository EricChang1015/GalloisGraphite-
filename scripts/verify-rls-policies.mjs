#!/usr/bin/env node
/**
 * RLS review — every public heap table must have RLS enabled; plus spot-checks
 * for critical policies (005 / 009 / 010 / 015 / 018).
 * Usage: node scripts/verify-rls-policies.mjs
 */
import { createAdminQuery, loadEnvLocal } from "./lib/supabase-env.mjs";

const env = loadEnvLocal();
const q = createAdminQuery(env);

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

async function publicTablesWithoutRls() {
  const rows = await q(`
    select c.relname as table_name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and not c.relrowsecurity
     order by 1;
  `);
  return rows.map((r) => r.table_name);
}

async function policiesOn(table) {
  const rows = await q(`
    select policyname, cmd, qual, with_check
      from pg_policies
     where schemaname = 'public' and tablename = '${table}'
     order by policyname;
  `);
  return rows.map((r) => r.policyname);
}

async function storagePolicies(bucketId) {
  const rows = await q(`
    select policyname, cmd
      from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname ilike '%${bucketId.replace("-", "")}%'
          or policyname ilike '%${bucketId}%'
     order by policyname;
  `);
  return rows.map((r) => r.policyname);
}

async function main() {
  console.log("=== RLS policy review ===\n");

  console.log("--- public schema: RLS enabled on all tables ---");
  const noRls = await publicTablesWithoutRls();
  if (noRls.length === 0) {
    check(true, "all public tables have RLS enabled");
  } else {
    for (const t of noRls) {
      check(false, `${t} has RLS disabled (Supabase rls_disabled_in_public)`);
    }
  }

  console.log("\n--- public._agent_migrations (030) ---");
  const agentRls = await q(`
    select relrowsecurity from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = '_agent_migrations';
  `);
  check(agentRls[0]?.relrowsecurity === true, "_agent_migrations RLS enabled");

  console.log("\n--- public.payments (005 / 015) ---");
  const pay = await policiesOn("payments");
  check(pay.includes("payments_buyer_insert"), "payments_buyer_insert exists");
  check(pay.includes("payments_seller_or_admin_update"), "payments_seller_or_admin_update exists");
  check(pay.includes("payments_select_parties"), "payments_select_parties exists");
  check(!pay.includes("payments_admin_update"), "legacy payments_admin_update dropped");

  console.log("\n--- public.orders (001) ---");
  const ord = await policiesOn("orders");
  check(ord.includes("orders_select_parties"), "orders_select_parties exists");
  check(ord.includes("orders_admin_write"), "orders_admin_write exists");

  console.log("\n--- storage.objects order-documents (010 / 018) ---");
  const od = await q(`
    select policyname from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname like 'order-documents:%'
     order by policyname;
  `);
  const odNames = od.map((r) => r.policyname);
  for (const name of [
    "order-documents:read parties",
    "order-documents:insert parties",
    "order-documents:update parties",
    "order-documents:delete admin",
    "order-documents:party read members",
    "order-documents:party insert members",
  ]) {
    check(odNames.includes(name), `storage policy ${name}`);
  }

  console.log("\n--- public.chat (018) ---");
  const chatRooms = await policiesOn("chat_rooms");
  const chatMembers = await policiesOn("chat_members");
  const messages = await policiesOn("messages");
  check(chatRooms.length >= 1, `chat_rooms has RLS policies (${chatRooms.length})`);
  check(chatMembers.length >= 1, `chat_members has RLS policies (${chatMembers.length})`);
  check(messages.length >= 1, `messages has RLS policies (${messages.length})`);

  console.log("\n--- payments.buyer_id column (005 rename) ---");
  const cols = await q(`
    select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'payments'
       and column_name in ('buyer_id', 'payer_id');
  `);
  const names = new Set(cols.map((c) => c.column_name));
  check(names.has("buyer_id"), "payments.buyer_id exists");
  check(!names.has("payer_id"), "payments.payer_id dropped");

  void storagePolicies;

  console.log(`\n==== ${pass} passed · ${fail} failed ====`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("✗ FATAL:", e.message);
  process.exit(2);
});
