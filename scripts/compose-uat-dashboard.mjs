#!/usr/bin/env node
/* eslint-disable no-console */
/** Start Supabase dashboard profile (Studio + analytics + vector + meta) on UAT. */
import { readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { execCommand, uploadFile, withJumpSsh } from "./lib/ssh-jump.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DEPLOY_SUPABASE = join(ROOT, "data", "deploy", "supabase");

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

await withJumpSsh({
  async onTarget(conn) {
    console.log("▸ Uploading supabase compose override + scripts...");
    await uploadDir(conn, DEPLOY_SUPABASE, "/data/deploy/supabase");

    console.log("▸ Starting dashboard profile (Studio + analytics + vector + meta)...");
    await execCommand(
      conn,
      "chmod +x /data/deploy/supabase/compose-*.sh && bash /data/deploy/supabase/compose-dashboard.sh",
    );

    console.log("▸ Waiting for Studio health...");
    for (let i = 1; i <= 20; i++) {
      try {
        await execCommand(
          conn,
          "curl -sf -o /dev/null -w 'studio HTTP %{http_code}\\n' http://127.0.0.1:54323/",
          { quiet: true },
        );
        break;
      } catch {
        if (i === 20) throw new Error("Studio not responding on 127.0.0.1:54323");
        await execCommand(conn, "sleep 3", { quiet: true });
      }
    }

    console.log("▸ Container status & memory:");
    await execCommand(
      conn,
      "docker ps --filter name=supabase --format 'table {{.Names}}\t{{.Status}}'",
    );
    await execCommand(
      conn,
      'docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}" | head -15',
    );
  },
});

console.log("\n✓ Dashboard profile started.");
console.log("  Access Studio via SSH tunnel:");
console.log("    ssh -J <jump> -L 54323:127.0.0.1:54323 aspect@uat.gf-v.io");
console.log("    → http://localhost:54323");
