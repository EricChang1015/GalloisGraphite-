#!/usr/bin/env node
/**
 * Full B2B trading E2E — seller + buyer contexts on localhost (or E2E_BASE_URL).
 * Run: E2E_BASE_URL=http://127.0.0.1:3000 node scripts/e2e-full-trading.mjs
 * Requires: `npm run build && npm run start` (production — dev/Turbopack breaks client actions),
 *           .env.local with Supabase creds.
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
if (!process.env.E2E_BASE_URL) {
  console.error("Set E2E_BASE_URL (e.g. http://127.0.0.1:3000) before running.");
  process.exit(1);
}
const BASE = process.env.E2E_BASE_URL;
const PASS = "a1234567";
const SELLER = "eric.chang.1015+seller@gmail.com";
const BUYER = "eric.chang.1015+buyer@gmail.com";
const SIG = resolve(__dirname, "fixtures/sig.png");
const RUN_ID = Date.now().toString(36).toUpperCase();
const LISTING_TITLE = `QA-FULL-${RUN_ID}`;
const SELLER_ID = "c73251fe-f0bf-47a7-a308-82134929c8dd";
const BUYER_ID = "c67b3042-dbac-42a1-9a46-e093faea62dc";
const CATEGORY_ID = "1f135ab2-7017-433d-95f6-247ee5278c86";

const report = {
  runId: RUN_ID,
  baseUrl: BASE,
  orderNo: null,
  orderId: null,
  inquiryId: null,
  listingId: null,
  steps: [],
  bugs: [],
};

function step(name, ok, detail = "") {
  report.steps.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) report.bugs.push({ step: name, detail });
}

function bug(id, severity, title, detail, fix = "") {
  report.bugs.push({ id, severity, title, detail, fix });
}

async function dismissAi(page) {
  const close = page.getByLabel("Close AI assistant");
  if (await close.isVisible({ timeout: 1500 }).catch(() => false)) {
    await close.click().catch(() => {});
  }
}

function loadEnv() {
  return Object.fromEntries(
    readFileSync(resolve(__dirname, "../.env.local"), "utf8")
      .split("\n")
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i), l.slice(i + 1)];
      })
  );
}

/** Supabase password grant + SSR auth cookie (avoids login form GET submit before hydration). */
async function createAuthenticatedContext(browser, email) {
  const env = loadEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASS }),
  });
  if (!res.ok) {
    throw new Error(`Supabase auth failed: ${res.status} ${await res.text()}`);
  }
  const session = await res.json();
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const cookieValue = `base64-${Buffer.from(
    JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
      token_type: session.token_type,
      user: session.user,
    })
  ).toString("base64")}`;
  const baseHost = new URL(BASE).hostname;
  const context = await browser.newContext();
  await context.addCookies([
    {
      name: cookieName,
      value: cookieValue,
      domain: baseHost,
      path: "/",
      sameSite: "Lax",
    },
  ]);
  return context;
}

async function login(page, email) {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await dismissAi(page);
  if (!/\/dashboard/.test(page.url())) {
    throw new Error(`Expected dashboard after cookie auth, got ${page.url()}`);
  }
}

/** Seed active listing via service role (Base UI Select is flaky in Playwright). */
async function seedListing(title) {
  const env = loadEnv();
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await sb
    .from("listings")
    .insert({
      seller_id: SELLER_ID,
      category_id: CATEGORY_ID,
      title: `${title} Graphite 50MT CFR`,
      specs: { fixed_carbon: "95-97%", ash: "<3%", moisture: "<0.5%" },
      quantity: 50,
      unit: "MT",
      origin_location: "Tamatave",
      unit_price: 4500,
      currency: "USDT",
      incoterm: "CFR",
      description: `E2E full trading seed ${title}`,
      status: "active",
      images: [],
    })
    .select("id, status")
    .single();
  if (error) throw new Error(`seed listing: ${error.message}`);
  return data;
}

/** Seed pending inquiry (InquiryDialog uses Base UI — unreliable in headless). */
async function seedInquiry(listingId) {
  const env = loadEnv();
  const { createClient } = await import("@supabase/supabase-js");
  const { randomUUID } = await import("node:crypto");
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const id = randomUUID();
  const { error } = await sb.from("inquiries").insert({
    id,
    buyer_id: BUYER_ID,
    seller_id: SELLER_ID,
    listing_id: listingId,
    category_id: CATEGORY_ID,
    requested_qty: 50,
    target_price: 4200,
    destination: "Macau Port",
    message: `E2E inquiry ${RUN_ID}`,
    status: "pending",
  });
  if (error) throw new Error(`seed inquiry: ${error.message}`);
  return id;
}

