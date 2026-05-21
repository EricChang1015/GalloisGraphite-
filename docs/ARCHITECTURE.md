# Architecture — 現有實作架構

> 此文件描述**現在實際長什麼樣子**的 Mada Graphite 平台。
> - 規劃／需求面請看 [`PRD.md`](./PRD.md)
> - 資料表細節請看 [`SCHEMA.md`](./SCHEMA.md)
> - 待補完項目請看 [`ROADMAP.md`](./ROADMAP.md)

---

## 1. 系統概覽

```
┌─────────────────────────── Vercel (Edge + Node) ──────────────────────────┐
│                                                                            │
│   Next.js 16 App Router (React 19)                                         │
│     ├─ (public)        SSG/ISR 行銷頁、News、AI Chat                        │
│     ├─ (auth)          login / register / verify                           │
│     ├─ (app)           SSR 登入後 dashboard / market / orders / messages    │
│     ├─ admin           SSR Admin Console（middleware 限 role）              │
│     └─ api/chat        POE-backed AI streaming（route handler）             │
│                                                                            │
│   src/proxy.ts (formerly middleware.ts)                                    │
│     - 統一 session refresh + 路由守衛                                       │
│                                                                            │
│   src/actions/* — Server Actions（所有 mutation）                           │
└────────────────────────────┬───────────────────────────────────────────────┘
                             │
            ┌────────────────┴────────────────────┬────────────────────┐
            ▼                                     ▼                    ▼
   ┌─────────────────┐               ┌──────────────────┐    ┌──────────────┐
   │  Supabase Cloud │               │  POE API         │    │  AWS SES     │
   │  - Auth         │               │  (OpenAI-compat) │    │  (SMTP via   │
   │  - Postgres+RLS │               │  Claude/GPT/...  │    │   nodemailer)│
   │  - Storage      │               └──────────────────┘    └──────────────┘
   │  - Realtime     │
   └─────────────────┘
```

**部署模式**：單一 Next.js 應用，無獨立後端。所有 mutation 走 Server Actions，
僅 AI streaming 用 route handler。沒有 Express / Fastify、沒有 Prisma、沒有 wallet SDK。

---

## 2. 路由地圖（已實作）

### 2.1 `(public)/` — 公開行銷與 AI Chat

| 路由 | 檔案 | 內容 |
|---|---|---|
| `/` | `(public)/page.tsx` | Hero narrative、Stats、Mine intro、Geopolitics、Products、Sustainability、Applications、Partners、AI CTA、Mining photos strip |
| `/about` | `(public)/about/page.tsx` | 公司歷史、三個礦場、全球客戶、礦區照片 |
| `/products` | `(public)/products/page.tsx` | MADA1/MADA2 brand cards + standard grades 規格表 |
| `/news` | `(public)/news/page.tsx` | 已發布新聞列表（ISR 5 分鐘） |
| `/news/[slug]` | `(public)/news/[slug]/page.tsx` | 單篇文章（read content_html，含 cover） |
| `/chat` | `(public)/chat/page.tsx` | 訪客 AI Chat 頁，內嵌 `<AiChat />` |
| `/geopolitics` | `(public)/geopolitics/page.tsx` | China+1 sourcing case |
| `/sustainability` | `(public)/sustainability/page.tsx` | ESG roadmap |

**Layout**：`(public)/layout.tsx` → `<Navbar />` + `<Footer />`

### 2.2 `(auth)/` — 認證

| 路由 | 檔案 | 內容 |
|---|---|---|
| `/login` | `(auth)/login/page.tsx` | `<LoginForm />`（email/password，含「Forgot password?」inline link）+ `<GoogleSignInButton />` |
| `/register` | `(auth)/register/page.tsx` | `<RegisterForm />`（含 role 選擇 buyer/seller）+ `<GoogleSignInButton />` |
| `/verify` | `(auth)/verify/page.tsx` | Email 驗證落地頁 + `<VerifyResendForm />` |
| `/forgot-password` | `(auth)/forgot-password/page.tsx` | `<ForgotPasswordForm />`：呼叫 `requestPasswordReset` 寄送 recovery 連結（包括給原 Google OAuth 用戶綁定 email/password 登入用） |
| `/reset-password` | `(auth)/reset-password/page.tsx` | Server component 讀 `auth.getUser()` 後渲染 `<ResetPasswordForm />`；未授權者顯示「Reset link expired」回到 `/forgot-password` |
| `/auth/callback` | `app/auth/callback/route.ts` | OAuth code → session 交換；`?type=recovery` 走 `/reset-password`、其它走 `next \|\| /dashboard`，失敗回 `/login?error=oauth_failed`（recovery 失敗回 `/forgot-password?error=recovery_failed`） |

**Layout**：`(auth)/layout.tsx`（無 Navbar）。`/reset-password` 不在 `isAuthRoute` 名單，避免恢復流程被導回 `/dashboard`。

### 2.3 `(app)/` — 登入後

需要 authenticated user，由 `src/proxy.ts` 強制。

| 路由 | 內容 |
|---|---|
| `/dashboard` | 歡迎詞 + 角色 badge + commercial-profile incomplete banner（若有缺欄） + 快捷卡片（market/orders/inquiries/new listing for seller，**Orders/Inquiries 卡片右側顯示金色 action-needed badge**） + **Priority Actions**（最多 5 筆，混合 orders-needing-my-action 與 inquiries-needing-my-response，按時間排序） + Active Orders（每列額外顯示「Your turn」/「Disputed」 hint）+ Inquiries needing your response（角色感知：seller 看 `pending`+`negotiating`，buyer 看 `quoted`+`negotiating`） |
| `/market` | 公開可瀏覽的 active listings 卡片網格 |
| `/market/[id]` | 單一 listing 詳情 + `<InquiryDialog />` |
| `/listings` | **My Listings**（賣家視角，建/暫停/恢復） |
| `/listings/new` | `<ListingForm />` |
| `/inquiries` | 兩個 Tab：**Sent**（買家視角）/ **Received**（賣家視角，含「快速報價」） |
| `/inquiries/[id]` | **Inquiry detail**：quotation 歷史 timeline、`<QuotationForm />`（seller）、`<QuotationActions />`（accept / counter / decline） |
| `/orders` | 買賣雙視角訂單列表 |
| `/orders/[id]` | 7 個 Tab + **OrderProgressBar**：**Overview** / **Quotation** / **Contract**（含 buyer approve/reject + signed-scan upload） / **Payment** / **Shipment**（B/L、vessel、container、ETD/ATD/ETA/ATA） / **Documents**（13 種類型分組上傳） / **Timeline** |
| `/messages` | ⚠️ **Placeholder（A2 待補）**：將顯示房間列表 |
| `/settings` | 帳戶設定：commercial profile（full_name / company_name / country / phone）+ role/status/kyc badges +「Change password」連結；若 `?prompt=incomplete` 或 `profiles.{company_name,country}` 為空，最上方顯示黃色提示 banner |

