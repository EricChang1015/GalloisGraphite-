# Mada Graphite Platform — Product Requirements

> 此文件是基於原始 [`Requirements.md`](./Requirements.md) 重新整理出的可執行 PRD。
>
> **實作狀態**：Day 1–2 MVP 主要功能已實作完成，補完項與 Phase 2 規劃見 [`ROADMAP.md`](./ROADMAP.md)。
> 已實作的真實架構請見 [`ARCHITECTURE.md`](./ARCHITECTURE.md)。

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
| 8 | **訂單狀態機（B2B 13 階段）**：Quotation Pending → Quoted ↔ Negotiating → Contract Pending → Contract Signed → (依 payment_terms 分支) → Payment Pending / Paid / In Production / Ready to Ship / Shipped / In Transit / Arrived / Customs Cleared / Completed；Disputed / Cancelled | `src/lib/order/stateMachine.ts` |
| 9 | **合約生成 + 回合制審核**：賣家 draftContract（含 payment_terms：full_prepay 或 net_after_arrival）→ 買家 approve / reject（可重新起草，revision_no++） → 雙方上傳簽名掃描（私有 Storage） | `src/lib/contract/template.ts` + `<ContractDraftForm />` + `<ContractApproveReject />` |
| 10 | **付款人工審核**：buyer 提交 tx_hash / proof_url，admin 在後台 verify/reject | `/admin/payments` |
| 11 | **訂單時間軸**：每次狀態轉換 append timeline 事件 | `appendTimeline()` |
| 12 | **Audit log**：所有 admin 動作寫入 `audit_logs` | `writeAuditLog()` |
| 13 | **Email 通知**：inquiry 發起、payment 提交、payment 審核、收貨確認 5 個事件點 | `src/lib/email/resend.ts` |
| 14 | **使用者 Dashboard**：active orders + pending inquiries 快速概覽 + 角色相關快捷 | `/dashboard` |
| 15 | **三主題 UI**：light / dark / editorial（next-themes） | `<ThemeToggle />` |
| 16 | **訂單進度條**：依 payment_terms 動態顯示 11–13 階段，已完成綠色、進行中金色、未到灰色 | `<OrderProgressBar />` |
| 17 | **訂單文件中心**：13 種文件類型分組（Contract / Invoice / Logistics / Inspection / Customs / Payment / Other）+ 每個 type 多檔上傳 + admin 核驗徽章 | `<OrderDocumentsTab />` + `<DocumentUploader />` |
| 18 | **B/L + Vessel 追蹤**：賣家 markShipped 時填 B/L No、vessel name/IMO、container numbers、ETD/ATD/ETA；任一方可 markArrived（記 ATA）；買家 markCustomsCleared | `<ShipmentForm />` + `<OrderPhaseActions />` |
| 19 | **Disputed / Cancelled UI**：所有非終止狀態都可 raiseDispute / cancelOrder，admin 收 email + audit log | `<OrderPhaseActions />` |
| 20 | **Admin 訂單詳情 + Force Transition**：admin 可 force transition 繞過狀態機（dispute 解決用），所有強制動作寫 audit_logs | `/admin/orders/[id]` + `<AdminOrderActions />` |
| 21 | **Forgot / Reset password**：寄 recovery 連結 → 設新密碼；Google OAuth 用戶可藉此額外綁定 email/password identity，同一個 profile 可用兩種方式登入 | `(auth)/{forgot-password,reset-password}` + `requestPasswordReset` / `updatePassword` server actions |
| 22 | **付款憑證上傳**：`bank_transfer` / `usdi` / `mup` 出示 file uploader 上傳到 `order-documents/<order_id>/payment_proof/...`，寫 signed URL 進 `payments.proof_url`；on-chain 方式才要求 `tx_hash` | `<PaymentForm />` |
| 23 | **簽名合約預覽**：`<ContractPreview />` 內嵌雙方 signed scan（image 或 PDF iframe），「Download signed contract」 把簽名注入到列印 HTML，PDF 輸出含簽名 | `<ContractPreview />` |
| 24 | **`order-documents` Storage bucket**：private、20 MB / PDF + image 白名單、`storage.objects` 4 條 RLS（read/insert/update parties；delete admin） | `010_storage_order_documents.sql` |

