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

### A2. 站內 IM（Party DM ✅；訂單 Tab + 附件待補）

> **模型（migration 018）**：同一 buyer + seller 僅一條 `chat_rooms.type='party'` thread；訊息可帶
> `context_type`（listing / inquiry / order）。**不再**為每張訂單開獨立 `type='order'` 房間。
> 詳見 [`TESTING.md` §3.5](./TESTING.md#35-站內信party-dm合併-main-前必跑)。

**已完成：**

- [x] `ensurePartyChat` + `openPartyChat` / `getPartyChatWithUser`（`src/lib/chat/ensure-room.ts`、`src/actions/chat.ts`）
- [x] `/messages` 對話列表 + `/messages/[userId]` 全頁 thread（`<ConversationList />`、`<PartyChatPanel />`）
- [x] Market / 訂單 Overview 的 `<MessageCounterpartyButton />`（同一 party thread，非新房）
- [x] Realtime 訂閱 `messages`（`PartyChatPanel` 內）；`npm run qa:chat`（7/7）

**仍待（MVP 上線前若要做完整 IM）：**

- [ ] `(app)/orders/[id]` 可選：內嵌精簡版 `<PartyChatPanel />`（或維持僅 Overview「Message」按鈕 — 見 TESTING §3.5 M4）
- [ ] `chat` Storage bucket + RLS（private，僅 `chat_members` 可讀寫）— 訊息附件 `image/*`、`application/pdf` ≤5MB
- [ ] 風險備案：若 Realtime 不穩定，fallback 為 5s polling（`src/hooks/useMessages.ts`，尚未建立）

### A3. ✅ 合約簽名掃描上傳 UI（已完成）

由 `<SignedScanUploader />` 元件 + `uploadSignedScan` Server Action 提供：

- [x] `(app)/orders/[id]` Contract Tab 已內建 file input
- [x] 上傳到 `order-documents` bucket（路徑 `{order_id}/contract_signed_{role}/{uuid}.{ext}`）
- [x] 上傳同步寫入 `order_documents` row（type=`contract_signed_buyer/seller`）
- [x] 雙方都簽完且 buyer 已 `approveContract` → 自動推進到 `contract_signed` → `in_production`（付款由 `payment_schedules` 獨立管理，migration 014 後訂單不再經 `payment_pending`）
- [x] UI 顯示「Waiting for buyer to approve the contract before signature uploads are unlocked.」

### A4. Storage Buckets 與 Policy 初始化

- [x] **`order-documents`**（private，owner + 訂單雙方 + admin 可讀，登入用戶可寫，uploader/admin 可覆蓋） — 由 [`010_storage_order_documents.sql`](../supabase/migrations/010_storage_order_documents.sql) 建立；合約簽名掃描、付款證明、發票 / B/L 等所有訂單檔案統一存到這顆 bucket，依路徑前綴歸類
- [x] **`avatars`**（public read，self write）— `021_avatars.sql`
- [x] **`kyc`**（private，僅 owner + admin 可讀，僅 owner 可寫）— `019_kyc_storage_and_settings.sql`
- [x] **`listings`**（public read，seller-owned write）— `024_listings_bucket.sql`（2 MiB / JPEG/PNG/WebP；路徑 `listings/{seller_uid}/{uuid}.ext`）；client 端 `compressTo720pWebp` 在上傳前縮到 720 px WebP；UI `<ListingImageUploader />` 提供 drag-drop + 「From your library」可重用既往上傳
- [ ] `chat`（private，僅 chat_members 可讀寫）— 與 A2 一起做

> `contracts` / `payments` 兩顆 legacy bucket 不再規劃 — `order-documents` 已涵蓋。
> 其餘 bucket 可於對應功能（avatar 上傳、KYC、商品圖、IM 附件）實作時補上。

### A5. ✅ Disputed / Cancelled 觸發 UI（已完成）

由 `<OrderPhaseActions />` 在訂單詳情頁提供：

- [x] 「Raise Dispute」按鈕（任意非終止狀態） → `raiseDispute`，dialog 收集 reason
- [x] 「Cancel Order」按鈕（pre-shipment 階段） → `cancelOrder`，dialog 收集 reason
- [x] Server Action 寫 `audit_logs` + `orders.timeline` event
- [x] Admin `/admin/orders/[id]` 可用 `<AdminOrderActions />` force-transition 到 `completed` / `cancelled`

### A6. ✅ KYC 文件上傳（簡易版） + Lazy-collect commercial profile（已完成 — 2026-05-21）

**設計原則**：一般用戶（瀏覽 / 用 AI Chat）不需要 KYC；只有真正要做買賣／詢價的實體才需要。Google OAuth 用戶現在以 `company_name=''` / `country=''` 建立 profile，後續第一次商業動作時觸發補資料 + KYC。

**Commercial profile gate（已完成）：**

- [x] `(app)/settings` 頁面 + `<CommercialProfileForm />`（編輯 full_name / company_name / country / phone）
- [x] `src/lib/auth/commercial.ts` helper：`findCommercialProfileGaps(userId)` 與 `describeCommercialGap(missing)`
- [x] **Lazy collect prompt**：`createInquiry` / `createListing`（seller 限定）/ `submitPayment` 入口在 `profiles.{company_name,country}` 為空時回 `{ error: { code: 'PROFILE_INCOMPLETE', fields, message } }`
- [x] `<InquiryDialog />` / `<ListingForm />` / `<PaymentForm />` 收到 `code='PROFILE_INCOMPLETE'` 顯示 toast 含「Open Settings」action button，跳到 `/settings?prompt=incomplete`
- [x] `updateCommercialProfile` server action（`src/actions/profile.ts`）

**✅ KYC 文件與門檻（2026-05-21，migration 019）：**

- [x] `kyc` Storage bucket + RLS（`019_kyc_storage_and_settings.sql`）
- [x] `(app)/settings/kyc` + `<KycUploadForm />`（PDF/圖 ≤5MB → `kyc/{user_id}/{type}/{uuid}.ext`）
- [x] `profiles.kyc_docs` jsonb 登記；`profiles_guard_kyc_level` trigger 防止使用者自調 `kyc_level`
- [x] Admin `/admin/settings` 設定 `kyc_min_level_inquiry` / `kyc_min_level_listing`（預設 **0**）
- [x] Admin `/admin/users` **KYC** 對話框：檢視文件 signed URL、手動設 level 0–3（audit_logs）
- [x] **四級 KYC + 電話 OTP**（migration 020）：0 信箱、1 電話、2 文件審核、3 進階（admin）；列表顯示 pending 文件數；一鍵核准 → Level 2
- [x] `createInquiry` / `createListing`（seller）檢查平台門檻 → `KYC_REQUIRED` + toast 導向 `/settings/kyc`

**仍待（非 MVP 阻塞 — 產品決策已記錄）：**

- [ ] **Seller 自助 buyer→seller role 切換** — 延後 Phase 2；MVP 由 admin 在 `/admin/users` 手動改 `role`
- [x] **`submitPayment` KYC 門檻** — **決策（2026-05-25）**：MVP **不要求** `kyc_level`；僅檢查 commercial profile（`company_name` + `country`，與現行程式一致）。平台可對 inquiry / listing 設 `kyc_min_level_*`（預設 0），付款不受此限

### A7. 部署與端到端煙霧測試（原 Step 9）

> 🚀 **站台已部署**到 <https://galloisgraphite.vercel.app/>（commit 2c38ddf 之後）。
> 剩餘工作為 production 環境的 schema sync + storage bucket 建立 + 完整 happy path 走測。

- [x] 推 GitHub
- [x] Vercel import + env（含 POE / Resend / Supabase / 平台收款資訊）
- [x] Supabase production schema：所有 24 個 migrations（001 → 024）都已透過 `scripts/apply-migrations.mjs` 套用，並由 `_agent_migrations` 追蹤表記錄
  > 注意：未來如增量 migration，**enum add value 與使用該值必須分檔**（007/009 是現有範例：007 加 enum value、009 才使用）
- [x] RLS policy review（005 / 010 / 015 / 018）— `npm run qa:verify-rls`（17/17 pass，2026-05-25）
- [x] ~~Resend domain DNS（或先用 `onboarding@resend.dev` 寄件）~~ — 2026-05-20 改用 **AWS SES SMTP**（`src/lib/email/smtp.ts`）；production env 需設 `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `EMAIL_FROM_ADDRESS`（必須是 SES 已驗證 identity）
- [x] **建立 `order-documents` Storage bucket + policy**（A4） — `010_storage_order_documents.sql` 已建立
- 端到端 happy path：
  1. [x] 註冊（buyer + seller）— Email 登入已驗證；Google OAuth 程式路徑 + migration 008 已驗證（`npm run qa:oauth`）；production 瀏覽器一鍵登入仍建議人工複核
  2. [x] 上貨
  3. [x] 詢價 → 賣家發 quotation → 買家 accept（含 counter-offer 來回測試）
  4. [x] 賣家 draftContract（含 30/70 分期排程）— 情境 B 已走測（2026-05-25）
  5. [x] 買家 approve contract + redraft 來回
  6. [x] 雙方上傳 signed scan → 自動推進到 `contract_signed`，簽名掃描已能嵌入合約預覽下載
  7. [x] **（full_prepay 流）** submit payment → admin verify → `paid` → `in_production`（含付款證明上傳）
  8. [x] `markReadyToShip` → `markShipped`(B/L + vessel + container) → `markInTransit` → `markArrived`(ATA)
  9. [x] 買家 `markCustomsCleared` → 自動 `completed`（2026-05-15 走完）
  10. [x] **（分期 / 情境 B）** 30% 簽約 + 70% `accepted_by_buyer`：`customs_cleared` 未付清不得 `completed`；付清後結案 — `npm run qa:a7:gate` + Playwright `e2e-full-trading`（`ORD-260525-67fdd1`，2026-05-25）
  11. [x] `disputed` / `cancelled` / admin force-transition — `npm run qa:a7:dispute`（9/9 pass，2026-05-25）

> 詳細測試帳號與走測腳本見 [`TESTING.md`](./TESTING.md)。

### A8. ✅ B2B 全流程追蹤（已完成 — 原 §B1）

由 migrations `007_b2b_progress_enums.sql` + `009_b2b_progress_tables.sql` + 大量
server actions / UI 元件實作：

- [x] `quotations` 議價表 + `order_documents` 文件中心
- [x] 12 階段線性狀態機（migration 014 後付款抽離；舊 `full_prepay` / `net_after_arrival` 改由 `payment_schedules` 表達）
- [x] 合約回合制審核（draft → approve / reject → re-draft, revision_no++）
- [x] B/L + vessel + container + ETD/ATD/ETA/ATA 追蹤
- [x] OrderProgressBar UI（12 階段線性 + Payments X/Y paid micro-badge）
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

### A16. ✅ Seller listing edit / delete（已完成 — 2026-05-24）

賣家原本上完貨之後沒有任何 UI 可以改或刪，這次補齊。

- [x] **Server actions**（`src/actions/listing.ts`）：
  - `updateListing(id, input)` 改成 dual-mode — full-form edit 會跑 `ListingInputSchema` + commercial-profile + KYC gate；bare status-toggle（`pauseListing` / `resumeListing` / 新 `markListingSoldOut`）保持原本快速通道。Pre-check `maybeSingle()` 回 `NOT_FOUND_OR_FORBIDDEN` 而非無聲 no-op。
  - **`deleteListing(id)`**：載入 listing → 驗 ownership（admin/super_admin 可代刪）→ 數 `orders.listing_id = id` count；> 0 時回 `LISTING_HAS_ORDERS`（`orders.listing_id` 是 `NOT NULL`，不擋直接讓 FK violation crash request）；通過則 hard delete，`inquiries.listing_id` / `quotations.listing_id` 設 `set null` 自動 scrub。
  - `markListingSoldOut(id)` — `<ListingRowActions />` 用。
- [x] **`/listings/[id]/edit` 頁**（server component）：用 `getCurrentUser` 驗證身分、撈 listing + 檢查 ownership（或 admin），fall through `notFound()` 處理 invalid id / 非 owner；若 listing 引用的 category 已被 `deactivate`，把它另撈出來塞回 dropdown 第一格避免空白。
- [x] **`<ListingForm />`** 加 `existing?: ExistingListing` prop：default values 全部對齊既存資料（title / specs / quantity / MOQ / unit / 日期 / price / currency / incoterm / description / images），submit 改呼 `updateListing(existing.id, values)`、button label / toast 切「Save changes」/「Listing updated.」。`titleEdited` 在 edit 模式預設 `true` 避免 onBlur 蓋掉手動標題。
- [x] **`<ListingRowActions />`**（`/listings` 新「Actions」欄）：Edit（Link）/ Pause↔Resume / Sold out / **Delete**（紅色 + confirm dialog；dialog 文案說明訂單存在會被擋）。
- [x] **Smoke**：`scripts/smoke-listing-delete.mjs`（`npm run qa:listing-delete`）— 11 assertions，分別驗 update 的 title / unit_price / status round-trip、delete 對 order-attached listing 回 `LISTING_HAS_ORDERS`、非 owner 被擋、owner 對 order-free listing 通過、row 真的不見。`--cleanup` 收尾。

### A15. ✅ Listing images（已完成 — 2026-05-24）

完成 ROADMAP §A4 中最後一個面向產品的 storage bucket，讓賣家上傳商品照、買家在 market 看到實際成品。

- [x] **migration 024**：public `listings` storage bucket（2 MiB / `image/jpeg`/`image/png`/`image/webp`）+ `storage.objects` 4 條 RLS（公開 SELECT；INSERT/UPDATE 限路徑首段 = `auth.uid()`；DELETE owner 或 admin）。`verify-schema.mjs` 補 10 條 assertion（總計 72/72）。
- [x] `src/lib/listings/images.ts`：型別 / path helpers / MIME 白名單常數（client/server 共用）；`LISTING_IMAGES_PER_LISTING = 5` 上限。
- [x] **Client-side 720p WebP 壓縮**（`src/lib/images/compress.ts`）：`compressTo720pWebp(file, { maxEdge=720, quality=0.82 })`，用 `createImageBitmap` + canvas → `toBlob('image/webp')` 在瀏覽器端縮邊 / 重編碼。對小檔 / 壓得反而變大 / 缺 API 的環境自動 passthrough。
- [x] **Server actions**（`src/actions/listing-images.ts`）：
  - `uploadListingImage(FormData)` — 走 user-scoped server client 上 storage（依賴 RLS owner-INSERT，避免 service-role 漏洞）；驗證 MIME 白名單 + 2 MiB cap；回 `{ url, path, size }`。
  - `deleteListingImage(pathOrUrl)` — owner / admin 才可；同時 scrub 賣家自家 `listings.images` jsonb 內所有引用。
  - `listMyListingImages()` — 列出 `listings/{auth.uid()}/...` 下的物件，最多 200 筆；供「From your library」tab 使用。
- [x] **`<ListingImageUploader />`** 新元件：
  - 兩個 tab — **Upload new**（drag-drop + 點選；逐檔顯示 `compressing… / uploading (X KB → Y KB)`）/ **From your library**（lazy-load 既往上傳的 thumbnail grid、點擊 toggle 加入/移除 selection、可從 library 直接刪除）
  - 下方 selected 區：首張是 cover、↑↓ 排序、× 刪除；最大 5 張
  - 全文案明示「Images are optional」+ 「publicly visible once active」
- [x] 整合：
  - `<ListingForm />` 在 Specifications 區之後 / Description 之前插入「Images (optional)」section
  - `/market` 卡片有圖時上方加 16:9 cover banner
  - `/market/[id]` 用新 `<ListingGallery />` 取代舊單張 hero（hero + thumbnail 列、點擊切換）
  - `/listings`（seller）每列前面加 size-10 縮圖（或灰底佔位）
- [x] 測試：
  - `scripts/smoke-listing-images.mjs`（`npm run qa:listing-images`）— 9 assertions，分別測 owner-INSERT 可、非 owner INSERT 被擋、`listings.images` jsonb 引用、owner-DELETE 可、非 owner DELETE 被擋、`storage.list` 確認刪除。`--cleanup` 透過 Storage API（不能直接 `DELETE FROM storage.objects`）清掉所有 tagged 物件。
  - `verify-schema.mjs` 補 bucket assertion（10 條）→ 總計 72/72 通過
- [x] 手動 GUI 走測（seller 上傳 → 看到 compressing → uploading (12 KB → 1.2 KB) → 切到 library tab 看到既往上傳 → toggle 重用 → 提交 listing → buyer 看到 market 卡片 banner + 詳情頁 hero / thumbnail 切換）

### A14. ✅ Category 重整 + Listing UX polish（已完成 — 2026-05-22）

把舊 MADA1/MADA2 brand 命名從 product category 裡拿掉（mining region 概念保留在
marketing copy / AI 知識庫），改成「Flake Graphite × {mesh size} + Custom Grade」
的結構化 spec_schema；同時補完 listing form 的若干 UX 漏洞：

- [x] **migration 022**（已合併 — commit 8ebee24）：
  - 6 個 mesh entries rename 為 `Flake Graphite +35 / +50 / +80 / +100 / +150 / -100 Mesh`
  - `spec_schema` 改成結構化 jsonb（`product_type` / `mesh_size` / `fixed_carbon_min/max` / `moisture_max` / `size_distribution_min_pct` / `is_custom`）
  - Custom Grade 設 `is_custom=true`、`mesh_size=null`
  - 舊 MADA brand rows 設 `is_active=false`（保留以維持既有 listings FK）
- [x] **migration 023**：`listings.min_order_quantity numeric(18,3) null`（optional MOQ）
- [x] `src/lib/categories/spec.ts`：
  - `CategorySpec` / `ListingSpecValues` 型別 + helpers（`parseCategorySpec` / `parseListingSpecs` / `resolveListingSpecs` / `describeCategorySpec`）
  - **新增** `buildListingTitle()` — 由 category name + spec + qty + unit 一鍵建議標題
  - **新增** `formatMeshSelection()` — 對 `MeshSize[]` 偵測 contiguous range 渲染 "+35 to -100 Mesh"，sparse 則 "+35, +80, -100 Mesh"
  - `ListingSpecValuesSchema.mesh_size` 改成 `MeshSize \| MeshSize[]`（Custom Grade 用 array）
- [x] **`<SelectValue>` raw-value bug 修正**：
  - 根因：base-ui `Select.Value` 沒給 children/items map 時 fallback 為 `serializeValue(value)`，所以 trigger 顯示原始 UUID / enum code
  - `<ListingForm />` Category select 改 `<SelectValue>{(v)=>categoryName}</SelectValue>`
  - `<ListingForm />` 標準 Mesh 改 `{(v)=>`${v} Mesh`}`
  - `<CategoryFormDialog />` Product Type / Mesh Size 同步修
- [x] `<ListingForm />` 大改：
  - Category dropdown 顯示「Flake Graphite +100 Mesh」（不再是 UUID）
  - Custom Grade 啟用時 mesh 變 6-格 checkbox grid，下方即時顯示 `formatMeshSelection` 預覽
  - 新增「Generate title」按鈕；title 留空 onBlur 自動填
  - Quantity 欄改名 「Available Quantity」 + helper text；新增 optional 「Minimum Order Quantity」
  - 預設 `quantity = undefined`（placeholder `"e.g. 50"`）取代 `1`
  - Description / Additional Notes 補 helper text 說明用途差異
- [x] `<InquiryDialog />`：
  - 加 listing summary card（category badge + spec chip + Available / Min order）
  - `requested_qty` 預設 `MOQ ?? 1`；client-side 校驗 `>= MOQ`
  - `target_price` 預設 undefined（placeholder = listing.unit_price）
- [x] `<MarketListingCard />` / `/market` page：
  - 取出 `min_order_quantity` + `specs` + `product_categories.spec_schema`
  - 卡片加 spec chip（mesh + carbon）
  - Qty 行改 「Available」；MOQ 有設時加 「Min order」 行
- [x] `/market/[id]` 詳情頁：加 「Min Order」 tile（MOQ 有設時）；spec 區的 Mesh Size 支援 array
- [x] `/listings`（seller 自己列表）：Title 下方加 spec chip 小字
- [x] `/admin/categories`：加 「Listings: N」 count cell（select count 每個 category），方便 admin 在 deactivate 前評估影響
- [x] `src/actions/inquiry.ts`：`createInquiry` 加 BELOW_MOQ guard（`requested_qty < min_order_quantity` 回 `error.code='BELOW_MOQ'`）
- [x] `src/actions/listing.ts`：`createListing` / `updateListing` 接 `min_order_quantity`
- [x] 測試：
  - `scripts/verify-schema.mjs` 加 `min_order_quantity` 欄位 assertion + `product_categories.spec_schema` shape sanity check（總計 62 assertions 全綠）
  - `scripts/test-listing-spec-helpers.mjs`（`npm run qa:spec-helpers`）— 17 cases，cover `formatMeshSelection`（single / contiguous / sparse / unsorted / dedup）、`buildListingTitle`（standard / custom / 無 qty）、`parseListingSpecs`（string + array mesh、garbage fallback）
  - `scripts/smoke-listing-moq.mjs`（`npm run qa:listing-moq`）— service-role 建 listing with MOQ → 走 below / equal / above MOQ 三分支 + DB 正性 constraint，`--cleanup` 收尾
- [x] 既有 `scripts/seed-test-order.mjs` / `scripts/smoke-payment-schedule.mjs` / `scripts/cleanup-test-data.mjs` 註解更新（UUID 沒變，只是 category name 改了）
- [x] **防禦性修正**（commit `ff464c9`）：`/listings` 與 `/inquiries` 原本對 `user!.id` 做 non-null assertion，session 過渡時偶會炸成 `TypeError: Cannot read properties of null`。改成顯示「Your session expired」卡片。發現於 manual smoke 走測時，是 listings/page.tsx 改動連帶觸發的 pre-existing bug；同步修了 inquiries/page.tsx

### A13. ✅ Payment 改 seller-primary review + Email migrate 到 AWS SES SMTP（已完成 — 2026-05-20）

把第一線審核責任交回賣家，把 admin 從每日 ops 解放但保留覆審權；同時把通知信
從 Resend 沙箱 domain 改 AWS SES SMTP，讓正式信能寄達。

- [x] **migration 015**：drop `payments_admin_update`，新建 `payments_seller_or_admin_update`（auth.uid() 是 payment.order.seller_id 或 admin/super_admin 都可 update）；補 `idx_payments_status_pending` (partial) + `idx_payments_order_status`
- [x] `src/actions/payment.ts`：
  - `verifyPayment` role check 改為 seller-of-order 或 admin/super_admin，audit_logs / buyer 通知都標記 reviewer 角色
  - `submitPayment` 通知改寄 seller（primary）並 CC `ADMIN_EMAIL`；同時接受 schedule.status='scheduled' 讓買家「Pay Early」
- [x] `src/components/order/PaymentVerifyActions.tsx`（從 `src/components/admin/` 移過來，admin/ 改為 re-export），接 `reviewerLabel` prop 分頭顯示
- [x] `(app)/orders/[id]` Payment Tab：seller/admin 看到自己有權的列直接 verify/reject；payment history 文案 `Admin: {note}` → `Reviewer note: {note}`
- [x] `(app)/components/order/PaymentScheduleTable.tsx`：對 `scheduled` 列顯示「Pay Early」按鈕（buyer 視角）+ tooltip
- [x] `src/lib/notifications/counts.ts`：seller 新增 `paymentsAwaitingMyReview` 計數，sidebar 顯示 badge
- [x] **Email migration**：
  - 移除 `src/lib/email/resend.ts`，改 `src/lib/email/smtp.ts`（nodemailer + AWS SES SMTP；`sendEmail` 簽名與舊版相容、加 `verifySmtp()`）
  - `.env.local` 預填 `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_SECURE` / `EMAIL_FROM_*` / `ADMIN_EMAIL`（`.env.example` 改成註解佔位，避免 leak）
  - `src/lib/notifications/dispatch.ts`：取消舊的 silent `catch(_){}`，改 `console.warn`
  - 新 server action `sendTestEmail` + `<SendTestEmailButton />` 掛到 `/admin/settings`
- [x] **Incoterm consistency**：`acceptQuotation` 寫入 `orders.incoterm = q.incoterm`；`<ContractDraftForm />` 取 `order.incoterm ?? order.current_quotation?.incoterm` fallback
- [x] **`<ShipmentForm />`** 加 optional B/L 與 Inspection Report 上傳（寫進 `order_documents`）
- [x] **`autoCompleteIfReady` bug fix**：Supabase count 改用 `{ count: "exact", head: true }` 避免誤推 completed（ORD-260520-601b6b 案例）
- [x] **`<SelectItem />`** 補 `data-[highlighted]` 樣式，解決合約 redraft 下拉文字 / 背景對比不足
- [x] **Dev log discipline**：新增 `scripts/check-dev-errors.mjs` + 升級 `scripts/probe-ssr.mjs` 過濾 MCP / 瀏覽器擴充注入的 hydration false positive；`.cursor/rules/verify-before-commit.mdc` 強制在 UI 測試後跑這支腳本

### A12. ✅ Payment timeline decoupling（已完成 — 2026-05-19）

把付款從訂單時間軸抽離，改為多階段獨立排程：

- [x] migrations 013/014：建立 `payment_schedules` 表 + `payments.schedule_id` + `orders.incoterm` + 9 個 milestone 時間戳；hard cutover 清掉 `payment_terms` / `payment_due_days` 欄位
- [x] `src/lib/order/stateMachine.ts` 簡化為 12 階段線性（去掉 `payment_pending` / `paid` 分支）
- [x] `src/lib/validations/payment-schedule.ts`：milestone 依 Incoterm 過濾、`PaymentScheduleArraySchema` 校驗 SUM=100
- [x] `src/actions/order.ts`：`draftContract` 接 incoterm + schedule[]；新增 7 個手動 milestone server actions（before_production / before_shipment / before_loading / bl_received / shipping_docs / bl_plus_insurance / picked_up）；新增 `triggerMilestone` helper；`markShipped` / `markArrived` / `markCustomsCleared` 同時觸發對應 milestone；移除 legacy wrappers (`generateContract` / `updateShipment` / `confirmReceipt` / `markDelivered`)
- [x] `src/actions/payment.ts`：`submitPayment` 必填 `schedule_id`；`verifyPayment` 改寫 schedule 而非 order status，搭配 `autoCompleteIfReady` 在所有 schedule paid 時 → completed
- [x] `src/lib/contract/template.ts`：渲染 payment-schedule 表，取代「100% within 5 days」段落
- [x] 新元件：`<PaymentScheduleBuilder />`、`<PaymentScheduleTable />`、`<MilestoneActionButtons />`
- [x] `ListingForm.tsx`：Incoterm 限縮 FOB / CFR / CIF（移除 EXW / DDP）
- [x] `/api/cron/payment-schedule` + `vercel.json`：每日 04:00 UTC 補算 `bl_date_plus_N` due_date、scheduled→due、due→overdue
- [x] **部署備註（2026-05-25）**：`vercel.json` 已設定 cron path；production 需設 env `CRON_SECRET`（Vercel 亦接受 `x-vercel-cron`）。日常 E2E 可手動觸發 milestone，不依賴 cron
- [x] `src/lib/notifications/dispatch.ts`：新增 `notifyScheduleDue` / `notifyScheduleOverdue`
- [x] `src/lib/notifications/counts.ts`：buyer 的 `ordersNeedingMyAction` 加入 `payment_schedules.status='due'/overdue` 的 distinct order 數
- [x] docs：PRD §2/§4.4/§4.5、SCHEMA +§5c、ARCHITECTURE §4.4/§4.5/§8/§10、CONTRACT_TEMPLATE §2/§4 同步

### A11. ✅ SMS 交易通知（已完成）

- [x] `.env.example`：`SMS_BASE_URL` / `SMS_APP_ID` / `SMS_TYPE`（可選 `type`）+ `ADMIN_EMAIL`
- [x] `src/lib/sms/client.ts`：`POST …/sendSMS.do`，`SMS_TYPE` 空則不帶 `type`
- [x] `011_platform_settings.sql` + `/admin/settings` 開關 `sms_notifications_enabled`
- [x] `012_listings_categories_order_party_read.sql`：訂單詳情頁 listing/category embed RLS
- [x] `src/lib/notifications/dispatch.ts`：與 Resend email 並行；需 profile.phone + Admin 開關 + env 才送 SMS
- [x] 掛載：`inquiry` / `quotation` / `order` / `payment` 既有 email 觸發點

### A10. ✅ Workspace 待辦通知（已完成）

之前的 Dashboard 只在卡片副標寫「N pending」，且 sidebar 完全沒有 badge，使用者必須點進 `/inquiries` 才知道有待處理事項。本次補上：

- [x] `src/lib/notifications/counts.ts`：`getUserActionCounts(userId, role)` 與 `getAdminActionCounts()`，全部以 `React.cache()` per-request 記憶化，sidebar + dashboard 共用一次查詢
- [x] `getOrderActionOwner(status)` / `describeOrderAction(status, myRole)`：判定某個訂單狀態目前是哪一方的回合，並產生短句 hint（「Submit payment」 / 「Mark ready to ship」 …）
- [x] `(app)/layout.tsx`：Inquiries / Orders / Settings 三個側欄項目顯示金色數字 badge、紅色「!」disputed badge、紅點 incomplete-profile 提示
- [x] `(app)/dashboard/page.tsx`：incomplete-profile banner、Quick links 卡片帶 action-needed badge、**Priority Actions 區塊**（混合 orders + inquiries top 5）、Active Orders 每列 「Your turn」/「Disputed」hint、Inquiries 區塊改為角色感知（seller 顯示 `pending`+`negotiating`，buyer 顯示 `quoted`+`negotiating`）
- [x] `admin/layout.tsx`：Payments 顯示金色 badge（pending count）、Orders 顯示紅色 badge（disputed count）
- [x] `admin/page.tsx`：新增 Disputed Orders 卡片、Payments Pending 卡片帶 action-needed badge、**動態 Priority Actions 區塊**（依 admin counts 列出進入點，全部 0 顯示「All caught up」）

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
| ~~Resend domain DNS 來不及~~ | ✅ 已切換 AWS SES SMTP（2026-05-20）；備案：若 SES 出問題可暫時 fallback Gmail SMTP（同樣靠 `src/lib/email/smtp.ts` 換 env 即可） |
| Vercel build 失敗（env） | 本地 `next build` 先過，確認 `server-only` 沒進 client |
| AI Token 過大 | 訊息超過 N 條時對前文做摘要 |
| Storage 成本 | KYC docs / contracts size 5MB 上限，圖檔壓縮 |
| 005 migration 破壞線上資料 | 先在 staging 跑；payer_id rename 用 `ALTER TABLE ... RENAME COLUMN` 而非 drop+recreate |

---

## D. Definition of Done（MVP 上線版）

- [x] A1 schema 對齊全部完成（TS types 由 `npm run db:types` 重新生成）
- [ ] A2 IM 可雙方即時對話 + 圖片附件 — party DM (`/messages`) 已通；order detail tab 仍待
- [x] A3 簽名掃描可上傳並推進到 `contract_signed` 狀態（009 完成）+ 雙方簽名嵌入 PDF 預覽（commit 1620d8e）
- [x] A4 **`order-documents`** / **`avatars`** / **`kyc`** / **`listings`** buckets 建立完成（010 / 021 / 019 / 024）；只剩 `chat`（與 A2 一起做）
- [x] A5 dispute / cancel 流程可走通（009 完成）
- [x] A6 KYC 上傳 + admin 門檻 + 四級 level + phone OTP（migrations 019/020）
- [x] A7 部署：站台已上 Vercel <https://galloisgraphite.vercel.app/>，所有 migrations 已套用
- [x] A7 full_prepay 端到端 happy path 通過（2026-05-15 走測 `ORD-TEST-MP6PL7MZ`）
- [x] A7 分期結案閘門 + dispute / cancel / force-transition + RLS 複查（2026-05-25，`npm run qa:a7`）
- [x] A8 B2B 全流程追蹤（quotation 議價、12 階段狀態機 + payment_schedules、文件中心）已完成
- [x] A9 Migration 自動套用 runner 完成（`npm run db:migrate`）
- [x] A13 Payment 改 seller-primary review + AWS SES SMTP（2026-05-20）
- [x] A14 Category 重整 + Listing UX polish — migrations 022/023, structured spec_schema, MOQ, custom mesh range, auto-title, Select label fixes（commits `15fba5b → ff464c9`，2026-05-22）
- [x] A15 Listing images — migration 024 `listings` bucket（720p WebP / 2 MiB cap / owner-scoped RLS）+ `<ListingImageUploader />`（drag-drop + reuse-library + client compress）+ market card banner + detail gallery（2026-05-24）
- [x] A16 Seller listing edit / delete — `updateListing` 走完整 zod 校驗 + `deleteListing`（FK-aware，order-attached 擋下）+ `/listings/[id]/edit` + `<ListingRowActions />` 行內 Edit/Pause/Resume/Sold-out/Delete（2026-05-24）
- [x] 公開頁 SEO meta（title/description/og）齊全
- [x] 所有路由都有 `loading.tsx` 與 `error.tsx` 雛形（多數已完成）
- [x] 沒有 console.error / TS error / lint error（`npm run build` 在每個 commit 前都跑過）
