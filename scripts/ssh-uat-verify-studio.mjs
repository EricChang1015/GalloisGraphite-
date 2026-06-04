#!/usr/bin/env node
import { withJumpSsh, execCommand } from "./lib/ssh-jump.mjs";

await withJumpSsh({
  async onTarget(conn) {
    console.log("▸ studio-locations.cfg on server:");
    await execCommand(conn, "cat /data/deploy/proxy/conf.d/studio-locations.cfg | head -20");
    console.log("\n▸ services.conf includes:");
    await execCommand(conn, "grep include /data/deploy/proxy/conf.d/services.conf");
    console.log("\n▸ nginx test:");
    await execCommand(
      conn,
      "docker exec proxy nginx -t 2>&1",
    );
    console.log("\n▸ proxy container status:");
    await execCommand(conn, "docker ps --filter name=proxy --format '{{.Names}} {{.Status}}'");
    console.log("\n▸ /studio from server (non-whitelist IP → expect 403):");
    await execCommand(
      conn,
      "curl -s -o /dev/null -w 'HTTP:%{http_code}\\n' --resolve uat.gf-v.io:443:127.0.0.1 https://uat.gf-v.io/studio/",
    );
    console.log("\n▸ /studio with whitelisted IP header simulation (X-Forwarded-For won't work for allow - uses $remote_addr):");
    await execCommand(
      conn,
      "curl -s -o /dev/null -w 'HTTP:%{http_code}\\n' --resolve uat.gf-v.io:443:127.0.0.1 -H 'X-Real-IP: 202.175.105.50' https://uat.gf-v.io/studio/",
    );
  },
});