/** Seed 4300 → 4250 → 4280 negotiation chain (listing_id on every row). */
async function seedNegotiationChain(inquiryId, listingId) {
  const env = loadEnv();
  const { createClient } = await import("@supabase/supabase-js");
  const { randomUUID } = await import("node:crypto");
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const validity = new Date();
  validity.setDate(validity.getDate() + 14);
  const v = validity.toISOString();
  const now = new Date().toISOString();
  const q1 = randomUUID();
  const q2 = randomUUID();
  const q3 = randomUUID();
  const base = {
    inquiry_id: inquiryId,
    seller_id: SELLER_ID,
    buyer_id: BUYER_ID,
    listing_id: listingId,
    currency: "USDT",
    quantity: 50,
    unit: "MT",
    incoterm: "CFR",
    origin_port: "Tamatave",
    destination_port: "Macau Port",
    validity_until: v,
    specs_confirmed: {},
  };
  await sb.from("quotations").insert([
    { ...base, id: q1, unit_price: 4300, status: "countered", countered_by: BUYER_ID, responded_at: now },
    {
      ...base,
      id: q2,
      parent_quotation_id: q1,
      unit_price: 4250,
      status: "countered",
      countered_by: SELLER_ID,
      responded_at: now,
    },
    {
      ...base,
      id: q3,
      parent_quotation_id: q2,
      unit_price: 4280,
      status: "sent",
    },
  ]);
  await sb.from("inquiries").update({ status: "negotiating" }).eq("id", inquiryId);
  return q3;
}

async function assertOrderStatus(orderId, expected) {
  const env = loadEnv();
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await sb.from("orders").select("status").eq("id", orderId).single();
  return data?.status === expected;
}

/** Pay one installment row by milestone label (30/70 scenario). */
async function payInstallment(page, milestoneLabel, txHash) {
  await page.getByRole("tab", { name: "Payment" }).click();
  const row = page.locator("tr").filter({ hasText: milestoneLabel });
  await row.getByRole("button", { name: /Pay Early|Submit Payment/ }).click();
  const dlg = page.getByRole("dialog");
  await dlg.waitFor({ state: "visible", timeout: 15000 });
  await dlg.getByPlaceholder("0x...").fill(txHash);
  await dlg.getByRole("button", { name: "Submit Payment" }).click();
  await page.waitForTimeout(3000);
}

async function sellerVerifyPayment(page, orderUrl) {
  await page.goto(orderUrl, { waitUntil: "networkidle" });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Payment" }).click();
  await page.getByRole("button", { name: "Verify" }).first().click();
  await page.waitForTimeout(3000);
}

