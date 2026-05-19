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
   │  Supabase Cloud │               │  POE API         │    │  Resend      │
   │  - Auth         │               │  (OpenAI-compat) │    │  (Email)     │
   │  - Postgres+RLS │               │  Claude/GPT/...  │    │              │
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
| `/dashboard` | 歡迎詞 + 角色 badge + 快捷卡片（market/orders/inquiries/new listing for seller）+ Active Orders + Pending Inquiries |
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

**Layout**：`(app)/layout.tsx` → 左側 sidebar nav

### 2.4 `admin/` — Admin Console

需要 `role IN ('admin','super_admin')`，由 `src/proxy.ts` + RLS 雙重把關。

| 路由 | 內容 |
|---|---|
| `/admin` | 4 卡片統計（Users / Orders / Pending Payments / Active Categories）+ Priority Action 提示 |
| `/admin/users` | 完整用戶表 + freeze/unfreeze + setRole（super_admin 才能 promote 為 admin） |
| `/admin/categories` | CRUD + `spec_schema` jsonb 編輯（`<CategoryFormDialog />`） |
| `/admin/orders` | 全平台訂單瀏覽（list view） |
| `/admin/orders/[id]` | Admin 訂單詳情：ProgressBar + **Force Transition**（繞過 state machine）+ contract 狀態 + payments + documents + audit log + timeline |
| `/admin/payments` | ⭐ Pending Review + History 兩段，**核心人工審核流程**（`<PaymentVerifyActions />`） |
| `/admin/news` | 新聞 CRUD（slug、content_html、cover、published toggle） |

**Layout**：`admin/layout.tsx` → 左側 Admin Console nav

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
| payments | parties / admin | buyer | admin | — |
| **order_documents**（007） | parties / admin | parties + admin | uploader (1h window) / admin | uploader (1h, unverified) / admin |
| chat_rooms / chat_members / messages | members / admin | members | sender | — |
| news | published 公開 / admin | admin | admin | admin |
| audit_logs | admin | server action | — | — |

> Helper：`public.current_user_role()` 為 `security definer` SQL function，
> 內部回傳 `auth.uid()` 對應的 `profiles.role`。

### 3.3 Storage Buckets（規劃 vs 現況）

| Bucket | 用途 | 訪問模式 | 現況 |
|---|---|---|---|
| `avatars` | 使用者頭像 | public read, self write | ⚠️ 待建立 |
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
|  | `acceptQuotation` | buyer only | create order(`current_quotation_id` = q.id, status='contract_pending'), q.status='accepted', inquiry='converted', notify seller |
|  | `rejectQuotation` | parties | q.status='rejected'; if no live quotations remain on inquiry → inquiry='rejected' |
| `order.ts` | `generateContract` | (legacy) parties | alias for `draftContract` with `full_prepay` / 5d defaults |
|  | `draftContract` | seller, status ∈ {draft, quoted, negotiating, contract_pending} | render HTML, insert/update contract（revision_no++ 若 re-draft），同步 `orders.payment_terms`，status='contract_pending', notify buyer |
|  | `approveContract` | buyer, status='contract_pending' | `contract.buyer_approved_at` = now |
|  | `rejectContract` | buyer, status='contract_pending' | `contract.buyer_rejected_at`、`buyer_reject_reason`，notify seller |
|  | `uploadSignedScan` | parties, status ∈ {contract_pending, contract_signed} | update `contract.{role}_signed_url` + 寫入 `order_documents`；雙方簽完且 buyer 已 approve → status='contract_signed' → 自動跳到 `payment_pending`（full_prepay）或 `in_production`（net_after_arrival） |
|  | `markInProduction` / `markReadyToShip` | seller | 推進對應狀態 |
|  | `markShipped` | seller, status='ready_to_ship' | 寫入 B/L / vessel / containers / ETD/ATD/ETA + status='shipped'，notify buyer |
|  | `markInTransit` | seller | shipped → in_transit |
|  | `markArrived` | parties + admin | 寫入 ATA + 計算 `payment_due_date`（net_after_arrival 才有意義），status='arrived' |
|  | `markCustomsCleared` | buyer | 寫入 `customs_cleared_at`，status='customs_cleared'；full_prepay 自動 → completed；net_after_arrival → payment_pending |
|  | `raiseDispute` | parties + admin | status='disputed'，audit_logs，notify admin |
|  | `cancelOrder` | parties + admin（pre-shipment 階段） | status='cancelled'，audit_logs |
|  | `forceTransitionOrder` | admin only | bypass state machine，audit_logs（管理員恢復用） |
|  | `confirmReceipt` / `markDelivered` / `updateShipment` | (legacy) | 對應 `markCustomsCleared` / `markArrived` / `markShipped` 的別名，相容舊 UI |
| `payment.ts` | `submitPayment` | buyer, status ∈ {contract_signed, payment_pending}, `company_name`/`country` non-empty | payment 寫入(pending), order.status→'payment_pending', notify admin；commercial profile 缺漏時回 `error.code='PROFILE_INCOMPLETE'` |
|  | `verifyPayment` | role ∈ {admin, super_admin} | payment.status→verified/rejected；驗證通過後依 `order.payment_terms` 自動推進：`full_prepay` → paid → in_production；`net_after_arrival` → paid → completed |
| **`document.ts`（007）** | `uploadOrderDocument` | parties + admin | insert `order_documents` row（檔案由 client 上傳到 `order-documents` bucket），timeline append |
|  | `verifyOrderDocument` | admin only | 標記已核驗，audit_logs |
|  | `deleteOrderDocument` | uploader（1h, 未驗證）/ admin | delete row |
| `admin.ts` | `freezeUser` / `unfreezeUser` | admin | profiles.status, audit_logs |
|  | `setUserRole` | admin（promote 為 admin 需 super_admin） | profiles.role, audit_logs |
|  | `upsertCategory` / `deleteCategory` | admin | product_categories, audit_logs |
|  | `upsertNews` | admin | news, audit_logs |

