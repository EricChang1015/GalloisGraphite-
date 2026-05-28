#!/usr/bin/env node
/**
 * i18n walkthrough — TESTING.md Appendix Dashboard i18n (steps 1–6, incl. 4b).
 * Usage:
 *   E2E_BASE_URL=https://galloisgraphite.vercel.app node scripts/smoke-i18n.mjs
 *   E2E_BASE_URL=http://127.0.0.1:3000 node scripts/smoke-i18n.mjs
 */
import { chromium } from "playwright";
import {
  assertServerUp,
  createAuthenticatedContext,
  loadEnvLocal,
} from "./lib/e2e-auth.mjs";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const BUYER = "eric.chang.1015+buyer@gmail.com";
const BUYER_ID = "c67b3042-dbac-42a1-9a46-e093faea62dc";
const PASS = "a1234567";

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

async function dismissAi(page) {
  const close = page.getByLabel("Close AI assistant");
  if (await close.isVisible({ timeout: 1500 }).catch(() => false)) {
    await close.click().catch(() => {});
  }
}

async function fetchLatestBuyerOrderId() {
  const env = loadEnvLocal();
  const token = env.SUPABASE_ACCESS_TOKEN;
  const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: `select id from public.orders where buyer_id = '${BUYER_ID}' order by created_at desc limit 1`,
      }),
    }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0]?.id ?? null;
}

async function main() {
  console.log(`=== smoke-i18n @ ${BASE} ===\n`);
  await assertServerUp(BASE);

  const browser = await chromium.launch({ headless: true });

  // --- Step 1: en dashboard ---
  {
    const ctx = await browser.newContext();
    await ctx.addCookies([
      { name: "mg-locale", value: "en", domain: new URL(BASE).hostname, path: "/" },
    ]);
    const page = await ctx.newPage();
    const authCtx = await createAuthenticatedContext(browser, BUYER, PASS, BASE);
    const authPage = await authCtx.newPage();
    await authPage.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
    await dismissAi(authPage);
    const html = await authPage.content();
    check(html.includes("Welcome back"), "step 1: /dashboard en — Welcome back");
    check(html.includes("Market"), "step 1: /dashboard en — Market nav");
    await authCtx.close();
    await ctx.close();
  }

  // --- Step 2: zh-CN dashboard ---
  {
    const ctx = await createAuthenticatedContext(browser, BUYER, PASS, BASE);
    await ctx.addCookies([
      { name: "mg-locale", value: "zh-CN", domain: new URL(BASE).hostname, path: "/" },
    ]);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
    await dismissAi(page);
    const html = await page.content();
    check(html.includes("欢迎回来"), "step 2: /dashboard zh-CN — 欢迎回来");
    check(html.includes("市场"), "step 2: /dashboard zh-CN — 市场 nav");
    await ctx.close();
  }

  // --- Step 3: settings language selector (switch to en) ---
  {
    const ctx = await createAuthenticatedContext(browser, BUYER, PASS, BASE);
    await ctx.addCookies([
      { name: "mg-locale", value: "zh-CN", domain: new URL(BASE).hostname, path: "/" },
    ]);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
    await dismissAi(page);
    const langSection = page.locator("text=语言").or(page.locator("text=Language"));
    check(await langSection.first().isVisible({ timeout: 8000 }).catch(() => false), "step 3: /settings language section visible");
    await ctx.close();
  }

  // --- Step 4: app routes zh-CN chrome ---
  {
    const ctx = await createAuthenticatedContext(browser, BUYER, PASS, BASE);
    await ctx.addCookies([
      { name: "mg-locale", value: "zh-CN", domain: new URL(BASE).hostname, path: "/" },
    ]);
    const page = await ctx.newPage();
    const routes = [
      { path: "/market", needle: "市场" },
      { path: "/inquiries", needle: "询盘" },
      { path: "/orders", needle: "订单" },
      { path: "/messages", needle: "消息" },
      { path: "/settings/kyc", needle: "KYC" },
    ];
    for (const { path, needle } of routes) {
      await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
      await dismissAi(page);
      const html = await page.content();
      check(html.includes(needle), `step 4: ${path} zh-CN — contains「${needle}」`);
    }
    await ctx.close();
  }

  // --- Step 4b: public pages zh-CN (guest) ---
  {
    const ctx = await browser.newContext();
    await ctx.addCookies([
      { name: "mg-locale", value: "zh-CN", domain: new URL(BASE).hostname, path: "/" },
    ]);
    const page = await ctx.newPage();
    const publicRoutes = [
      { path: "/", needle: "AI 辅助" },
      { path: "/about", needle: "关于" },
      { path: "/products", needle: "产品" },
    ];
    for (const { path, needle } of publicRoutes) {
      await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
      await dismissAi(page);
      const html = await page.content();
      check(html.includes(needle), `step 4b: ${path} guest zh-CN — contains「${needle}」`);
    }
    await ctx.close();
  }

  // --- Step 5: contract body stays English on zh-CN UI ---
  {
    const ctx = await createAuthenticatedContext(browser, BUYER, PASS, BASE);
    await ctx.addCookies([
      { name: "mg-locale", value: "zh-CN", domain: new URL(BASE).hostname, path: "/" },
    ]);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/orders`, { waitUntil: "domcontentloaded" });
    await dismissAi(page);
    const firstOrder = page.locator('a[href^="/orders/"]').first();
    let orderPath = await firstOrder.getAttribute("href").catch(() => null);
    if (!orderPath) {
      const orderId = await fetchLatestBuyerOrderId();
      orderPath = orderId ? `/orders/${orderId}` : null;
    }
    if (!orderPath) {
      check(false, "step 5: buyer has at least one order for contract tab check");
    } else {
      await page.goto(`${BASE}${orderPath}?tab=contract`, { waitUntil: "domcontentloaded" });
      await dismissAi(page);
      await page.waitForTimeout(2000);
      const html = await page.content();
      check(
        html.includes("SALES CONTRACT") || html.includes("Sales Contract"),
        "step 5: contract tab — HTML body still English (SALES CONTRACT)"
      );
    }
    await ctx.close();
  }

  // --- Proxy: /settings redirects unauthenticated ---
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
    check(page.url().includes("/login"), "bonus: unauthenticated /settings → /login");
    await ctx.close();
  }

  await browser.close();

  console.log(`\n=== smoke-i18n: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
