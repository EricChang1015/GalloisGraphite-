# Roadmap — 補完項 + Phase 2

> Day 1–2 MVP 主要功能已完成（公開頁、AI 助手、註冊登入、賣家上貨、買家詢價、
> 訂單狀態機、合約生成、付款人工審核、Admin 後台、Audit log）。
> 本文件僅追蹤 **「上線前必補完項」** 與 **「Phase 2 後續迭代」**。
>
> 已完成的功能盤點請見 [`ARCHITECTURE.md`](./ARCHITECTURE.md)。

---

## A. MVP 補完項（上線前必做）

### A1. ✅ Schema 對齊（已完成）

代碼／TS types 與 `001_init.sql` 的差異已由 `005` migration 補齊：

- [x] 新增 [`supabase/migrations/005_align_payments_and_news.sql`](../supabase/migrations/005_align_payments_and_news.sql)
  - `payments.payer_id` → `buyer_id`（rename，並重建 RLS `payments_buyer_insert` policy）
  - `payments` 加 `admin_note text`、`reviewed_by uuid → profiles(id)`、`reviewed_at timestamptz`
  - 既存 `verified_by` / `verified_at` 保留以避免破壞舊資料，並 backfill 到 `reviewed_*`
  - `news` 加 `author_id uuid → profiles(id)` + index
  - `orders` 加 `updated_at timestamptz` + `BEFORE UPDATE` trigger `trg_orders_touch_updated_at`
  - 順手把 `contracts.updated_at` + trigger 也補上
- [x] `docs/SCHEMA.md` 同步更新（payments、news、orders 欄位）
- [x] migration idempotent，可重跑

> 部署到 production 後仍需重跑 `npx supabase gen types typescript ... > src/types/database.ts`
> 以對齊型別（屬 A7 部署清單）。

### A2. 站內 IM（原 Step 7，schema 已就位但 UI 是 placeholder）

- [ ] `acceptInquiry` 建單時自動建立 `chat_rooms (type='order')` + `chat_members`（buyer + seller）
- [ ] `src/components/chat/OrderChat.tsx`：使用 Supabase Realtime `postgres_changes` 訂閱 `messages`
- [ ] `(app)/orders/[id]` 加 「Communication」Tab 內嵌 `<OrderChat />`
- [ ] `(app)/messages/page.tsx` 改為房間列表（依最後訊息時間排序）
- [ ] 訊息附件上傳到 Supabase Storage `chat` bucket（`image/*`、`application/pdf`，limit 5MB）
- [ ] 風險備案：若 Realtime 不穩定，fallback 為 SWR 5s polling（`src/hooks/useMessages.ts`）

### A3. 合約簽名掃描上傳 UI（補 Step 6）

`uploadSignedScan` Server Action 已存在於 `src/actions/order.ts`，但訂單頁 Contract Tab 沒對應觸發 UI。

- [ ] 在 `(app)/orders/[id]` Contract Tab 加 `<input type="file" accept="image/*,application/pdf">`
- [ ] 上傳到 `contracts` bucket，路徑 `{order_id}/{role}-{uuid}.{ext}`
- [ ] 上傳成功後呼叫 `uploadSignedScan(orderId, role, signedUrl)`
- [ ] 雙方都上傳完成 → server action 已自動把 `orders.status` 改為 `signed`
- [ ] 顯示「等待對方上傳」狀態提示

### A4. Storage Buckets 與 Policy 初始化

目前 schema 沒有自動建 bucket 與 storage policy。手動建或寫成 migration：

- [ ] `avatars`（public read，self write）
- [ ] `kyc`（private，僅 owner + admin 可讀，僅 owner 可寫）
- [ ] `contracts`（private，僅訂單雙方 + admin 可讀）
- [ ] `payments`（private，僅 buyer + admin 可讀）
- [ ] `listings`（public read，seller 可寫）
- [ ] `chat`（private，僅 chat_members 可讀寫）

> 建議寫成 `supabase/migrations/006_storage_buckets.sql` 或 `scripts/setup-storage.sql`，
> 並在 `docs/ARCHITECTURE.md` §3.3 標註執行方式。

### A5. Disputed / Cancelled 觸發 UI

訂單狀態機支援 `disputed` 與 `cancelled`，但 UI 尚無觸發點。

