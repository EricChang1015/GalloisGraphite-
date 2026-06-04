#!/usr/bin/env node
import { withJumpSsh, execCommand } from "./lib/ssh-jump.mjs";

await withJumpSsh({
  async onTarget(conn) {
    await execCommand(
      conn,
      "sudo ss -tlnp 2>/dev/null | grep -E ':8000|:5432|:18080' || ss -tlnp | head -30; echo '---'; docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'kong|pooler|NAMES'",
    );
  },
});
