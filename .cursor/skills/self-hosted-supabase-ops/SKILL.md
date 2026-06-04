---
name: self-hosted-supabase-ops
description: Operates the self-hosted Supabase VM on UAT/production via SSH jump (io proxy → SELF_HOST_SUPABASE). Use when deploying, migrating, restarting, debugging, or inspecting data/deploy/supabase, uat.gf-v.io, self-host Supabase, or SELF_HOST_SUPABASE_* env vars.
---

# Self-Hosted Supabase VM Operations

## When to use

Load this skill **before any task** that touches:

- `data/deploy/supabase/` or `data/deploy/proxy/`
- UAT domain (`uat.gf-v.io`) or future self-host API domain
- Remote Postgres / Storage / Kong / Auth on the VM
- User says「自建 Supabase」「self-host」「UAT server」「SSH proxy」

**Do not** use Supabase Cloud Management API (`SUPABASE_ACCESS_TOKEN`, `api.supabase.com`) for the self-hosted VM. Use SSH + project scripts instead.

## Credentials (local only)

Read from **`.env.local`** (gitignored). Required keys:

| Variable | Purpose |
|---|---|
| `SSH_PROXY_HOST` | Jump host (e.g. `io.aspectgaming.com`) |
| `SSH_PROXY_ACCOUNT` / `SSH_PROXY_PASSWORD` | Jump SSH login |
| `SELF_HOST_SUPABASE_HOST` | Target VM hostname (e.g. `uat.gf-v.io`) |
| `SELF_HOST_SUPABASE_ACCOUNT` / `SELF_HOST_SUPABASE_PASSWORD` | Target SSH login |

**Rules:**

1. Never commit passwords or paste them into chat responses.
2. Never add real secrets to `.env.example` or repo files.
3. Prefer existing scripts (`scripts/lib/ssh-jump.mjs`) over ad-hoc SSH commands.
4. If keys are missing, tell the user to fill `.env.local` — do not invent credentials.

## How the agent connects

```
Local (Cursor) ──SSH──► SSH_PROXY (io) ──SSH──► SELF_HOST_SUPABASE VM
                              │
                              └── All remote ops run ON the target VM
```

Implementation: `scripts/lib/ssh-jump.mjs` → `withJumpSsh({ onTarget })` using `ssh2` + `forwardOut` (ProxyJump-style).

**Always verify connectivity first:**

```powershell
npm run deploy:uat:check
```

## Server layout

```
/data/
├── data/postgres/          # Postgres data (persistent)
├── data/storage/           # Supabase Storage files
├── deploy/
│   ├── supabase/
│   │   ├── bootstrap.sh
│   │   ├── docker-compose.override.yml
│   │   ├── .env.uat          # gitignored on server; merged into upstream/.env
│   │   └── upstream/         # official supabase/docker (cloned on server)
│   ├── proxy/                # nginx + TLS → Kong on Docker network
│   └── next/                 # Phase 2: Next.js (not yet)
└── logs/supabase/
```

## Architecture (UAT)

- **Public HTTPS**: `https://uat.gf-v.io` → nginx container → `supabase-kong:8000` on network `supabase_default`
- **Kong has no host port** (avoids 8000 conflicts); nginx joins `supabase_default`
- **Supavisor disabled** (avoids 5432 conflicts with other Postgres on VM)
- **Edge Functions disabled** (MVP not used)
- **Phase 1**: Next.js stays on Vercel; only Supabase is self-hosted

## Docker Compose profiles

Override: `data/deploy/supabase/docker-compose.override.yml`  
Full doc: `data/deploy/supabase/COMPOSE.md`

| Profile | Services | When |
|---|---|---|
| **(default)** | db, kong, auth, rest, storage, realtime | Always — Mada Graphite app |
| **dashboard** | analytics, vector, meta, studio | Ops / Studio / logs (~+1 GB RAM) |
| **imgproxy** | imgproxy | Optional image transforms (app unused) |
| **pooler** | supavisor | Optional; often conflicts with host :5432 |
| **edge** | functions | MVP unused |

**Server commands** (from `/data/deploy/supabase/upstream`):

```bash
# Runtime only (default)
bash /data/deploy/supabase/compose-runtime.sh

# Add Studio + logs
bash /data/deploy/supabase/compose-dashboard.sh

# Stop dashboard, keep runtime
bash /data/deploy/supabase/compose-dashboard-stop.sh
```

Or manually:

```bash
docker compose -f docker-compose.yml -f ../docker-compose.override.yml up -d --remove-orphans
docker compose -f docker-compose.yml -f ../docker-compose.override.yml --profile dashboard up -d
```