**Layout**：`(app)/layout.tsx` → 左側 sidebar nav；側欄項目從 `src/lib/notifications/counts.ts` 取 `getUserActionCounts()`，於 Inquiries / Orders 顯示金色數字 badge（`inquiriesNeedingMyResponse` / `ordersNeedingMyAction`），Orders 額外在有 disputed 時補上紅色「!」badge，Settings 在 commercial profile 缺欄時顯示紅點。Counter helper 用 `React.cache()` per-request 記憶化，所以 sidebar + dashboard 共用一次查詢。

### 2.4 `admin/` — Admin Console

需要 `role IN ('admin','super_admin')`，由 `src/proxy.ts` + RLS 雙重把關。

| 路由 | 內容 |
|---|---|
| `/admin` | 4 卡片統計（Users / Total Orders / **Disputed Orders** / Payments Pending；後兩者在 >0 時顯示紅 / 金 Action-needed badge）+ **動態 Priority Actions 區塊**（依 `getAdminActionCounts()` 列出 disputed orders 與 pending payments 的進入點；全部歸零時顯示「All caught up」） |
| `/admin/users` | 完整用戶表 + freeze/unfreeze + setRole（super_admin 才能 promote 為 admin） |
| `/admin/categories` | CRUD + `spec_schema` jsonb 編輯（`<CategoryFormDialog />`） |
| `/admin/orders` | 全平台訂單瀏覽（list view） |
| `/admin/orders/[id]` | Admin 訂單詳情：ProgressBar + **Force Transition**（繞過 state machine）+ contract 狀態 + payments + documents + audit log + timeline |
| `/admin/payments` | ⭐ Pending Review + History 兩段，**核心人工審核流程**（`<PaymentVerifyActions />`） |
| `/admin/news` | 新聞 CRUD（slug、content_html、cover、published toggle） |
| `/admin/settings` | 平台設定：SMS 交易通知開關（需 env 已配置 `SMS_BASE_URL` + `SMS_APP_ID`） |

**Layout**：`admin/layout.tsx` → 左側 Admin Console nav；Payments / Orders 兩個項目從 `getAdminActionCounts()` 抓 `paymentsPending` / `ordersDisputed` 並顯示 badge（金 / 紅），與 `/admin` 卡片數字一致。

### 2.5 `api/chat` — AI Streaming

`POST /api/chat`：使用 AI SDK v6（`streamText` + `convertToModelMessages`），
provider 為 POE OpenAI-compatible endpoint，回傳 `toUIMessageStreamResponse()`。

---

## 3. 資料層

### 3.1 三個 Supabase Client（`src/lib/supabase/`）

| 檔案 | 使用情境 | 金鑰 | 注意事項 |
|---|---|---|---|
| `client.ts` | Client Components（'use client'） | anon key | 透過 `@supabase/ssr` `createBrowserClient` |
| `server.ts` | Server Components / Server Actions | anon key + cookies | `await createServerClient()` |
| `admin.ts` | 需繞過 RLS 的特權操作 | **service_role** | 第一行 `import "server-only"`，**禁止** import 進 Client |
| `middleware.ts` | `src/proxy.ts` 用 | anon + cookies | `updateSession(request)` 統一刷新 session |

### 3.2 RLS 政策矩陣（已實作於 `001_init.sql`）

| 表 | select | insert | update | delete |
|---|---|---|---|---|
| profiles | public | trigger（auth） | self / admin | admin only |
| product_categories | public（active 才公開） | admin | admin | admin |
| listings | active 公開 / owner / admin | seller / admin | owner / admin | owner / admin |
| inquiries | parties / admin | buyer | parties / admin | — |
| **quotations**（007） | parties / admin | seller 或 buyer | parties / admin | — |
| orders | parties / admin | server action | server action（service_role） | — |
| contracts | parties / admin | server action | server action | — |
| payments | parties / admin | buyer | **seller (of order) / admin**（015） | — |
| **order_documents**（007） | parties / admin | parties + admin | uploader (1h window) / admin | uploader (1h, unverified) / admin |
| chat_rooms / chat_members / messages | members / admin | members | sender | — |
| news | published 公開 / admin | admin | admin | admin |
| audit_logs | admin | server action | — | — |

> Helper：`public.current_user_role()` 為 `security definer` SQL function，
> 內部回傳 `auth.uid()` 對應的 `profiles.role`。

### 3.3 Storage Buckets（規劃 vs 現況）

| Bucket | 用途 | 訪問模式 | 現況 |
|---|---|---|---|
| `avatars` | 使用者頭像 | public read, self write | ✅ 已建立 — `021_avatars.sql` |
| `kyc` | KYC 證件 | private（owner + admin） | ⚠️ 待建立 |
| `contracts` | 合約簽名掃描（legacy） | private（訂單雙方 + admin） | ⚠️ 待建立（已被 `order-documents` 取代） |
| **`order-documents`** | 訂單通用文件中心（合約簽名、發票、B/L、檢驗、付款證明…） | private（owner / 訂單雙方 / admin） | ✅ 已建立 — `010_storage_order_documents.sql` |
| `payments` | 付款憑證圖 | private（buyer + admin） | ✅ 由 `order-documents` 內 `payment_proof` 路徑覆蓋（單一 bucket，路徑命名分類） |
| `listings` | 商品圖 | public read, seller write | ⚠️ 待建立 |
| `chat` | 聊天室附件 | private（chat members） | ⚠️ 待建立 |

> 剩餘 buckets（avatars / kyc / listings / chat）待寫成 migration，請參考 [`ROADMAP.md` §A4](./ROADMAP.md)。
> `010_storage_order_documents.sql` 已建立 `order-documents` bucket（private）並設好 RLS：
> - SELECT：路徑首段為 `orders/<order_id>/...` 時，訂單雙方 / admin 可讀；其它路徑以上傳者 + admin 可讀
> - INSERT：登入用戶可上傳，並由 server action 寫對應的 `order_documents` row
> - UPDATE：上傳者本人 + admin（用於覆蓋）

### 3.4 Realtime

`001_init.sql` 結尾：

```sql
alter publication supabase_realtime add table public.messages;
```