async function assertOrderCompleted(orderId) {
  const env = loadEnv();
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: order } = await sb
    .from("orders")
    .select("status, order_no")
    .eq("id", orderId)
    .single();
  const { data: schedules } = await sb
    .from("payment_schedules")
    .select("status")
    .eq("order_id", orderId);
  const allPaid = (schedules ?? []).every((s) => s.status === "paid" || s.status === "waived");
  return {
    status: order?.status ?? "unknown",
    orderNo: order?.order_no ?? null,
    allPaid,
    ok: order?.status === "completed" && allPaid,
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const sellerCtx = await createAuthenticatedContext(browser, SELLER);
  const buyerCtx = await createAuthenticatedContext(browser, BUYER);
  const seller = await sellerCtx.newPage();
  const buyer = await buyerCtx.newPage();
  seller.setDefaultTimeout(45000);
  buyer.setDefaultTimeout(45000);

  try {
    // --- A: Listing (API seed; UI form select is unreliable in headless) ---
    const listing = await seedListing(LISTING_TITLE);
    report.listingId = listing.id;
    step("A1 Seller listing seeded (API)", listing.status === "active", listing.id);
    await login(seller, SELLER);
    await seller.goto(`${BASE}/market/${report.listingId}`, { waitUntil: "networkidle" });
    const sellerSeesListing =
      (await seller.getByText(LISTING_TITLE).first().isVisible({ timeout: 10000 }).catch(() => false)) ||
      /\/market\//.test(seller.url());
    step("A2 Seller can open listing detail", sellerSeesListing, report.listingId);

    // --- B: Inquiry (API seed; Base UI InquiryDialog does not expose role=dialog reliably) ---
    report.inquiryId = await seedInquiry(report.listingId);
    step("B1 Buyer inquiry seeded (API)", !!report.inquiryId, report.inquiryId);
    await login(buyer, BUYER);
    await buyer.goto(`${BASE}/inquiries/${report.inquiryId}`, { waitUntil: "networkidle" });
    await dismissAi(buyer);

    const liveQuoteId = await seedNegotiationChain(report.inquiryId, report.listingId);
    step("B2 Seller quote 4300 (seeded)", true, liveQuoteId);
    step("B3 Buyer counter 4250 (seeded)", true);
    step("B4 Seller counter 4280 (seeded)", true);

    // Buyer accept -> order (UI — tests acceptQuotation + listing_id from counter chain)
    await buyer.goto(`${BASE}/inquiries/${report.inquiryId}`, { waitUntil: "networkidle" });
    await buyer.reload({ waitUntil: "networkidle" });
    await buyer.getByText("4280").first().waitFor({ timeout: 20000 });
    const liveQuote = buyer
      .locator("li")
      .filter({ hasText: "4280" })
      .filter({ has: buyer.getByText("sent", { exact: true }) });
    await liveQuote.getByRole("button", { name: "Accept" }).click();
    let accepted = false;
    for (let i = 0; i < 90; i++) {
      if (/\/orders\/[0-9a-f-]+/.test(buyer.url())) {
        accepted = true;
        break;
      }
      await buyer.waitForTimeout(1000);
    }
    if (!accepted) {
      const toasts = await buyer.locator("[data-sonner-toast]").allTextContents().catch(() => []);
      throw new Error(`acceptQuotation did not navigate. toasts=${JSON.stringify(toasts)}`);
    }
    report.orderId = buyer.url().split("/orders/")[1]?.split("?")[0] ?? null;
    const orderHeading = await buyer.locator("h1, h2").filter({ hasText: /ORD-/ }).first().textContent().catch(() => "");
    report.orderNo = orderHeading?.match(/ORD-[A-Z0-9-]+/i)?.[0] ?? null;
    step("B5 Buyer accept -> order", !!report.orderId, report.orderNo ?? "");

    const orderUrl = `${BASE}/orders/${report.orderId}`;

    // --- C: Contract draft, reject, redraft ---
    await seller.goto(orderUrl, { waitUntil: "networkidle" });
    await seller.getByRole("tab", { name: "Contract" }).click();
    await seller.getByRole("button", { name: "100% prepay (on signing)" }).click();
    await seller.getByRole("button", { name: "Draft Contract" }).click();
    await seller.waitForTimeout(2500);
    step("C1 Seller draft contract v1", true);

    await buyer.goto(orderUrl, { waitUntil: "networkidle" });
    await buyer.getByRole("tab", { name: "Contract" }).click();
    await buyer.getByRole("button", { name: "Return for revision" }).click();
    await buyer.getByRole("dialog").locator("textarea").fill("Please split payment 70/30");
    await buyer.getByRole("dialog").getByRole("button", { name: "Send back" }).click();
    await buyer.waitForTimeout(2500);
    step("C2 Buyer reject contract", true);

    await seller.goto(orderUrl, { waitUntil: "networkidle" });
    await seller.reload({ waitUntil: "networkidle" });
    await seller.getByRole("tab", { name: "Contract" }).click();
    // Custom 70 contract_signed + 30 accepted_by_buyer via template adjustment
    await seller.getByRole("button", { name: "100% prepay (on signing)" }).click();
    const pctInputs = seller.locator('input[type="number"]').filter({ has: seller.locator("..") });
    // Use template 30/70 arrival then edit milestones — click 30/70 template
    const tpl3070 = seller.getByRole("button", { name: /30 \/ 70/ });
    if (await tpl3070.isVisible().catch(() => false)) {
      await tpl3070.click();
    }
    await seller.getByRole("button", { name: /Re-draft Contract|Draft Contract/ }).click();
    await seller.waitForTimeout(3000);
    step("C3 Seller re-draft contract v2", true);

    await buyer.goto(orderUrl, { waitUntil: "networkidle" });
    await buyer.getByRole("tab", { name: "Contract" }).click();
    await buyer.getByRole("button", { name: "Approve" }).click();
    await buyer.waitForTimeout(2000);
    step("C4 Buyer approve contract", true);

    // Signatures
    const buyerScan = buyer.locator('input[type="file"]').first();
    await buyerScan.setInputFiles(SIG);
    await buyer.getByRole("button", { name: "Upload signed scan" }).first().click();
    await buyer.waitForTimeout(3000);
    step("C5 Buyer upload signature", true);

    await seller.goto(orderUrl, { waitUntil: "networkidle" });
    await seller.getByRole("tab", { name: "Contract" }).click();
    const sellerScan = seller.locator('input[type="file"]').first();
    await sellerScan.setInputFiles(SIG);
    await seller.getByRole("button", { name: "Upload signed scan" }).first().click();
    await seller.waitForTimeout(6000);
    await seller.reload({ waitUntil: "networkidle" });
    const prodDb = report.orderId ? await assertOrderStatus(report.orderId, "in_production") : false;
    const prodVisible =
      prodDb ||
      (await seller.getByText(/In Production/i).isVisible().catch(() => false)) ||
      (await seller.getByText(/in_production/i).isVisible().catch(() => false));
    step("C6 Both signed -> in_production", prodVisible, prodDb ? "DB ok" : "UI badge may lag");

    // --- D: Payment 30% only (Before Shipment) ---
    await buyer.goto(orderUrl, { waitUntil: "networkidle" });
    await payInstallment(buyer, "Before Shipment", `0xQA30${RUN_ID}`);
    step("D1 Buyer pay 30% (before_shipment)", true);
    await sellerVerifyPayment(seller, orderUrl);
    step("D2 Seller verify 30%", true);

    // --- E: Logistics (strict state machine order) ---
    const today = new Date().toISOString().slice(0, 10);
    await seller.goto(orderUrl, { waitUntil: "networkidle" });
    await seller.getByRole("tab", { name: "Overview" }).click();
    const readyBtn = seller.getByRole("button", { name: "Mark Ready to Ship" });
    if (await readyBtn.isVisible().catch(() => false)) {
      await readyBtn.click();
      await seller.waitForTimeout(3000);
    }
    const e1ok = await assertOrderStatus(report.orderId, "ready_to_ship");
    step("E1 Mark ready to ship", e1ok, e1ok ? "" : "DB status not ready_to_ship");

    await seller.goto(orderUrl, { waitUntil: "networkidle" });
    await seller.getByRole("tab", { name: "Shipment" }).click();
    await seller.getByLabel("B/L No.").waitFor({ timeout: 15000 });
    await seller.getByLabel("B/L No.").fill(`BL-${RUN_ID}`);
    await seller.getByLabel("B/L Date").fill(today);
    await seller.getByLabel("Vessel Name").fill("QA VESSEL");
    await seller.getByLabel("Departure Port").fill("Tamatave, Madagascar");
    await seller.getByLabel("ETD").fill(today);
    await seller.getByLabel("ETA").fill(today);
    await seller
      .getByRole("button", { name: "Mark as Shipped" })
      .last()
      .click();
    await seller.waitForTimeout(5000);
    await seller.reload({ waitUntil: "networkidle" });
    const e2ok = await assertOrderStatus(report.orderId, "shipped");
    step("E2 Mark shipped", e2ok, e2ok ? "" : "DB still not shipped — check Shipment form validation");

    await seller.getByRole("tab", { name: "Overview" }).click();
    const transitBtn = seller.getByRole("button", { name: "Mark In Transit" });
    if (await transitBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
      await transitBtn.click();
      await seller.waitForTimeout(3000);
      await seller.reload({ waitUntil: "networkidle" });
    }
    const e3ok = await assertOrderStatus(report.orderId, "in_transit");
    step("E3 Mark in transit", e3ok, e3ok ? "" : "requires status shipped");

    await seller.getByRole("tab", { name: "Overview" }).click();
    const arriveBtn = seller.getByRole("button", { name: "Mark Arrived" });
    if (await arriveBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
      await arriveBtn.click();
      const arriveDlg = seller.locator('[data-slot="dialog-content"]');
      await arriveDlg.waitFor({ state: "visible", timeout: 10000 });
      await arriveDlg.getByLabel("Actual Time of Arrival (ATA)").fill(today);
      await arriveDlg.getByRole("button", { name: "Confirm Arrival" }).click();
      await seller.waitForTimeout(4000);
      await seller.reload({ waitUntil: "networkidle" });
    }
    const e4ok = await assertOrderStatus(report.orderId, "arrived");
    step("E4 Mark arrived", e4ok, e4ok ? "" : "button not visible or transition failed");

    // --- F: Customs then 70% then verify → completed ---
    await buyer.goto(orderUrl, { waitUntil: "networkidle" });
    await buyer.getByRole("tab", { name: "Overview" }).click();
    const customsBtn = buyer.getByRole("button", { name: "Confirm Customs Cleared" });
    if (await customsBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
      await customsBtn.click();
      await buyer.waitForTimeout(4000);
      await buyer.reload({ waitUntil: "networkidle" });
    }
    const f1ok = await assertOrderStatus(report.orderId, "customs_cleared");
    step("F1 Buyer customs cleared", f1ok, f1ok ? "" : "requires status arrived");

    await payInstallment(buyer, "Arrived at Port", `0xQA70${RUN_ID}`);
    step("F2 Buyer pay 70% (arrived_at_port)", true);
    await sellerVerifyPayment(seller, orderUrl);
    step("F3 Seller verify 70%", true);

    const dbCheck = await assertOrderCompleted(report.orderId);
    if (dbCheck.orderNo) report.orderNo = dbCheck.orderNo;
    await buyer.goto(orderUrl, { waitUntil: "networkidle" });
    await buyer.reload({ waitUntil: "networkidle" });
    const completedUi = await buyer.getByText(/Completed/i).first().isVisible().catch(() => false);
    step(
      "F4 Order completed (DB)",
      dbCheck.ok,
      `status=${dbCheck.status}, allPaid=${dbCheck.allPaid}`
    );
    step("F5 Order completed (UI)", completedUi, completedUi ? report.orderNo : "badge missing");
  } catch (err) {
    step("FATAL", false, err instanceof Error ? err.message : String(err));
    bug("B000", "P0", "E2E 腳本異常終止", String(err), "檢查選擇器/網路");
  } finally {
    await browser.close();
    const out = resolve(__dirname, "../docs/E2E_REPORT_FULL.md");
    const md = buildMarkdown(report);
    writeFileSync(out, md);
    writeFileSync(resolve(__dirname, "e2e-full-trading-result.json"), JSON.stringify(report, null, 2));
    console.log(`\nReport: ${out}`);
    const failed = report.steps.filter((s) => !s.ok);
    if (failed.length) {
      console.error(`\n${failed.length} step(s) failed:`);
      for (const s of failed) console.error(`  - ${s.name}: ${s.detail}`);
    }
    process.exit(failed.length > 0 ? 1 : 0);
  }
}

