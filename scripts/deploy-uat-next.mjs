#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Build Next.js (standalone) locally and deploy to UAT VM at /data/deploy/next.
 *
 * Deploy model: upload standalone tarball + restart container (no docker build per deploy).
 *
 * Usage:
 *   node scripts/deploy-uat-next.mjs
 *   node scripts/deploy-uat-next.mjs --skip-build
 *   node scripts/deploy-uat-next.mjs --next-only     # skip nginx proxy upload
 *   node scripts/deploy-uat-next.mjs --proxy-only
 *   node scripts/deploy-uat-next.mjs --sync-auth-env # patch GoTrue SITE_URL (rare)
 */
import { execSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildNextProductionEnv,
  buildNextServerEnvFile,
  buildSupabaseUatEnvFile,
  uatPublicOrigin,
} from "./lib/deploy-env.mjs";
import { loadEnvLocal } from "./lib/supabase-env.mjs";
import { execCommand, uploadFile, withJumpSsh } from "./lib/ssh-jump.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const STAGE = join(ROOT, ".tmp-next-deploy");
const REMOTE_NEXT = "/data/deploy/next";
const DEPLOY_NEXT = join(ROOT, "data", "deploy", "next");
const DEPLOY_PROXY = join(ROOT, "data", "deploy", "proxy");

const flags = {
  skipBuild: process.argv.includes("--skip-build"),
  proxyOnly: process.argv.includes("--proxy-only"),
  nextOnly: process.argv.includes("--next-only"),
  syncAuthEnv: process.argv.includes("--sync-auth-env"),
};

async function uploadDir(conn, localDir, remoteDir) {
  await execCommand(conn, `mkdir -p '${remoteDir.replace(/'/g, "'\\''")}'`);
  for (const name of readdirSync(localDir)) {
    const localPath = join(localDir, name);
    const remotePath = `${remoteDir}/${name}`;
    if (statSync(localPath).isDirectory()) {
      await uploadDir(conn, localPath, remotePath);
    } else {
      console.log(`  ↑ ${relative(ROOT, localPath)}`);
      await uploadFile(conn, localPath, remotePath);
    }
  }
}

function stageStandaloneBundle() {
  rmSync(STAGE, { recursive: true, force: true });
  mkdirSync(STAGE, { recursive: true });

  const standalone = join(ROOT, ".next", "standalone");
  const staticDir = join(ROOT, ".next", "static");
  if (!existsSync(standalone)) {
    throw new Error(
      "Missing .next/standalone — run build first (output: standalone in next.config.ts)",
    );
  }
  const dest = join(STAGE, "standalone");
  // dereference: true — Windows cannot create symlinks (sharp) without admin EPERM
  cpSync(standalone, dest, { recursive: true, dereference: true });
  cpSync(staticDir, join(dest, ".next", "static"), { recursive: true });
  cpSync(join(ROOT, "public"), join(dest, "public"), { recursive: true });
}

async function applySupabaseUatEnv(conn, env) {
  const tmpUat = join(ROOT, ".tmp.env.uat");
  writeFileSync(tmpUat, buildSupabaseUatEnvFile(env));
  try {
    await uploadFile(conn, tmpUat, "/data/deploy/supabase/.env.uat");
  } finally {
    unlinkSync(tmpUat);
  }
  await execCommand(
    conn,
    `while IFS= read -r line || [[ -n "$line" ]]; do
      [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
      key="\${line%%=*}"; val="\${line#*=}"
      [[ -n "$key" && -n "$val" ]] || continue
      if grep -q "^\${key}=" /data/deploy/supabase/upstream/.env 2>/dev/null; then
        sed -i "s|^\${key}=.*|\${key}=\${val}|" /data/deploy/supabase/upstream/.env
      else
        echo "\${key}=\${val}" >> /data/deploy/supabase/upstream/.env
      fi
    done < /data/deploy/supabase/.env.uat`,
  );
  await execCommand(
    conn,
    "cd /data/deploy/supabase/upstream && docker compose -f docker-compose.yml -f ../docker-compose.override.yml up -d auth",
  );
}

