#!/usr/bin/env node
import { withJumpSsh, execCommand } from "./lib/ssh-jump.mjs";

await withJumpSsh({
  async onTarget(conn) {
    const serviceKey = (
      await execCommand(
        conn,
        "grep '^SERVICE_ROLE_KEY=' /data/deploy/supabase/upstream/.env | head -1 | cut -d= -f2-",
        { quiet: true },
      )
    ).trim();

    console.log("=== kong ip ===");
    await execCommand(
      conn,
      "docker inspect supabase-kong --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'",
    );

    console.log("\n=== GET bucket ===");
    await execCommand(
      conn,
      `curl -s -w '\\nHTTP:%{http_code}\\n' --resolve uat.gf-v.io:443:127.0.0.1 -H 'apikey: ${serviceKey.replace(/'/g, "'\\''")}' https://uat.gf-v.io/storage/v1/bucket`,
    );

    console.log("\n=== POST small ===");
    await execCommand(
      conn,
      `printf '\\x89PNG\\r\\n\\x1a\\n' | curl -s -w '\\nHTTP:%{http_code}\\n' --resolve uat.gf-v.io:443:127.0.0.1 \\
        -X POST 'https://uat.gf-v.io/storage/v1/object/avatars/test-ext2.png' \\
        -H 'apikey: ${serviceKey.replace(/'/g, "'\\''")}' \\
        -H 'Authorization: Bearer ${serviceKey.replace(/'/g, "'\\''")}' \\
        -H 'Content-Type: image/png' \\
        -H 'x-upsert: true' \\
        --data-binary @-`,
    );

    console.log("\n=== nginx error tail ===");
    await execCommand(conn, "docker logs proxy 2>&1 | tail -5");
  },
});
