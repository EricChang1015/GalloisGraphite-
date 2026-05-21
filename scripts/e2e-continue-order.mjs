#!/usr/bin/env node
/** Continue from negotiating inquiry — run after partial e2e */
import { chromium } from "playwright";

if (!process.env.E2E_BASE_URL) {
  console.error("Set E2E_BASE_URL before running.");
  process.exit(1);
}
const BASE = process.env.E2E_BASE_URL;
const PASS = "a1234567";
const BUYER = "eric.chang.1015+buyer@gmail.com";
const SELLER = "eric.chang.1015+seller@gmail.com";
const INQUIRY_ID = process.env.INQUIRY_ID || "688fa3b5-78a4-4d1e-8728-c73ff6e8fcfa";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const SIG = resolve(__dirname, "fixtures/sig.png");

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASS);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
}

const browser = await chromium.launch({ headless: true });
const buyerCtx = await browser.newContext();
const sellerCtx = await browser.newContext();
const buyer = await buyerCtx.newPage();
const seller = await sellerCtx.newPage();
buyer.setDefaultTimeout(60000);
seller.setDefaultTimeout(60000);

try {
  await login(buyer, BUYER);
  await buyer.goto(`${BASE}/inquiries/${INQUIRY_ID}`, { waitUntil: "networkidle" });
  await buyer.getByText("4280").first().waitFor();
  const liveRound = buyer.locator("li").filter({ hasText: "4280" }).filter({ hasText: "sent" });
  await liveRound.getByRole("button", { name: "Accept" }).click();
  const navigated = await buyer
    .waitForURL(/\/orders\//, { timeout: 60000 })
    .then(() => true)
    .catch(() => false);
  if (!navigated) {
    const toast = await buyer.locator("[data-sonner-toast]").allTextContents().catch(() => []);
    console.log("ACCEPT FAILED toasts:", toast);
    throw new Error("acceptQuotation did not navigate");
  }
  const orderId = buyer.url().split("/orders/")[1]?.split("?")[0];
  const orderNo = await buyer.locator("h1").textContent();
  console.log("ORDER", orderNo, orderId);

  const orderUrl = `${BASE}/orders/${orderId}`;
  await login(seller, SELLER);
  await seller.goto(orderUrl);
  await seller.getByRole("tab", { name: "Contract" }).click();
  await seller.getByRole("button", { name: "100% prepay (on signing)" }).click();
  await seller.getByRole("button", { name: "Draft Contract" }).click();
  await seller.waitForTimeout(3000);

  await buyer.goto(orderUrl);
  await buyer.getByRole("tab", { name: "Contract" }).click();
  await buyer.getByRole("button", { name: "Return for revision" }).click();
  await buyer.getByRole("dialog").locator("textarea").fill("Split 70/30 please");
  await buyer.getByRole("dialog").getByRole("button", { name: "Send back" }).click();
  await buyer.waitForTimeout(3000);

  await seller.goto(orderUrl);
  await seller.reload();
  await seller.getByRole("tab", { name: "Contract" }).click();
  await seller.getByRole("button", { name: /30 \/ 70/ }).click();
  await seller.getByRole("button", { name: /Re-draft Contract|Draft Contract/ }).click();
  await seller.waitForTimeout(3000);

  await buyer.goto(orderUrl);
  await buyer.getByRole("tab", { name: "Contract" }).click();
  await buyer.getByRole("button", { name: "Approve" }).click();
  await buyer.waitForTimeout(2000);
  await buyer.locator('input[type="file"]').first().setInputFiles(SIG);
  await buyer.getByRole("button", { name: "Upload signed scan" }).first().click();
  await buyer.waitForTimeout(3000);

  await seller.goto(orderUrl);
  await seller.getByRole("tab", { name: "Contract" }).click();
  await seller.locator('input[type="file"]').first().setInputFiles(SIG);
  await seller.getByRole("button", { name: "Upload signed scan" }).first().click();
  await seller.waitForTimeout(4000);
  await seller.reload();

  await buyer.goto(orderUrl);
  await buyer.getByRole("tab", { name: "Payment" }).click();
  const pay = buyer.getByRole("button", { name: /Submit Payment|Pay Early/ }).first();
  await pay.waitFor();
  await pay.click();
  await buyer.getByRole("dialog").locator('input[type="number"]').first().fill("1000");
  await buyer.getByRole("dialog").getByLabel(/TX/i).fill("0xFULLCONTINUE");
  await buyer.getByRole("dialog").getByRole("button", { name: "Submit Payment" }).click();
  await buyer.waitForTimeout(3000);

  await seller.goto(orderUrl);
  await seller.reload();
  await seller.getByRole("tab", { name: "Payment" }).click();
  await seller.getByRole("button", { name: "Verify" }).first().click();
  await seller.waitForTimeout(3000);

  await seller.goto(orderUrl);
  await seller.getByRole("tab", { name: "Overview" }).click();
  for (const name of ["Mark Ready to Ship", "Mark In Transit"]) {
    const b = seller.getByRole("button", { name });
    if (await b.isVisible().catch(() => false)) { await b.click(); await seller.waitForTimeout(2000); }
  }
  await seller.getByRole("button", { name: "Mark Arrived" }).click();
  await seller.getByLabel("Actual Time of Arrival (ATA)").fill(new Date().toISOString().slice(0, 10));
  await seller.getByRole("button", { name: "Confirm Arrival" }).click();

  await seller.getByRole("tab", { name: "Shipment" }).click();
  await seller.getByLabel(/B\/L/i).first().fill("BL-FULL-001");
  await seller.getByLabel(/Vessel/i).first().fill("TEST SHIP");
  await seller.getByRole("button", { name: "Mark as Shipped" }).click();
  await seller.waitForTimeout(3000);

  await buyer.goto(orderUrl);
  await buyer.getByRole("tab", { name: "Overview" }).click();
  await buyer.getByRole("button", { name: "Confirm Customs Cleared" }).click();
  await buyer.waitForTimeout(3000);

  // second payment if needed
  await buyer.getByRole("tab", { name: "Payment" }).click();
  const pay2 = buyer.getByRole("button", { name: /Submit Payment|Pay Early/ }).first();
  if (await pay2.isVisible().catch(() => false)) {
    await pay2.click();
    await buyer.getByRole("dialog").getByLabel(/TX/i).fill("0xFULLCONTINUE2");
    await buyer.getByRole("dialog").getByRole("button", { name: "Submit Payment" }).click();
    await seller.goto(orderUrl);
    await seller.reload();
    await seller.getByRole("tab", { name: "Payment" }).click();
    await seller.getByRole("button", { name: "Verify" }).first().click();
  }

  await buyer.reload();
  console.log("FINAL STATUS TEXT:", await buyer.locator("body").innerText().then(t => t.match(/Completed|In Production|Customs/g)?.join(", ")));
} finally {
  await browser.close();
}
