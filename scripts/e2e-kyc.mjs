#!/usr/bin/env node
/**
 * KYC UI smoke — seller/buyer /settings/kyc, admin thresholds & user KYC dialog.
 * Run: E2E_BASE_URL=http://127.0.0.1:3000 node scripts/e2e-kyc.mjs
 * Requires: `npm run build && npm run start`, .env.local with Supabase creds.
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
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
    throw new Error(`Supabase auth failed for ${email}: ${res.status}`);
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

async function dismissAi(page) {
  const close = page.getByLabel("Close AI assistant");
  if (await close.isVisible({ timeout: 1500 }).catch(() => false)) {
    await close.click().catch(() => {});
  }
}

async function main() {
  console.log(`=== E2E KYC UI @ ${BASE} ===\n`);

  const browser = await chromium.launch({ headless: true });
  try {
    // TC-KYC-UI-01 seller settings/kyc
    console.log("--- TC-KYC-UI-01 Seller /settings/kyc ---");
    const sellerCtx = await createAuthenticatedContext(browser, SELLER);
    const sellerPage = await sellerCtx.newPage();
    await sellerPage.goto(`${BASE}/settings/kyc`, { waitUntil: "networkidle" });
    await dismissAi(sellerPage);
    const sellerUrl = sellerPage.url();
    check(
      sellerUrl.includes("/settings/kyc"),
      "TC-KYC-UI-01a",
      "seller reaches KYC settings page",
      sellerUrl
    );
    const sellerHeading = sellerPage.getByRole("heading", {
      name: /kyc verification/i,
    });
    await sellerHeading.waitFor({ state: "visible", timeout: 15000 });
    check(
      await sellerHeading.isVisible(),
      "TC-KYC-UI-01b",
      "KYC page shows verification heading"
    );
    await sellerCtx.close();

    // TC-KYC-UI-02 buyer settings/kyc
    console.log("\n--- TC-KYC-UI-02 Buyer /settings/kyc ---");
    const buyerCtx = await createAuthenticatedContext(browser, BUYER);
    const buyerPage = await buyerCtx.newPage();
    await buyerPage.goto(`${BASE}/settings/kyc`, { waitUntil: "networkidle" });
    await dismissAi(buyerPage);
    check(
      buyerPage.url().includes("/settings/kyc"),
      "TC-KYC-UI-02a",
      "buyer reaches KYC settings page",
      buyerPage.url()
    );
    await buyerCtx.close();

    console.log("\n--- TC-KYC-UI-03 Admin ---");
    let adminCtx;
    try {
      adminCtx = await createAuthenticatedContext(browser, ADMIN);
    } catch (e) {
      check(false, "TC-KYC-UI-03a", "admin auth", e.message);
      adminCtx = null;
    }
    if (adminCtx) {
      const adminPage = await adminCtx.newPage();
      await adminPage.goto(`${BASE}/admin/settings`, {
        waitUntil: "networkidle",
      });
      await dismissAi(adminPage);
      const settingsBody = await adminPage.locator("body").innerText();
      check(
        /kyc|inquiry|listing/i.test(settingsBody),
        "TC-KYC-UI-03b",
        "admin settings shows KYC threshold controls"
      );

      await adminPage.goto(`${BASE}/admin/users`, {
        waitUntil: "networkidle",
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
