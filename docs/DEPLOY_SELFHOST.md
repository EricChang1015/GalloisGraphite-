# Self-Hosted Supabase + Next.js — UAT 部署指南

> **Phase 1（已完成）**：Supabase 自建於 UAT VM（`uat.gf-v.io`）。  
> **Phase 2（已完成 2026-06-04）**：Next.js 同機部署至 `/data/deploy/next`，`https://uat.gf-v.io/` 為完整 App。  
> 詳見 [`ROADMAP.md` §E](./ROADMAP.md#e-基礎設施--自建-uat)。

**最後同步**：2026-06-05

---

## 1. 架構概覽（Phase 2 — 現況）

```
Internet ──HTTPS──► proxy (nginx) ──┬──► mada-next:3000     (Next.js App, /, /login, …)
                                    ├──► supabase-kong:8000 (Auth / REST / Storage / Realtime)
                                    └──► supabase-db + /data/data/storage
```

| 元件 | 容器 | 說明 |
|------|------|------|
| Next.js App | `mada-next` | `node:22-alpine` + volume 掛載 `standalone/`（**每次 deploy 不 rebuild image**） |
| Supabase API | kong + auth + rest + storage + realtime | runtime-only profile |
| TLS | `proxy` | 憑證在 server `conf.d/*.pem`（**不入 git**） |
| Postgres | `supabase-db` | `/data/data/postgres` |
| Storage 檔案 | `supabase-storage` | `/data/data/storage` |

**對外 URL**：`https://uat.gf-v.io` — App 與 Supabase API 同域。

---

## 2. Repo 內 deploy 目錄

```
data/deploy/
├── supabase/
│   ├── bootstrap.sh
│   ├── compose-runtime.sh / compose-dashboard.sh / compose-dashboard-stop.sh
│   ├── docker-compose.override.yml
│   ├── COMPOSE.md
│   └── .env.uat.example
├── proxy/
│   ├── docker-compose.yml
│   └── conf.d/                      # upstream、locations、studio-locations、next-studio-map
└── next/
    ├── docker-compose.yml           # node:22-alpine + volume ./standalone
    ├── bootstrap.sh                 # pull + up（不 build image）
    ├── Dockerfile                   # 選用；預設 deploy 不用
    ├── cron-payment-schedule.sh
    └── .env.example
```

**Server 端（不入 git）**

| 路徑 | 內容 |
|------|------|
| `/data/deploy/supabase/upstream/` | 官方 `supabase/supabase` docker 克隆 |
| `/data/deploy/supabase/.env.uat` | UAT URL、SMTP 覆寫 |
| `/data/deploy/supabase/upstream/.env` | JWT、ANON/SERVICE keys |
| `/data/deploy/proxy/conf.d/*.pem` | TLS 憑證 |

---

## 3. 本機前置（`.env.local`）

```env
# SSH jump → UAT VM（僅 deploy 腳本使用，勿 commit）
SSH_PROXY_HOST=io.aspectgaming.com
SSH_PROXY_ACCOUNT=...
SSH_PROXY_PASSWORD=...
SELF_HOST_SUPABASE_HOST=uat.gf-v.io
SELF_HOST_SUPABASE_ACCOUNT=...
SELF_HOST_SUPABASE_PASSWORD=...

# App 連 UAT Supabase（測試時切換；Cloud 變數可加 x 前綴保留）
NEXT_PUBLIC_SUPABASE_URL=https://uat.gf-v.io
NEXT_PUBLIC_SUPABASE_ANON_KEY=<deploy:uat:status>
SUPABASE_SERVICE_ROLE_KEY=<deploy:uat:status>
```

完整範本見 [`.env.example`](../.env.example) 底部 SSH 區塊。

---

## 4. npm 指令（repo root）

| 指令 | 用途 |
|------|------|
| `npm run deploy:uat:check` | SSH 連線 + docker 探測 |
| `npm run deploy:uat:supabase` | 上傳 deploy 樹 + bootstrap + 重啟 proxy |
| `npm run deploy:uat:compose` | **僅**上傳 override 並套用 runtime-only（不做 pull） |
| `npm run deploy:uat:next` | 本機 `npm run build` → 上傳 ~7MB tarball → **`--force-recreate` 容器**（不 rebuild Docker image） |
| `npm run deploy:uat:next -- --skip-build` | 略過 build，只上傳現有 `.next/standalone` |
| `npm run deploy:uat:next -- --next-only` | 只更新 Next.js，不重啟 nginx |
| `npm run deploy:uat:next -- --sync-auth-env` | 順便 patch GoTrue `SITE_URL`（預設不做） |
| `node scripts/compose-uat-dashboard.mjs` | 開 Studio dashboard profile |
| `node scripts/ssh-uat-grow-rootfs.mjs` | AWS 擴 EBS 後延伸 root 分割區 |
| `npm run deploy:uat:proxy` | 只更新 nginx |
| `npm run deploy:uat:migrate` | 套用 `supabase/migrations/*.sql` |
| `npm run deploy:uat:migrate:status` | 遠端 migration 狀態 |
| `npm run deploy:uat:status` | 健康檢查 + 印 API keys |
| `npm run deploy:uat:migrate-cloud` | Cloud → UAT 資料遷移（選用） |

**Agent 工作流**： [`.cursor/skills/self-hosted-supabase-ops/SKILL.md`](../.cursor/skills/self-hosted-supabase-ops/SKILL.md)

---

## 5. Docker Compose profiles

預設只跑 **6 個 Supabase 容器**（約 1 GB RAM）：

| 容器 | 用途 |
|------|------|
| supabase-db | Postgres |
| supabase-kong | API Gateway |
| supabase-auth | GoTrue |
| supabase-rest | PostgREST |
| supabase-storage | 檔案 |
| realtime-dev.supabase-realtime | WebSocket |

| Profile | 額外容器 | 何時開 |
|---------|----------|--------|
| **dashboard** | analytics, vector, meta, studio | 維運 / Studio（+~1 GB） |
| **imgproxy** | imgproxy | App 未用，預設關 |
| **pooler** | supavisor | 常與 host :5432 衝突，預設關 |
| **edge** | functions | MVP 未用 |

Server 快捷指令：

```bash
bash /data/deploy/supabase/compose-runtime.sh
bash /data/deploy/supabase/compose-dashboard.sh
bash /data/deploy/supabase/compose-dashboard-stop.sh
```

詳見 [`data/deploy/supabase/COMPOSE.md`](../data/deploy/supabase/COMPOSE.md)。

---

## 5.1 Next.js 部署（`deploy:uat:next`）

**流程（本機 Windows → UAT Linux）：**

1. 本機 `npm run build`（`output: "standalone"`）
2. 打包 `standalone/`（含 `.next/static`、`public`）→ tarball **~7MB**
3. SSH 上傳至 `/data/deploy/next/standalone/`
4. `docker compose up -d --force-recreate next` — **不 rebuild Docker image**（必須 recreate，否則舊 Node 進程不會載入新 `standalone/`）

**容器模型：** 固定映像 `node:22-alpine`，build 產物以 **volume 掛載** `./standalone:/app:ro`。

**Windows 注意：** standalone 內 `sharp` 等 symlink 需 `dereference` 複製（腳本已處理 EPERM）。

**典型日常發布（改一頁後）：**

```powershell
npm run deploy:uat:next -- --skip-build --next-only
```

---

## 5.2 Supabase Studio（辦公室 IP）

Dashboard profile 開啟後，nginx 白名單路徑（`studio-locations.cfg`）：

- 允許 IP：`202.175.105.50`、`52.229.168.52`
- URL：**https://uat.gf-v.io/studio/**
- App 與 Studio 共用 `/_next/static/` 時，由 `next-studio-map.conf` 依 Referer 分流

備用：SSH tunnel → `http://localhost:54323`（server `127.0.0.1:54323`）

---

## 6. Migrations

| 環境 | 指令 | 機制 |
|------|------|------|
| Supabase Cloud | `npm run db:migrate` | Management API + `SUPABASE_ACCESS_TOKEN` |
| Self-host UAT | `npm run deploy:uat:migrate` | SSH → `docker exec supabase-db psql` |

**不要**對自建 VM 使用 `db:migrate`（除非已擴充 `DATABASE_URL` 模式）。

新增 migration 流程：

1. 在 `supabase/migrations/` 新增 SQL（見 `.cursor/rules/migrations.mdc`）
2. Cloud：`npm run db:migrate`
3. UAT：`npm run deploy:uat:migrate`

---

## 7. App env（UAT 同域）

Server `/data/deploy/next/.env`（由 `deploy:uat:next` 從 `.env.local` 產生）：

```env
NEXT_PUBLIC_SUPABASE_URL=https://uat.gf-v.io
NEXT_PUBLIC_APP_URL=https://uat.gf-v.io
APP_URL=https://uat.gf-v.io
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
# + POE / SMTP / CRON_SECRET / PLATFORM_* …
```

`APP_URL` 僅在 server runtime 讀取（`src/lib/app-url.ts`），避免 Next build 內嵌 localhost 導致 OAuth redirect 錯誤。

GoTrue `SITE_URL` 需與 App 同域時，使用 `npm run deploy:uat:next -- --sync-auth-env`（merge 進 `upstream/.env` 並 recreate auth）。

### 7.1 Google OAuth（自建 GoTrue）

與 Supabase Cloud Dashboard 不同，自建需手動把 Google 憑證傳入 GoTrue：

1. **Google Cloud Console** → Credentials → OAuth 2.0 Client (Web)  
   Authorized redirect URI：`https://uat.gf-v.io/auth/v1/callback`
2. **本機 `.env.local`**（勿 commit）：`GOOGLE_CLIENT_ID`、`GOOGLE_SECRET`（可選 `GOOGLE_ENABLED=true`）
3. **部署**：`npm run deploy:uat:oauth`  
   - 上傳 `docker-compose.override.yml`（auth 服務 `GOTRUE_EXTERNAL_GOOGLE_*` passthrough）  
   - merge `.env.uat` → `upstream/.env`  
   - recreate `supabase-auth`  
   - 驗證：`curl https://uat.gf-v.io/auth/v1/settings` → `"google":true`
4. **Next.js**：`npm run deploy:uat:next`（含 `APP_URL`、callback route handler）

**OAuth 登入鏈路**：Google → GoTrue `/auth/v1/callback` → App `/auth/callback?code=...` → `exchangeCodeForSession` → `/dashboard`

**Cron（payment schedule）**：host crontab 呼叫 `/data/deploy/next/cron-payment-schedule.sh`（04:00 UTC）。

---

## 8. 驗證（smoke）

```powershell
npm run deploy:uat:status
node scripts/smoke-supabase-connectivity.mjs
node scripts/smoke-selfhost-auth.mjs
npm run build
```

| 測試 | Self-host 可用？ |
|------|------------------|
| `smoke-supabase-connectivity` | ✅ |
| `smoke-selfhost-auth` | ✅ |
| `npm run build` | ✅ |
| `npm run qa:preflight` / `qa:verify-rls` | ❌ 需 Cloud `SUPABASE_ACCESS_TOKEN` |

---

## 9. 除錯腳本（選用）

| 腳本 | 用途 |
|------|------|
| `scripts/ssh-uat-probe.mjs` | 檢查 port / 容器 |
| `scripts/ssh-uat-debug-storage.mjs` | Storage 路由與 log |
| `scripts/ssh-uat-debug-studio.mjs` | Studio（需 `--profile dashboard`） |
| `scripts/ssh-uat-verify-data.mjs` | 遠端資料抽查 |
| `scripts/ssh-uat-debug-next.mjs` | Next.js + nginx 健康 |
| `scripts/ssh-uat-grow-rootfs.mjs` | EBS 擴容後延伸 ext4 |

---

## 10. 完成檢查清單

- [x] UAT VM Supabase stack（runtime-only profile）
- [x] nginx TLS → Kong + mada-next
- [x] Next.js 於 `https://uat.gf-v.io/`（home/login HTTP 200）
- [x] 30 migrations 已套用
- [x] Auth / REST / Storage / Realtime smoke
- [x] `npm run deploy:uat:next` 一鍵部署
- [ ] Host crontab 設定 payment-schedule cron
- [ ] Regenerate JWT keys（勿沿用 demo keys）
- [x] GoTrue Google OAuth（`deploy:uat:oauth` + UAT 人工驗證 2026-06-08）
- [ ] GoTrue SMTP 完整設定

---

## 11. 常見問題

**Q: `SUPABASE_ACCESS_TOKEN` 自建能用嗎？**  
A: 不行。那是 Supabase Cloud Management API 專用。

**Q: Studio 怎麼開？**  
A: `node scripts/compose-uat-dashboard.mjs` 或 server 上 `compose-dashboard.sh`。辦公室 IP 可開 **https://uat.gf-v.io/studio/**；其餘 IP 用 SSH tunnel `http://localhost:54323`。

**Q: 如何切回 Cloud？**  
A: `.env.local` 把 `NEXT_PUBLIC_SUPABASE_URL` 改回 `*.supabase.co`，保留 UAT 變數加 `x` 前綴即可。

**Q: Google 登入後 `/auth/callback` 502 或 nginx `upstream sent too big header`？**  
A: OAuth 成功後 GoTrue/Next 會回傳多個大型 `Set-Cookie`（chunked session）。預設 nginx `proxy_buffer_size` 4k 不足。確認 `data/deploy/proxy/conf.d/proxy.cfg` 已設 `proxy_buffer_size 128k`，且 `nginx.conf` 的 `http {}` 內有 `large_client_header_buffers 8 32k`（不可放在 `proxy.cfg`）。然後 `npm run deploy:uat:proxy`。

**Q: 登入後跳到 `0.0.0.0:3000` 或 `login?error=oauth_failed`？**  
A: 確認 server `/data/deploy/next/.env` 有 `APP_URL=https://uat.gf-v.io`；callback 須用 `createRouteHandlerClient` 把 session cookie 寫入同一個 redirect response（見 `src/lib/supabase/route-handler.ts`）。

**Q:  destructive 操作？**  
A: 未經明確同意勿跑 `docker compose down -v` 或刪 `/data/data/postgres`。
