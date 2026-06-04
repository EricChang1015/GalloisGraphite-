#!/usr/bin/env node
import { withJumpSsh, execCommand } from "./lib/ssh-jump.mjs";

await withJumpSsh({
  async onTarget(conn) {
    console.log("=== containers ===");
    await execCommand(
      conn,
      "docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'supabase|proxy' || true",
    );
    console.log("\n=== storage logs ===");
    await execCommand(conn, "docker logs supabase-storage 2>&1 | tail -40");
    console.log("\n=== kong -> storage health ===");
    await execCommand(
      conn,
      "docker exec supabase-kong curl -s -o /dev/null -w 'HTTP:%{http_code}\\n' http://storage:5000/status || true",
    );
    console.log("\n=== kong storage route ===");
    await execCommand(
      conn,
      "docker exec supabase-kong curl -s -o /dev/null -w 'HTTP:%{http_code}\\n' http://127.0.0.1:8000/storage/v1/bucket || true",
    );
    console.log("\n=== proxy -> storage ===");
    const anon = (
      await execCommand(
        conn,
        "grep '^ANON_KEY=' /data/deploy/supabase/upstream/.env | head -1 | cut -d= -f2-",
      )
    ).trim();
    await execCommand(
      conn,
      `curl -s -w '\\nHTTP:%{http_code}\\n' --resolve uat.gf-v.io:443:127.0.0.1 -H 'apikey: ${anon.replace(/'/g, "'\\''")}' https://uat.gf-v.io/storage/v1/bucket`,
    );
    console.log("\n=== storage dir ===");
    await execCommand(conn, "ls -la /data/data/storage/ 2>&1 | head -20");
  },
});
