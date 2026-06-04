#!/usr/bin/env node
import { execCommand, withJumpSsh } from "./lib/ssh-jump.mjs";

await withJumpSsh({
  async onTarget(c) {
    console.log("=== mada-next logs ===");
    await execCommand(c, "docker logs mada-next --tail 50");
    console.log("\n=== proxy logs ===");
    await execCommand(c, "docker logs proxy --tail 30");
    console.log("\n=== proxy -> next ===");
    await execCommand(
      c,
      "docker exec proxy curl -s -o /dev/null -w 'next:%{http_code}\\n' http://mada-next:3000/ || echo curl_failed",
    );
    console.log("\n=== nginx -t ===");
    await execCommand(c, "docker exec proxy nginx -t");
    console.log("\n=== local https ===");
    await execCommand(
      c,
      "curl -sk --resolve uat.gf-v.io:443:127.0.0.1 -o /dev/null -w 'home:%{http_code}\\n' https://uat.gf-v.io/",
    );
  },
});
