#!/usr/bin/env node
import { withJumpSsh, execCommand } from "./lib/ssh-jump.mjs";

await withJumpSsh({
  async onTarget(conn) {
    await execCommand(conn, "docker ps --filter name=proxy --format '{{.Status}}'");
    await execCommand(
      conn,
      "docker exec proxy curl -s -o /dev/null -w 'studio:%{http_code}\\n' http://supabase-studio:3000/",
    );
    await execCommand(conn, "docker logs proxy 2>&1 | tail -5");
  },
});
