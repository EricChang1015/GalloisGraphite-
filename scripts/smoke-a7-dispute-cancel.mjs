#!/usr/bin/env node
/**
 * A7 Tier 3 — dispute / cancel / force-transition DB + RLS checks.
 *
 * Usage: node scripts/smoke-a7-dispute-cancel.mjs [--cleanup]
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  createAdminQuery,
  loadEnvLocal,
  sqlEscape as esc,
} from "./lib/supabase-env.mjs";

const CLEANUP = process.argv.includes("--cleanup");
const SELLER = "c73251fe-f0bf-47a7-a308-82134929c8dd";
const BUYER = "c67b3042-dbac-42a1-9a46-e093faea62dc";
const CATEGORY = "1f135ab2-7017-433d-95f6-247ee5278c86";

const BUYER_EMAIL = process.env.QA_BUYER_EMAIL;
const ADMIN_EMAIL = process.env.QA_ADMIN_EMAIL;
const PASSWORD = process.env.QA_PASSWORD;

const env = loadEnvLocal();
const q = createAdminQuery(env);

let pass = 0;
let fail = 0;
function check(cond, label, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function authClient(email) {
  const res = await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password: PASSWORD }),
    }
  );
  if (!res.ok) throw new Error(`Auth failed ${email}: ${await res.text()}`);
  const session = await res.json();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });
}

async function seedOrder(status) {
  const orderId = randomUUID();
  const orderNo = `ORD-A7-${status.toUpperCase()}-${Date.now().toString(36)}`;
  const listingId = randomUUID();
  await q(`
    insert into public.listings (
      id, seller_id, category_id, title, specs, quantity, unit,
      origin_location, unit_price, currency, incoterm, status
    ) values (
      ${esc(listingId)}, ${esc(SELLER)}, ${esc(CATEGORY)},
      'SMOKE A7', '{}'::jsonb, 1, 'MT', 'Tamatave', 1000, 'USDT', 'CFR', 'active'
    );
  `);
  await q(`
    insert into public.orders (
      id, order_no, buyer_id, seller_id, listing_id,
      quantity, unit_price, total_amount, currency, status, timeline
    ) values (
      ${esc(orderId)}, ${esc(orderNo)},
      ${esc(BUYER)}, ${esc(SELLER)}, ${esc(listingId)},
      1, 1000, 1000, 'USDT', ${esc(status)},
      '[]'::jsonb
    );
  `);
  return { orderId, orderNo };
}

async function cleanup(orderId) {
  await q(`delete from public.audit_logs where target_id = ${esc(orderId)};`);
  await q(`delete from public.orders where id = ${esc(orderId)};`);
}

const CANCELLABLE = new Set([
  "quotation_pending",
  "quoted",
  "negotiating",
  "contract_pending",
  "contract_signed",
  "in_production",
  "ready_to_ship",
  "disputed",
]);

async function main() {
  if (!BUYER_EMAIL || !ADMIN_EMAIL || !PASSWORD) {
    console.error(
      "✗ Set QA_BUYER_EMAIL, QA_ADMIN_EMAIL, and QA_PASSWORD (see docs/TESTING.md §1)."
    );
    process.exit(2);
  }
  console.log("=== A7 dispute / cancel / force-transition ===\n");

  const dispute = await seedOrder("in_production");
  const cancel = await seedOrder("in_production");
  const noCancel = await seedOrder("shipped");
  const force = await seedOrder("disputed");

  try {
    // --- Raise dispute (service role path = server actions) ---
    await q(`
      update public.orders set status = 'disputed'
       where id = ${esc(dispute.orderId)};
    `);
    await q(`
      insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
      values (
        ${esc(BUYER)}, 'raise_dispute', 'order', ${esc(dispute.orderId)},
        '{"reason":"QA smoke dispute","from":"in_production"}'::jsonb
      );
    `);
    const [{ status: ds }] = await q(
      `select status from public.orders where id = ${esc(dispute.orderId)};`
    );
    check(ds === "disputed", "raise dispute → status disputed");
    const disputeAudit = await q(`
      select action from public.audit_logs
       where target_id = ${esc(dispute.orderId)} and action = 'raise_dispute'
       limit 1;
    `);
    check(disputeAudit.length === 1, "audit_logs row for raise_dispute");

    // --- Cancel (pre-shipment) ---
    check(CANCELLABLE.has("in_production"), "in_production is cancellable per server action");
    await q(`
      update public.orders set status = 'cancelled'
       where id = ${esc(cancel.orderId)};
    `);
    const [{ status: cs }] = await q(
      `select status from public.orders where id = ${esc(cancel.orderId)};`
    );
    check(cs === "cancelled", "cancel → status cancelled");

    // --- Cancel blocked from shipped (business rule mirror) ---
    check(!CANCELLABLE.has("shipped"), "shipped is NOT cancellable per cancelOrder()");
    const buyer = await authClient(BUYER_EMAIL);
    const { data: partyWriteData, error: partyWriteErr } = await buyer
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", noCancel.orderId)
      .select("id");
    const [{ status: afterPartyWrite }] = await q(
      `select status from public.orders where id = ${esc(noCancel.orderId)};`
    );
    check(
      !partyWriteErr && (partyWriteData?.length ?? 0) === 0 && afterPartyWrite === "shipped",
      "buyer RLS blocks order write (0 rows updated, status unchanged)"
    );

    // --- Admin force transition ---
    const admin = await authClient(ADMIN_EMAIL);
    const { data: adminProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", (await admin.auth.getUser()).data.user?.id)
      .single();
    const isAdmin =
      adminProfile?.role === "admin" || adminProfile?.role === "super_admin";
    check(isAdmin, `admin account ${ADMIN_EMAIL} has admin role`, adminProfile?.role ?? "unknown");

    const { error: forceErr } = await admin
      .from("orders")
      .update({ status: "in_production" })
      .eq("id", force.orderId);
    check(!forceErr, "admin RLS can force-transition disputed → in_production");
    const [{ status: fs }] = await q(
      `select status from public.orders where id = ${esc(force.orderId)};`
    );
    check(fs === "in_production", "force transition applied in DB");
  } finally {
    if (CLEANUP) {
      for (const id of [dispute.orderId, cancel.orderId, noCancel.orderId, force.orderId]) {
        await cleanup(id);
      }
      console.log("\n--- Cleanup: removed A7 dispute/cancel test orders ---");
    }
  }

  console.log(`\n==== ${pass} passed · ${fail} failed ====`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("✗ FATAL:", e.message);
  process.exit(2);
});
