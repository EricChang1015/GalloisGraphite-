#!/usr/bin/env node
/* eslint-disable no-console */
/** Upload compose override and apply runtime-only stack on UAT (no full bootstrap pull). */
import { readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { execCommand, uploadFile, withJumpSsh } from "./lib/ssh-jump.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DEPLOY_LOCAL = join(ROOT, "data", "deploy", "supabase");

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

async function main() {
  console.log("▸ UAT compose runtime-only apply");
  await withJumpSsh({
    async onTarget(conn) {
      console.log("▸ Uploading data/deploy/supabase ...");
      await uploadDir(conn, DEPLOY_LOCAL, "/data/deploy/supabase");

      console.log("▸ Applying runtime-only stack...");
      await execCommand(
        conn,
        "chmod +x /data/deploy/supabase/compose-*.sh && bash /data/deploy/supabase/compose-runtime.sh",
      );

      console.log("▸ Removing leftover optional containers (if any)...");
      await execCommand(
        conn,
        "docker stop supabase-analytics supabase-vector supabase-meta supabase-studio supabase-imgproxy 2>/dev/null || true",
      );
      await execCommand(
        conn,
        "docker rm supabase-analytics supabase-vector supabase-meta supabase-studio supabase-imgproxy 2>/dev/null || true",
      );

      console.log("▸ Health check...");
      await execCommand(conn, "docker exec supabase-kong kong health");
      await execCommand(
        conn,
        "docker ps --filter name=supabase --format 'table {{.Names}}\t{{.Status}}'",
      );
      await execCommand(
        conn,
        'docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}" 2>/dev/null | head -12',
      );
      await execCommand(
        conn,
        "ANON=$(grep '^ANON_KEY=' /data/deploy/supabase/upstream/.env | cut -d= -f2-) && curl -sf -o /dev/null -w 'auth health HTTP %{http_code}\\n' --resolve uat.gf-v.io:443:127.0.0.1 -H \"apikey: ${ANON}\" https://uat.gf-v.io/auth/v1/health",
      );
    },
  });
  console.log("\n✓ Runtime-only stack applied on UAT server.");
}

main().catch((err) => {
  console.error("\n✗ Failed:");
  console.error(err.message ?? err);
  process.exit(1);
});
