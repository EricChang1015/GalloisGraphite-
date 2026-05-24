#!/usr/bin/env node
/**
 * A7 Tier 3 — dispute / cancel / admin force-transition E2E.
 * Run: E2E_BASE_URL=http://127.0.0.1:3000 node scripts/e2e-dispute-cancel.mjs
 */
import { chromium } from "playwright";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createAuthenticatedContext,
  loadEnvLocal,
} from "./lib/e2e-auth.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
if (!process.env.E2E_BASE_URL) {
  console.error("Set E2E_BASE_URL (e.g. http://127.0.0.1:3000) before running.");
  process.exit(1);
}

const BASE = process.env.E2E_BASE_URL;
const PASS = "a1234567";
const SELLER = "eric.chang.1015+seller@gmail.com";
const BUYER = "eric.chang.1015+buyer@gmail.com";
const ADMIN = process.env.QA_ADMIN_EMAIL ?? SELLER.replace("+seller@", "+admin@");
const SELLER_ID = "c73251fe-f0bf-47a7-a308-82134929c8dd";
const BUYER_ID = "c67b3042-dbac-42a1-9a46-e093faea62dc";
const CATEGORY_ID = "1f135ab2-7017-433d-95f6-247ee5278c86";
const RUN_ID = Date.now().toString(36).toUpperCase();

const report = { runId: RUN_ID, steps: [] };