### 4.3 Server Actions 共通慣例

- 第一行 `"use server"`
- zod 驗證所有外部輸入
- `supabase.auth.getUser()` 取使用者（**不用 `getSession`**）
- 雙重授權：先檢查 `profiles.role` / 業務狀態，再依靠 RLS 為第二道防線
- 訂單狀態轉換 → 同一個 update 內 append `timeline` event
- Admin 動作 → `audit_logs` 寫入
- 結束前 `revalidatePath()`

### 4.4 訂單狀態機（`src/lib/order/stateMachine.ts`）

採用兩條共用前段、後段分流的狀態機（依 `orders.payment_terms` 分支）：

```
quotation_pending → quoted ↔ negotiating → contract_pending → contract_signed
                                                                   │
                                       ┌───────── full_prepay ─────┴──── net_after_arrival ──────┐
                                       ▼                                                          ▼
                              payment_pending → paid → in_production                       in_production
                                                              │                                   │
                                                              └────►  ready_to_ship  ◄────────────┘
                                                                              │
                                                                          shipped → in_transit → arrived → customs_cleared
                                                                                                                  │
                                  ┌─────────── full_prepay ─────────────────────────────────────────────────┴── net_after_arrival ──┐
                                  ▼                                                                                                  ▼
                              completed                                                                              payment_pending → paid → completed

任何節點 → disputed / cancelled
disputed → cancelled / completed
```

API:
- `canTransition(from, to, paymentTerms?)` — 型別安全的轉換驗證（會依 payment_terms 解析分支差異）
- `nextAfter(current, paymentTerms)` — auto-advance 用：在 contract_signed / paid / customs_cleared 三個分支點回傳對應下一狀態
- `getProgressStages(paymentTerms)` — 給 UI ProgressBar 用的有序狀態清單
- `getStageIndex(status, paymentTerms)` — 目前狀態在 progress bar 的位置
- `STATUS_LABEL` — 各狀態的英文 label

`disputed` / `cancelled` 由 `<OrderPhaseActions />` 觸發。`forceTransitionOrder`（admin only）可繞過狀態機（紀錄到 audit_logs）。

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
                OrderDocumentsTab / DocumentUploader / DocumentVerifyButton
  admin/        UserActions / CategoryActions / NewsActions /
                PaymentVerifyActions / AdminOrderActions
  chat/         AiChat / AiChatLauncher / FloatingAiChat /
                ChatHistorySidebar / ChatPageBody / PinAiToggle
  theme/        ThemeProvider / ThemeToggle
```

### 7.4 Toast / Loading

- `<Toaster />` 自 `@/components/ui/sonner` 在 root layout 掛一次
- 操作後 `toast.success(...)` / `toast.error(...)`
- Loading 用 shadcn `Skeleton`（避免 spinner-only）

---

## 8. 通知系統（`src/lib/email/resend.ts`）

| 觸發點 | 對象 | 內容 |
|---|---|---|
| `createInquiry` | seller | 「New inquiry received」+ link 到 /inquiries |
| `submitPayment` | admin (`ADMIN_EMAIL`) | 「New payment pending review」+ link 到 /admin/payments |
| `verifyPayment(verified)` | buyer | 「Payment verified」 |
| `verifyPayment(rejected)` | buyer | 「Payment rejected」+ admin note |
| `confirmReceipt` | admin | 「Buyer confirmed receipt — release funds」 |

Email 失敗為 non-blocking（包在 try/catch，不阻擋業務流程）。

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
| `RESEND_API_KEY` | ✅ | Resend API key |
| `RESEND_FROM_EMAIL` / `RESEND_FROM_NAME` | ✅ | 寄件人資訊 |
| `NEXT_PUBLIC_APP_URL` | ✅ | 站台 URL（verify 信、admin link 用） |
| `NEXT_PUBLIC_APP_NAME` | — | 顯示用 |
| `ADMIN_EMAIL` | ✅ | 接收 payment / receipt 通知信 |
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

---

## 附錄 A：實作但 PRD 未列項目

下列功能已在程式碼中實作，未來如有對外文件需引用，請以本文件為準：

1. `/dashboard` — 登入後預設首頁，顯示 active orders 與 pending inquiries
2. `/admin` — 4 卡片統計 + Priority Action 提示
3. `/admin/orders` — 平台訂單瀏覽
4. `(public)/geopolitics` — China+1 sourcing case 行銷頁
5. `(public)/sustainability` — ESG roadmap 行銷頁
6. 三主題支援（light / dark / editorial）+ `<ThemeToggle />`
7. News slug + 富文本（content_html）+ cover image
8. 12 個預設 product categories + Custom Grade
9. Resend Email 通知（5 個事件點）
10. Audit log 完整覆蓋所有 admin mutations