> 已實作但原 PRD 未列的項目（Dashboard、行銷頁 Geopolitics/Sustainability、Admin Console 統計、News slug 富文本等）見 [`ARCHITECTURE.md` §附錄 A](./ARCHITECTURE.md#附錄-a實作但-prd-未列項目)。

#### 2.2 待補完（MVP 上線前必做） 🟡

詳見 [`ROADMAP.md` §A](./ROADMAP.md#a-mvp-補完項上線前必做)：

- ~~**A1** Schema 對齊（payments / news / orders）~~ ✅ 已完成（migration 005）
- **A2** 站內 IM（schema 已就位，但 `/messages` 與 `OrderChat` 待實作）
- ~~**A3** 合約簽名掃描上傳 UI~~ ✅ 已完成（009 + `<SignedScanUploader />`，並可嵌入簽名後 PDF 預覽下載）
- ~~**A4** `order-documents` Storage bucket + RLS~~ ✅ 已完成（migration 010）；其餘 buckets（avatars / kyc / listings / chat）依需要時補
- ~~**A5** Disputed / Cancelled UI 觸發點~~ ✅ 已完成（009 + `<OrderPhaseActions />`）
- **A6** KYC 文件上傳（簡易版，提升 `kyc_level`）
- **A7** 部署 ✅；full_prepay 端到端煙霧測試 ✅（2026-05-15）；net_after_arrival 走測待補
- ~~**B1** B2B 全流程追蹤（quotation 議價、13 階段狀態機、文件中心、回合制合約）~~ ✅ 已完成（migrations 007 + 009）

### OUT OF SCOPE（此次 MVP 不做）

- 區塊鏈/錢包整合（WalletConnect、Web3、Fireblocks 等一律不做）
- DocuSign / 電子簽名服務（平台自證即可）
- 即時石墨價格與歷史走勢圖（規格分散、單一報價偏差大,延後到 Phase 2）
- 自動爬取石墨新聞（改為 admin 手動發布）
- 多語系（架構預留,但 MVP 僅英文 + 預留中繁/法文 i18n key）
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
4. 賣家「Accept」 → 自動建立 `orders.status='draft'`，inquiry.status='converted'，導向訂單頁

### 4.4 訂單核心流程（B2B 13 階段，分支由 `payment_terms` 決定）

```
quotation_pending → quoted ↔ negotiating
  └─ buyer accept quotation
       └─ contract_pending  ←─────── 賣家可重新起草（revision_no++）─┐
            └─ buyer approve + 雙方上傳簽名掃描                      │
                 └─ contract_signed                                  │
                      ├── (full_prepay)        → payment_pending → paid → in_production
                      └── (net_after_arrival)                       → in_production
                          → ready_to_ship → shipped → in_transit → arrived → customs_cleared
                              ├── (full_prepay)        → completed
                              └── (net_after_arrival)  → payment_pending → paid → completed
```

任何非終止狀態都可進入 `disputed` 或 `cancelled`（雙方 + admin 可觸發；admin 另可
`forceTransitionOrder` 繞過狀態機，全程寫 `audit_logs`）。完整定義見
[`src/lib/order/stateMachine.ts`](../src/lib/order/stateMachine.ts) 與
[`ARCHITECTURE.md`](./ARCHITECTURE.md) §4.4「訂單狀態機」。

### 4.5 付款（MVP 簡化 — 雙分支）

- 平台顯示自有錢包/帳戶資訊（USDT TRC20/ERC20、USDI、MUP、銀行）
- 買家在訂單頁 Payment Tab 提交：method / amount / currency / tx_hash / proof_url / note
- `payments.status='pending'` → `orders.status='payment_pending'` → 寄信通知 admin
- admin 在 `/admin/payments` 審核 → verified；驗證通過後依 `orders.payment_terms` 自動推進：
  - `full_prepay`：`payment_pending → paid → in_production`（之後賣家走出貨流程）
  - `net_after_arrival`：`payment_pending → paid → completed`（在到港 + 通關之後才會進入此分支）
- 寄信通知 buyer，並寫 `audit_logs`

### 4.6 站內 IM ⚠️ 待實作（A2）
- 建立訂單時自動建 `chat_rooms (type='order')` + `chat_members(buyer, seller)`
- Realtime via Supabase `postgres_changes` event on `messages`
- 支援文字 + 圖片附件（Storage `chat` bucket，A4 待建）
- Admin 可選擇加入

## 5. 非功能需求

| 類別 | 要求 | 現況 |
|---|---|---|
| 部署 | Vercel（前端 + Server Actions），Supabase（Postgres / Auth / Storage / Realtime） | ✅ 已部署 <https://galloisgraphite.vercel.app/>；端到端煙霧測試列為 ROADMAP §A7 |
| 效能 | 公開頁 SSG/ISR；市場頁 SSR + RSC；首屏 LCP < 2.5s（WiFi） | ✅ 公開頁 ISR、SSR 已實作 |
| 安全 | 全表 RLS、service_role key 永不入 client、輸入用 zod | ✅ |
| 可觀測性 | `audit_logs` + `ai_chat_logs` 記錄；Vercel Logs；後續可接 Sentry | ✅ audit/AI logs；Sentry 為 Phase 2 |
| 國際化 | i18n 結構預留（next-intl key），MVP 僅 en；合約必須英文版 | ⚠️ key 未抽，僅英文寫死 |
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
