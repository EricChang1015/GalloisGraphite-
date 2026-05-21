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
| `007_b2b_progress_enums.sql` | **B2B 追蹤 P1**：新增 `quotation_status` / `payment_terms_type` / `document_type` enum；`order_status` rename `signed→contract_signed`、`delivered→customs_cleared` 並加 9 個新狀態；`inquiry_status` 加 `quoted/negotiating/expired` |
| `008_oauth_profile_handling.sql` | `handle_new_user` 支援 Google OAuth：fallback meta.name；`email_confirmed_at` 已設則 status 直接 `'active'` |
| `009_b2b_progress_tables.sql` | **B2B 追蹤 P1**：新增 `quotations` / `order_documents` 表；`orders` 加運輸欄位（`bl_no` / `vessel_*` / `etd/atd/ata` / `payment_terms` / `payment_due_*`）；`contracts` 加 revision + buyer-approval 欄位；補 RLS |
| `010_storage_order_documents.sql` | **Storage**：建立 `order-documents` private bucket（20 MB / PDF + image MIME 白名單）+ `storage.objects` 的 4 條 RLS（read / insert / update parties；delete admin）；解除合約簽名掃描、付款證明、發票 / B/L / 海關 / 檢驗等檔案的上傳阻塞 |
| `011_platform_settings.sql` | **平台設定**：`platform_settings(key, value jsonb, updated_at, updated_by)`；seed `sms_notifications_enabled=false`；admin RLS |
| `012_listings_categories_order_party_read.sql` | **訂單雙方讀取**：`listings` / `product_categories` 額外 RLS，允許訂單 buyer/seller 讀取關聯商品（即使 listing 已 pause 或 category 已下架） |
| `013_payment_schedules.sql` | **付款抽離**：新增 enum `payment_category` / `payment_milestone` / `payment_schedule_status` + `payment_schedules` 表；`payments` 加 `schedule_id`；`orders` 加 `incoterm` + 9 個 milestone 時間戳；RLS 對 buyer/seller/admin 開放 select |
| `014_drop_legacy_payment_terms.sql` | **Hard cutover**：truncate 所有 orders / contracts / payments / quotations / payment_schedules 測試資料；`orders` drop `payment_terms` / `payment_due_days` / `payment_due_date`；`contracts` drop `payment_terms` / `payment_due_days`。`payment_terms_type` enum + `order_status` 的 `payment_pending` / `paid` / `draft` / `contract_generated` 仍保留（PG 無法 drop enum value），但不再被任何 server action 寫入 |
| `015_payment_seller_verify.sql` | **Payment 審核權限改寫**：drop legacy `payments_admin_update`，新建 `payments_seller_or_admin_update`，允許 update 的條件為「auth.uid() 是該 payment.order 的 seller_id，或 `current_user_role()` ∈ {admin, super_admin}」。順手加 `idx_payments_status_pending` (partial, status='pending') 與 `idx_payments_order_status`，加速 seller / admin 查詢待審 payment |
| `019_avatars.sql` | **頭像**：`profiles.avatar_url`；`avatars` public Storage bucket；`handle_new_user` 從 OAuth meta 帶入 Google 頭像；既有 OAuth 用戶 backfill |

> ⚠️ **注意**：007/009 因 PostgreSQL 限制（`alter type ... add value` 不可在同一 transaction 內使用新值）必須拆成兩個檔案，且 enum 必須在使用該值的 table migration 之前執行。
>
> **執行方式**：用 `npm run db:migrate`（Supabase Management API，免 DB password）。詳見 [`.cursor/rules/migrations.mdc`](../.cursor/rules/migrations.mdc) 與 [`scripts/apply-migrations.mjs`](../scripts/apply-migrations.mjs)。

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
| avatar_url | text | Google OAuth 頭像或 Storage 上傳的公開 URL（`019_avatars.sql`） |
| created_at / updated_at | timestamptz | |

設計理由:把 auth 與業務分離,RLS 易控制;super_admin 一律手動在 SQL 設定。

