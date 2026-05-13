# Database Schema

> 對應 SQL 在 [`supabase/migrations/`](../supabase/migrations/)。
> 此文件以「中文 + 設計理由」描述 schema,方便 AI agent 與工程師對齊。
>
> **注意**：001_init.sql 與目前代碼實際使用的欄位有部分差異，已由
> [`005_align_payments_and_news.sql`](../supabase/migrations/005_align_payments_and_news.sql)
> 修正。本文件描述的是 **執行完所有 migration 後的最終 schema**。

## Migration 順序

| 檔案 | 內容 |
|---|---|
| `001_init.sql` | 全部 enum / table / RLS / Realtime publication / 預設 3 個 categories seed |
| `002_seed_first_admin.sql` | 指引 — 手動把第一個帳號 promote 為 super_admin |
| `003_seed_categories.sql` | 12 個標準 grade（MADA1/MADA2 × 6 mesh）+ Custom Grade |
| `004_news_schema_update.sql` | `news` 加 `slug` / `content_html` / `cover_image_url` / `created_at` + 索引 |
| `005_align_payments_and_news.sql` | 對齊實際代碼：`payments.payer_id → buyer_id`、加 `admin_note/reviewed_by/reviewed_at`、`news.author_id`、`orders.updated_at` + trigger |
| `006_ai_chat_logs.sql` | AI chat 稽核日誌（session_id / IP / geo / user-agent + admin-only RLS） |
| `007_oauth_profile_handling.sql` | `handle_new_user` 支援 Google OAuth：fallback meta.name；`email_confirmed_at` 已設則 status 直接 `'active'` |
| `006_ai_chat_logs.sql` | 新增 `ai_chat_logs` audit table（session_id / IP / geo / UA / role / content）+ admin-only RLS |

---

## 1. 用戶與權限

### `auth.users`(Supabase 內建)
- 由 Supabase Auth 管理,不直接動。

### `profiles`
延伸 `auth.users`,儲存業務資料。

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid PK | 對應 `auth.users.id` |
| email | text | 同 auth.users(冗餘以便聯結) |
| full_name | text | 聯絡人姓名 |
| company_name | text | 公司名 |
| country | text | ISO 國別碼 |
| phone | text | 含國碼 |
| role | enum `user_role` | buyer / seller / admin / super_admin |
| status | enum `user_status` | pending / active / frozen |
| kyc_level | int | 0=email only, 1=企業文件已上傳, 2=超管驗證 |
| kyc_docs | jsonb | 上傳憑證 URL 列表 |
| created_at / updated_at | timestamptz | |

設計理由:把 auth 與業務分離,RLS 易控制;super_admin 一律手動在 SQL 設定。

**Trigger**：
- `on_auth_user_created` → `handle_new_user()`：新註冊自動 insert 一筆 profile
  - **007 後行為**：讀 `raw_user_meta_data`，`full_name` fallback 到 `name`（Google ID token 用此 key）；`company_name` / `country` 缺漏視為空字串；`role` 預設 `'buyer'`
  - 若 `auth.users.email_confirmed_at` 已非 null（OAuth 流程），直接落 `status='active'`；否則 `'pending'` 等 email 驗證
- `on_auth_user_email_confirmed` → `handle_user_email_confirmed()`：email 驗證後（UPDATE 觸發）status='active'。OAuth 流程因 INSERT 時 status 已 active，此 trigger 不會再觸發

## 2. 商品

### `product_categories`
平台可交易品類,由超管管理。

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid PK | |
| name | text UNIQUE | e.g. "MADA1 — +80 Mesh" |
| description | text | |
| spec_schema | jsonb | 描述該品類規格欄位的 schema |
| is_active | bool | 下架時設 false |
| created_at | timestamptz | |

`spec_schema` 範例（用於前端動態渲染欄位）:
```json
{
  "fixed_carbon": {"type": "string", "label": "Fixed Carbon (%)", "placeholder": "e.g. 94–96"},
  "mesh_size":    {"type": "string", "label": "Mesh Size",         "placeholder": "+80MESH"},
  "moisture":     {"type": "string", "label": "Moisture",          "placeholder": "0.5% MAX"},
  "brand":        {"type": "string", "label": "Brand",             "placeholder": "MADA1"}
}
```

預設 13 個 category 由 `003_seed_categories.sql` 載入：
MADA1 / MADA2 × {+35, +50, +80, +100, +150, -100} mesh + Custom Grade。

### `listings`
賣家上貨。

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid PK | |
| seller_id | uuid FK profiles | |
| category_id | uuid FK product_categories | |
| title | text | |
| specs | jsonb | 該批次的具體規格(允許優於 schema) |
| quantity | numeric(18,3) | |
| unit | text | MT / KG (預設 MT) |
| origin_location | text | e.g. "Toamasina, Madagascar" |
| available_from / available_to | date | 可出貨時間區間 |
| unit_price | numeric(18,4) | |
| currency | text | USDT / USD / EUR (MVP 主用 USDT) |
| incoterm | text | CFR / FOB / CIF |
| description | text | |
| images | jsonb | URL 列表 |
| status | enum `listing_status` | active / paused / sold_out |
| created_at | timestamptz | |

