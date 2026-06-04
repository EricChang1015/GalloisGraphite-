# Self-Hosted Supabase — Phase 1 部署指南

> **Phase 1（已完成）**：Supabase 自建於 UAT VM（`uat.gf-v.io`），Next.js 仍跑 Vercel。  
> **Phase 2（待做）**：Next.js 同機部署至 `/data/deploy/next`，nginx 反代 App + Supabase API。  
> 詳見 [`ROADMAP.md` §E](./ROADMAP.md#e-基礎設施--自建-supabasephase-1-完成phase-2-進行中)。

**最後同步**：2026-06-02

---

## 1. 架構概覽（Phase 1）

```
                    ┌── Vercel ──────────────────┐
                    │  Next.js (galloisgraphite) │
                    └────────────┬───────────────┘
                                 │ HTTPS (Supabase JS client)
                                 ▼
Internet ──HTTPS──► proxy (nginx) ──► supabase-kong:8000
                         │                    │
                         │         auth / rest / storage / realtime
                         │                    │
                         └──────────── supabase-db (Postgres)
```

| 元件 | 位置 | 說明 |
|------|------|------|
| Next.js App | Vercel | Server Actions、AI `/api/chat`、Cron |
| Supabase API | UAT VM Docker | Auth / REST / Storage / Realtime |
| TLS | nginx `proxy` 容器 | 憑證在 server `conf.d/*.pem`（**不入 git**） |
| Postgres 資料 | `/data/data/postgres` | 持久化 volume |
| Storage 檔案 | `/data/data/storage` | 持久化 volume |

---

## 2. Repo 內 deploy 目錄

```
data/deploy/
├── supabase/
│   ├── bootstrap.sh                 # 首次 clone 官方 stack + compose up
│   ├── compose-runtime.sh           # 只跑 App runtime（預設）
│   ├── compose-dashboard.sh         # 開 Studio + 日誌
│   ├── compose-dashboard-stop.sh    # 關 Dashboard
│   ├── docker-compose.override.yml    # profiles + volume + Kong 依賴
│   ├── COMPOSE.md                   # Compose profiles 詳細說明
│   └── .env.uat.example             # server 端 UAT env 範本
└── proxy/
    ├── docker-compose.yml           # nginx，加入 supabase_default 網路
    └── conf.d/                      # upstream、locations、SSL 設定
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

## 7. App / Vercel env（Phase 1）

Vercel Production 或 Preview 指向 UAT 時：

```env
NEXT_PUBLIC_SUPABASE_URL=https://uat.gf-v.io
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from deploy:uat:status>
SUPABASE_SERVICE_ROLE_KEY=<from deploy:uat:status>
NEXT_PUBLIC_APP_URL=https://galloisgraphite.vercel.app
```

GoTrue / Google OAuth callback：`https://uat.gf-v.io/auth/v1/callback`

Server 端 GoTrue SMTP：在 `/data/deploy/supabase/.env.uat` 填入 AWS SES（與 App 相同 SMTP）。

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
| `scripts/ssh-uat-test-storage-upload.mjs` | Storage 上傳測試 |

---

## 10. Phase 1 完成檢查清單

- [x] UAT VM Supabase stack（runtime-only profile）
- [x] nginx TLS → Kong（`uat.gf-v.io`）
- [x] 30 migrations 已套用
- [x] Auth / REST / Storage / Realtime 驗證通過
- [x] Vercel App 可切換 `NEXT_PUBLIC_SUPABASE_URL` 至 UAT
- [ ] 正式環境前：regenerate JWT keys（勿沿用 demo keys）
- [ ] GoTrue SMTP + Google OAuth redirect 完整設定
- [ ] Phase 2：Next.js 同機部署（見 ROADMAP §E）

---

## 11. 常見問題

**Q: `SUPABASE_ACCESS_TOKEN` 自建能用嗎？**  
A: 不行。那是 Supabase Cloud Management API 專用。

**Q: Studio 怎麼開？**  
A: Server 上 `compose-dashboard.sh`，用 SSH tunnel 存取，勿公網暴露。

**Q: 如何切回 Cloud？**  
A: `.env.local` 把 `NEXT_PUBLIC_SUPABASE_URL` 改回 `*.supabase.co`，保留 UAT 變數加 `x` 前綴即可。

**Q:  destructive 操作？**  
A: 未經明確同意勿跑 `docker compose down -v` 或刪 `/data/data/postgres`。
