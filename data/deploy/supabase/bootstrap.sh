#!/usr/bin/env bash
# Bootstrap self-hosted Supabase on UAT server.
# Run on server: bash /data/deploy/supabase/bootstrap.sh
set -euo pipefail

DEPLOY_ROOT="/data/deploy/supabase"
UPSTREAM="${DEPLOY_ROOT}/upstream"
OVERRIDE="${DEPLOY_ROOT}/docker-compose.override.yml"
ENV_UAT="${DEPLOY_ROOT}/.env.uat"
LOG_DIR="/data/logs/supabase"

echo "▸ Ensuring data directories..."
mkdir -p /data/data/postgres /data/data/storage "${LOG_DIR}" /data/deploy/proxy /data/deploy/next
chmod +x "${DEPLOY_ROOT}/bootstrap.sh" "${DEPLOY_ROOT}"/compose-*.sh 2>/dev/null || true

echo "▸ Checking Docker..."
if ! command -v docker >/dev/null 2>&1; then
  echo "✗ docker not found. Install Docker before continuing."
  exit 1
fi

echo "▸ Fetching official Supabase docker stack..."
if [[ ! -f "${UPSTREAM}/docker-compose.yml" ]]; then
  rm -rf /tmp/supabase-docker-fetch
  git clone --depth 1 --filter=blob:none --sparse https://github.com/supabase/supabase.git /tmp/supabase-docker-fetch
  (
    cd /tmp/supabase-docker-fetch
    git sparse-checkout set docker
  )
  rm -rf "${UPSTREAM}"
  mv /tmp/supabase-docker-fetch/docker "${UPSTREAM}"
  rm -rf /tmp/supabase-docker-fetch
fi

cd "${UPSTREAM}"

if [[ ! -f .env ]]; then
  echo "▸ Creating .env from example..."
  cp .env.example .env
  if [[ -f ./utils/generate-keys.sh ]]; then
    sh ./utils/generate-keys.sh
  else
    echo "✗ utils/generate-keys.sh missing — check upstream checkout."
    exit 1
  fi
fi

if [[ -f "${ENV_UAT}" ]]; then
  echo "▸ Applying UAT env overrides from ${ENV_UAT}..."
  while IFS= read -r line || [[ -n "${line}" ]]; do
    [[ -z "${line}" || "${line}" =~ ^[[:space:]]*# ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    if [[ -n "${key}" && -n "${val}" ]]; then
      if grep -q "^${key}=" .env; then
        sed -i "s|^${key}=.*|${key}=${val}|" .env
      else
        echo "${key}=${val}" >> .env
      fi
    fi
  done < "${ENV_UAT}"
fi

echo "▸ Pulling images (may take several minutes)..."
COMPOSE=(docker compose -f docker-compose.yml -f "${OVERRIDE}")
"${COMPOSE[@]}" pull

echo "▸ Starting Supabase runtime stack (default profile — no Studio/Analytics)..."
"${COMPOSE[@]}" up -d --remove-orphans

echo "▸ Optional: start Dashboard (Studio + Analytics) with:"
echo "    cd ${UPSTREAM} && docker compose -f docker-compose.yml -f ${OVERRIDE} --profile dashboard up -d"

echo "▸ Waiting for Kong health..."
for i in $(seq 1 30); do
  if docker exec supabase-kong kong health >/dev/null 2>&1; then
    echo "✓ Kong is healthy"
    break
  fi
  if [[ "${i}" -eq 30 ]]; then
    echo "⚠ Kong not healthy yet — check: docker compose -f docker-compose.yml -f ${OVERRIDE} ps"
    exit 1
  fi
  sleep 3
done

echo ""
echo "▸ API keys (add to Vercel / .env.local):"
grep -E '^(ANON_KEY|SERVICE_ROLE_KEY|POSTGRES_PASSWORD)=' .env | sed 's/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=***redacted***/'

echo ""
echo "✓ Supabase bootstrap complete."
echo "  Public URL: $(grep '^SUPABASE_PUBLIC_URL=' .env | cut -d= -f2-)"
echo "  Profiles: default=app runtime | --profile dashboard=Studio+logs"
echo "  Docs: ${DEPLOY_ROOT}/COMPOSE.md"