After updating override locally, run `npm run deploy:uat:supabase` then `compose-runtime.sh` on server to drop orphaned dashboard containers.

## npm commands (run from repo root)

| Command | Action |
|---|---|
| `npm run deploy:uat:check` | SSH jump + `docker --version` + disk |
| `npm run deploy:uat:supabase` | Upload `data/deploy/supabase`, run `bootstrap.sh`, upload proxy, restart nginx |
| `npm run deploy:uat:proxy` | Upload + restart nginx only |
| `npm run deploy:uat:migrate` | Apply `supabase/migrations/*.sql` via `docker exec supabase-db psql` |
| `npm run deploy:uat:migrate:status` | List pending/applied migrations on UAT |
| `npm run deploy:uat:status` | Container health + `/auth/v1/health` + print API keys for Vercel |
| `npm run deploy:uat:compose` | Upload override + apply runtime-only stack (no bootstrap pull) |
| `npm run deploy:uat:migrate-cloud` | Cloud → UAT data migration (if script present) |

## Standard workflows

### Deploy / update stack

1. `npm run deploy:uat:check`
2. Edit files under `data/deploy/` locally
3. `npm run deploy:uat:supabase` (or `--proxy-only` if only nginx changed)
4. `npm run deploy:uat:status` — expect Kong healthy + auth health **HTTP 200**

### Apply new SQL migrations

1. Add migration under `supabase/migrations/` (follow `.cursor/rules/migrations.mdc`)
2. `npm run deploy:uat:migrate:status`
3. `npm run deploy:uat:migrate`
4. Re-verify with status script

**Do not** use `npm run db:migrate` against self-host unless `apply-migrations.mjs` has been extended with `DATABASE_URL` — default runner uses Cloud Management API only.

### Inspect / debug remotely

Use `withJumpSsh` in a small one-off script or extend `scripts/ssh-uat-status.mjs`. Common checks:

```bash
docker ps --filter name=supabase
docker exec supabase-kong kong health
docker logs proxy --tail 50
docker logs supabase-auth --tail 50
```

For DB queries:

```bash
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT ..."
```

### Custom remote command pattern

```javascript
import { withJumpSsh, execCommand } from "./scripts/lib/ssh-jump.mjs";

await withJumpSsh({
  async onTarget(conn) {
    await execCommand(conn, "docker ps");
  },
});
```

## Vercel / app env (Phase 1)

After deploy, set on Vercel (and redeploy):

```env
NEXT_PUBLIC_SUPABASE_URL=https://uat.gf-v.io
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from deploy:uat:status>
SUPABASE_SERVICE_ROLE_KEY=<from deploy:uat:status>
NEXT_PUBLIC_APP_URL=https://galloisgraphite.vercel.app
```

Google OAuth redirect: `https://uat.gf-v.io/auth/v1/callback`

Run `npm run deploy:uat:status` to print keys — **never log full keys in user-facing summaries**; tell user to run the command locally.

## Known constraints

| Issue | Mitigation |
|---|---|
| Port 5432 taken on VM | Supavisor profile disabled in override |
| Port 8000 taken on VM | Kong only on Docker network; nginx proxies internally |
| nginx crash on startup | Use `conf.d/upstream.conf` with `resolve`; resolver in `nginx.conf` http {} |
| Migration file not in container | Pipe SQL: `cat file \| docker exec -i supabase-db psql ...` (see `migrate-uat-supabase.mjs`) |
| Demo JWT keys in `.env` | Fresh install: wipe `/data/data/postgres`, delete `upstream/.env`, rerun bootstrap |
| Studio | Not public; use SSH tunnel if needed |

## What not to do

- Do not expose Postgres 5432 to the public internet.
- Do not commit `*.pem`, `*.key`, `.env.uat`, or `data/deploy/supabase/upstream/`.
- Do not run destructive `docker compose down -v` without explicit user approval.
- Do not assume Cloud project ref URLs (`*.supabase.co`) on self-host.

## Related docs

- [`docs/DEPLOY_SELFHOST.md`](../../../docs/DEPLOY_SELFHOST.md) — Phase 1 deploy guide
- [`data/deploy/supabase/COMPOSE.md`](../../../data/deploy/supabase/COMPOSE.md) — Compose profiles
- App Supabase client rules: `.cursor/rules/supabase.mdc`
- SQL migrations: `.cursor/rules/migrations.mdc`
- Env template: `.env.example` (SSH + Supabase sections)