function step(name, ok, detail = "") {
  report.steps.push({ name, ok, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function dismissAi(page) {
  const close = page.getByLabel("Close AI assistant");
  if (await close.isVisible({ timeout: 1500 }).catch(() => false)) {
    await close.click().catch(() => {});
  }
}

async function seedOrder(status) {
  const env = loadEnvLocal();
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const listingId = randomUUID();
  const inquiryId = randomUUID();
  const quotationId = randomUUID();
  const orderId = randomUUID();
  const orderNo = `ORD-QA-DC-${RUN_ID}-${status.slice(0, 4).toUpperCase()}`;

  await sb.from("listings").insert({
    id: listingId,
    seller_id: SELLER_ID,
    category_id: CATEGORY_ID,
    title: `QA-DISPUTE ${RUN_ID} ${status}`,
    specs: {},
    quantity: 10,
    unit: "MT",
    origin_location: "Tamatave",
    unit_price: 4000,
    currency: "USDT",
    incoterm: "CFR",
    status: "active",
  });

  await sb.from("inquiries").insert({
    id: inquiryId,
    buyer_id: BUYER_ID,
    seller_id: SELLER_ID,
    listing_id: listingId,
    category_id: CATEGORY_ID,
    requested_qty: 10,
    status: "converted",
  });

  const validity = new Date();
  validity.setDate(validity.getDate() + 14);
  const { error: qErr } = await sb.from("quotations").insert({
    id: quotationId,
    inquiry_id: inquiryId,
    seller_id: SELLER_ID,
    buyer_id: BUYER_ID,
    listing_id: listingId,
    unit_price: 4000,
    currency: "USDT",
    quantity: 10,
    unit: "MT",
    incoterm: "CFR",
    validity_until: validity.toISOString(),
    status: "accepted",
  });
  if (qErr) throw new Error(`seed quotation: ${qErr.message}`);

  const { error: oErr } = await sb.from("orders").insert({
    id: orderId,
    order_no: orderNo,
    buyer_id: BUYER_ID,
    seller_id: SELLER_ID,
    listing_id: listingId,
    inquiry_id: inquiryId,
    current_quotation_id: quotationId,
    quantity: 10,
    unit_price: 4000,
    total_amount: 40000,
    currency: "USDT",
    incoterm: "CFR",
    status,
    timeline: [
      {
        event: "seeded_for_qa",
        at: new Date().toISOString(),
        by: SELLER_ID,
        note: `e2e-dispute-cancel ${status}`,
      },
    ],
  });
  if (oErr) throw new Error(`seed order: ${oErr.message}`);

  return { orderId, orderNo, status };
}

async function getOrderStatus(orderId) {
  const env = loadEnvLocal();
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await sb.from("orders").select("status").eq("id", orderId).single();
  return data?.status ?? null;
}

async function hasAuditLog(orderId, action) {
  const env = loadEnvLocal();
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await sb
    .from("audit_logs")
    .select("id")
    .eq("target_type", "order")
    .eq("target_id", orderId)
    .eq("action", action)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const buyerCtx = await createAuthenticatedContext(browser, BUYER, PASS, BASE);
  const adminCtx = await createAuthenticatedContext(browser, ADMIN, PASS, BASE);
  const buyer = await buyerCtx.newPage();
  const admin = await adminCtx.newPage();
  buyer.setDefaultTimeout(45000);
  admin.setDefaultTimeout(45000);

  try {
    const disputeOrder = await seedOrder("in_production");
    const cancelOrderRow = await seedOrder("contract_pending");

    // --- Dispute flow ---
    const disputeUrl = `${BASE}/orders/${disputeOrder.orderId}`;
    await buyer.goto(disputeUrl, { waitUntil: "networkidle" });
    await dismissAi(buyer);
    if (!/\/orders\//.test(buyer.url())) {
      throw new Error(`Buyer not on order page: ${buyer.url()}`);
    }
    const raiseBtn = buyer.getByRole("button", { name: "Raise Dispute" });
    if (!(await raiseBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      await buyer.getByRole("tab", { name: "Overview" }).click();
    }
    await raiseBtn.click();
    await buyer
      .getByPlaceholder("Describe the issue")
      .fill(`QA dispute E2E ${RUN_ID} — quality mismatch on shipment docs.`);
    await buyer
      .getByRole("dialog")
      .getByRole("button", { name: "Raise Dispute" })
      .click();
    await buyer.waitForTimeout(4000);
    await buyer.reload({ waitUntil: "networkidle" });
    const disputed = (await getOrderStatus(disputeOrder.orderId)) === "disputed";
    step("G1 Buyer raise dispute -> disputed", disputed, disputeOrder.orderNo);
    const disputeAudit = await hasAuditLog(disputeOrder.orderId, "raise_dispute");
    step("G2 audit_logs raise_dispute", disputeAudit);

    // --- Admin force back to in_production ---
    await admin.goto(`${BASE}/admin/orders/${disputeOrder.orderId}`, {
      waitUntil: "networkidle",
    });
    await dismissAi(admin);
    await admin.getByLabel("Target Status").click();
    await admin.getByRole("option", { name: "In Production" }).click();
    await admin
      .getByPlaceholder("Why is this manual transition needed?")
      .fill(`QA mediation resolved ${RUN_ID}`);
    await admin.getByRole("button", { name: "Force Transition" }).click();
    await admin.waitForTimeout(4000);
    await admin.reload({ waitUntil: "networkidle" });
    const restored =
      (await getOrderStatus(disputeOrder.orderId)) === "in_production";
    step("G3 Admin force disputed -> in_production", restored);
    const forceAudit = await hasAuditLog(disputeOrder.orderId, "force_transition_order");
    step("G4 audit_logs force_transition", forceAudit);

    // --- Cancel flow ---
    const cancelUrl = `${BASE}/orders/${cancelOrderRow.orderId}`;
    await buyer.goto(cancelUrl, { waitUntil: "networkidle" });
    await dismissAi(buyer);
    const cancelBtn = buyer.getByRole("button", { name: "Cancel Order" });
    if (!(await cancelBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      await buyer.getByRole("tab", { name: "Overview" }).click();
    }
    await cancelBtn.click();
    await buyer
      .getByPlaceholder("Reason for cancellation.")
      .fill(`QA cancel E2E ${RUN_ID}`);
    await buyer
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel Order" })
      .click();
    await buyer.waitForTimeout(4000);
    await buyer.reload({ waitUntil: "networkidle" });
    const cancelled =
      (await getOrderStatus(cancelOrderRow.orderId)) === "cancelled";
    step("G5 Buyer cancel contract_pending -> cancelled", cancelled, cancelOrderRow.orderNo);
    const cancelAudit = await hasAuditLog(cancelOrderRow.orderId, "cancel_order");
    step("G6 audit_logs cancel_order", cancelAudit);
  } catch (err) {
    step("FATAL", false, err instanceof Error ? err.message : String(err));
  } finally {
    await browser.close();
    const out = resolve(__dirname, "../docs/E2E_REPORT_DISPUTE.md");
    const lines = [
      `# A7 Dispute / Cancel / Force E2E`,
      ``,
      `| Run ID | ${RUN_ID} |`,
      `| Base URL | ${BASE} |`,
      ``,
      `| 步驟 | 結果 | 備註 |`,
      `|---|---|---|`,
      ...report.steps.map((s) => `| ${s.name} | ${s.ok ? "✅" : "❌"} | ${s.detail || "—"} |`),
    ];
    writeFileSync(out, lines.join("\n"));
    console.log(`\nReport: ${out}`);
    const failed = report.steps.filter((s) => !s.ok);
    process.exit(failed.length > 0 ? 1 : 0);
  }
}

main();
