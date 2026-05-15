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

### A3. ✅ 合約簽名掃描上傳 UI（已完成）

由 `<SignedScanUploader />` 元件 + `uploadSignedScan` Server Action 提供：

- [x] `(app)/orders/[id]` Contract Tab 已內建 file input
- [x] 上傳到 `order-documents` bucket（路徑 `{order_id}/contract_signed_{role}/{uuid}.{ext}`）
- [x] 上傳同步寫入 `order_documents` row（type=`contract_signed_buyer/seller`）
- [x] 雙方都簽完且 buyer 已 `approveContract` → 自動推進到 `contract_signed` → 依 `payment_terms` 跳到 `payment_pending` 或 `in_production`
- [x] UI 顯示「Waiting for buyer to approve the contract before signature uploads are unlocked.」

### A4. Storage Buckets 與 Policy 初始化（**部分阻塞 007 後 UI**）

目前 schema 沒有自動建 bucket 與 storage policy。手動建或寫成 migration：

- [ ] `avatars`（public read，self write）
- [ ] `kyc`（private，僅 owner + admin 可讀，僅 owner 可寫）
- [ ] **`order-documents`**（private，僅訂單雙方 + admin 可讀） — **🔥 阻塞**：007 後 `<DocumentUploader />` / `<SignedScanUploader />` 已假設此 bucket 存在；上線前必建
- [ ] `contracts`（legacy，可考慮統一到 `order-documents`）
- [ ] `payments`（private，僅 buyer + admin 可讀） — 也可合併到 `order-documents` `payment_proof` type
- [ ] `listings`（public read，seller 可寫）
- [ ] `chat`（private，僅 chat_members 可讀寫）

> 建議寫成 `supabase/migrations/008_storage_buckets.sql`，
> 並在 `docs/ARCHITECTURE.md` §3.3 標註執行方式。

### A5. ✅ Disputed / Cancelled 觸發 UI（已完成）

由 `<OrderPhaseActions />` 在訂單詳情頁提供：

- [x] 「Raise Dispute」按鈕（任意非終止狀態） → `raiseDispute`，dialog 收集 reason
- [x] 「Cancel Order」按鈕（pre-shipment 階段） → `cancelOrder`，dialog 收集 reason
- [x] Server Action 寫 `audit_logs` + `orders.timeline` event
- [x] Admin `/admin/orders/[id]` 可用 `<AdminOrderActions />` force-transition 到 `completed` / `cancelled`

### A6. KYC 文件上傳（簡易版） + Lazy-collect commercial profile

**設計原則**：一般用戶（瀏覽 / 用 AI Chat）不需要 KYC；只有真正要做買賣／詢價的實體才需要。Google OAuth 用戶現在以 `company_name=''` / `country=''` 建立 profile，後續第一次商業動作時觸發補資料 + KYC。

- [ ] `(app)/settings/kyc` 頁面 + `<KycUploadForm />`
- [ ] 上傳到 `kyc` bucket，URL 寫入 `profiles.kyc_docs jsonb`
- [ ] Admin 可在 `/admin/users/[id]` 檢視與升級 `kyc_level`
- [ ] **Lazy collect prompt**：在 `createInquiry` / `createListing` / `submitPayment` 三個 server action 入口檢查
  - 若 `profiles.company_name` 或 `country` 為空 → 回 `{ error: { code: 'PROFILE_INCOMPLETE' } }`，前端彈出 `<CommercialProfileDialog />` 收集
  - 若 `profiles.kyc_level < 1` → 回 `{ error: { code: 'KYC_REQUIRED' } }`，前端引導至 `/settings/kyc`
- [ ] Seller 自助升級流程：buyer → seller 的 role 切換需 admin 審核（在 admin/users 加按鈕）

### A7. 部署與端到端煙霧測試（原 Step 9）

> 🚀 **站台已部署**到 <https://galloisgraphite.vercel.app/>（commit 2c38ddf 之後）。
> 剩餘工作為 production 環境的 schema sync + storage bucket 建立 + 完整 happy path 走測。

- [x] 推 GitHub
- [x] Vercel import + env（含 POE / Resend / Supabase / 平台收款資訊）
- [x] Supabase production schema：所有 9 個 migrations（001 → 009）都已透過 `scripts/apply-migrations.mjs` 套用，並由 `_agent_migrations` 追蹤表記錄
  > 注意：未來如增量 migration，**enum add value 與使用該值必須分檔**（007/009 是現有範例：007 加 enum value、009 才使用）