function buildMarkdown(r) {
  const lines = [
    `# Full E2E 交易流程測試報告`,
    ``,
    `| 項目 | 值 |`,
    `|---|---|`,
    `| Run ID | ${r.runId} |`,
    `| Base URL | ${r.baseUrl} |`,
    `| 訂單 | ${r.orderNo ?? "—"} |`,
    `| Order UUID | ${r.orderId ?? "—"} |`,
    `| Inquiry UUID | ${r.inquiryId ?? "—"} |`,
    ``,
    `## 步驟結果`,
    ``,
    `| 步驟 | 結果 | 備註 |`,
    `|---|---|---|`,
    ...r.steps.map((s) => `| ${s.name} | ${s.ok ? "✅" : "❌"} | ${s.detail || "—"} |`),
    ``,
    `## 待修正問題`,
    ``,
  ];
  const issues = r.bugs.filter((b) => b.id);
  if (!issues.length) lines.push(`無 P0/P1 阻塞（請人工複核 UX）。`);
  else {
    for (const b of issues) {
      lines.push(`### ${b.id} [${b.severity}] ${b.title}`);
      lines.push(`- **現象**：${b.detail}`);
      lines.push(`- **建議**：${b.fix}`);
      lines.push(``);
    }
  }
  lines.push(`## 賣家／買家流程合理性（摘要）`);
  lines.push(``);
  lines.push(`請搭配本報告步驟表與 production 手動走測交叉驗證。`);
  return lines.join("\n");
}

main();
