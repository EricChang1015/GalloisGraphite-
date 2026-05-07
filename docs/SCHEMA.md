# Database Schema (MVP)

> 對應 SQL 在 [`supabase/migrations/001_init.sql`](../supabase/migrations/001_init.sql)。
> 此文件用「中文 + 設計理由」描述 schema,方便 AI agent 與工程師對齊。

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
| created_at | timestamptz | |

設計理由:把 auth 與業務分離,RLS 易控制;super_admin 一律手動在 SQL 設定。

## 2. 商品

### `product_categories`
平台可交易品類,由超管管理。

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid PK | |
| name | text | e.g. "Flake Graphite 94%" |
| description | text | |
| spec_schema | jsonb | 描述該品類規格欄位的 schema |
| is_active | bool | 下架時設 false |
| created_at | timestamptz | |

`spec_schema` 範例:
```json
{
  "carbon": "94% min",
  "ash": "6% max",
  "moisture": "0.5% max",
  "mesh": "100 mesh 80% min"
}
```
此欄位用於前端渲染動態欄位,以及驗證 listing 的 `specs`。

### `listings`
賣家上貨。

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid PK | |
| seller_id | uuid FK profiles | |
| category_id | uuid FK product_categories | |
| title | text | |
| specs | jsonb | 該批次的具體規格(允許優於 schema) |
| quantity | numeric | |
| unit | text | MT / KG (預設 MT) |
| origin_location | text | e.g. "Toamasina, Madagascar" |
| available_from / available_to | date | 可出貨時間區間 |
| unit_price | numeric | |
| currency | text | USDT / USD / EUR (MVP 主用 USDT) |
| incoterm | text | CFR / FOB / CIF |
| description | text | |
| status | enum `listing_status` | active / paused / sold_out |
| created_at | timestamptz | |

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
| requested_qty | numeric | |
| target_price | numeric | |
| destination | text | 目的地港/城市 |
| message | text | |
| status | enum `inquiry_status` | pending / accepted / rejected / converted |
| created_at | timestamptz | |

### `orders`
核心交易實體。

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid PK | |
| order_no | text UNIQUE | `ORD-YYMMDD-xxxxxx`,自動生成 |
| buyer_id / seller_id | uuid FK profiles | |
| listing_id | uuid FK listings | |
| inquiry_id | uuid FK inquiries | nullable |
| quantity | numeric | |
| unit_price | numeric | |
| total_amount | numeric | quantity × unit_price (應用層計算) |
| currency | text | |
| destination | text | |
| shipment_from | text | 賣家更新 |
| shipment_eta | date | |
| status | enum `order_status` | 見下表 |
| timeline | jsonb | append-only 事件列表 |
| created_at | timestamptz | |

`order_status` 狀態機:
```
draft → contract_generated → signed
  → payment_pending → paid → shipped → delivered → completed
任何節點 → disputed / cancelled
```

`timeline` 事件 schema:
```json
{
  "at": "2026-05-08T12:00:00Z",
  "by": "<user_uuid>",
  "type": "status_changed | shipment_update | note | payment_submitted | ...",
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
| order_id | unique FK orders |
| contract_no | 合約編號 e.g. `113-26-xxx` |
| content_html | 渲染好的 HTML(供列印) |
| pdf_url | 產生 PDF 後的 Storage URL(MVP 可空) |
| buyer_signed_url / seller_signed_url | 雙方簽名掃描檔 URL |
| buyer_signed_at / seller_signed_at | timestamps |
| created_at | |

## 5. 付款

### `payments`
人工審核制。

| 欄位 | 說明 |
|---|---|
| order_id | FK orders |
| payer_id | FK profiles(通常是 buyer,出口退稅情境可由其他付) |
| method | enum: usdt_trc20 / usdt_erc20 / usdi / mup / bank_transfer |
| amount | numeric |
| currency | text |
| tx_hash | text(crypto 必填,bank 可空) |
| proof_url | text(banks 必填,crypto 可空) |
| note | text |
| status | enum: pending / verified / rejected |
| verified_by | FK profiles(admin) |
| verified_at | timestamptz |

## 6. 即時通訊

### `chat_rooms` / `chat_members` / `messages`
每張 order 對應一個 chat_room (type='order'),admin 可選加入。

`messages` 用 Supabase Realtime 訂閱,`postgres_changes` event。

| messages 欄位 | 說明 |
|---|---|
| id | uuid PK |
| room_id | FK chat_rooms ON DELETE CASCADE |
| sender_id | FK profiles |
| content | text(可空,純圖片訊息) |
| attachment_url | text(Storage URL) |
| created_at | timestamptz |

## 7. 內容

### `news`
Admin 手動發布(MVP 不爬蟲)。

| 欄位 | 說明 |
|---|---|
| id | |
| title / summary / content | |
| source_url | 原始來源 URL(若有) |
| image_url | cover |
| published_at | timestamptz |
| is_published | bool |

## 8. 稽核

### `audit_logs`
所有 admin 動作都要寫一筆。

| 欄位 | 說明 |
|---|---|
| id | uuid PK |
| actor_id | FK profiles |
| action | text e.g. `freeze_user`, `verify_payment` |
| target_type | text e.g. `user`, `order`, `payment` |
| target_id | uuid |
| metadata | jsonb |
| created_at | timestamptz |

## 9. RLS 概覽

| 表 | select | insert | update | delete |
|---|---|---|---|---|
| profiles | public | trigger 由 auth | self | admin only |
| product_categories | public | admin | admin | admin |
| listings | active 可 public;owner 全看 | seller(role=seller) | seller owner / admin | seller owner / admin |
| inquiries | buyer/seller of row | buyer | buyer (status=pending);seller(status 改 accept/reject) | -- |
| orders | buyer/seller/admin of row | server action 內 | server action + state machine | -- |
| contracts | parties | server action | server action | -- |
| payments | parties + admin | buyer | admin only | -- |
| chat_* | members | members | -- | -- |
| messages | room members | room members | sender(短時間內) | -- |
| news | published 公開;all admin | admin | admin | admin |
| audit_logs | admin | server action | -- | -- |

> 真正 SQL 政策見 migration 檔。MVP 先實作關鍵表的 RLS,其他補上 admin escape via service_role。

## 10. 索引

- `listings(category_id, status)`
- `orders(buyer_id, status)`、`orders(seller_id, status)`
- `messages(room_id, created_at desc)`
- `payments(order_id, status)`
