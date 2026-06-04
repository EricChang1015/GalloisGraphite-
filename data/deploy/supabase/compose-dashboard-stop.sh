#!/usr/bin/env bash
# Stop Dashboard ops stack; runtime (Kong/Auth/DB/…) keeps running.
set -euo pipefail
UPSTREAM="/data/deploy/supabase/upstream"
OVERRIDE="/data/deploy/supabase/docker-compose.override.yml"
cd "${UPSTREAM}"
docker compose -f docker-compose.yml -f "${OVERRIDE}" --profile dashboard stop analytics vector meta studio 2>/dev/null || true
echo "✓ Dashboard services stopped."
