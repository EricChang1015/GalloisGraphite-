#!/usr/bin/env node
/**
 * KYC UI smoke — seller/buyer /settings/kyc, admin thresholds & user KYC dialog.
 *
 * Prerequisites:
 *   npm run build && npm run start
 *   E2E_BASE_URL=http://127.0.0.1:3000 npm run qa:kyc:e2e
 */
import { chromium } from "playwright";
import {
  assertServerUp,
  createAuthenticatedContext,
} from "./lib/e2e-auth.mjs";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const PASS = "a1234567";
const SELLER = "eric.chang.1015+seller@gmail.com";
const BUYER = "eric.chang.1015+buyer@gmail.com";
const ADMIN =
  process.env.QA_ADMIN_EMAIL ?? SELLER.replace("+seller@", "+admin@");

let pass = 0;
let fail = 0;

function check(cond, id, label, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${id} ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${id} ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function dismissAi(page) {
  const close = page.getByLabel("Close AI assistant");
  if (await close.isVisible({ timeout: 1500 }).catch(() => false)) {
    await close.click().catch(() => {});
  }
}

/** Wait for KYC page content (SSR h1 or error state). */
async function waitForKycPage(page) {
  await page.waitForLoadState("domcontentloaded");
  const marker = page.getByText(/kyc verification/i).first();
  await marker.waitFor({ state: "visible", timeout: 20000 });
  return marker;
}

async function warmSession(page) {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await dismissAi(page);
  if (!page.url().includes("/dashboard")) {
    throw new Error(`Cookie auth failed — landed on ${page.url()}`);
  }
}

async function main() {
  console.log(`=== E2E KYC UI @ ${BASE} ===\n`);
  await assertServerUp(BASE);

  const browser = await chromium.launch({ headless: true });
  try {
    console.log("--- TC-KYC-UI-01 Seller /settings/kyc ---");
    const sellerCtx = await createAuthenticatedContext(
      browser,
      SELLER,
      PASS,
      BASE
    );
    const sellerPage = await sellerCtx.newPage();
    await warmSession(sellerPage);
    await sellerPage.goto(`${BASE}/settings/kyc`, {
      waitUntil: "domcontentloaded",
    });
    await dismissAi(sellerPage);
    check(
      sellerPage.url().includes("/settings/kyc"),
      "TC-KYC-UI-01a",
      "seller reaches KYC settings page",
      sellerPage.url()
    );
    try {
      await waitForKycPage(sellerPage);
      check(true, "TC-KYC-UI-01b", "KYC page shows verification heading");
    } catch (e) {
      const snippet = (await sellerPage.locator("body").innerText()).slice(0, 200);
      check(false, "TC-KYC-UI-01b", "KYC page shows verification heading", `${e.message} | body: ${snippet}`);
    }
    await sellerCtx.close();

    console.log("\n--- TC-KYC-UI-02 Buyer /settings/kyc ---");
    const buyerCtx = await createAuthenticatedContext(browser, BUYER, PASS, BASE);
    const buyerPage = await buyerCtx.newPage();
    await warmSession(buyerPage);
    await buyerPage.goto(`${BASE}/settings/kyc`, {
      waitUntil: "domcontentloaded",
    });
    await dismissAi(buyerPage);
    check(
      buyerPage.url().includes("/settings/kyc"),
      "TC-KYC-UI-02a",
      "buyer reaches KYC settings page",
      buyerPage.url()
    );
    try {
      await waitForKycPage(buyerPage);
      check(true, "TC-KYC-UI-02b", "buyer sees KYC verification content");
    } catch (e) {
      check(false, "TC-KYC-UI-02b", "buyer sees KYC verification content", e.message);
    }
    await buyerCtx.close();

    console.log("\n--- TC-KYC-UI-03 Admin ---");
    let adminCtx;
    try {
      adminCtx = await createAuthenticatedContext(browser, ADMIN, PASS, BASE);
    } catch (e) {
      check(false, "TC-KYC-UI-03a", "admin auth", e.message);
      adminCtx = null;
    }
    if (adminCtx) {
      const adminPage = await adminCtx.newPage();
      await warmSession(adminPage);
      await adminPage.goto(`${BASE}/admin/settings`, {
        waitUntil: "domcontentloaded",
      });
      await dismissAi(adminPage);
      const settingsBody = await adminPage.locator("body").innerText();
      check(
        /kyc|inquiry|listing/i.test(settingsBody),
        "TC-KYC-UI-03b",
        "admin settings shows KYC threshold controls"
      );

      await adminPage.goto(`${BASE}/admin/users`, {
        waitUntil: "domcontentloaded",
      });
      await dismissAi(adminPage);
      const kycBtn = adminPage.getByRole("button", { name: /^KYC$/i });
      check(
        (await kycBtn.count()) > 0,
        "TC-KYC-UI-03c",
        "admin users table has KYC action buttons"
      );

      const firstKyc = kycBtn.first();
      if (await firstKyc.isVisible().catch(() => false)) {
        await firstKyc.click();
        const dialog = adminPage.getByRole("dialog");
        await dialog.waitFor({ state: "visible", timeout: 8000 });
        const dialogText = await dialog.innerText();
        check(
          /kyc level|uploaded documents/i.test(dialogText),
          "TC-KYC-UI-03d",
          "User KYC dialog opens with level + documents"
        );
        await adminPage.keyboard.press("Escape");
      }
      await adminCtx.close();
    }
  } finally {
    await browser.close();
  }

  console.log(`\n==== ${pass} passed · ${fail} failed ====`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(2);
});