→ 客戶端用 `supabase.channel('messages:room_id={uuid}')` + `postgres_changes` 監聽。
**（`OrderChat` 組件待實作 — 見 ROADMAP §A2）**

---

## 4. Server Actions（`src/actions/*`）

### 4.1 統一回傳形式

```ts
type ActionResult<T> =
  | { data: T; error: null }
  | { data: null; error: { message: string; fieldErrors?: Record<string, string[]> } };
```

定義於 `src/actions/auth.ts`，所有 actions 都遵循（**永不 throw 到 UI**）。

### 4.2 Action 清單

| 檔案 | Action | 權限檢查 | 副作用 |
|---|---|---|---|
| `auth.ts` | `signUp` / `signIn` / `signOut` / `resendVerification` | — | Supabase Auth（email/password）；`signUp` 會偵測 Supabase 對「已存在帳號」的 silent no-op（`data.user.identities.length===0`）並回友善提示，導到 forgot-password 而非假裝寄信 |
|  | `requestPasswordReset(email)` | — | 呼叫 `auth.resetPasswordForEmail`，redirect 到 `/auth/callback?type=recovery&next=/reset-password`；Google OAuth 用戶可藉此額外綁定 email/password identity |
|  | `updatePassword(password)` | recovery session | 呼叫 `auth.updateUser({ password })` |
| **`profile.ts`** | `updateCommercialProfile(input)` | self | 更新 `profiles.{full_name,company_name,country,phone}`；`/settings` 表單與「lazy-collect」入口都呼叫它 |
| `components/auth/GoogleSignInButton.tsx` | client-side `supabase.auth.signInWithOAuth({ provider:'google' })` | — | 重導 Google → `/auth/callback` |
| `listing.ts` | `createListing` | role ∈ {seller, admin}, status='active'；seller 角色另需 `company_name`/`country` non-empty | revalidate /listings, /market；commercial profile 缺漏時回 `error.code='PROFILE_INCOMPLETE'` |
|  | `updateListing` / `pauseListing` / `resumeListing` | owner | revalidate /listings, /market |
| `inquiry.ts` | `createInquiry` | role='buyer' + `profiles.company_name`/`country` non-empty | Email 通知 seller, revalidate /inquiries；commercial profile 缺漏時回 `error.code='PROFILE_INCOMPLETE'` |
|  | `acceptInquiry` | seller_id = auth.uid() | **(007 變更)** 改為自動發出預設 quotation（用 listing 條件 + 14 天 validity），inquiry='quoted'，buyer 仍需 accept quotation |
|  | `rejectInquiry` | seller_id = auth.uid() | inquiry='rejected' |
| **`quotation.ts`（007）** | `submitQuotation` | seller, role check | mark prior live quotations as superseded, insert quotation, inquiry='quoted', notify buyer |
|  | `counterQuotation` | parties | parent → 'countered', insert child quotation, inquiry='negotiating' |
|  | `acceptQuotation` | buyer only | create order(`current_quotation_id` = q.id, **`incoterm = q.incoterm`**, status='contract_pending'), q.status='accepted', inquiry='converted', notify seller。Incoterm 在這一步就敲定（不等到合約 draft），確保 ContractDraftForm 帶到的是議價後的 Incoterm 而不是 listing 原值 |
|  | `rejectQuotation` | parties | q.status='rejected'; if no live quotations remain on inquiry → inquiry='rejected' |
| `order.ts` | `draftContract` | seller, status ∈ {quoted, negotiating, contract_pending} | render HTML（含 payment schedule 表）、insert/update contract（revision_no++ 若 re-draft），同步 `orders.incoterm`，rebuild `payment_schedules` 列（保留已 paid 列），status='contract_pending', notify buyer |
|  | `approveContract` | buyer, status='contract_pending' | `contract.buyer_approved_at` = now |
|  | `rejectContract` | buyer, status='contract_pending' | `contract.buyer_rejected_at`、`buyer_reject_reason`，notify seller |
|  | `uploadSignedScan` | parties, status ∈ {contract_pending, contract_signed} | update `contract.{role}_signed_url` + 寫入 `order_documents`；雙方簽完且 buyer 已 approve → status='contract_signed' → 觸發 `contract_signed` milestone → 自動跳到 `in_production` |
|  | `markInProduction` / `markReadyToShip` | seller | 推進對應狀態 |
|  | `markShipped` | seller, status='ready_to_ship' | 寫入 B/L / vessel / containers / ETD/ATD/ETA + `loaded_at` + status='shipped'，觸發 `loaded_onto_vessel` milestone，若 `bl_date` 有給則 back-fill `bl_date_plus_N` 的 due_date，notify buyer。`<ShipmentForm />` UI 額外提供 **B/L 掃描檔**與 **Inspection Report**（COA/SGS）兩個 optional 上傳欄位 — 不強制，但若上傳則寫進 `order_documents`（type=`bill_of_lading` / `inspection_report`），方便後續通關與買家對帳 |
|  | `markInTransit` | seller | shipped → in_transit |
|  | `markArrived` | parties + admin | 寫入 ATA + status='arrived'，觸發 `arrived_at_port` milestone |
|  | `markCustomsCleared` | buyer | 寫入 `customs_cleared_at` / `accepted_at`，status='customs_cleared'，觸發 `accepted_by_buyer` milestone；若所有 schedules 都 paid → 自動 completed |
|  | `markBeforeProduction` / `markBeforeShipment` / `markBeforeLoading` | seller | 寫入對應時間戳 + 觸發對應 milestone |
|  | `markBlReceived` / `markShippingDocsReceived` / `markBlPlusInsuranceReceived` / `markGoodsPickedUp` | buyer | 寫入對應時間戳 + 觸發對應 milestone |
|  | `raiseDispute` | parties + admin | status='disputed'，audit_logs，notify admin |
|  | `cancelOrder` | parties + admin（pre-shipment 階段） | status='cancelled'，audit_logs |
|  | `forceTransitionOrder` | admin only | bypass state machine，audit_logs（管理員恢復用） |
|  | `autoCompleteIfReady` | internal helper | 由 `verifyPayment` 呼叫；若 customs cleared 且所有 schedule paid 則自動 → completed |
| `payment.ts` | `submitPayment` | buyer, schedule.status ∈ {due, overdue, **scheduled**}, `company_name`/`country` non-empty | payment 寫入(pending) 含 `schedule_id`；schedule.status→'awaiting_review'；**通知 seller（primary reviewer）並 CC `ADMIN_EMAIL`**。接受 `scheduled` 是讓買家可以「Pay Early」提早結算尚未到 milestone 的 installment |
|  | `verifyPayment` | **order 的 seller 或 role ∈ {admin, super_admin}**（015：sellers 是主審，admin 保留 override / dispute 介入權） | payment.status→verified/rejected；verified：schedule.status→'paid' + schedule.paid_payment_id = payment.id；rejected：schedule.status→'due'；都不再直接推 order.status，唯一例外是 `autoCompleteIfReady`（在所有 schedule paid 且 status 已到 `customs_cleared` 時自動 → `completed`）。audit_logs 與 buyer 通知文案會帶上 reviewer 角色（"Seller" / "Admin"） |
| **`document.ts`（007）** | `uploadOrderDocument` | parties + admin | insert `order_documents` row（檔案由 client 上傳到 `order-documents` bucket），timeline append |
|  | `verifyOrderDocument` | admin only | 標記已核驗，audit_logs |
|  | `deleteOrderDocument` | uploader（1h, 未驗證）/ admin | delete row |
| `admin.ts` | `freezeUser` / `unfreezeUser` | admin | profiles.status, audit_logs |
|  | `setUserRole` | admin（promote 為 admin 需 super_admin） | profiles.role, audit_logs |
|  | `upsertCategory` / `deleteCategory` | admin | product_categories, audit_logs |
|  | `upsertNews` | admin | news, audit_logs |
|  | `sendTestEmail` | admin | 走 `src/lib/email/smtp.ts` 寄一封驗證信給目前登入的 admin，audit_logs；用於 `/admin/settings` 一鍵驗證 SES SMTP 連線是否正常 |

