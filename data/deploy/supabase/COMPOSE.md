# Self-Hosted Supabase — Docker Compose

## 怎麼跑（目前架構）

```
Internet
   │
   ▼ HTTPS
proxy (nginx)  ──network: supabase_default──►  supabase-kong:8000
   │                                              │
   │                    ┌─────────────────────────┼─────────────────────────┐
   │                    ▼                         ▼                         ▼
   │               supabase-auth            supabase-rest              supabase-storage
   │               (GoTrue)               (PostgREST)                  (files)
   │                    │                         │                         │
   │                    └──────────── supabase-db (Postgres) ──────────────┘
   │                                         ▲
   │                                         │
   │                              realtime-dev.supabase-realtime (WebSocket)
   │
   └── Static files: /data/deploy/proxy/html
```

**工作目錄（server）：** `/data/deploy/supabase/upstream`

**啟動命令：**

```bash
cd /data/deploy/supabase/upstream
docker compose -f docker-compose.yml -f ../docker-compose.override.yml up -d --remove-orphans
```

**bootstrap（首次 / 更新設定）：**

```bash
bash /data/deploy/supabase/bootstrap.sh
```

**快捷腳本（server 上）：**

| 腳本 | 用途 |
|------|------|
| `compose-runtime.sh` | 只跑 App runtime（預設） |
| `compose-dashboard.sh` | 額外開 Studio + meta + analytics + vector |
| `compose-dashboard-stop.sh` | 關 Dashboard，runtime 繼續跑 |

```bash
bash /data/deploy/supabase/compose-runtime.sh
bash /data/deploy/supabase/compose-dashboard.sh      # 維運時
bash /data/deploy/supabase/compose-dashboard-stop.sh # 省 RAM
```

**本機一鍵部署：** `npm run deploy:uat:supabase`

---

## Profiles（預設 vs 可選）

| Profile | 容器 | 用途 | 約 RAM |
|---------|------|------|--------|
| **(default)** | db, kong, auth, rest, storage, realtime | **Mada Graphite App 必要** | ~0.9–1.1 GB |
| **dashboard** | analytics, vector, meta, studio | Supabase Studio 後台 | ~+1 GB |
| **imgproxy** | imgproxy | Storage 即時縮圖（本 App 未用） | ~+20 MB |
| **pooler** | supavisor | DB 連線池（與 host 5432 常衝突） | ~+50 MB |
| **edge** | functions | Edge Functions（MVP 未用） | ~+100 MB |

### 只跑 App runtime（預設，省 RAM）

```bash
cd /data/deploy/supabase/upstream
docker compose -f docker-compose.yml -f ../docker-compose.override.yml up -d --remove-orphans
```

### 開 Studio + 日誌（維運時）

```bash
docker compose -f docker-compose.yml -f ../docker-compose.override.yml \
  --profile dashboard up -d
```

Studio 預設只在 Docker 網路內；建議 SSH tunnel，不要公網暴露：

```bash
# 若需對外 port，可暫時在 override 加 studio ports（不建議 production）
ssh -L 54323:127.0.0.1:3000 user@server
# 再連 http://localhost:54323（視 studio 容器 port 而定）
```

### 關閉 Dashboard 服務

```bash
docker compose -f docker-compose.yml -f ../docker-compose.override.yml \
  --profile dashboard stop analytics vector meta studio
# 或 down 後只 up default（會 remove-orphans 清掉未在 compose 的容器）
docker compose -f docker-compose.yml -f ../docker-compose.override.yml up -d --remove-orphans
```

### 查看狀態 / RAM

```bash
docker compose -f docker-compose.yml -f ../docker-compose.override.yml ps
docker stats --no-stream
```

---

## 環境變數

| 檔案 | 位置 | 說明 |
|------|------|------|
| `.env` | `upstream/.env` | JWT、ANON/SERVICE keys、Postgres 密碼（`generate-keys.sh`） |
| `.env.uat` | `../.env.uat` | UAT URL、SMTP、Site URL（bootstrap 合併進 `.env`） |

App 端（Vercel / `.env.local`）只需：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ← `ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` ← `SERVICE_ROLE_KEY`

---

## Default runtime 容器清單

| 容器 | 對外 path（經 nginx） |
|------|----------------------|
| supabase-kong | `/auth/v1/` `/rest/v1/` `/storage/v1/` `/realtime/v1/` |
| supabase-auth | ← kong |
| supabase-rest | ← kong |
| supabase-storage | ← kong |
| realtime-dev.supabase-realtime | ← kong (WebSocket) |
| supabase-db | 僅 Docker 內網 |
| proxy | `:443` uat.gf-v.io |

---

## 常見問題

**Q: 為什麼官方 `docker compose up` 會起十幾個容器？**  
A: 官方預設包含 Studio + Analytics。本 repo 的 override 把 Dashboard 類服務收到 `--profile dashboard`。

**Q: 停掉 analytics 後 App 會壞嗎？**  
A: 不會。Analytics 只給 Logflare / Studio 日誌。

**Q: imgproxy 關了 Storage 還能用嗎？**  
A: 可以。我們用 signed URL 直接讀檔，不做即時 transform。

**Q: 如何 regenerate JWT keys？**  
A: 備份 DB 後刪 `upstream/.env`，重跑 `bootstrap.sh`，或手動 `sh utils/generate-keys.sh` 再 recreate 容器。
