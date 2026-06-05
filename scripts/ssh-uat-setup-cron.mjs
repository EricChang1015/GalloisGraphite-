#!/usr/bin/env node
/**
 * Install host crontab for payment-schedule cron on UAT (replaces Vercel cron).
 * Syncs CRON_SECRET from `.env.local` (generates if missing), refreshes mada-next .env.
 * Usage: node scripts/ssh-uat-setup-cron.mjs [--dry-run]
 */
import { appendFileSync, writeFileSync, unlinkSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { buildNextServerEnvFile } from "./lib/deploy-env.mjs";
import { loadEnvLocal } from "./lib/supabase-env.mjs";
import { execCommand, uploadFile, withJumpSsh } from "./lib/ssh-jump.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ENV_LOCAL = join(ROOT, ".env.local");
const CRON_SCRIPT = join(ROOT, "data", "deploy", "next", "cron-payment-schedule.sh");

const CRON_LINE =
  "0 4 * * * /data/deploy/next/cron-payment-schedule.sh >> /data/logs/next/cron.log 2>&1";
const CRON_MARKER = "cron-payment-schedule.sh";

const dryRun = process.argv.includes("--dry-run");

function ensureLocalCronSecret(env) {
  if (env.CRON_SECRET) return env.CRON_SECRET;
  const secret = randomBytes(32).toString("hex");
  const block = `\n# Auto-generated for UAT payment-schedule cron\nCRON_SECRET=${secret}\n`;
  appendFileSync(ENV_LOCAL, block, "utf8");
  console.log("▸ Generated CRON_SECRET in .env.local (not printed)");
  env.CRON_SECRET = secret;
  return secret;
}

const env = loadEnvLocal();
ensureLocalCronSecret(env);

await withJumpSsh({
  async onTarget(c) {
    if (!dryRun) {
      await uploadFile(c, CRON_SCRIPT, "/data/deploy/next/cron-payment-schedule.sh");
      await execCommand(c, "chmod +x /data/deploy/next/cron-payment-schedule.sh", {
        quiet: true,
      });
    }

    console.log("=== Pre-checks ===");

    const scriptOk = await execCommand(
      c,
      "test -x /data/deploy/next/cron-payment-schedule.sh && echo yes || echo no",
      { quiet: true },
    );
    console.log("cron script executable:", scriptOk.trim());
    if (scriptOk.trim() !== "yes") {
      throw new Error(
        "Missing /data/deploy/next/cron-payment-schedule.sh — run npm run deploy:uat:next first",
      );
    }

    const envOk = await execCommand(
      c,
      "test -f /data/deploy/next/.env && echo yes || echo no",
      { quiet: true },
    );
    console.log(".env present:", envOk.trim());
    if (envOk.trim() !== "yes") {
      throw new Error("Missing /data/deploy/next/.env");
    }

    const secretOk = await execCommand(
      c,
      'grep -q "^CRON_SECRET=" /data/deploy/next/.env && echo yes || echo no',
      { quiet: true },
    );
    console.log("CRON_SECRET configured:", secretOk.trim());
    if (secretOk.trim() !== "yes") {
      console.log("▸ Syncing CRON_SECRET to /data/deploy/next/.env …");
      if (dryRun) {
        console.log("[DRY RUN] Would upload refreshed .env and restart mada-next");
      } else {
        const tmpEnv = join(ROOT, ".tmp-next.env");
        writeFileSync(tmpEnv, buildNextServerEnvFile(env));
        try {
          await uploadFile(c, tmpEnv, "/data/deploy/next/.env");
        } finally {
          unlinkSync(tmpEnv);
        }
        await execCommand(
          c,
          "bash /data/deploy/next/bootstrap.sh",
          { quiet: true },
        );
        console.log("▸ mada-next restarted with CRON_SECRET");
      }
    }

    await execCommand(c, "mkdir -p /data/logs/next", { quiet: true });
    console.log("log dir: /data/logs/next");

    let current = "";
    try {
      current = await execCommand(c, "crontab -l 2>/dev/null", { quiet: true });
    } catch {
      current = "";
    }

    console.log("\n=== Current crontab ===");
    console.log(current.trim() || "(empty)");

    if (current.includes(CRON_MARKER)) {
      console.log("\nCron entry already present — skipping install.");
    } else if (dryRun) {
      console.log("\n[DRY RUN] Would append:");
      console.log(CRON_LINE);
    } else {
      const next = current.trim()
        ? `${current.trim()}\n${CRON_LINE}\n`
        : `${CRON_LINE}\n`;
      const b64 = Buffer.from(next, "utf8").toString("base64");
      await execCommand(
        c,
        `echo '${b64}' | base64 -d | crontab -`,
        { quiet: true },
      );
      console.log("\n=== Installed crontab ===");
      const installed = await execCommand(c, "crontab -l", { quiet: true });
      console.log(installed.trim());
    }

    if (dryRun) {
      console.log("\n[DRY RUN] Skipping live cron test.");
      return;
    }

    console.log("\n=== Manual cron test ===");
    const testOut = await execCommand(
      c,
      "/data/deploy/next/cron-payment-schedule.sh",
      { quiet: true },
    );
    console.log(testOut.trim());

    console.log("\nDone.");
  },
});
