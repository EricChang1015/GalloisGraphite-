#!/usr/bin/env bash
# Host cron helper — daily payment schedule (replaces Vercel cron on self-host).
# Crontab example (04:00 UTC):
#   0 4 * * * /data/deploy/next/cron-payment-schedule.sh >> /data/logs/next/cron.log 2>&1
set -euo pipefail
ENV_FILE="/data/deploy/next/.env"
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "missing ${ENV_FILE}"
  exit 1
fi
# shellcheck disable=SC1090
source "${ENV_FILE}"
: "${CRON_SECRET:?CRON_SECRET missing in .env}"
curl -sf -H "x-cron-secret: ${CRON_SECRET}" \
  --resolve "uat.gf-v.io:443:127.0.0.1" \
  "https://uat.gf-v.io/api/cron/payment-schedule"
echo " cron OK $(date -u +%Y-%m-%dT%H:%M:%SZ)"