### 4.3 Server Actions 共通慣例

- 第一行 `"use server"`
- zod 驗證所有外部輸入
- `supabase.auth.getUser()` 取使用者（**不用 `getSession`**）
- 雙重授權：先檢查 `profiles.role` / 業務狀態，再依靠 RLS 為第二道防線
- 訂單狀態轉換 → 同一個 update 內 append `timeline` event
- Admin 動作 → `audit_logs` 寫入
- 結束前 `revalidatePath()`

### 4.4 訂單狀態機（`src/lib/order/stateMachine.ts`）

Post-014 cutover — 付款已從訂單時間軸抽離，狀態機簡化為固定 12 階段線性：

```
quotation_pending → quoted ↔ negotiating
  → contract_pending → contract_signed → in_production
  → ready_to_ship → shipped → in_transit
  → arrived → customs_cleared → completed

任何節點 → disputed / cancelled
disputed → cancelled / completed
```

API:
- `canTransition(from, to)` — 型別安全的轉換驗證（不再吃 `paymentTerms`）
- `nextAfter(current)` — auto-advance：`contract_signed → in_production`、`customs_cleared → completed`（後者由 `autoCompleteIfReady` 在所有 schedule paid 時才呼叫）
- `getProgressStages()` — 固定回傳 12 階段
- `getStageIndex(status)` — 目前狀態在 progress bar 的位置
- `STATUS_LABEL` — 各狀態的英文 label（含 legacy 值 `payment_pending` / `paid` / `draft` / `contract_generated`，用於兜底渲染歷史 timeline）

付款生命週期改由 `payment_schedules` 表獨立管理（見 SCHEMA §5c）；訂單可以
推到 `completed`，但 UI 在所有 schedule paid 之前 `<OrderProgressBar />` 會
跳出黃色 "Payments outstanding" 徽章與提示文字，避免買賣雙方誤以為已結清。
`disputed` / `cancelled` 由 `<OrderPhaseActions />` 觸發。`forceTransitionOrder`
（admin only）可繞過狀態機（紀錄到 audit_logs）。

> **`autoCompleteIfReady` count 修正（2026-05-20）**：先前用
> `select("id").neq(...).neq(...)` 拿陣列 length 判斷剩餘 schedule，遇到部分
> 訂單在所有 schedule 都還沒 paid 時被誤推到 `completed`（symptom: ORD-260520-601b6b
> 在 buyer 還沒付最後一期就 auto-complete）。現改用
> `select("id", { count: "exact", head: true }).neq("status","paid").neq("status","waived")`
> 取真實 count，且僅在 `count===0` 時才推進；同時 `verifyPayment` / `submitPayment`
> 後都會 revalidate 訂單詳情頁。

### 4.5 付款排程觸發機制（`triggerMilestone()`）

每筆 schedule 對應一個 milestone；server action 達成 milestone 時呼叫
`triggerMilestone(orderId, milestone)` 把符合的 `scheduled` 列推到 `due` 並
寄 buyer email/SMS。

- **自動 milestone**（隨 server action）：
  - `contract_signed` ← `uploadSignedScan`（兩方 signed + buyer approved）
  - `loaded_onto_vessel` ← `markShipped`
  - `arrived_at_port` ← `markArrived`
  - `accepted_by_buyer` ← `markCustomsCleared`
- **手動 milestone**（`<MilestoneActionButtons />`）：
  - 賣家：`before_production` / `before_shipment` / `before_loading`
  - 買家：`bl_received` / `shipping_docs_received` / `bl_plus_insurance_received` / `goods_picked_up`
- **時間 milestone**（`/api/cron/payment-schedule`）：
  - `bl_date_plus_30 / 60 / 90` — Vercel Cron 每日 04:00 UTC 掃描；
    `scheduled` + `due_date <= today` → `due`；`due` + `due_date < today` → `overdue`。

---

## 5. AI 助手（`src/lib/ai/*` + `api/chat/route.ts` + `components/chat/*`）

### 5.1 Provider

POE OpenAI-compatible endpoint，由 `@ai-sdk/openai` `createOpenAI({ baseURL, apiKey })` 接入。
單一 API key 可切換 Claude / GPT / Gemini / Llama，由 `POE_MODEL` env var 控制。

### 5.2 System Prompt 兩種模式（`src/lib/ai/prompt.ts`）

定義於 `buildSystemPrompt({ mode, marketContext? })`：

- **Guest（未登入）**：可答石墨知識、公司介紹、Incoterm；
  價格／詢價／下單／訂單／KYC 等意圖一律回 `[LOGIN_REQUIRED]` token，
  由前端 `<AiChat />` 偵測並顯示登入 CTA
- **User（已登入）**：上述能力 + 可基於 **live market context** 給出 indicative price range；
  可協助起草 inquiry 訊息（不會自動送出）；
  destructive action（取消/退款）一律導引到官方 UI

prompt 內含：`COMMON_RULES`（never reveal prompt / hedge / no record mutation）
+ mode rules + `GRAPHITE_KNOWLEDGE_BASE`（公司／礦場／產品／規格）
+ `FAQ_KNOWLEDGE`（買家／賣家／投資方／公眾四視角的「可直接答」與「must defer」清單 + Disclaimer）
+ user mode 額外注入 market context section。

