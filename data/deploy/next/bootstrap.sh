#!/usr/bin/env bash
# Start / refresh mada-next (volume-mounted standalone — no docker build).
# Always recreate the container after a new standalone/ tarball lands on disk —
# `up -d` alone leaves the old Node process running (stale JS + broken public/).
set -euo pipefail
cd /data/deploy/next
docker compose pull --quiet 2>/dev/null || true
docker compose up -d --remove-orphans --force-recreate next
echo "✓ mada-next up:"
docker compose ps
