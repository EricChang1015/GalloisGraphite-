#!/usr/bin/env bash
# Build and start mada-next container (expects build context already uploaded).
set -euo pipefail
cd /data/deploy/next
docker compose up -d --build --remove-orphans
echo "✓ mada-next up:"
docker compose ps
