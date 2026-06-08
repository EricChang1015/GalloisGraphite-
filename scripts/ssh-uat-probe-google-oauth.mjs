#!/usr/bin/env node
/* eslint-disable no-console */
/** Probe UAT server for Google OAuth / GoTrue config (secrets redacted). */
import { loadEnvLocal } from "./lib/supabase-env.mjs";
import { execCommand, withJumpSsh } from "./lib/ssh-jump.mjs";
import { uatPublicOrigin } from "./lib/deploy-env.mjs";

const env = loadEnvLocal();
const origin = uatPublicOrigin(env);

await withJumpSsh({
  async onTarget(conn) {
    console.log("▸ upstream/.env Google OAuth (redacted):");
    const lines = await execCommand(
      conn,
      'grep -E "^GOOGLE_(ENABLED|CLIENT_ID|SECRET)=" /data/deploy/supabase/upstream/.env 2>/dev/null | sed "s/SECRET=.*/SECRET=***/" || true',
      { quiet: true },
    );
    console.log(lines.trim() || "(not configured — add GOOGLE_* to .env.local, run deploy:uat:oauth)");

    const siteUrl = await execCommand(
      conn,
      "grep '^SITE_URL=' /data/deploy/supabase/upstream/.env | head -1",
      { quiet: true },
    );
    console.log(`▸ ${siteUrl.trim()}`);

    const anonLine = await execCommand(
      conn,
      "grep '^ANON_KEY=' /data/deploy/supabase/upstream/.env | head -1",
      { quiet: true },
    );
    const anonKey = anonLine.trim().slice("ANON_KEY=".length);
    const safeKey = anonKey.replace(/'/g, "'\\''");

    console.log("\n▸ /auth/v1/settings external providers:");
    const settings = await execCommand(
      conn,
      `docker run --rm --network supabase_default curlimages/curl:8.5.0 -sf -H 'apikey: ${safeKey}' http://supabase-kong:8000/auth/v1/settings`,
      { quiet: true },
    );
    try {
      const parsed = JSON.parse(settings.trim());
      console.log(JSON.stringify(parsed.external ?? {}, null, 2));
    } catch {
      console.log(settings.slice(0, 300));
    }

    console.log(`\n▸ Expected redirect URI: ${origin}/auth/v1/callback`);
  },
});