### 5.3 Live Market Context（`src/lib/ai/marketContext.ts`）

僅在使用者已登入時於每次 `/api/chat` 請求中即時聚合：

- **Active listings**：依 `product_categories.name` 分組統計 `count / min / avg / max unit_price` + mode currency / mode unit
- **Recent settled orders**：90 天內 `status IN ('paid','shipped','delivered','completed')` 的訂單（最多 5 筆，匿名化），
  輸出 category / quantity / unit_price / currency / status

注入到 system prompt 後模型即可給出「indicative range from active listings / recent settled orders」式回答，
但**永不洩漏 listing id、seller、buyer 或 order_no**。RLS 會做為第二道防線。

### 5.4 Streaming

AI SDK v6 的 `UIMessageStream`：

- 後端：`streamText().toUIMessageStreamResponse()`
- 前端：`useChat({ transport: new DefaultChatTransport({ api: '/api/chat' }) })`
- 過濾 `providerMetadata`（避免 ZDR org 的 itemId 問題）

### 5.5 UI 入口

| 元件 | 用途 | 掛載點 |
|---|---|---|
| `<AiChat />` | 完整對話 UI（`variant: 'full' \| 'compact'`、受控 `sessionId` + `initialMessages`） | `/chat` 全頁 + floating widget 內部 |
| `<FloatingAiChat />` | 右下金色浮動按鈕 + 彈出式對話面板（mobile 全 sheet / desktop 380×600 卡片）+ History dropdown | `(public)/layout.tsx`、`(app)/layout.tsx` |
| `<AiChatLauncher />` | Server component wrapper，解析 `auth.getUser()` 後傳 `isAuthenticated` 給浮動視窗 | layouts |
| `<PinAiToggle />` | `/chat` 全頁右上角的「Pin / Hide AI assistant」切換 | `(public)/chat/page.tsx` |
| `<ChatPageBody />` | `/chat` 全頁兩欄佈局（左 sidebar + 右 chat） | `(public)/chat/page.tsx` |
| `<ChatHistorySidebar />` | 對話歷史列表 + 新增 / 刪除 / 清空 | floating dropdown / `/chat` 全頁 sidebar |

**狀態持久化（client localStorage）**：
- `mada.ai.sessions` — `ChatSession[]`（每 session 含 id / title / createdAt / updatedAt / messages，cap 30 sessions × 100 messages）
- `mada.ai.activeSession` — 目前選中的 session id（10-byte 隨機 hex = 20 char）
- `mada.ai.hidden` — 完全隱藏浮動按鈕（用戶可在 `/chat` 重新 pin 回來）
- `mada.ai.open` — 對話面板的展開狀態（跨頁保留）
- 全部透過 `useSyncExternalStore` 訂閱（SSR-safe，零 `useEffect` setState）

**Session 切換規則**：父層使用 `<AiChat key={sessionId} ...>` 強制 remount，
讓 `useChat` 用 `initialMessages` 重新初始化，避免從 effect 中 setState。

**不掛載區域**：`(auth)/`（登入流程不應干擾）、`admin/`（後台運維）。

### 5.6 Server-side audit log（`public.ai_chat_logs`）

每次 `/api/chat` 收到請求：

1. 從 header `x-mada-session` 取出 client 端 sessionId（20-char hex）
2. 從 `x-forwarded-for` / `x-real-ip` / `cf-connecting-ip` 抽取 IP
3. 從 Vercel headers `x-vercel-ip-{country,country-region,city}` 取出地理位置
4. 記下 `user-agent`、`auth.getUser()` 的 `user_id`（guest 為 null）
5. 寫入兩筆 `ai_chat_logs`：user message（streaming 開始前）+ assistant final（`onFinish` callback）

寫入用 service-role admin client 繞過 RLS；讀取僅 admin / super_admin
（policy `ai_chat_logs_admin_select`）。寫入失敗 silent，不阻擋對話。

> 詳細「如何修改 prompt / FAQ」請見 [`docs/AI_PROMPT.md`](./AI_PROMPT.md)。

---

## 6. 認證與路由守衛（`src/proxy.ts`）

> Next.js 16 把 `middleware.ts` 改名為 `proxy.ts`（仍是 edge runtime）。

```
Request ──► updateSession() ──► 取得 user
            │
            ├─ /login|/register|/verify + user 已登入 → /dashboard
            ├─ /(app|admin)/* + 未登入 → /login?next=...
            ├─ /admin/* + role ∉ {admin, super_admin} → /dashboard
            ├─ /auth/callback → 放行（由 route handler 自行 exchangeCodeForSession）
            └─ 其它 → 放行
```

`updateSession` 內部刷新 cookies 中的 Supabase session token。

### OAuth 旁路

Google OAuth 流程不走 server action，而是：

1. Client `<GoogleSignInButton />` 呼叫 `supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: ${origin}/auth/callback?next=... } })`
2. 瀏覽器跳轉到 Google 同意頁
3. Google 回呼 `https://<project-ref>.supabase.co/auth/v1/callback`，Supabase 再 302 到我們的 `/auth/callback?code=...`
4. `app/auth/callback/route.ts` 用 server SSR client 呼 `exchangeCodeForSession(code)` 寫入 session cookies
5. DB trigger `handle_new_user`（007 migration 後）對 `auth.users.email_confirmed_at` 已非 null 的列直接建立 `profiles.status='active'`，避開 email_confirmed trigger

---

## 7. UI 系統

### 7.1 Tailwind v4 + shadcn

- shadcn style: **base-nova**
- Underlying primitives: **`@base-ui/react`**（不是 Radix；只有 `@radix-ui/react-slot` 在需要的地方裝）
- 主色：graphite dark `#1a1a1a` + accent gold `#c9a961`
- 主題 tokens 定義於 `src/app/globals.css`
- 三主題：`light` / `dark` / `editorial`（透過 `next-themes` + `<ThemeToggle />`）

### 7.2 表單

統一 `react-hook-form` + `zod` + shadcn `Form/FormField/FormItem/FormControl/FormMessage`。
Schema 集中於 `src/lib/validations/{auth,forms,inquiry,admin}.ts`。

### 7.3 元件目錄

