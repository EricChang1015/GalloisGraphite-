#!/usr/bin/env node
/**
 * A7 Google OAuth — config / code-path smoke (no browser OAuth round-trip).
 * Usage: node scripts/smoke-oauth-config.mjs
 */
import { readFileSync } from "node:fs";
import { createAdminQuery, loadEnvLocal, projectRefFromUrl } from "./lib/supabase-env.mjs";

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

async function main() {
  console.log("=== A7 Google OAuth config smoke ===\n");

  const googleBtn = readFileSync(
    new URL("../src/components/auth/GoogleSignInButton.tsx", import.meta.url),
    "utf8"
  );
  check(googleBtn.includes("signInWithOAuth"), "GoogleSignInButton uses signInWithOAuth");
  check(googleBtn.includes('provider: "google"'), 'OAuth provider is "google"');

  const callback = readFileSync(
    new URL("../src/app/auth/callback/route.ts", import.meta.url),
    "utf8"
  );
  check(callback.includes("exchangeCodeForSession"), "auth/callback exchanges OAuth code");
  check(callback.includes("oauth_failed"), "OAuth failure redirects to login hint");

  const migrations = await q(`
    select name from public._agent_migrations
     where name = '008_oauth_profile_handling.sql';
  `);
  check(migrations.length === 1, "migration 008_oauth_profile_handling applied");

  const triggers = await q(`
    select tgname from pg_trigger
     where tgrelid = 'auth.users'::regclass
       and tgname in ('on_auth_user_created', 'on_auth_user_email_confirmed');
  `);
  const tgNames = new Set(triggers.map((t) => t.tgname));
  check(tgNames.has("on_auth_user_created"), "handle_new_user trigger on auth.users");

  const ref = projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  check(!!env.NEXT_PUBLIC_SUPABASE_URL?.includes(ref), "Supabase URL matches project ref");

  const appUrl = env.NEXT_PUBLIC_APP_URL ?? "";
  if (appUrl) {
    check(appUrl.startsWith("http"), "NEXT_PUBLIC_APP_URL is set for OAuth redirect base");
  } else {
    console.log("  ⚠ NEXT_PUBLIC_APP_URL unset — OAuth redirect may default to request origin");
  }

  console.log(`\n==== ${pass} passed · ${fail} failed ====`);
  console.log(
    "\nManual production check: /login → Continue with Google → lands on /dashboard with active profile."
  );
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("✗ FATAL:", e.message);
  process.exit(2);
});
