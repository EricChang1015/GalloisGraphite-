#!/usr/bin/env bash
# Start Dashboard ops stack (Studio + meta + analytics + vector).
# Requires runtime stack already running.
set -euo pipefail
UPSTREAM="/data/deploy/supabase/upstream"
OVERRIDE="/data/deploy/supabase/docker-compose.override.yml"
cd "${UPSTREAM}"
docker compose -f docker-compose.yml -f "${OVERRIDE}" --profile dashboard up -d
echo "✓ Dashboard profile up. Containers:"
docker compose -f docker-compose.yml -f "${OVERRIDE}" --profile dashboard ps