- [ ] RLS policy review（特別是 005 / 009 新增 / 修改的政策）
- [ ] Resend domain DNS（或先用 `onboarding@resend.dev` 寄件）
- [ ] **建立 `order-documents` Storage bucket + policy**（A4） — 🔥 否則所有 contract 簽名 + 文件上傳會 500
- [ ] 端到端 happy path：
  1. 註冊（buyer + seller）— Email 驗證 + Google OAuth 各跑一次
  2. 上貨
  3. 詢價 → 賣家發 quotation → 買家 accept（順便測一次 counter-offer 來回）
  4. 賣家 draftContract（選 full_prepay 或 net_after_arrival）
  5. 買家 approve contract（順便測一次 reject + re-draft，revision_no 會 ++）
  6. 雙方上傳 signed scan → 自動推進到 `contract_signed`
  7. **（full_prepay 流）** submit payment → admin verify → `paid` → `in_production`
  8. `markReadyToShip` → `markShipped`(B/L + vessel + container) → `markInTransit` → `markArrived`(ATA)
  9. 買家 `markCustomsCleared` → 自動 `completed`
  10. **（net_after_arrival 流）** `contract_signed` 直接 → `in_production` → ... → `arrived` → `customs_cleared` → buyer submit final payment → admin verify → `completed`
  11. `disputed` / `cancelled` 路徑各跑一次（含 admin force-transition 解 dispute）

### A8. ✅ B2B 全流程追蹤（已完成 — 原 §B1）

由 migrations `007_b2b_progress_enums.sql` + `009_b2b_progress_tables.sql` + 大量
server actions / UI 元件實作：

- [x] `quotations` 議價表 + `order_documents` 文件中心
- [x] 13 階段細粒度狀態機 + 雙分支（full_prepay / net_after_arrival）
- [x] 合約回合制審核（draft → approve / reject → re-draft, revision_no++）
- [x] B/L + vessel + container + ETD/ATD/ETA/ATA 追蹤
- [x] OrderProgressBar UI（依 payment_terms 動態渲染）
- [x] /inquiries/[id] 議價歷史頁
- [x] /admin/orders/[id] + force transition

### A9. ✅ Migration 自動套用 runner（已完成）

由 [`scripts/apply-migrations.mjs`](../scripts/apply-migrations.mjs) +
[`scripts/gen-types.mjs`](../scripts/gen-types.mjs) + npm script 實作（commit 2c38ddf）：

- [x] 透過 Supabase Management API（`POST /v1/projects/{ref}/database/query`）執行 SQL，無需 DB password
- [x] 追蹤表 `public._agent_migrations(name PK, checksum, applied_at, bootstrap)`，SHA-256 偵測 drift
- [x] CLI flags：`--status` / `--bootstrap` / `--dry-run` / `--all` / `--force <name>`
- [x] 同步 npm scripts：`db:migrate` / `db:migrate:status` / `db:migrate:bootstrap` / `db:migrate:dry` / `db:types`
- [x] AI agent 撰寫規範：[`.cursor/rules/migrations.mdc`](../.cursor/rules/migrations.mdc)（檔名規則、idempotency、enum 拆檔、RLS 覆蓋、failure handling）
- [x] 解決舊版重複 prefix：`006_b2b_progress_enums` → `007_b2b_progress_enums`、`007_oauth_profile_handling` → `008_oauth_profile_handling`、`007_b2b_progress_tables` → `009_b2b_progress_tables`

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

- [x] A1 schema 對齊全部完成（TS types 由 `npm run db:types` 重新生成）
- [ ] A2 IM 可雙方即時對話 + 圖片附件
- [x] A3 簽名掃描可上傳並推進到 `contract_signed` 狀態（009 完成）
- [ ] A4 所有 buckets 建立完成（**`order-documents` 為當前最後阻塞項**）
- [x] A5 dispute / cancel 流程可走通（009 完成）
- [ ] A6 KYC 上傳可運作（admin 可升級 level）
- [x] A7 部署：站台已上 Vercel <https://galloisgraphite.vercel.app/>，9 個 migration 已套用
- [ ] A7 端到端 happy path（含 quotation / contract approve / B/L / customs 全流程，full_prepay + net_after_arrival 雙分支）通過
- [x] A8 B2B 全流程追蹤（quotation 議價、13 階段狀態機、文件中心）已完成
- [x] A9 Migration 自動套用 runner 完成（`npm run db:migrate`）
- [x] 公開頁 SEO meta（title/description/og）齊全
- [x] 所有路由都有 `loading.tsx` 與 `error.tsx` 雛形（多數已完成）
- [x] 沒有 console.error / TS error / lint error（`npm run build` 在每個 commit 前都跑過）