**Trigger**：
- `on_auth_user_created` → `handle_new_user()`：新註冊自動 insert 一筆 profile
  - **007 後行為**：讀 `raw_user_meta_data`，`full_name` fallback 到 `name`（Google ID token 用此 key）；`company_name` / `country` 缺漏視為空字串；`role` 預設 `'buyer'`
  - **019 後**：`avatar_url` 從 `raw_user_meta_data.avatar_url`（Google 等 OAuth）寫入 profile；使用者可在 `/settings` 上傳覆蓋
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
| status | enum `inquiry_status` | pending / **quoted** / **negotiating** / accepted / rejected / **expired** / converted |
| created_at | timestamptz | |

索引：`(buyer_id)`, `(seller_id)`

**狀態流轉**（007 之後）：
- `pending` → seller 第一次發 quotation → `quoted`
- `quoted` ↔ `negotiating`（有 counter-offer 時）
- 任意點 → buyer accept quotation → `converted`（轉為 order）
- 任意點 → reject / expire → `rejected` / `expired`

### `quotations`（007 新增）
正式議價紀錄。一個 inquiry 可有多輪 quotations（counter-offer 樹狀結構）。

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid PK | |
| inquiry_id | uuid FK inquiries ON DELETE CASCADE | |
| parent_quotation_id | uuid FK quotations | 此筆為對哪一筆的 counter |
| seller_id / buyer_id | uuid FK profiles | |
| listing_id | uuid FK listings | |
| unit_price | numeric(18,4) | |
| currency | text | |
| quantity | numeric(18,3) | |
| unit | text | MT / KG |
| incoterm | text | FOB / CFR / CIF |
| origin_port / destination_port | text | |
| validity_until | timestamptz | quotation 過期時間 |
| specs_confirmed | jsonb | 議價確認的規格快照 |
| shipping_window_from / to | date | 可出貨窗口 |
| notes | text | |
| status | enum `quotation_status` | sent / countered / accepted / rejected / expired / superseded |
| countered_by | uuid FK profiles | counter / accept / reject 的執行者 |
| responded_at | timestamptz | |
| created_at | timestamptz | |

索引：`(inquiry_id, status)`, `(buyer_id)`, `(seller_id)`

**RLS**：select = parties + admin；insert = seller 或 buyer（counter）；update = parties + admin。

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
| ~~payment_terms / payment_due_days / payment_due_date~~ | — | **014 移除**；改用 `payment_schedules` |
| **incoterm** | text | 013 新增：FOB / CFR / CIF；在合約 draft 時敲定，覆蓋 listing 的 incoterm |
| **vessel_name / vessel_imo** | text | 007 新增 |
| **container_numbers** | text[] | 007 新增 |
| **bl_no / bl_date** | text / date | 007 新增：Bill of Lading |
| **etd / atd / ata** | date | 007 新增：預計/實際 出航 + 預計/實際 到港 |
| **customs_cleared_at** | timestamptz | 007 新增 |
| **before_production_at / before_shipment_at / before_loading_at** | timestamptz | 013 新增：手動 milestone 時間戳（賣家觸發） |
| **loaded_at / bl_received_at / shipping_docs_received_at / bl_plus_insurance_received_at** | timestamptz | 013 新增：船運 milestone（loaded_at 隨 markShipped 自動寫入；其餘三個由買家手動觸發） |
| **picked_up_at / accepted_at** | timestamptz | 013 新增：買家手動 milestone |
| **current_quotation_id** | uuid FK quotations | 007 新增：訂單採用的 quotation |

索引：`(buyer_id, status)`, `(seller_id, status)`

`order_status` 狀態機（完整定義見 `src/lib/order/stateMachine.ts`）— **付款已抽離為 `payment_schedules`，狀態機固定 12 階段線性**：

```
quotation_pending → quoted ↔ negotiating
  → contract_pending → contract_signed → in_production
  → ready_to_ship → shipped → in_transit → arrived
  → customs_cleared → completed
任何節點 → disputed / cancelled
disputed → cancelled / completed
```

> 註：legacy enum 值 `draft` / `contract_generated` / `payment_pending` / `paid` 仍存在於 `order_status` enum（PG 限制），但 server actions 不再寫入；歷史 timeline 列若包含這些值，UI 用 `STATUS_LABEL` 兜底渲染。

