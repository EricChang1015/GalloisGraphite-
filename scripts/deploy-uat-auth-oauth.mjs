#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Enable Google OAuth on self-hosted GoTrue (UAT).
 *
 * - Uploads docker-compose.override.yml (auth Google passthrough)
 * - Merges .env.uat (SITE_URL, GOOGLE_*) into upstream/.env
 * - Recreates supabase-auth
 * - Verifies /auth/v1/settings reports google: true
 *
 * Prerequisites (.env.local):
 *   SSH_PROXY_* + SELF_HOST_SUPABASE_*
 *   GOOGLE_CLIENT_ID + GOOGLE_SECRET (from Google Cloud Console)
 *
 * Usage:
 *   node scripts/deploy-uat-auth-oauth.mjs
 *   node scripts/deploy-uat-auth-oauth.mjs --verify-only
 *   node scripts/deploy-uat-auth-oauth.mjs --infra-only  # override + SITE_URL, no Google creds
 */
import { writeFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildSupabaseUatEnvFile,
  uatPublicOrigin,
  validateGoogleOAuthEnv,
} from "./lib/deploy-env.mjs";
import { loadEnvLocal } from "./lib/supabase-env.mjs";
import { execCommand, uploadFile, withJumpSsh } from "./lib/ssh-jump.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OVERRIDE = join(ROOT, "data", "deploy", "supabase", "docker-compose.override.yml");
const VERIFY_ONLY = process.argv.includes("--verify-only");
const INFRA_ONLY = process.argv.includes("--infra-only");

/** Merge key=value lines from a file into upstream/.env on the server. */
const MERGE_ENV_UAT_SHELL = `while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
  key="\${line%%=*}"; val="\${line#*=}"
  [[ -n "$key" && -n "$val" ]] || continue
  if grep -q "^\${key}=" /data/deploy/supabase/upstream/.env 2>/dev/null; then
    sed -i "s|^\${key}=.*|\${key}=\${val}|" /data/deploy/supabase/upstream/.env
  else
    echo "\${key}=\${val}" >> /data/deploy/supabase/upstream/.env
  fi
done < /data/deploy/supabase/.env.uat`;

async function verifyGoogleEnabled(conn, origin, anonKey) {
  const safeKey = anonKey.replace(/'/g, "'\\''");
  const out = await execCommand(
    conn,
    `docker run --rm --network supabase_default curlimages/curl:8.5.0 -sf -H 'apikey: ${safeKey}' http://supabase-kong:8000/auth/v1/settings`,
  );
  let settings;
  try {
    settings = JSON.parse(out.trim());
  } catch {
    throw new Error(`Could not parse /auth/v1/settings: ${out.slice(0, 200)}`);
  }
  const googleOn = settings?.external?.google === true;
  console.log(`  external.google = ${settings?.external?.google}`);
  if (!googleOn) {
    throw new Error(
      "GoTrue reports google=false — check GOOGLE_* in upstream/.env and auth container env.",
    );
  }
  const redirectUri = `${origin}/auth/v1/callback`;
  const gotrueEnv = await execCommand(
    conn,
    "docker exec supabase-auth env | grep -E 'GOTRUE_EXTERNAL_GOOGLE_|API_EXTERNAL_URL=' || true",
  );
  console.log("  auth container (redacted secret):");
  for (const line of gotrueEnv.split("\n")) {
    if (!line.trim()) continue;
    if (line.includes("SECRET")) {
      const [k] = line.split("=");
      console.log(`    ${k}=***`);
    } else {
      console.log(`    ${line.trim()}`);
    }
  }
  console.log(`  expected Google redirect URI: ${redirectUri}`);
}

async function main() {
  const env = loadEnvLocal();
  const origin = uatPublicOrigin(env);

  if (!VERIFY_ONLY && !INFRA_ONLY) {
    const err = validateGoogleOAuthEnv(env);
    if (err) {
      console.error(`\n✗ ${err}`);
      process.exit(1);
    }
  }

  console.log("▸ UAT Google OAuth (GoTrue) deploy");
  console.log(`▸ Target: ${origin}`);
  console.log("");

  await withJumpSsh({
    async onTarget(conn) {
      if (!VERIFY_ONLY) {
        console.log("▸ Uploading docker-compose.override.yml...");
        await uploadFile(conn, OVERRIDE, "/data/deploy/supabase/docker-compose.override.yml");

        const tmpUat = join(ROOT, ".tmp.env.uat");
        const uatEnv = buildSupabaseUatEnvFile(env);
        writeFileSync(tmpUat, uatEnv);
        try {
          await uploadFile(conn, tmpUat, "/data/deploy/supabase/.env.uat");
        } finally {
          unlinkSync(tmpUat);
        }

        console.log("▸ Merging .env.uat → upstream/.env...");
        await execCommand(conn, MERGE_ENV_UAT_SHELL);

        console.log("▸ Recreating supabase-auth...");
        await execCommand(
          conn,
          "cd /data/deploy/supabase/upstream && docker compose -f docker-compose.yml -f ../docker-compose.override.yml up -d --force-recreate --no-deps auth",
        );

        console.log("▸ Waiting for auth health...");
        for (let i = 1; i <= 15; i++) {
          try {
            await execCommand(conn, "docker exec supabase-kong kong health");
            break;
          } catch {
            if (i === 15) throw new Error("Kong not healthy after auth recreate");
            await new Promise((r) => setTimeout(r, 2000));
          }
        }
      }

      const anonLine = await execCommand(
        conn,
        "grep '^ANON_KEY=' /data/deploy/supabase/upstream/.env | head -1",
      );
      const anonKey = anonLine.trim().slice("ANON_KEY=".length);

      if (INFRA_ONLY) {
        console.log("\n✓ GoTrue infra synced (override + SITE_URL).");
        console.log(
          "  Next: add GOOGLE_CLIENT_ID + GOOGLE_SECRET to .env.local, then npm run deploy:uat:oauth",
        );
        return;
      }

      console.log("▸ Verifying Google provider...");
      await verifyGoogleEnabled(conn, origin, anonKey);

      console.log("\n✓ Google OAuth enabled on UAT GoTrue.");
      console.log(`  Manual test: ${origin}/login → Continue with Google`);
    },
  });
}

main().catch((err) => {
  console.error("\n✗ Google OAuth deploy failed:");
  console.error(err.message ?? err);
  process.exit(1);
});