- [ ] `OrderActions` 加「Raise Dispute」按鈕（雙方任一狀態 → `disputed`）
- [ ] `OrderActions` 加「Cancel Order」按鈕（僅 `draft / contract_generated / signed / payment_pending` 可取消）
- [ ] Server Action 寫 `audit_logs` + `orders.timeline` event
- [ ] Admin 在 `/admin/orders/[id]`（待新增）可從 `disputed` → `completed` / `cancelled`

### A6. KYC 文件上傳（簡易版）

PRD §2 IN SCOPE 第 11 項提到「之後可上傳企業登記/身份證件以提升 kyc_level」。

- [ ] `(app)/settings/kyc` 頁面 + `<KycUploadForm />`
- [ ] 上傳到 `kyc` bucket，URL 寫入 `profiles.kyc_docs jsonb`
- [ ] Admin 可在 `/admin/users/[id]` 檢視與升級 `kyc_level`

### A7. 部署與煙霧測試（原 Step 9）

- [ ] 推 GitHub
- [ ] Vercel import + env（含 POE / Resend / Supabase / 平台收款資訊）
- [ ] Supabase production 切換 + 重跑 001 → 005 migrations
- [ ] RLS policy review（特別是 005 修改後的 payments）
- [ ] Resend domain DNS（或先用 `onboarding@resend.dev` 寄件）
- [ ] 端到端 happy path：註冊 → 上貨 → 詢價 → 接受 → 合約 → 簽名 → 付款 → 審核 → 出貨 → 確認

---

## B. Phase 2（MVP 上線後 30 天內評估）

### B1. AI 助手 — 登入態工具呼叫
- 預留介面已完成，補實際 tools：
  - `search_listings(category, qty_min, price_max, ...)` → 從 listings 撈
  - `get_my_orders(status?)` → buyer/seller 視角
  - `draft_inquiry(listing_id, qty, target_price, msg)` → 預填 InquiryDialog

### B2. 即時石墨價格 / 歷史走勢
- PRD §2 OUT OF SCOPE 原因：「規格分散、單一報價偏差大」
- 重新評估：以 listings 內部成交價聚合 + Benchmark Mineral Intelligence 公開指數

### B3. 多語系
- next-intl，預留 en / zh-Hant / fr key
- 合約強制英文版

### B4. PDF 真渲染（取代 `window.print()`）
- 評估 `@react-pdf/renderer` 或 `puppeteer-core` + `chrome-aws-lambda`
- 渲染後存到 `contracts/{order_no}.pdf`

### B5. 觀測性
- Sentry（front + server actions）
- Vercel Analytics
- Supabase log drain

### B6. 付款流自動化（試行）
- USDT 鏈上監聽 → 自動標 `verified`
- 仍保留 admin 覆核（雙簽機制）

### B7. 平台費率與賣家結算
- 目前 `confirmReceipt` 後僅寄信通知 admin「請放款」
- 補 `payouts` 表：admin 標註已付款給賣家（含 tx_hash / 銀行憑證）

### B8. 多語客服 + Discord/Slack 通知
- 整合 Resend → Slack webhook，inquiry/payment 即時通知 sales team

---

## C. 風險與備案（保留）

| 風險 | 備案 |
|---|---|
| Supabase Realtime 延遲/不穩 | 改 polling（SWR 5s） |
| Resend domain DNS 來不及 | 用預設 sender（`onboarding@resend.dev`） |
| Vercel build 失敗（env） | 本地 `next build` 先過，確認 `server-only` 沒進 client |
| AI Token 過大 | 訊息超過 N 條時對前文做摘要 |
| Storage 成本 | KYC docs / contracts size 5MB 上限，圖檔壓縮 |
| 005 migration 破壞線上資料 | 先在 staging 跑；payer_id rename 用 `ALTER TABLE ... RENAME COLUMN` 而非 drop+recreate |

---

## D. Definition of Done（MVP 上線版）

- [x] A1 schema 對齊全部完成（TS types 重新生成於 A7 部署時執行）
- [ ] A2 IM 可雙方即時對話 + 圖片附件
- [ ] A3 簽名掃描可上傳並推進到 `signed` 狀態
- [ ] A4 所有 buckets 建立完成
- [ ] A5 dispute / cancel 流程可走通
- [ ] A6 KYC 上傳可運作（admin 可升級 level）
- [ ] A7 部署完成，端到端 happy path 通過
- [x] 公開頁 SEO meta（title/description/og）齊全
- [x] 所有路由都有 `loading.tsx` 與 `error.tsx` 雛形（多數已完成）
- [ ] 沒有 console.error / TS error / lint error