索引：`(category_id, status)`, `(seller_id)`

## 3. 詢價與訂單

### `inquiries`
買家詢價;一次詢價對應一個 listing(可選)。

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid PK | |
| buyer_id | uuid FK profiles | |
| seller_id | uuid FK profiles | |
| listing_id | uuid FK listings | 可空(直接以 category 詢價) |
| category_id | uuid FK product_categories | |
| requested_qty | numeric(18,3) | |
| target_price | numeric(18,4) | 可空 |
| destination | text | 目的地港/城市 |
| message | text | |
| status | enum `inquiry_status` | pending / accepted / rejected / converted |
| created_at | timestamptz | |

索引：`(buyer_id)`, `(seller_id)`

### `orders`
核心交易實體。

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid PK | |
| order_no | text UNIQUE | `ORD-YYMMDD-xxxxxx`,自動生成 |
| buyer_id / seller_id | uuid FK profiles | |
| listing_id | uuid FK listings | |
| inquiry_id | uuid FK inquiries | nullable |
| quantity | numeric(18,3) | |
| unit_price | numeric(18,4) | |
| total_amount | numeric(18,4) | quantity × unit_price (應用層計算) |
| currency | text | |
| destination | text | |
| shipment_from | text | 賣家更新 |
| shipment_eta | date | |
| status | enum `order_status` | 見下表 |
| timeline | jsonb | append-only 事件列表 |
| created_at / updated_at | timestamptz | `updated_at` 由 005 加入 trigger 自動維護 |

索引：`(buyer_id, status)`, `(seller_id, status)`

`order_status` 狀態機（完整定義見 `src/lib/order/stateMachine.ts`）:
```
draft → contract_generated → signed
  → payment_pending → paid → shipped → delivered → completed
任何節點 → disputed / cancelled
disputed → cancelled / completed
```

`timeline` 事件 schema:
```json
{
  "event": "contract_generated",
  "at": "2026-05-08T12:00:00Z",
  "by": "<user_uuid>",
  "from": "draft",
  "to": "contract_generated",
  "data": { "...": "..." }
}
```

## 4. 合約

### `contracts`
一張訂單對一份合約(unique)。

| 欄位 | 說明 |
|---|---|
| id | uuid PK |
| order_id | unique FK orders ON DELETE CASCADE |
| contract_no | 合約編號 e.g. `CNT-ORD-260508-abc123` |
| content_html | 渲染好的 HTML（供列印；MVP 用 `window.print()` 出 PDF） |
| pdf_url | 產生 PDF 後的 Storage URL（MVP 可空） |
| buyer_signed_url / seller_signed_url | 雙方簽名掃描檔 URL（在 `contracts` bucket） |
| buyer_signed_at / seller_signed_at | timestamps |
| created_at / updated_at | timestamptz |

## 5. 付款

### `payments`
人工審核制。

> ⚠️ 實際欄位（005 修正後）— 與 001_init.sql 原始定義不同。

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid PK | |
| order_id | uuid FK orders ON DELETE CASCADE | |
| **buyer_id** | uuid FK profiles | 005 從 `payer_id` rename；通常是 buyer，例外情境（出口退稅等）後續再改 schema |
| method | enum `payment_method` | usdt_trc20 / usdt_erc20 / usdi / mup / bank_transfer |
| amount | numeric(18,4) | |
| currency | text | |
| tx_hash | text | crypto 必填,bank 可空 |
| proof_url | text | bank 必填,crypto 可空 |
| note | text | buyer 留言 |
| status | enum `payment_status` | pending / verified / rejected |
| **admin_note** | text | 005 新增：admin 審核時的回覆 |
| **reviewed_by** | uuid FK profiles | 005 新增（取代 verified_by） |
| **reviewed_at** | timestamptz | 005 新增（取代 verified_at） |
| created_at | timestamptz | |

索引：`(order_id, status)`

## 6. 即時通訊

### `chat_rooms` / `chat_members` / `messages`
每張 order 對應一個 chat_room (type='order'),admin 可選加入。

`messages` 用 Supabase Realtime 訂閱,`postgres_changes` event。

| chat_rooms 欄位 | 說明 |
|---|---|
| id | uuid PK |
| type | enum `chat_type` | order / support / ai |
| order_id | FK orders ON DELETE CASCADE | nullable（support / ai 不綁訂單） |
| created_at | timestamptz |

| chat_members 欄位 | 說明 |
|---|---|
| room_id | FK chat_rooms ON DELETE CASCADE |
| user_id | FK profiles ON DELETE CASCADE |
| (PK = room_id, user_id) | |
| joined_at | timestamptz |

