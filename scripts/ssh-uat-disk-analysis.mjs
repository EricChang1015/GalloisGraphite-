#!/usr/bin/env node
/* eslint-disable no-console */
/** Disk usage analysis on UAT VM via SSH jump. */
import { execCommand, withJumpSsh } from "./lib/ssh-jump.mjs";

await withJumpSsh({
  async onTarget(c) {
    console.log("=== df -h ===");
    await execCommand(c, "df -h / /data 2>/dev/null; df -h /");

    console.log("\n=== Top-level / (depth 1) ===");
    await execCommand(
      c,
      "sudo du -xh --max-depth=1 / 2>/dev/null | sort -hr | head -20",
    );

    console.log("\n=== /data breakdown ===");
    await execCommand(
      c,
      "du -xh --max-depth=3 /data 2>/dev/null | sort -hr | head -30",
    );

    console.log("\n=== Docker disk summary ===");
    await execCommand(c, "docker system df -v 2>/dev/null | head -80");

    console.log("\n=== Container log driver config ===");
    await execCommand(
      c,
      "docker ps --format '{{.Names}}' | while read n; do echo \"--- $n ---\"; docker inspect -f 'Log: {{.HostConfig.LogConfig.Type}} max-size={{index .HostConfig.LogConfig.Config \"max-size\"}} max-file={{index .HostConfig.LogConfig.Config \"max-file\"}}' \"$n\" 2>/dev/null; done",
    );

    console.log("\n=== Docker container log files on disk (top 15) ===");
    await execCommand(
      c,
      "sudo find /var/lib/docker/containers -name '*-json.log' -exec du -h {} + 2>/dev/null | sort -hr | head -15",
    );

    console.log("\n=== /var/log (top 15) ===");
    await execCommand(
      c,
      "sudo du -xh /var/log 2>/dev/null | sort -hr | head -15",
    );

    console.log("\n=== Journal size ===");
    await execCommand(
      c,
      "journalctl --disk-usage 2>/dev/null || echo 'journalctl N/A'",
    );

    console.log("\n=== Docker images (size) ===");
    await execCommand(
      c,
      "docker images --format 'table {{.Repository}}\\t{{.Tag}}\\t{{.Size}}' | head -25",
    );

    console.log("\n=== Dangling/unused docker ===");
    await execCommand(
      c,
      "echo -n 'Dangling images: '; docker images -f dangling=true -q | wc -l; echo -n 'Stopped containers: '; docker ps -aq -f status=exited | wc -l",
    );

    console.log("\n=== Postgres data size ===");
    await execCommand(
      c,
      "du -sh /data/data/postgres 2>/dev/null; du -sh /data/data/storage 2>/dev/null",
    );

    console.log("\n=== RAM / containers ===");
    await execCommand(
      c,
      "free -h; echo '---'; docker stats --no-stream --format 'table {{.Name}}\\t{{.MemUsage}}\\t{{.CPUPerc}}' 2>/dev/null",
    );
  },
});

console.log("\n✓ Disk analysis complete.");