```
src/components/
  ui/           shadcn 自動生成（avatar / badge / button / card / dialog / dropdown-menu /
                form / input / label / select / separator / sheet / skeleton / sonner /
                table / tabs / textarea）
  layout/       Navbar / NavSearchTrigger / MobileNav / Footer
  home/         Hero / KpiStrip / LiveTicker / MineIntro / MinePhotosStrip /
                ProductsBento / ApplicationsGrid / SupplyMap / PartnersMarquee /
                SustainabilityDashboard / AiPreview / ClosingCta /
                CommandPalette / CommandPaletteHost / BgGrid
  auth/         LoginForm / RegisterForm / VerifyResendForm /
                ForgotPasswordForm / ResetPasswordForm /
                CommercialProfileForm /
                GoogleSignInButton / LogoutButton
  listing/      ListingForm / InquiryDialog / InquiryActions /
                QuotationForm / QuotationActions
  order/        OrderActions / OrderProgressBar / OrderPhaseActions /
                ContractDraftForm / ContractApproveReject / ContractPreview /
                SignedScanUploader / ShipmentForm /
                PaymentScheduleTable / PaymentScheduleBuilder /
                MilestoneActionButtons / PaymentVerifyActions /
                OrderDocumentsTab / DocumentUploader / DocumentVerifyButton
  admin/        UserActions / CategoryActions / NewsActions /
                PaymentVerifyActions（re-export from order/）/
                AdminOrderActions / SmsNotificationsToggle /
                SendTestEmailButton
  chat/         AiChat / AiChatLauncher / FloatingAiChat /
                ChatHistorySidebar / ChatPageBody / PinAiToggle
  theme/        ThemeProvider / ThemeToggle
```

### 7.4 Toast / Loading

- `<Toaster />` 自 `@/components/ui/sonner` 在 root layout 掛一次
- 操作後 `toast.success(...)` / `toast.error(...)`
- Loading 用 shadcn `Skeleton`（避免 spinner-only）

---

## 8. 通知系統

### 8.1 Email + SMS（`src/lib/notifications/dispatch.ts`）

| 觸發點 | 對象 | Email | SMS（需 Admin 開關 + env + profile.phone） |
|---|---|---|---|
| `createInquiry` | seller | 「New inquiry received」 | 短訊 + /inquiries link |
| `acceptInquiry` / `submitQuotation` | buyer | 「Quotation received」 | 短訊 + inquiry link |
| `acceptQuotation` | seller | 「Quotation accepted — draft contract」 | 短訊 + order link |
| `draftContract` | buyer | 「Contract ready for review」 | 短訊 + order link |
| `rejectContract` | seller | 「Contract returned for revision」 | 短訊 + order link |
| `markShipped` | buyer | 「Shipment dispatched」 | 短訊 + order link |
| `triggerMilestone()`（任何 milestone 推進到 due 時） | buyer | 「Payment installment due」 | 短訊 + order link |
| `submitPayment` | **seller（primary）+ `ADMIN_EMAIL`（CC）** | 「New payment pending your review」 | 短訊 + order link（seller 端） |
| `verifyPayment` | buyer | verified / rejected（信內標明 reviewer：「verified by Seller / Admin」） | 短訊摘要 |
| `notifyScheduleDue`（cron `scheduled→due`） | buyer | 「Payment installment due」 | 短訊 + order link |
| `notifyScheduleOverdue`（cron `due→overdue`） | buyer + admin | OVERDUE 提醒 | 短訊（buyer 端） |
| `raiseDispute` | admin | 「Dispute raised」 | —（僅 email） |

**SMS 發送條件**（四項同時滿足）：Admin Settings 開啟、`SMS_BASE_URL` + `SMS_APP_ID` 已設、收件人 `profiles.phone` 非空、上表該列有 SMS 欄。

- Email：`src/lib/email/smtp.ts`（**nodemailer + AWS SES SMTP**；2026-05-20 從 Resend 遷移）
  - env：`SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_SECURE` / `EMAIL_FROM_ADDRESS` / `EMAIL_FROM_NAME`
  - `getTransporter()` 建立 nodemailer transporter；`sendEmail({ to, subject, html })` API 與舊 `resend.ts` 簽名相容，所以 `dispatch.ts` 只需換 import
  - `verifySmtp()` 工具可在啟動或 `/admin/settings → Send test email`（`sendTestEmail` server action）按鈕中即時驗證連線
- SMS：`src/lib/sms/client.ts` → `POST {SMS_BASE_URL}/sendSMS.do`，body 含 `appId` / `content` / `to`；`SMS_TYPE` 非空才帶 `type`
- Admin 開關：`/admin/settings` → `platform_settings.sms_notifications_enabled`（預設 `false`）
- 通知失敗為 non-blocking：`dispatch.ts` 內以 try/catch 包覆並 `console.warn` 紀錄（**2026-05-20 移除舊的 silent `catch(_){}`**，避免遇到 SMTP 設定錯誤時無聲失敗）

### 8.2 In-app 待辦徽章（`src/lib/notifications/counts.ts`）

Server-only module 集中計算 sidebar / dashboard 上的 action-needed 數字，
所有 helper 都用 `React.cache()` 包過，因此 layout + page 在同一個 request 共用查詢結果。

| Helper | 輸入 | 輸出 | 用在 |
|---|---|---|---|
| `getUserActionCounts(userId, role)` | 當前使用者 | `{ inquiriesNeedingMyResponse, ordersNeedingMyAction, ordersDisputed, profileIncomplete, paymentsAwaitingMyReview }` | `(app)/layout.tsx` sidebar badges、`dashboard/page.tsx` 卡片副標 + Priority Actions。`paymentsAwaitingMyReview` 僅 seller 角色會帶值（status='awaiting_review' 且 order.seller_id = me 的 schedule 數），讓 seller 在 sidebar 看到「N payments to verify」 |
| `getAdminActionCounts()` | — | `{ paymentsPending, ordersDisputed }` | `admin/layout.tsx` sidebar badges、`admin/page.tsx` 卡片 + Priority Actions |
| `getOrderActionOwner(status)` | 訂單狀態 | `'buyer' \| 'seller' \| 'admin' \| 'none'` | 判斷某個 row 是否「我的回合」 |
| `describeOrderAction(status, myRole)` | 狀態 + 我方角色 | 短句 hint（e.g.「Submit payment」） | dashboard Priority Actions 顯示文案 |

定義口徑（v1 簡化版，必要時可改用 quotations.countered_by 做更細的判斷）：

- **Inquiries needing my response**：
  - seller：`status IN ('pending','negotiating')` AND `seller_id=me`
  - buyer：`status IN ('quoted','negotiating')` AND `buyer_id=me`