async function uploadBundle(conn) {
  const tgzName = ".tmp-next-deploy.tgz";
  const tgz = join(ROOT, tgzName);
  console.log("▸ Packaging standalone bundle (standalone + static + public)...");
  execSync(`tar -czf ${tgzName} -C .tmp-next-deploy .`, {
    cwd: ROOT,
    stdio: "inherit",
  });
  try {
    const sizeMb = (statSync(tgz).size / (1024 * 1024)).toFixed(1);
    console.log(`▸ Uploading bundle (~${sizeMb} MB, no docker build on server)...`);
    await uploadFile(conn, tgz, `${REMOTE_NEXT}/deploy.tgz`);
    await execCommand(
      conn,
      `cd ${REMOTE_NEXT} && rm -rf standalone && tar -xzf deploy.tgz && rm -f deploy.tgz`,
    );
  } finally {
    rmSync(tgz, { force: true });
  }
}

async function main() {
  const env = loadEnvLocal();
  const origin = uatPublicOrigin(env);
  console.log("▸ UAT Next.js deploy");
  console.log(`▸ Target: ${origin}`);
  console.log("");

  if (!flags.proxyOnly) {
    if (!flags.skipBuild) {
      console.log("▸ Building Next.js (standalone) for UAT...");
      execSync("npm run build", {
        cwd: ROOT,
        stdio: "inherit",
        env: buildNextProductionEnv(env),
      });
    }
    stageStandaloneBundle();
  }

  await withJumpSsh({
    async onTarget(conn) {
      await execCommand(conn, "mkdir -p /data/deploy/next /data/logs/next /data/deploy/proxy");

      if (!flags.proxyOnly) {
        await uploadDir(conn, DEPLOY_NEXT, REMOTE_NEXT);

        console.log("▸ Uploading Next.js build output...");
        await uploadBundle(conn);

        const tmpEnv = join(ROOT, ".tmp-next.env");
        writeFileSync(tmpEnv, buildNextServerEnvFile(env));
        try {
          await uploadFile(conn, tmpEnv, `${REMOTE_NEXT}/.env`);
        } finally {
          unlinkSync(tmpEnv);
        }

        if (flags.syncAuthEnv) {
          console.log("▸ Patching Supabase GoTrue SITE_URL...");
          await applySupabaseUatEnv(conn, env);
        }

        console.log("▸ Restarting mada-next (volume mount, no image rebuild)...");
        await execCommand(
          conn,
          `chmod +x ${REMOTE_NEXT}/bootstrap.sh ${REMOTE_NEXT}/cron-payment-schedule.sh && bash ${REMOTE_NEXT}/bootstrap.sh`,
        );
      }

      if (!flags.nextOnly && !flags.proxyOnly) {
        console.log("▸ Uploading nginx proxy config...");
        await uploadDir(conn, DEPLOY_PROXY, "/data/deploy/proxy");
        console.log("▸ Restarting nginx proxy...");
        await execCommand(
          conn,
          "cd /data/deploy/proxy && docker compose up -d --force-recreate",
        );
      } else if (flags.proxyOnly) {
        console.log("▸ Uploading nginx proxy config...");
        await uploadDir(conn, DEPLOY_PROXY, "/data/deploy/proxy");
        await execCommand(
          conn,
          "cd /data/deploy/proxy && docker compose up -d --force-recreate",
        );
      }

      console.log("▸ Health checks...");
      await execCommand(
        conn,
        "docker ps --filter name=mada-next --format 'table {{.Names}}\t{{.Status}}'",
      );
      await execCommand(
        conn,
        `curl -sf -o /dev/null -w 'home HTTP %{http_code}\\n' --resolve uat.gf-v.io:443:127.0.0.1 ${origin}/`,
      );
      await execCommand(
        conn,
        `curl -sf -o /dev/null -w 'login HTTP %{http_code}\\n' --resolve uat.gf-v.io:443:127.0.0.1 ${origin}/login`,
      );
    },
  });

  rmSync(STAGE, { recursive: true, force: true });
  console.log(`\n✓ Next.js deployed at ${origin}`);
}

main().catch((err) => {
  console.error("\n✗ Deploy failed:");
  console.error(err.message ?? err);
  process.exit(1);
});
