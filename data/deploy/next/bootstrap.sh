#!/usr/bin/env bash
# Start / refresh mada-next (volume-mounted standalone — no docker build).
set -euo pipefail
cd /data/deploy/next
docker compose pull --quiet 2>/dev/null || true
docker compose up -d --remove-orphans
echo "✓ mada-next up:"
docker compose ps
