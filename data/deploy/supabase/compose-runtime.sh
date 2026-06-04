#!/usr/bin/env bash
# Start / refresh app runtime only (no Studio, Analytics, imgproxy, pooler, edge).
set -euo pipefail
UPSTREAM="/data/deploy/supabase/upstream"
OVERRIDE="/data/deploy/supabase/docker-compose.override.yml"
cd "${UPSTREAM}"
docker compose -f docker-compose.yml -f "${OVERRIDE}" up -d --remove-orphans
echo "✓ Runtime stack up. Containers:"
docker compose -f docker-compose.yml -f "${OVERRIDE}" ps
