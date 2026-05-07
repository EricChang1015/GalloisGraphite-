# Two-Day MVP Roadmap

> 假設:每天工作 ~10 小時,團隊 1-2 人 + Cursor。
> 每個 Step 對應一段 Cursor Prompt(直接貼即可)。

## Day 1 — 地基 + 公開頁 + AI + 賣家上貨

### ✅ Step 0 — 環境準備(已完成)
- [x] `npx create-next-app` (Next.js 16, TS, Tailwind v4, App Router)
- [x] 安裝核心依賴(supabase / anthropic / ai sdk / hookform / zod / lucide / resend ...)
- [x] `npx shadcn init` + 添加常用元件
- [x] 建立 `.cursorrules` / `.cursor/rules/*.mdc`
- [x] 建立 docs(PRD / SCHEMA / CONTRACT_TEMPLATE / ROADMAP)
- [x] 建立 `supabase/migrations/001_init.sql`
- [x] 建立 `.env.example`

### Step 1 — Supabase 專案 + Auth + Middleware(預估 1.5h)
1. 在 Supabase Dashboard 建立 project,複製 URL / anon / service_role 到 `.env.local`
2. 在 SQL Editor 跑 `supabase/migrations/001_init.sql`
3. Cursor Prompt:
   ```
   參考 .cursorrules 與 docs/SCHEMA.md。
   1. src/lib/supabase/{client,server,admin,middleware}.ts:
      - 使用 @supabase/ssr;client/server/admin 嚴格分離。
      - admin.ts 加 `import "server-only"`,只在 Server Action / route handler 使用。
   2. src/middleware.ts:
      - /(app)/* 需要登入,/admin/* 需 role=admin/super_admin
      - /(auth)/* 已登入 → /dashboard
   3. src/actions/auth.ts:
      - signUp(values) / signIn / signOut / resendVerification
      - 註冊時 trigger 在 SQL 已建,只需 supabase.auth.signUp
   4. src/app/(auth)/login|register|verify/page.tsx 使用 shadcn Form
   ```

### Step 2 — 公開頁面遷移(2h)
1. 從 `docs/oldSite/madagraphite.com-mirror/` 抽取舊站文案/圖,整理進
   `docs/LEGACY_CONTENT.md`(若還沒做,可以邊做邊整)
2. Cursor Prompt:
   ```
   建立 src/app/(public)/{page,about,products,news,chat}/page.tsx
   - 風格:graphite dark + accent gold,industrial 質感
   - 首頁:Hero、公司介紹、三大產品卡片、AI 助手 CTA
   - About:Graphite Energy Inc. 介紹 + 馬達加斯加礦場
   - Products:從 product_categories 讀(SSR)
   - News:從 news 讀已發布項目
   - Layout 含 Navbar(登入/註冊 CTA)+ Footer
   - 圖片可先用 picsum.photos 占位
   ```

### Step 3 — AI 助手(訪客模式,1.5h)
- `src/lib/ai/{prompt,knowledge}.ts`
- `src/app/api/chat/route.ts`(streaming)
- `src/components/chat/AiChat.tsx`(useChat)
- 偵測 `[LOGIN_REQUIRED]` 標記顯示登入 CTA

### Step 4 — 賣家上貨(2h)
- `src/app/(app)/listings/{page,new}.tsx`
- `src/actions/listing.ts` 含 zod schema、role 檢查
- 動態欄位渲染:依 `category.spec_schema`

## Day 2 — 買家流程 + 訂單 + 合約 + 付款 + IM + Admin + 部署

### Step 5 — 買家市場 + 詢價(2h)
- `/market`(公開瀏覽)+ `/market/[id]` 詳情
- 詢價 Dialog 表單
- `src/actions/inquiry.ts`(含寄信通知賣家)
- `/inquiries`(雙視角)
- 賣家 accept → 建立 order,導向訂單頁

### Step 6 — 訂單詳情 + 合約 + 付款(3h)
- `/orders` 列表 + `/orders/[id]` 細節 Tabs:
  - 概覽 / 合約 / 付款 / 出貨 / 收貨確認 / 溝通
- `src/components/order/{OrderTimeline,ContractGenerator,PaymentProof}.tsx`
- `src/lib/contract/template.ts` 渲染 HTML
- 雙方上傳簽名掃描 → Supabase Storage `contracts/`
- 買家提交 tx_hash/憑證 → `payments` insert
- `src/actions/order.ts` 完整狀態機

### Step 7 — 站內 IM(1.5h)
- 建單時自動建 chat_room
- `src/components/chat/OrderChat.tsx` Realtime
- `/messages` 總覽

### Step 8 — Admin 後台(2h)
- `/admin/{users,categories,orders,payments,news}/*`
- ⭐ payments 審核是核心,timeline 與 audit_logs 都要寫
- categories CRUD,spec_schema 用 textarea + JSON validation

### Step 9 — 部署 + 煙霧測試(1h)
1. 推 GitHub
2. Vercel import,設定 env
3. Supabase 切到 production URL,RLS 再 review 一次
4. Resend 設 domain(若 DNS 來不及就用 onboarding@resend.dev)
5. 端到端走完一個訂單

## 風險與備案

| 風險 | 備案 |
|---|---|
| Supabase Realtime 延遲/不穩 | 改 polling(SWR 5s) |
| Resend domain DNS 來不及 | 用預設 sender,提示 user 收件匣去看 |
| Vercel build 失敗(env) | 本地 `next build` 先過,確認 server-only 沒進 client |
| AI Token 過大 | 訊息超過 N 條時對前文做摘要 |
| Storage 成本 | MVP 階段限 KYC docs / contracts size 5MB,圖檔壓縮 |

## 完成定義(Definition of Done)

- [ ] 從註冊 → 完成訂單的端到端 happy path 可走通
- [ ] Admin 可審核付款並標記
- [ ] 公開頁 SEO meta(title/description/og)齊全
- [ ] 所有路由都有 loading.tsx 與 error.tsx 雛形
- [ ] 沒有 console.error / TS error / lint error