- **Orders needing my action**：用 `getOrderActionOwner(status)` 判斷 + buyer 額外加上「有 due/overdue schedule 的訂單數」
  - buyer 行為：`contract_pending`（review/sign） / `arrived`（confirm customs cleared） / 任何訂單上有 `payment_schedules.status IN ('due','overdue')` 的 distinct order 數
  - seller 行為：`contract_signed`（mark in production，多半已 auto-step） / `in_production` / `ready_to_ship` / `shipped` / `in_transit`
  - admin 行為：`disputed`
- **profileIncomplete**：呼叫 `findCommercialProfileGaps(userId)`，缺 `company_name` / `country` 任一即視為未完成。

---

## 9. 環境變數一覽（對應 `.env.example`）

| 變數 | 必填 | 說明 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | **server-only**，admin client 用 |
| `POE_API_KEY` | ✅ | POE API key（AI Chat） |
| `POE_MODEL` | ✅ | e.g. `claude-3-5-sonnet` |
| `POE_BASE_URL` | ✅ | `https://api.poe.com/v1` |
| `SMTP_HOST` | ✅ | e.g. `email-smtp.us-east-1.amazonaws.com`（AWS SES SMTP endpoint） |
| `SMTP_PORT` | ✅ | 587（STARTTLS）或 465（implicit TLS） |
| `SMTP_USER` | ✅ | SES SMTP IAM 使用者名 |
| `SMTP_PASS` | ✅ | SES SMTP IAM 密碼（**server-only**） |
| `SMTP_SECURE` | — | `"true"` 強制 implicit TLS（搭配 port 465）；預設 false |
| `EMAIL_FROM_ADDRESS` | ✅ | 寄件人 email（必須是 SES 已驗證的 identity） |
| `EMAIL_FROM_NAME` | — | 寄件人顯示名（預設 `Mada Graphite`） |
| `EMAIL_FROM_DOMAIN` | — | 寄件 domain（SPF / DKIM 對齊參考用） |
| `SMS_BASE_URL` | — | SMS 閘道根網址（server-only）；與 `SMS_APP_ID` 同時設定才視為已配置 |
| `SMS_APP_ID` | — | 閘道 `appId` |
| `SMS_TYPE` | — | 閘道 `type`；留空則請求不含此欄位 |
| `NEXT_PUBLIC_APP_URL` | ✅ | 站台 URL（verify 信、admin link 用） |
| `NEXT_PUBLIC_APP_NAME` | — | 顯示用 |
| `ADMIN_EMAIL` | ✅ | 接收 payment / dispute 等 admin 通知信 |
| `PLATFORM_USDT_TRC20_ADDRESS` 等 | ✅ | 顯示在合約 / 付款指引 |
| `PLATFORM_BANK_INFO` | ✅ | 同上 |
| `NEXT_PUBLIC_ENABLE_SELLER_SELF_SIGNUP` | — | feature flag |
| `NEXT_PUBLIC_ENABLE_AI_CHAT` | — | feature flag |

---

## 10. Migrations 順序

```
supabase/migrations/
  001_init.sql                  ← 所有 enum / table / RLS / realtime publication / 預設 categories seed
  002_seed_first_admin.sql      ← 指引：UPDATE profiles SET role='super_admin' WHERE email=...
  003_seed_categories.sql       ← 12 個標準 grade + Custom Grade
  004_news_schema_update.sql    ← news 加 slug / content_html / cover_image_url / created_at
  005_align_payments_and_news.sql  ← payments(buyer_id/admin_note/reviewed_*) + news(author_id) + orders(updated_at trigger)
  006_ai_chat_logs.sql             ← AI 助手 audit table（session_id / IP / geo / UA + admin-only RLS）
  007_b2b_progress_enums.sql       ← order_status 擴充（quotation_pending/quoted/negotiating/in_production/in_transit/arrived...）+ rename signed→contract_signed / delivered→customs_cleared；inquiry_status 擴充
  008_oauth_profile_handling.sql   ← handle_new_user 支援 Google OAuth（fallback meta.name；email_confirmed_at 已設 → status='active'）
  009_b2b_progress_tables.sql      ← quotations / order_documents 表 + orders/contracts 運輸與合約審核欄位擴充 + RLS
  010_storage_order_documents.sql  ← Storage：建立 `order-documents` bucket + RLS（解除合約簽名 / 付款證明 / 文件上傳的阻塞）
  011_platform_settings.sql        ← `platform_settings` 表 + `sms_notifications_enabled` seed（Admin Settings 開關）
  012_listings_categories_order_party_read.sql  ← 訂單雙方可讀關聯 listing/category（避免訂單詳情 embed 被 RLS 擋成 404）
  013_payment_schedules.sql        ← 付款抽離：新增 payment_schedules + payments.schedule_id + orders.incoterm + 9 個 milestone 時間戳；3 個新 enum
  014_drop_legacy_payment_terms.sql ← Hard cutover：清測試資料 + drop orders/contracts.payment_terms 欄位（enum 值保留）
  015_payment_seller_verify.sql     ← Payment 審核權限改寫：drop policy `payments_admin_update`、改建 `payments_seller_or_admin_update`（order 的 seller 或 admin/super_admin 都可 update）；新增 idx `payments_status_pending` / `payments_order_status`
  016_chat_room_denorm.sql          ← chat_rooms last_message 反規範化
  017_party_chat_enums.sql          ← chat_type 加 party；chat_message_context_type enum
  018_party_chat.sql                ← Party DM thread + 合併 legacy order rooms
  019_kyc_storage_and_settings.sql  ← kyc bucket + platform_settings 門檻 seed（inquiry/listing min=0）+ profiles kyc_level 防自改 trigger
```

### 自動執行（取代手動進 Dashboard SQL Editor）

