#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Deploy UAT self-hosted Supabase + Nginx proxy to remote server via SSH jump.
 *
 * Prerequisites (.env.local):
 *   SSH_PROXY_HOST, SSH_PROXY_ACCOUNT, SSH_PROXY_PASSWORD
 *   SELF_HOST_SUPABASE_HOST, SELF_HOST_SUPABASE_ACCOUNT, SELF_HOST_SUPABASE_PASSWORD
 *
 * Usage:
 *   node scripts/deploy-uat-supabase.mjs              # full deploy
 *   node scripts/deploy-uat-supabase.mjs --check      # SSH + docker probe only
 *   node scripts/deploy-uat-supabase.mjs --proxy-only # restart nginx only
 */
import { readdirSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { buildSupabaseUatEnvFile } from "./lib/deploy-env.mjs";
import { loadEnvLocal } from "./lib/supabase-env.mjs";
import {
  execCommand,
  uploadFile,
  withJumpSsh,
} from "./lib/ssh-jump.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DEPLOY_LOCAL = join(ROOT, "data", "deploy");

const flags = {
  check: process.argv.includes("--check"),
  proxyOnly: process.argv.includes("--proxy-only"),
};

/** Recursively upload a directory via SFTP mkdir -p + fastPut */
async function uploadDir(conn, localDir, remoteDir) {
  await execCommand(conn, `mkdir -p '${remoteDir.replace(/'/g, "'\\''")}'`);
  for (const name of readdirSync(localDir)) {
    const localPath = join(localDir, name);
    const remotePath = `${remoteDir}/${name}`;
    if (statSync(localPath).isDirectory()) {
      await uploadDir(conn, localPath, remotePath);
    } else {
      console.log(`  ↑ ${relative(ROOT, localPath)} → ${remotePath}`);
      await uploadFile(conn, localPath, remotePath);
    }
  }
}

async function main() {
  console.log("▸ UAT Supabase deploy");
  console.log(`▸ Local deploy tree: ${DEPLOY_LOCAL}`);
  console.log("");

  const env = loadEnvLocal();

  await withJumpSsh({
    async onTarget(conn) {
      if (flags.check) {
        console.log("▸ SSH jump OK — probing target...");
        await execCommand(conn, "uname -a && docker --version && docker compose version");
        await execCommand(conn, "df -h /data 2>/dev/null || df -h /");
        return;
      }

      console.log("▸ Creating remote directories...");
      await execCommand(
        conn,
        "mkdir -p /data/data/postgres /data/data/storage /data/logs/supabase /data/deploy/proxy /data/deploy/supabase /data/deploy/next",
      );

      if (!flags.proxyOnly) {
        console.log("▸ Uploading data/deploy/supabase ...");
        await uploadDir(conn, join(DEPLOY_LOCAL, "supabase"), "/data/deploy/supabase");

        const tmpUat = join(ROOT, ".tmp.env.uat");
        writeFileSync(tmpUat, buildSupabaseUatEnvFile(env));
        try {
          await uploadFile(conn, tmpUat, "/data/deploy/supabase/.env.uat");
        } finally {
          unlinkSync(tmpUat);
        }

        console.log("▸ Running Supabase bootstrap (may take 10+ min on first run)...");
        await execCommand(
          conn,
          "chmod +x /data/deploy/supabase/bootstrap.sh /data/deploy/supabase/compose-*.sh && bash /data/deploy/supabase/bootstrap.sh",
        );
      }

      console.log("▸ Uploading data/deploy/proxy ...");
      await uploadDir(conn, join(DEPLOY_LOCAL, "proxy"), "/data/deploy/proxy");

      console.log("▸ Restarting Nginx proxy...");
      await execCommand(
        conn,
        "cd /data/deploy/proxy && docker compose up -d --force-recreate",
      );

      console.log("");
      console.log("▸ Remote health check...");
      await execCommand(conn, "docker exec supabase-kong kong health");
      if (!flags.proxyOnly) {
        const anonLine = await execCommand(
          conn,
          "grep '^ANON_KEY=' /data/deploy/supabase/upstream/.env | head -1",
        );
        const anonKey = anonLine.trim().slice("ANON_KEY=".length);
        await execCommand(
          conn,
          `docker run --rm --network supabase_default curlimages/curl:8.5.0 -sf -H 'apikey: ${anonKey.replace(/'/g, "'\\''")}' http://supabase-kong:8000/auth/v1/health`,
        );
      }
      await execCommand(
        conn,
        "docker ps --filter name=proxy --format '{{.Status}}' | grep -q Up && curl -sf -o /dev/null -w '%{http_code}\\n' --resolve uat.gf-v.io:443:127.0.0.1 https://uat.gf-v.io/ || echo proxy_not_ready",
      );

      if (!flags.proxyOnly) {
        console.log("");
        console.log("▸ API keys from server (copy to Vercel env):");
        await execCommand(
          conn,
          "grep -E '^(ANON_KEY|SERVICE_ROLE_KEY|SUPABASE_PUBLIC_URL)=' /data/deploy/supabase/upstream/.env",
        );
      }

      console.log("\n✓ Deploy finished.");
    },
  });
}

main().catch((err) => {
  console.error("\n✗ Deploy failed:");
  console.error(err.message ?? err);
  process.exit(1);
});