`timeline` 事件 schema:
```json
{
  "event": "contract_pending",
  "at": "2026-05-08T12:00:00Z",
  "by": "<user_uuid>",
  "from": "quoted",
  "to": "contract_pending",
  "revision": 1
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
| buyer_signed_url / seller_signed_url | 雙方簽名掃描檔 URL（在 `order-documents` bucket） |
| buyer_signed_at / seller_signed_at | timestamps |
| created_at / updated_at | timestamptz |
| **revision_no** | int default 1 | 007 新增：重新起草時 +1 |
| **buyer_approved_at / buyer_rejected_at** | timestamptz | 007 新增：合約審核回合制 |
| **buyer_reject_reason** | text | 007 新增 |
| ~~payment_terms / payment_due_days~~ | — | **014 移除**；改用 `payment_schedules` |

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
| **schedule_id** | uuid FK payment_schedules | 013 新增：本筆 payment 結算的 schedule 列；admin verify 後 schedule.paid_payment_id 回指此 row |
| created_at | timestamptz | |

索引：`(order_id, status)`, `(schedule_id)`，**`(status) WHERE status='pending'`（015）**, **`(order_id, status)`（015）**。

**RLS（015 後）**：
- select：order 的 buyer / seller 或 admin
- insert：buyer（本人）
- **update：order 的 seller（自審）或 admin / super_admin（覆審 / 介入）** — `payments_seller_or_admin_update` 取代 `payments_admin_update`
- delete：—（無 policy）

> 設計理由：把第一線審核責任交還賣家（他能直接在區塊鏈 / 銀行對帳系統確認到帳），把 admin 從每日例行 ops 解放，但保留 admin override 處理爭議的權力。

## 5c. 付款排程 — `payment_schedules` (013 新增)

把單筆「整訂單付款」拆成 1..N 筆 installment。每筆有自己的 `due_date`、
`status` 與 milestone 觸發條件；當 milestone 達成時，server action 或 cron
把 `scheduled` 推到 `due`，買家提交 payment 後變 `awaiting_review`，admin
verify 後變 `paid`。

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid PK | |
| order_id | uuid FK orders ON DELETE CASCADE | |
| sequence | int | UI 排序用 |
| category | enum `payment_category` | `prepayment` / `regular_payment` / `postpayment` |
| milestone | enum `payment_milestone` | 13 個值；依 Incoterm 過濾（見 `src/lib/validations/payment-schedule.ts`） |
| percentage | numeric(5,2) | > 0 且 ≤ 100；同訂單 SUM 必須 = 100 |
| amount | numeric(18,4) | 建立時用 `order.total × pct / 100` 快照，避免日後改 unit_price 連動 |
| currency | text | 與 order 同 |
| bl_offset_days | int | 僅 `bl_date_plus_N` 用；未指定時用 milestone 內建預設 (30/60/90) |
| due_date | date | milestone 觸發後寫入；time-based milestones 待 `orders.bl_date` 填入後由 cron 補算 |
| status | enum `payment_schedule_status` | `scheduled` / `due` / `awaiting_review` / `paid` / `overdue` / `waived` |
| paid_payment_id | uuid FK payments | admin verify 後寫回 |
| notes | text | 簽合約時的備註 |
| created_at / updated_at | timestamptz | `updated_at` 由 trigger 自動維護 |

索引：`(order_id, sequence)`, `(status)`, `(due_date)` partial WHERE due_date IS NOT NULL。

**Milestone enum** 共 13 個：
- 共用 prepayment：`contract_signed` / `before_production` / `before_shipment` / `before_loading`
- FOB regular：`loaded_onto_vessel` / `bl_received`
- CFR regular：`loaded_onto_vessel` / `bl_received` / `shipping_docs_received`
- CIF regular：`loaded_onto_vessel` / `bl_plus_insurance_received`
- 共用 postpayment：`arrived_at_port` / `goods_picked_up` / `accepted_by_buyer` / `bl_date_plus_30` / `bl_date_plus_60` / `bl_date_plus_90`

**RLS**：
- select：order 的 buyer / seller 或 admin
- update：僅 admin（一般寫入透過 server action + service-role 走過）
- insert / delete：僅 service-role（無公開 policy）

## 5b. 訂單文件中心（007 新增）

### `order_documents`
通用訂單文件容器，所有合約掃描、發票、B/L、檢驗報告、付款憑證等均寫入此表。

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid PK | |
| order_id | uuid FK orders ON DELETE CASCADE | |
| type | enum `document_type` | 13 種文件分類，見下 |
| file_url | text | Storage signed URL |
| file_name / file_size_bytes / mime_type | | 原檔案中繼資料 |
| uploaded_by | uuid FK profiles | |
| uploaded_at | timestamptz | |
| verified_by / verified_at | | admin 標記已核驗 |
| admin_note | text | admin 補充說明 |
| is_required | boolean | 預留旗標，UI 判斷必要文件 |
| metadata | jsonb | 額外資訊（storage_path 等） |

`document_type` enum：
- 合約：`contract_signed_buyer`, `contract_signed_seller`
- 發票：`proforma_invoice`, `commercial_invoice`
- 物流：`packing_list`, `bill_of_lading`, `insurance_policy`
- 檢驗：`coa_sgs`, `inspection_report`
- 海關：`cert_of_origin`, `customs_declaration`
- 付款：`payment_proof`
- 其他：`other`

索引：`(order_id, type)`

**RLS**（`public.order_documents` 表，由 `009_b2b_progress_tables.sql` 設）：
- select：parties + admin
- insert：parties（必須是 order 的 buyer / seller）+ admin
- update：uploader 在 1 小時內可改自己的；admin 隨時可改（驗證）
- delete：uploader 在 1 小時內且未驗證可撤回；admin 可隨時刪

**Storage 層 RLS**（`010_storage_order_documents.sql` 在 `storage.objects` 套用，bucket=`order-documents`）：
- select / insert / update：訂單雙方 + admin（依路徑首段 `{order_id}/...` 反查 `orders` 確認身分）
- delete：admin only（避免買賣方手滑刪掉合約 / 付款證明，保留稽核線索）
- bucket 設 private、20 MB 上限、僅允許 PDF 與常見圖片 MIME（jpg/png/webp/heic）

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

## 8. 平台設定與稽核

### `platform_settings`（migration 011）
Admin 可在 `/admin/settings` 調整的全站 key-value 設定。

| 欄位 | 型別 | 說明 |
|---|---|---|
| key | text PK | e.g. `sms_notifications_enabled` |
| value | jsonb | 布林或結構化設定 |
| updated_at | timestamptz | |
| updated_by | uuid FK profiles | 最後修改者 |

Seed：`sms_notifications_enabled = false`。

**RLS**：`admin` / `super_admin` 可 select + write；一般 user 無權。

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
| payments | parties / admin | buyer | **seller (of order) / admin**（015） | -- |
| chat_rooms | members / admin | (server action) | -- | -- |
| chat_members | self / admin | (server action) | -- | -- |
| messages | room members / admin | room members | sender(短時間內) | -- |
| news | published 公開 / admin | admin | admin | admin |
| platform_settings | admin | admin | admin | -- |
| audit_logs | admin | server action（service_role） | -- | -- |
| ai_chat_logs | admin only | server action（service_role） | -- | -- |

> Helper SQL function：`public.current_user_role()` returns enum `user_role`。
> 真正 SQL policy 見 migration 檔案。

## 10. Storage Buckets

| Bucket | 訪問模式 | 用途 | 現況 |
|---|---|---|---|
| **`order-documents`** | private（訂單雙方 + admin） | **合約簽名掃描、付款證明、發票、B/L、檢驗、海關、其他訂單檔案**（依路徑首段 `{order_id}/{doctype}/...` 分類） | ✅ 已建立（`010_storage_order_documents.sql`） |
| `avatars` | public read, self write | 使用者頭像 | ✅ `019_avatars.sql` |
| `kyc` | private（owner + admin） | KYC 證件 | ⚠️ 待建立（與 ROADMAP §A6 一起） |
| `listings` | public read, seller write | 商品圖 | ⚠️ 待建立 |
| `chat` | private（chat members） | 聊天室附件 | ⚠️ 待建立（與 ROADMAP §A2 一起） |
| ~~`contracts`~~ | — | （legacy 規劃）合約簽名掃描 | ❌ 不再建立，`order-documents` 已涵蓋 |
| ~~`payments`~~ | — | （legacy 規劃）付款憑證 | ❌ 不再建立，`order-documents` `payment_proof` 子路徑已涵蓋 |

## 11. Realtime

```sql
alter publication supabase_realtime add table public.messages;
```

僅 `messages` 表開放 `postgres_changes` event 訂閱。
客戶端：`supabase.channel('messages:room_id=eq.{uuid}')`。