由於 `.env.local` 已有 `SUPABASE_ACCESS_TOKEN`（Personal Access Token），
所有 migration 都改用 [`scripts/apply-migrations.mjs`](../scripts/apply-migrations.mjs)
透過 [Supabase Management API](https://api.supabase.com)
（`POST /v1/projects/{ref}/database/query`）執行，**不需 DB password**。

```powershell
npm run db:migrate           # 跑所有未執行的 migration
npm run db:migrate:status    # 顯示已/未執行清單
npm run db:migrate:bootstrap # 首次：把現有全部 mark as applied 但不執行
npm run db:migrate:dry       # 列印計畫但不實際跑
npm run db:types             # 重新生成 src/types/database.ts
```

追蹤表：`public._agent_migrations(name PK, checksum, applied_at, bootstrap)`。
作者規則見 [`.cursor/rules/migrations.mdc`](../.cursor/rules/migrations.mdc)。

---

## 11. 已知不一致 / 待補（一覽）

完整清單見 [`ROADMAP.md`](./ROADMAP.md)。重點：

| # | 項目 | 狀態 | 備註 |
|---|---|---|---|
| 1 | Schema 對齊（payments / news / orders） | ✅ 已完成 | `005_align_payments_and_news.sql` |
| 2 | B2B 全流程追蹤（13 階段、quotation、document hub、合約回合審核） | ✅ 已完成 | `007_b2b_progress_enums.sql` + `009_b2b_progress_tables.sql` + 大量 server actions / UI 元件 |
| 3 | 合約簽名掃描上傳 UI（A3） | ✅ 已完成 | `<SignedScanUploader />` + `uploadSignedScan` server action |
| 4 | Disputed / Cancelled 觸發 UI（A5） | ✅ 已完成 | `<OrderPhaseActions />` + `<AdminOrderActions />` |
| 5 | Migration 自動套用 runner | ✅ 已完成 | `scripts/apply-migrations.mjs` + `npm run db:migrate` |
| 6 | `order-documents` Storage bucket + RLS | ✅ 已完成 | `010_storage_order_documents.sql` |
| 7 | 簽名合約預覽嵌入買賣雙方簽名 + 下載 | ✅ 已完成 | `<ContractPreview />` 內嵌雙方 signed scan（image/PDF），可下載合併 PDF |
| 8 | 付款證明上傳（非加密貨幣方式） | ✅ 已完成 | `<PaymentForm />` 對 `bank_transfer / usdi / mup` 顯示檔案上傳 input，存到 `order-documents` |
| 9 | Full-prepay 端到端流程煙霧測試 | ✅ 已驗證 | 2026-05-15 走測 `ORD-TEST-MP6PL7MZ`：quotation → contract draft/approve/sign → payment submit/verify → ready/shipped/in_transit/arrived → customs_cleared → completed |
| 10 | Net-after-arrival 端到端流程煙霧測試 | ⚠️ 待執行 | UI / actions 路徑相同，僅分支跳轉時點不同；需要實際走一次驗證 |
| 11 | 站內 IM（A2） | ⚠️ 待實作 | schema 已就位（`chat_rooms` / `chat_members` / `messages`）；`OrderChat` 元件、自動建房、`/messages` 列表頁都未做 |
| 12 | 其餘 Storage buckets（avatars / kyc / listings / chat） | ⚠️ 待實作 | 用到該功能時補上 |
| 13 | KYC 上傳 + lazy-collect commercial profile（A6） | 🟡 部分完成 | Commercial profile gate（`createInquiry` / `createListing` / `submitPayment` 缺欄位時回 `error.code='PROFILE_INCOMPLETE'`）、`/settings` 編輯頁、`<CommercialProfileForm />`、client toast 帶 "Open Settings" action 已完成；KYC 文件上傳 + admin 升級 kyc_level 仍待 |
| 14 | `(app)` / `admin` layout 缺 Logout 按鈕 | ✅ 已完成 | `(app)/layout.tsx` 與 `admin/layout.tsx` 已掛上 `<Navbar />`，desktop 有 LogoutButton 在右上、mobile 有 `<MobileNav />` 抽屜 |
| 15 | Dashboard 待辦通知不完整（要進 Inquiries 才知道有待處理項） | ✅ 已完成 | `src/lib/notifications/counts.ts` 統一計算 sidebar / dashboard 上的 action-needed 數字；`(app)/layout.tsx` 與 `admin/layout.tsx` 顯示金 / 紅 badge，dashboard 加上 incomplete-profile banner + Priority Actions 區塊 + Active Orders「Your turn」/「Disputed」hint |
| 16 | Payment 由 admin 主審造成 admin 成為瓶頸 + Resend domain 未驗證導致通知信收不到 | ✅ 已完成 | **migration 015** 把 update RLS 改為 seller-of-order or admin；`verifyPayment` 改 role check + UI（`<PaymentVerifyActions />` 抽到 `src/components/order/`，admin/seller 共用，以 `reviewerLabel` 分頭顯示）；email service 從 Resend 改 `nodemailer` + AWS SES SMTP（`src/lib/email/smtp.ts`），`/admin/settings` 加「Send test email」一鍵驗證；通知矩陣調整為 `submitPayment` → seller + admin CC，`verifyPayment` 通知信標示 reviewer 角色 |
| 17 | Incoterm 在議價更動後合約 draft 仍使用 listing 原 Incoterm | ✅ 已完成 | `acceptQuotation` 寫入 `orders.incoterm = q.incoterm`；`<ContractDraftForm />` 以 `order.incoterm ?? order.current_quotation?.incoterm` fallback |
| 18 | ShipmentForm 缺貨物品檢報告上傳 | ✅ 已完成 | `<ShipmentForm />` 加入 optional B/L 與 Inspection Report（COA/SGS）上傳欄；上傳後寫進 `order_documents`（type=`bill_of_lading` / `inspection_report`） |
| 19 | `autoCompleteIfReady` 誤推 order 至 `completed` | ✅ 已完成 | Supabase count 改用 `select("id", { count: "exact", head: true })`，僅 count===0 時才推進；同時 buyer 可在 `<PaymentScheduleTable />` 對 `scheduled` 列點「Pay Early」提前結算 |

---

## 附錄 A：實作但 PRD 未列項目

下列功能已在程式碼中實作，未來如有對外文件需引用，請以本文件為準：

1. `/dashboard` — 登入後預設首頁：incomplete-profile banner、4 張快捷卡片（Inquiries / Orders 帶 action-needed badge）、Priority Actions 區塊、Active Orders 與 Inquiries needing your response 兩塊
2. `/admin` — 4 卡片統計（含 Disputed Orders）+ 動態 Priority Actions 區塊
3. `/admin/orders` — 平台訂單瀏覽
4. `(public)/geopolitics` — China+1 sourcing case 行銷頁
5. `(public)/sustainability` — ESG roadmap 行銷頁
6. 三主題支援（light / dark / editorial）+ `<ThemeToggle />`
7. News slug + 富文本（content_html）+ cover image
8. 12 個預設 product categories + Custom Grade
9. Email 通知透過 AWS SES SMTP（`src/lib/email/smtp.ts`，nodemailer）；`/admin/settings` 可一鍵測試
10. Audit log 完整覆蓋所有 admin mutations
11. Payment 改由 seller 主審（admin 可覆審 / 介入）；buyer 可對 `scheduled` 期 Pay Early
12. ShipmentForm 接受 optional 的 B/L 掃描 + Inspection Report（COA/SGS）上傳到 `order_documents`