| messages 欄位 | 說明 |
|---|---|
| id | uuid PK |
| room_id | FK chat_rooms ON DELETE CASCADE |
| sender_id | FK profiles |
| content | text(可空,純圖片訊息) |
| attachment_url | text(`chat` bucket Storage URL) |
| created_at | timestamptz |

索引：`messages(room_id, created_at desc)`

> ⚠️ 表結構就緒，但 `OrderChat` 組件、自動建房邏輯、`/messages` 列表頁待實作（見 ROADMAP §A2）。

## 7. 內容

### `news`
Admin 手動發布(MVP 不爬蟲)。

> ⚠️ 實際欄位（004 + 005 修正後）

| 欄位 | 說明 |
|---|---|
| id | uuid PK |
| title | text |
| **slug** | text UNIQUE | 004 新增；URL key（自動由 title slugify） |
| summary | text | 列表頁顯示 |
| **content** | text | 001 原始欄位（保留，舊資料用） |
| **content_html** | text | 004 新增；富文本內容（取代 content） |
| source_url | text | 原始來源（外部新聞） |
| **image_url** | text | 001 原始欄位（保留） |
| **cover_image_url** | text | 004 新增；封面圖（取代 image_url） |
| **author_id** | uuid FK profiles | 005 新增；發布者 |
| published_at | timestamptz | 發布時間 |
| is_published | boolean | true 才公開 |
| created_at | timestamptz | 004 補上 |

索引：`(slug)`, `(is_published, published_at desc)`

## 8. 稽核

### `audit_logs`
所有 admin 動作都要寫一筆。

| 欄位 | 說明 |
|---|---|
| id | uuid PK |
| actor_id | FK profiles |
| action | text e.g. `freeze_user`, `verify_payment`, `payment_rejected`, `update_category`, `create_news` |
| target_type | text e.g. `user`, `order`, `payment`, `category`, `news` |
| target_id | uuid |
| metadata | jsonb |
| created_at | timestamptz |

### `ai_chat_logs`（migration 006）
AI 助手每個 Q&A turn 的 server-side audit trail。append-only。

| 欄位 | 說明 |
|---|---|
| id | uuid PK |
| session_id | text — client 端產生的 10-byte 隨機 hex（20 chars），透過 `x-mada-session` header 傳入 |
| user_id | FK profiles，guest 為 NULL |
| role | `'user'` 或 `'assistant'` |
| content | text — 該 turn 純文字（最多 16,000 char，超過截斷） |
| ip | inet — 從 `x-forwarded-for` / `x-real-ip` / `cf-connecting-ip` 抽取 |
| country / region / city | text — Vercel 的 `x-vercel-ip-*` headers |
| user_agent | text — 原始 User-Agent header |
| created_at | timestamptz |

索引：`(session_id, created_at)`、`(user_id, created_at desc)`、`(created_at desc)`

**RLS**：僅 `admin` / `super_admin` 可 select；無 insert/update/delete policy。
寫入一律由 `/api/chat` 經 service-role admin client 執行。

> 參見 [`docs/AI_PROMPT.md` §6](./AI_PROMPT.md) 了解寫入流程與本機開發 caveat。

## 9. RLS 概覽

| 表 | select | insert | update | delete |
|---|---|---|---|---|
| profiles | public | trigger 由 auth | self / admin | admin only |
| product_categories | public（active 才公開） | admin | admin | admin |
| listings | active 公開 / owner / admin | seller(role=seller) / admin | owner / admin | owner / admin |
| inquiries | parties / admin | buyer | parties / admin | -- |
| orders | parties / admin | server action（service_role） | server action / admin | -- |
| contracts | parties / admin | server action | server action | -- |
| payments | parties / admin | buyer | admin only | -- |
| chat_rooms | members / admin | (server action) | -- | -- |
| chat_members | self / admin | (server action) | -- | -- |
| messages | room members / admin | room members | sender(短時間內) | -- |
| news | published 公開 / admin | admin | admin | admin |
| audit_logs | admin | server action（service_role） | -- | -- |
| ai_chat_logs | admin only | server action（service_role） | -- | -- |

> Helper SQL function：`public.current_user_role()` returns enum `user_role`。
> 真正 SQL policy 見 migration 檔案。

## 10. Storage Buckets（規劃 — 待 ROADMAP §A4 自動化）

| Bucket | 訪問模式 | 用途 |
|---|---|---|
| `avatars` | public read, self write | 使用者頭像 |
| `kyc` | private（owner + admin） | KYC 證件 |
| `contracts` | private（訂單雙方 + admin） | 合約簽名掃描 |
| `payments` | private（buyer + admin） | 付款憑證圖 |
| `listings` | public read, seller write | 商品圖 |
| `chat` | private（chat members） | 聊天室附件 |

## 11. Realtime

```sql
alter publication supabase_realtime add table public.messages;
```

僅 `messages` 表開放 `postgres_changes` event 訂閱。
客戶端：`supabase.channel('messages:room_id=eq.{uuid}')`。
