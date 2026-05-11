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
| 3 | **註冊/登入**：Email + 驗證信，role = buyer / seller | `(auth)/{login,register,verify}` |
| 4 | **超級管理員後台**：用戶凍結/解凍、品類管理、訂單瀏覽、付款審核、新聞管理 | `/admin/*` |
| 5 | **賣家上貨**：選品類 → 規格 / 數量 / 出貨地 / 出貨時間區間 / 價格 / 幣別 / Incoterm | `/listings/new` |
| 6 | **買家市場**：瀏覽 listings、篩選、單品詳情 | `/market` + `/market/[id]` |
| 7 | **詢價流程**：買家提交 → 賣家 accept → 自動建立 order | `<InquiryDialog />` + `acceptInquiry` |
| 8 | **訂單狀態機**：Draft → Contract Generated → Signed → Payment Pending → Paid → Shipped → Delivered → Completed | `src/lib/order/stateMachine.ts` |
| 9 | **合約生成**：從模板渲染 HTML，可印出簽名（`window.print()`） | `src/lib/contract/template.ts` |
| 10 | **付款人工審核**：buyer 提交 tx_hash / proof_url，admin 在後台 verify/reject | `/admin/payments` |
| 11 | **訂單時間軸**：每次狀態轉換 append timeline 事件 | `appendTimeline()` |
| 12 | **Audit log**：所有 admin 動作寫入 `audit_logs` | `writeAuditLog()` |
| 13 | **Email 通知**：inquiry 發起、payment 提交、payment 審核、收貨確認 5 個事件點 | `src/lib/email/resend.ts` |
| 14 | **使用者 Dashboard**：active orders + pending inquiries 快速概覽 + 角色相關快捷 | `/dashboard` |
| 15 | **三主題 UI**：light / dark / editorial（next-themes） | `<ThemeToggle />` |

> 已實作但原 PRD 未列的項目（Dashboard、行銷頁 Geopolitics/Sustainability、Admin Console 統計、News slug 富文本等）見 [`ARCHITECTURE.md` §附錄 A](./ARCHITECTURE.md#附錄-a實作但-prd-未列項目)。

#### 2.2 待補完（MVP 上線前必做） 🟡

詳見 [`ROADMAP.md` §A](./ROADMAP.md#a-mvp-補完項上線前必做)：

- ~~**A1** Schema 對齊（payments / news / orders）~~ ✅ 已完成（migration 005）
- **A2** 站內 IM（schema 已就位，但 `/messages` 與 `OrderChat` 待實作）
- **A3** 合約簽名掃描上傳 UI（Server Action 已寫好）
- **A4** Storage buckets 與 policies 初始化
- **A5** Disputed / Cancelled UI 觸發點
- **A6** KYC 文件上傳（簡易版，提升 `kyc_level`）
- **A7** Vercel + Supabase 部署 + 端到端煙霧測試

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
1. 使用者填 email + 密碼 + 角色(buyer/seller) + 公司名/國家
2. Supabase Trigger `handle_new_user` 自動建立 `profiles`（status='pending'）
3. Supabase 寄驗證信 → 點擊驗證連結 → Trigger `handle_user_email_confirmed` 把 status 改為 active
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

### 4.4 訂單核心流程
```
draft
  └─ seller / buyer 任一方點「Generate Contract」 → contract_generated
       └─ 雙方上傳簽名掃描（A3 待補 UI） → signed
            └─ 買家提交付款資訊（method / amount / tx_hash / proof） → payment_pending
                 └─ admin 在 /admin/payments 審核通過 → paid
                      └─ 賣家更新出貨資訊（shipment_from / eta） → shipped
                           └─ 賣家標記實際送達 → delivered
                                └─ 買家確認收貨 → completed
                                     └─ admin 收到 Email 通知，平台外放款給賣家
```
任何節點可進入 `disputed` 或 `cancelled`（A5 待補 UI；雙方 + admin 可觸發）。

### 4.5 付款（MVP 簡化）
- 平台顯示自有錢包/帳戶資訊（USDT TRC20/ERC20、USDI、MUP、銀行）
- 買家在訂單頁 Payment Tab 提交：method / amount / currency / tx_hash / proof_url / note
- `payments.status='pending'` → `orders.status='payment_pending'` → 寄信通知 admin
- admin 在 `/admin/payments` 審核 → verified → `orders.status='paid'`
- 寄信通知 buyer，並寫 `audit_logs`

### 4.6 站內 IM ⚠️ 待實作（A2）
- 建立訂單時自動建 `chat_rooms (type='order')` + `chat_members(buyer, seller)`
- Realtime via Supabase `postgres_changes` event on `messages`
- 支援文字 + 圖片附件（Storage `chat` bucket，A4 待建）
- Admin 可選擇加入

## 5. 非功能需求

| 類別 | 要求 | 現況 |
|---|---|---|
| 部署 | Vercel（前端 + Server Actions），Supabase（Postgres / Auth / Storage / Realtime） | ⚠️ 待 A7 |
| 效能 | 公開頁 SSG/ISR；市場頁 SSR + RSC；首屏 LCP < 2.5s（WiFi） | ✅ 公開頁 ISR、SSR 已實作 |
| 安全 | 全表 RLS、service_role key 永不入 client、輸入用 zod | ✅ |
| 可觀測性 | `audit_logs` 表記錄 admin 動作；Vercel Logs；後續可接 Sentry | ✅ audit_logs；Sentry 為 Phase 2 |
| 國際化 | i18n 結構預留（next-intl key），MVP 僅 en；合約必須英文版 | ⚠️ key 未抽，僅英文寫死 |

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
