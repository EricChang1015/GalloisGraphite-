# Mada Graphite Platform — Product Requirements

> 此文件是基於原始 [`Requirements.md`](./Requirements.md) 重新整理出的可執行 PRD。
>
> **實作狀態**：MVP 主要功能已實作完成，補完項與 Phase 2 規劃見 [`ROADMAP.md`](./ROADMAP.md)。
> **實作單一真相來源**：[`ARCHITECTURE.md`](./ARCHITECTURE.md)（最後同步 2026-05-27）。

## 1. 願景

打造一個結合 AI 智能諮詢、市場情報、B2B 交易的石墨產業平台,連接全球買家與
馬達加斯加在地賣家(Graphite Energy Inc. 自有礦場為主要供應方)。

## 2. MVP 範圍

### IN SCOPE

#### 2.1 已實作 ✅

| # | 功能 | 對應位置 |
|---|---|---|
| 1 | **品牌官網**：首頁 / About / Products / News / Geopolitics / Sustainability | `(public)/` |
| 2 | **AI 助手**（訪客模式）：石墨知識/公司介紹；偵測購買意圖回 `[LOGIN_REQUIRED]` | `/chat` + `/api/chat` |
| 3 | **註冊/登入**：Email + 驗證信 / Google OAuth，role = buyer / seller | `(auth)/{login,register,verify}` + `auth/callback` |
| 4 | **超級管理員後台**：用戶凍結/解凍、品類管理、訂單瀏覽、付款審核、新聞管理 | `/admin/*` |
| 5 | **賣家上貨**：選品類 → 規格 / 數量 / 出貨地 / 出貨時間區間 / 價格 / 幣別 / Incoterm | `/listings/new` |
| 6 | **買家市場**：瀏覽 listings、篩選、單品詳情 | `/market` + `/market/[id]` |
| 7 | **詢價 → 報價流程**：買家提交 inquiry → 賣家發 quotation（規格/價格/Incoterm/有效期）→ 雙方可 counter 來回議價 → buyer accept → 自動建立 order | `<InquiryDialog />` + `<QuotationForm />` + `acceptQuotation` |
| 8 | **訂單狀態機（B2B 12 階段，付款已抽離）**：Quotation Pending → Quoted ↔ Negotiating → Contract Pending → Contract Signed → In Production → Ready to Ship → Shipped → In Transit → Arrived → Customs Cleared → Completed；Disputed / Cancelled。付款不再卡關訂單流程，獨立由 `payment_schedules` 管理（migration 013/014） | `src/lib/order/stateMachine.ts` |
| 9 | **合約生成 + 多階段付款排程**：賣家 draftContract 選 Incoterm（FOB/CFR/CIF only） + 用 `<PaymentScheduleBuilder />` 拆出 prepayment / regular / postpayment 多筆 installment（總和 100%）；買家 approve / reject（revision_no++）；雙方上傳簽名掃描 | `src/lib/contract/template.ts` + `<ContractDraftForm />` + `<PaymentScheduleBuilder />` |
| 10 | **多階段付款 + 人工審核**：每筆 schedule 在對應 milestone 觸發（粗節點隨訂單狀態自動；細節點由買賣方手動 button；`bl_date_plus_N` 由 Vercel Cron 排程）→ schedule.status `scheduled → due → awaiting_review → paid`。**Seller 為 primary reviewer，在 Payment tab 內直接 verify / reject；Admin 保留覆審 / 爭議介入權**（migration 015）。Buyer 可對 `scheduled` 列 **「Pay Early」** 提前結算 | `/admin/payments` + `<PaymentScheduleTable />` + `<PaymentVerifyActions />` + `<MilestoneActionButtons />` + `/api/cron/payment-schedule` |
| 11 | **訂單時間軸**：每次狀態轉換 append timeline 事件 | `appendTimeline()` |
| 12 | **Audit log**：所有 admin 動作寫入 `audit_logs` | `writeAuditLog()` |
| 13 | **Email + SMS 通知**：詢價/報價/合約/出貨/付款等 10 個 user 事件（SMS 需 Admin 開關 + env + `profiles.phone`）；admin 事件僅 Email。Email 走 **AWS SES SMTP（nodemailer，2026-05-20 從 Resend 遷移）**，`/admin/settings` 有「Send test email」即時驗證 | `src/lib/notifications/dispatch.ts` + `src/lib/email/smtp.ts` + `src/lib/sms/client.ts`；詳見 [ARCHITECTURE §8](./ARCHITECTURE.md#8-通知系統) |
| 14 | **使用者 Dashboard**：active orders + pending inquiries 快速概覽 + 角色相關快捷 | `/dashboard` |
| 15 | **三主題 UI**：light / dark / editorial（next-themes） | `<ThemeToggle />` |
| 16 | **訂單進度條**：固定 12 階段線性進度（付款已抽離），右上 micro-badge 顯示 Payments: X/Y paid | `<OrderProgressBar />` |
| 17 | **訂單文件中心**：13 種文件類型分組（Contract / Invoice / Logistics / Inspection / Customs / Payment / Other）+ 每個 type 多檔上傳 + admin 核驗徽章 | `<OrderDocumentsTab />` + `<DocumentUploader />` |
| 18 | **B/L + Vessel 追蹤 + 文件上傳**：賣家 markShipped 時填 B/L No、vessel name/IMO、container numbers、ETD/ATD/ETA；UI **可選**上傳 B/L 掃描與 Inspection Report（COA/SGS）到 `order_documents`（不強制，符合實務上有些船公司只給電子 B/L）。任一方可 markArrived（記 ATA）；買家 markCustomsCleared | `<ShipmentForm />` + `<OrderPhaseActions />` |
| 19 | **Disputed / Cancelled UI**：所有非終止狀態都可 raiseDispute / cancelOrder，admin 收 email + audit log | `<OrderPhaseActions />` |
| 20 | **Admin 訂單詳情 + Force Transition**：admin 可 force transition 繞過狀態機（dispute 解決用），所有強制動作寫 audit_logs | `/admin/orders/[id]` + `<AdminOrderActions />` |
| 21 | **Forgot / Reset password**：寄 recovery 連結 → 設新密碼；Google OAuth 用戶可藉此額外綁定 email/password identity，同一個 profile 可用兩種方式登入 | `(auth)/{forgot-password,reset-password}` + `requestPasswordReset` / `updatePassword` server actions |
| 22 | **付款憑證上傳**：`bank_transfer` / `usdi` / `mup` 出示 file uploader 上傳到 `order-documents/<order_id>/payment_proof/...`，寫 signed URL 進 `payments.proof_url`；on-chain 方式才要求 `tx_hash` | `<PaymentForm />` |
| 23 | **簽名合約預覽**：`<ContractPreview />` 內嵌雙方 signed scan（image 或 PDF iframe），「Download signed contract」 把簽名注入到列印 HTML，PDF 輸出含簽名 | `<ContractPreview />` |
| 24 | **`order-documents` Storage bucket**：private、20 MB / PDF + image 白名單、`storage.objects` 4 條 RLS（read/insert/update parties；delete admin） | `010_storage_order_documents.sql` |
| 25 | **Commercial profile gate + Settings 頁**：`createInquiry` / `createListing`（seller）/ `submitPayment` 在 `profiles.{company_name,country}` 為空時回 `error.code='PROFILE_INCOMPLETE'`；UI 顯示 toast 含「Open Settings」action 跳到 `/settings?prompt=incomplete`；`<CommercialProfileForm />` 編輯 full_name / company_name / country / phone | `src/lib/auth/commercial.ts` + `src/actions/profile.ts` + `(app)/settings/page.tsx` |
| 26 | **結構化 Flake Graphite spec schema + listing override**（migration 022）：`product_categories.spec_schema` 改成結構化 jsonb（`product_type` / `mesh_size` / `fixed_carbon_min/max` / `moisture_max` / `size_distribution_min_pct` / `is_custom`）；舊 MADA1/MADA2 brand 命名 deactivate；listing 端 `specs` jsonb 為 override；Custom Grade 解鎖賣家自填 mesh + 範圍 | `src/lib/categories/spec.ts` + `<CategoryFormDialog />` + `<ListingForm />` |
| 27 | **Listing MOQ + auto-title + Custom mesh 範圍**（migration 023 / 2026-05-22）：optional `listings.min_order_quantity`；`createInquiry` 加 BELOW_MOQ guard；Custom Grade listing 的 `specs.mesh_size` 改 `MeshSize[]`，UI checkbox grid，顯示 "+35 to -100 Mesh"；`buildListingTitle()` helper + 「Generate title」按鈕；Market 卡片顯示 spec chip + MOQ；Category / Product Type / Mesh `<SelectValue>` 改用 children render function 解掉 base-ui 顯示 raw value 的 bug | `src/lib/categories/spec.ts` + `<ListingForm />` + `<InquiryDialog />` + `<MarketListingCard />` + `<CategoryActions />` |
| 28 | **Listing images**（migration 024 / 2026-05-24）：public `listings` storage bucket（2 MiB / JPEG/PNG/WebP / owner-scoped RLS）；`<ListingImageUploader />` 兩 tab UI（Upload new + From your library 重用既往上傳）；client `compressTo720pWebp` 在上傳前縮到 720 px WebP（實測 12 KB → 1.2 KB）；`<MarketListingCard />` 16:9 banner；`/market/[id]` `<ListingGallery />` hero + thumbnail；`/listings` 加縮圖；圖片 optional | `src/actions/listing-images.ts` + `src/lib/images/compress.ts` + `src/lib/listings/images.ts` + `<ListingImageUploader />` + `<ListingGallery />` |
| 29 | **Seller listing edit / delete**（2026-05-24）：`updateListing` 升級成 full-form zod 校驗 + commercial / KYC gate；新 `deleteListing` 在 order-attached listing 時回 `LISTING_HAS_ORDERS`；新頁 `/listings/[id]/edit` 復用 `<ListingForm existing>`；`/listings` 加 Actions 欄行內 Edit / Pause / Resume / Sold-out / Delete（Delete 走 confirm dialog） | `src/actions/listing.ts` + `src/app/(app)/listings/[id]/edit/page.tsx` + `<ListingRowActions />` + `<ListingForm />` |
| 30 | **儀表板 + 核心公開行銷頁多語系**（2026-05-27–28）：next-intl + cookie `mg-locale` + `profiles.locale`（migration 028）；`(app)/**` 儀表板 + `/`、`/about`、`/products`、`/sustainability`、`/geopolitics` 支援 `en` / `zh-CN`；Settings / Navbar 語言選擇器；合約正文 / email / SMS / admin / news / chat 仍英文 | `src/i18n/*` + [`I18N_PLAN.md`](./I18N_PLAN.md) |

> 已實作但原 PRD 未列的項目（Dashboard、行銷頁 Geopolitics/Sustainability、Admin Console 統計、News slug 富文本等）見 [`ARCHITECTURE.md` §附錄 A](./ARCHITECTURE.md#附錄-a實作但-prd-未列項目)。

#### 2.2 待補完（MVP 上線前必做） 🟡

詳見 [`ROADMAP.md` §A](./ROADMAP.md#a-mvp-補完項上線前必做)：

- ~~**A1** Schema 對齊（payments / news / orders）~~ ✅ 已完成（migration 005）
- ~~**A2** 站內 IM~~ ✅ Party DM 文字對話已完成（`/messages`、`MessageCounterpartyButton`、`npm run qa:chat`）；訊息附件 / `chat` bucket **不做**（2026-05-28 產品決策）
- ~~**A3** 合約簽名掃描上傳 UI~~ ✅ 已完成（009 + `<SignedScanUploader />`，並可嵌入簽名後 PDF 預覽下載）
- ~~**A4** Storage buckets~~ ✅ `order-documents` / `avatars` / `kyc` / `listings` 已建立；`chat` bucket 不做（無 IM 附件）
- ~~**A5** Disputed / Cancelled UI 觸發點~~ ✅ 已完成（009 + `<OrderPhaseActions />`）
- ~~**A6** KYC~~ ✅ 已完成（migrations 019/020、`/settings/kyc`、四級 level、admin 門檻）；非阻塞延伸見 ROADMAP §A6「仍待」
- ~~**A7** 部署與 E2E 煙霧測試~~ ✅ 已完成（2026-05-25，`npm run qa:a7` + 分期 UI 走測，見 [`TESTING.md`](./TESTING.md) §8）
- ~~**B1** B2B 全流程追蹤~~ ✅ 已完成（migrations 007 + 009；付款已抽離至 `payment_schedules`，見 ARCHITECTURE §4.4–4.5）

### OUT OF SCOPE（此次 MVP 不做）

- 區塊鏈/錢包整合（WalletConnect、Web3、Fireblocks 等一律不做）
- DocuSign / 電子簽名服務（平台自證即可）
- 即時石墨價格與歷史走勢圖（規格分散、單一報價偏差大,延後到 Phase 2）
- 自動爬取石墨新聞（改為 admin 手動發布）
- **admin 後台 / news / chat 多語系**（儀表板 + 核心公開行銷五頁 `en` + `zh-CN` 已完成；見 §2.1 #30）
- 自動化爭議仲裁（僅 admin 介入,合約 + 平台方為準）
- 賣家自動結算 / payouts（confirmReceipt 後僅寄信通知 admin 平台外操作）

## 3. 角色與權限

| 角色 | 描述 | 權限要點 |
|---|---|---|
| guest | 未登入訪客 | 看公開頁、用 AI(限知識性問答) |
| buyer | 已驗證買家 | 詢價、下單、付款、確認收貨、IM |
| seller | 已驗證賣家(僅自有/合作礦商) | 上貨、回應詢價、出貨更新、IM |
| admin | 平台運維 | 用戶/品類/訂單/付款/新聞/IM 介入 |
| super_admin | 平台所有人 | 管理 admin、敏感設定、平台錢包 |

> 「promote 為 admin」僅 super_admin 可執行（在 `setUserRole` 內檢查）。
> 第一個 super_admin 由 `002_seed_first_admin.sql` 手動 SQL 設定。

## 4. 核心使用者流程

### 4.1 註冊
1. **Email 註冊**：填 email + 密碼 + 角色(buyer/seller) + 公司名/國家
   - Supabase Trigger `handle_new_user` 自動建立 `profiles`（status='pending'）
   - Supabase 寄驗證信 → 點擊驗證連結 → Trigger `handle_user_email_confirmed` 把 status 改為 active
2. **Google OAuth 註冊／登入**（lazy collect）：點「Continue with Google」→ Supabase 走 OAuth 2.0 → 回 `/auth/callback?code=...` → `exchangeCodeForSession` 後重導 `/dashboard`
   - `handle_new_user` 偵測 `auth.users.email_confirmed_at` 已非 null（Google 已驗證），直接建 `profiles` 並設 `status='active'`
   - `role` 預設 `'buyer'`、`company_name` / `country` 留空，待用戶日後在 inquiry / listing / payment 時補齊（並進入 KYC 流程，見 ROADMAP §A6）
3. **Forgot / Reset password**（`/forgot-password` + `/reset-password`）：
   - `requestPasswordReset(email)` 呼叫 `auth.resetPasswordForEmail`，寄出 recovery 連結到 `/auth/callback?type=recovery&next=/reset-password`
   - 在 reset 頁設定新密碼後，Supabase 會把 `email` identity 加到該 `auth.users` 上 → **原本只用 Google 登入的帳號可同時用 email/password 登入**（同一個 profile，不會建第二個帳號）
   - `signUp` 也會偵測 Supabase 對「已存在帳號」的 silent no-op（`data.user.identities.length === 0`）並回友善提示，導去 `/forgot-password`
4. 超管可在 `/admin/users` 凍結/解凍（`status='frozen'`）

### 4.2 賣家上貨
1. 賣家進入 `/listings/new`
2. 選擇品類（從 `product_categories` 撈），可看到 `spec_schema` 提示欄位
3. 填：title、specs（JSON）、數量、單位（MT/KG）、出貨地、可出貨時間區間、單價、幣別、Incoterm、備註、圖片
4. 提交 → `listings.status = active`，立刻出現在 `/market`

### 4.3 買家詢價 → 訂單
1. 買家在 `/market` 瀏覽，進詳情頁，點「Submit Inquiry」
2. `<InquiryDialog />` 表單：requested_qty、target_price、destination、message
3. 賣家收到 Email 通知 + 在 `/inquiries` Received Tab 看到
4. 賣家以 `<QuotationForm />` 發出第一筆 quotation（可預設 listing 條件 + 14 天 validity）→ 雙方可 counter 來回議價
5. Buyer accept quotation → `acceptQuotation` 建立 `orders.status='contract_pending'`、`orders.incoterm = q.incoterm`、`current_quotation_id = q.id`；inquiry.status='converted'，導向訂單頁。Incoterm 在這一步就敲定，避免後續合約 draft 沿用 listing 的舊 Incoterm。

### 4.4 訂單核心流程（B2B 12 階段，付款已抽離）

```
quotation_pending → quoted ↔ negotiating
  └─ buyer accept quotation
       └─ contract_pending  ←─────── 賣家可重新起草（revision_no++）─┐
            └─ buyer approve + 雙方上傳簽名掃描                      │
                 └─ contract_signed → in_production
                      → ready_to_ship → shipped → in_transit
                      → arrived → customs_cleared → completed
```

付款不再卡關訂單流程；installment 改由 `payment_schedules` 表 1..N 筆紀錄
（見 §4.5）。`customs_cleared → completed` 由 `verifyPayment` 在「所有 schedule
皆 paid」時自動推進。任何非終止狀態都可進入 `disputed` 或 `cancelled`
（雙方 + admin 可觸發；admin 另可 `forceTransitionOrder` 繞過狀態機，全程寫
`audit_logs`）。完整定義見 [`src/lib/order/stateMachine.ts`](../src/lib/order/stateMachine.ts)
與 [`ARCHITECTURE.md`](./ARCHITECTURE.md) §4.4「訂單狀態機」。

### 4.5 付款（多階段排程）

**Incoterm 範圍**：只支援 `FOB` / `CFR` / `CIF`（EXW / DDP 已移除）。

**Schedule 結構**：每張訂單在簽約時由賣家透過 `<PaymentScheduleBuilder />`
拆出 1..10 筆 `payment_schedules` 列，每筆有：

- `category`：`prepayment` / `regular_payment` / `postpayment`
- `milestone`：13 個值，依 Incoterm 過濾（例如 CIF 才能用 `bl_plus_insurance_received`）
- `percentage` + `amount`（金額 = order.total × pct / 100）
- `status`：`scheduled → due → awaiting_review → paid` (`overdue` / `waived` 為旁支)

**Milestone 觸發策略**（hybrid manual + auto + cron）：

| Trigger 類型 | 例子 | 來源 |
|---|---|---|
| 自動（隨訂單狀態） | `contract_signed`、`loaded_onto_vessel`（隨 `markShipped`）、`arrived_at_port`、`accepted_by_buyer`（隨 `markCustomsCleared`） | `src/actions/order.ts` 內呼叫 `triggerMilestone()` |
| 手動（賣家按鈕） | `before_production` / `before_shipment` / `before_loading` | `<MilestoneActionButtons />` |
| 手動（買家按鈕） | `bl_received` / `shipping_docs_received` / `bl_plus_insurance_received` / `goods_picked_up` | `<MilestoneActionButtons />` |
| 時間（cron） | `bl_date_plus_30 / 60 / 90` | `/api/cron/payment-schedule` 每日 04:00 UTC |

**買家付款流程**：在 Payment tab `<PaymentScheduleTable />` 看到 `due`（或 `scheduled` — 可 Pay Early）列
→ 點 Submit Payment 開 dialog（method / tx_hash / proof_url / note）→
`payments.status='pending'` + `schedule.status='awaiting_review'` →
**seller 在訂單的 Payment tab（或 admin 在 `/admin/payments`）審核**
→ verified 時 `schedule.status='paid'` + `schedule.paid_payment_id`。

**Pay Early**：buyer 可以對任何 `scheduled` 列（尚未到 milestone）按 Pay Early，
方便在已有資金 / 想鎖匯率時提前結算。提前付款一樣會送進 awaiting_review 等 seller / admin verify。

**Reviewer 邏輯（migration 015）**：
- Seller 是 primary reviewer：他能直接從鏈上 (USDT) 或自家銀行對帳系統確認入金
- Admin 是 fallback：遇到爭議、seller 失職、買賣雙方意見不一時介入
- RLS：`payments_seller_or_admin_update` — `auth.uid()` 是該 payment.order 的 seller_id 或 `current_user_role() ∈ {admin, super_admin}`
- 通知：`submitPayment` → seller email/SMS（主收）+ admin email CC；`verifyPayment` → buyer email 含 reviewer 角色標記

**自動 completion**：`verifyPayment` 在「所有 schedule paid 且
`order.status='customs_cleared'`」時呼叫 `autoCompleteIfReady()` 把訂單
推到 `completed`。

> **2026-05-20 bug fix**：`autoCompleteIfReady` 先前用 `.select("id")` 取陣列 length 判斷，
> 部分情況回傳 size hint 為 0 導致沒付完款的訂單被誤推到 `completed`（ORD-260520-601b6b
> 案例）。現改為 `select("id", { count: "exact", head: true })` 取真實 count。

### 4.6 站內 IM（Party DM ✅ — 文字 only）

**已實作（migration 016–018）**：

- 同一 buyer + seller 僅一條 `chat_rooms.type='party'` thread（不再為每張訂單開獨立 order room）
- `/messages` 對話列表 + `/messages/[userId]` 全頁 thread（`<PartyChatPanel />`）
- Market / 訂單 Overview 的 `<MessageCounterpartyButton />` 開啟同一 party thread
- Realtime：`postgres_changes` on `messages`（`PartyChatPanel` 內訂閱）
- 訊息可帶 `context_type`（listing / inquiry / order / none）+ `context_id`

**明確不做**：訊息附件 / `chat` Storage bucket（MVP 僅文字）。

**可選 Phase 2**：訂單詳情內嵌精簡版 chat；Realtime polling fallback。

## 5. 非功能需求

| 類別 | 要求 | 現況 |
|---|---|---|
| 部署 | Vercel（前端 + Server Actions），Supabase（Postgres / Auth / Storage / Realtime） | ✅ 已部署 <https://galloisgraphite.vercel.app/>；E2E 煙霧測試已完成（ROADMAP §A7，見 [`TESTING.md`](./TESTING.md)） |
| 效能 | 公開頁 SSG/ISR；市場頁 SSR + RSC；首屏 LCP < 2.5s（WiFi） | ✅ 公開頁 ISR、SSR 已實作 |
| 安全 | 全表 RLS、service_role key 永不入 client、輸入用 zod | ✅ |
| 可觀測性 | `audit_logs` + `ai_chat_logs` 記錄；Vercel Logs；後續可接 Sentry | ✅ audit/AI logs；Sentry 為 Phase 2 |
| 國際化 | next-intl（cookie `mg-locale` → `profiles.locale` → Accept-Language）；已上線 `en` + `zh-CN` 儀表板 + 核心公開行銷五頁；合約 / 郵件 / admin / news / chat 仍英文 | ✅ Phase 2 完成；詳見 [`I18N_PLAN.md`](./I18N_PLAN.md) |
| Migration 自動化 | 所有 schema 變更可由 AI agent 透過 Supabase Management API 直接套用，不需 DB password | ✅ `npm run db:migrate` 走 Personal Access Token；追蹤表 `_agent_migrations` |

## 6. 內容資產

- 舊 madagraphite.com 鏡像位於 `docs/oldSite/madagraphite.com-mirror/`,
  從中抽取公司介紹、產品規格、礦場照片;整理至 [`docs/LEGACY_CONTENT.md`](./LEGACY_CONTENT.md)。
- 行銷文案參考 [`docs/COPY_DRAFTS.md`](./COPY_DRAFTS.md)。
- 合約範本參考 [`docs/CONTRACT_TEMPLATE.md`](./CONTRACT_TEMPLATE.md)，
  動態渲染由 `src/lib/contract/template.ts` 完成。

## 7. 成功指標（MVP 上線後 30 天觀察）

- 註冊用戶 > 50（買家:賣家比例約 3:1）
- 完成首筆完整流程（詢價 → 簽約 → 付款 → 出貨 → 確認）
- AI 助手問答觸發登入 CTA 轉換率 > 10%
- Admin 平均審核付款時間 < 24h

## 8. 變更歷史

| 日期 | 變更 |
|---|---|
| 2026-05-11 | 對齊實際代碼：標記 IN SCOPE 1–13 已完成；新增 14 (Dashboard) / 15 (三主題)；補非功能需求現況欄；OUT OF SCOPE 補 payouts；新增 §2.2 待補完項 reference ROADMAP §A |
| 2026-05-13 | feat(order) 76e40c2：導入 13 階段 B2B 訂單狀態機 + quotation 議價 + order_documents 文件中心；migrations 改名 006/007 → 007/009（保留 006_ai_chat_logs / 008_oauth_profile_handling） |
| 2026-05-14 | feat(admin) 3f9c8d2：新增 `/admin/orders/[id]` 與 `<AdminOrderActions />` force-transition 控制台；docs 15a21f5：同步 SCHEMA / ARCHITECTURE / PRD / ROADMAP |
| 2026-05-15 | feat(db) 2c38ddf：`scripts/apply-migrations.mjs` 與 `scripts/gen-types.mjs` 透過 Supabase Management API 自動套用 migration（不需 DB password）；新增 `.cursor/rules/migrations.mdc` 規範 AI agent 撰寫 migration；本次 PRD §4.4/4.5/§5/§8 對齊 13 階段 B2B 流程 |
| 2026-05-15 | feat(auth) c163710：新增 `/forgot-password` + `/reset-password` 流程；Google OAuth 用戶可藉此補綁定 email/password identity；`signUp` 偵測 Supabase silent no-op 並導向 forgot password |
| 2026-05-15 | fix(orders) a2095b6：修復 PostgREST 1:1 embed 把 contracts 解析成 object 而非陣列導致「No contract drafted yet」幻象 bug；新增 `010_storage_order_documents.sql` 與 `docs/TESTING.md` |
| 2026-05-15 | fix(orders) 1620d8e：合約簽名後預覽 / Save-as-PDF 內嵌雙方簽名掃描；`<PaymentForm />` 對 `bank_transfer / usdi / mup` 加 remittance proof uploader；`/admin/payments` 用對 FK hint（`payments_payer_id_fkey`） |
| 2026-05-15 | fix(admin) 768cfbc：`/admin` 計數器與 `/admin/payments` 同步（`dynamic = "force-dynamic"` + 於 `verifyPayment` / `submitPayment` revalidate） |
| 2026-05-15 | docs 773411c：完成 full-prepay 端到端走測（`ORD-TEST-MP6PL7MZ`）；A4 關閉，A7 full-prepay happy path 勾選；OrderProgressBar 在 `completed` 狀態 polish |
| 2026-05-19 | refactor(orders) decouple-payment：付款從訂單時間軸抽離，新增 `payment_schedules`（migration 013/014）；訂單狀態機簡化為 12 階段線性；Incoterm 限縮 FOB/CFR/CIF；新增 `<PaymentScheduleBuilder />`、`<PaymentScheduleTable />`、`<MilestoneActionButtons />`、`/api/cron/payment-schedule`；移除 `payment_terms` / `payment_due_days` 欄位（hard cutover，舊測試資料清空） |
| 2026-05-20 | feat(payment/email/shipment) seller-review-and-ses：(1) Payment 改 seller 主審 admin 覆審（migration 015 `payments_seller_or_admin_update`，`<PaymentVerifyActions />` 抽到 `src/components/order/` 雙處使用）；(2) Email 從 Resend 改 nodemailer + AWS SES SMTP（`src/lib/email/smtp.ts`，`/admin/settings` 加「Send test email」）；(3) `acceptQuotation` 寫入 `orders.incoterm = q.incoterm`，解決議價更動後合約 draft 仍用 listing 原 Incoterm 的 bug；(4) `<ShipmentForm />` 加 optional B/L + Inspection Report 上傳；(5) `submitPayment` 接受 `scheduled` 期讓買家「Pay Early」；(6) `autoCompleteIfReady` 修正 Supabase count 用法（`{ count: "exact", head: true }`），解決 ORD-260520-601b6b 未付完款就被推到 completed 的 bug；(7) seller `getUserActionCounts` 加 `paymentsAwaitingMyReview` |
| 2026-05-24 | feat(listings) seller-edit-and-delete：`updateListing` 升級為 dual-mode（full-form zod 校驗 + commercial profile / KYC gate；bare status toggle 不變）；新 `deleteListing` 在 `orders.listing_id` 引用該 listing 時回 `LISTING_HAS_ORDERS`（`inquiries` / `quotations` FK 設 `set null` 自動處理）；新 `markListingSoldOut` 快速 action；新 `/listings/[id]/edit` 頁復用 `<ListingForm existing>` pre-fill；`/listings` 新「Actions」欄含 `<ListingRowActions />`（Edit / Pause↔Resume / Sold out / Delete with confirm dialog）；smoke `scripts/smoke-listing-delete.mjs` 11 assertions 全綠 |
| 2026-05-24 | feat(listings) image-upload-720p-with-library：migration 024 建立 `listings` public storage bucket（2 MiB / JPEG/PNG/WebP / owner-scoped RLS）；新 `<ListingImageUploader />`（drag-drop + 從庫重用既往上傳的 thumbnail grid，最多 5 張）；client-side `compressTo720pWebp`（720 px / WebP / q=0.82）在上傳前縮邊重編碼（實測 12 KB PNG → 1.2 KB，~90% reduction）；server actions `uploadListingImage` / `deleteListingImage`（含 scrub `listings.images` 引用）/ `listMyListingImages`；market 卡片 16:9 banner、`/market/[id]` 用新 `<ListingGallery />`（hero + thumbnail 切換）、`/listings` seller 列表加縮圖；9 個 smoke-listing-images RLS assertion + 10 個 verify-schema bucket assertion 全綠 |
| 2026-05-27 | docs: 全面對齊實作 — 修正 migration 計數（001→028）、KYC 四級、Party DM 狀態、付款 seller-primary、Email SES；`.cursorrules` / `README` / `AGENTS.md` 同步 |
| 2026-05-28 | docs: 公開行銷頁 i18n 狀態同步 — ARCHITECTURE / PRD / ROADMAP / TESTING 對齊 I18N_PLAN §6；proxy 守衛清單、Server Actions 補遺、AI market context 狀態篩選 |
| 2026-05-27 | feat(i18n): Dashboard Phase 2 — next-intl + `profiles.locale`（028）；`(app)/**` 儀表板 `en`/`zh-CN`；合併 `main`；docs 同步 ARCHITECTURE / PRD / ROADMAP / I18N_PLAN / SCHEMA |
| 2026-05-22 | feat(categories+listings) flake-graphite-restructure-followup：(1) migration 022 已合併 — `product_categories` 改用結構化 `spec_schema`（product_type / mesh_size / fixed_carbon_min/max / moisture_max / size_distribution_min_pct / is_custom），移除 MADA1/MADA2 brand 命名；(2) migration 023：optional `listings.min_order_quantity`；`createInquiry` 加 `BELOW_MOQ` server-side guard；(3) `<ListingForm />` Category / Mesh 改用 `<SelectValue>{(v)=>label}</SelectValue>`（修正 base-ui Select.Value 顯示 raw UUID/enum code 的 bug）；同步 `<CategoryFormDialog />` 的 Product Type / Mesh Size；(4) `buildListingTitle()` helper + 「Generate title」按鈕；(5) Custom Grade 的 `specs.mesh_size` 改 `MeshSize[]`，UI 變 checkbox grid，`formatMeshSelection` 渲染 "+35 to -100 Mesh"；(6) `<InquiryDialog />` 預設 `requested_qty = MOQ ?? 1`、`target_price` 改空白 placeholder、加 listing summary card；(7) Market 卡片 / 詳情顯示 spec chip（mesh + carbon）+ "Available" / "Min order" 雙行；(8) Admin Category 列表加「Listings: N」count cell；(9) 測試：`scripts/test-listing-spec-helpers.mjs`（17 cases）+ `scripts/smoke-listing-moq.mjs`（10 cases）+ `verify-schema.mjs` 補 7 個 022/023 assertion；(10) 防禦性修正（commit `ff464c9`）：`/listings` 與 `/inquiries` 對 `user!.id` 的 non-null assertion 改成顯示「Session expired」卡片，避免 session 過渡時的 `TypeError: Cannot read properties of null (reading 'id')` |
