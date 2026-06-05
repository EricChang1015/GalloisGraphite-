#!/usr/bin/env node
import { execCommand, withJumpSsh } from "./lib/ssh-jump.mjs";

await withJumpSsh({
  async onTarget(c) {
    for (const cmd of [
      "du -sh /var/lib/docker 2>/dev/null || echo 'docker dir: no access'",
      "du -sh /var/lib/docker/overlay2 2>/dev/null | head -1",
      "du -sh /var/lib/docker/volumes 2>/dev/null | head -1",
      "du -sh /var/lib/docker/containers 2>/dev/null | head -1",
      "du -sh /var/lib/docker/image 2>/dev/null | head -1",
      "docker volume ls",
      "docker volume inspect supabase_db-config 2>/dev/null | head -20",
      "sudo du -sh /var/lib/docker/volumes/* 2>/dev/null | sort -hr | head -10",
      "sudo du -sh /var/lib/docker/containers/*/*-json.log 2>/dev/null | sort -hr | head -10",
      "sudo du -xh --max-depth=1 /var 2>/dev/null | sort -hr | head -10",
      "sudo du -xh --max-depth=1 /usr 2>/dev/null | sort -hr | head -10",
      "sudo du -xh --max-depth=1 /home 2>/dev/null | sort -hr | head -5",
      "docker images --format '{{.Size}}' | sed 's/MB/ MB/;s/GB/ GB/' ; docker system df",
    ]) {
      console.log(`\n$ ${cmd.slice(0, 70)}...`);
      try {
        await execCommand(c, cmd);
      } catch (e) {
        console.log("(skipped:", e.message.split("\\n")[0], ")");
      }
    }
  },
});
