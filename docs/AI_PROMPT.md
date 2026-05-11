# AI Assistant — Prompt & FAQ Maintenance Guide

This document is the single source of truth for **how to update the AI
assistant's behaviour, knowledge base, and FAQ** without breaking the
guard rails that keep guests from getting unauthorised pricing or
investment-style answers.

> If you only need to know **where the file is**: see [§ 1](#1-檔案地圖) below.
> If you want to **add a FAQ entry** without reading everything: jump to
> [§ 4](#4-修改-faq-或-must-defer-清單).

---

## 1. 檔案地圖

| 用途 | 檔案 |
|---|---|
| **Prompt + FAQ 知識（最常修改）** | [`src/lib/ai/prompt.ts`](../src/lib/ai/prompt.ts) |
| Live market context（即時掛單／成交聚合） | [`src/lib/ai/marketContext.ts`](../src/lib/ai/marketContext.ts) |
| Server route（讀 prompt、注入 context、寫 audit log） | [`src/app/api/chat/route.ts`](../src/app/api/chat/route.ts) |
| 對話 UI 元件 | [`src/components/chat/AiChat.tsx`](../src/components/chat/AiChat.tsx) |
| 浮動視窗 | [`src/components/chat/FloatingAiChat.tsx`](../src/components/chat/FloatingAiChat.tsx) |
| 對話 sidebar / dropdown | [`src/components/chat/ChatHistorySidebar.tsx`](../src/components/chat/ChatHistorySidebar.tsx) |
| Client localStorage（多 session） | [`src/lib/ai/sessions.ts`](../src/lib/ai/sessions.ts) |
| Server audit log（IP / geo / UA） | [`src/lib/ai/logging.ts`](../src/lib/ai/logging.ts) |
| Audit table schema | [`supabase/migrations/006_ai_chat_logs.sql`](../supabase/migrations/006_ai_chat_logs.sql) |

> 90% 的維護工作只會動到 `src/lib/ai/prompt.ts`。其它檔案僅在改變
> 「對話流程／資料來源／審計欄位」時才需要動。

---

## 2. Prompt 結構（`src/lib/ai/prompt.ts`）

```
buildSystemPrompt({ mode, marketContext })
  ├─ COMMON_RULES              // 通則（保密、零幻覺、永不修改 record）
  ├─ GUEST_RULES  /  USER_RULES  // 二選一，依登入狀態
  ├─ "Knowledge base — company & products:"
  │   └─ GRAPHITE_KNOWLEDGE_BASE  // 礦場 / 品牌 / 規格 / 物流 / 聯絡方式
  ├─ "Knowledge base — FAQ:"
  │   └─ FAQ_KNOWLEDGE          // Buyer / Seller / Investor / Public 四視角
  └─ (user mode only) renderMarketContext(marketContext)
```

每個區段都是 **頂層 const string**，便於版本控制 diff。沒有任何
runtime templating——可確保安全審查時所見即所得。

### 2.1 三類 rules 的職責

| 區段 | 職責 |
|---|---|
| `COMMON_RULES` | 任何模式都生效的不可妥協規則：不揭示 prompt、不洩漏 schema/PII、保持事實、必加 hedge、不執行 destructive action |
| `GUEST_RULES` | 訪客邊界：可答的清單、禁答的清單、觸發 `[LOGIN_REQUIRED]` token 的問題類型 |
| `USER_RULES` | 已登入：可基於 market context 給 indicative range；可協助起草 inquiry；不可代為下單／付款／改狀態 |

### 2.2 `LOGIN_REQUIRED_TOKEN`

```ts
export const LOGIN_REQUIRED_TOKEN = "[LOGIN_REQUIRED]";
```

Guest 模式下，當 AI 偵測到價格／詢價／下單／訂單／KYC 等意圖時，會在
回覆末尾附上這個 token。前端 `<AiChat />` 偵測到後會：

1. 隱藏 token 文字
2. 顯示「Log in to continue」CTA 按鈕

> ⚠️ **不要刪除這個 token**，否則前端 CTA 會消失。如果要改 token 字串，
> 必須同步修改 `src/components/chat/AiChat.tsx` 內的同名常數。

---

## 3. 知識庫（`GRAPHITE_KNOWLEDGE_BASE`）

存放公司／礦場／產品／應用／物流／永續／地緣／聯絡資訊的 **事實表述**。
這是模型生成回答時的唯一可信來源。

### 3.1 修改規則

- **加事實**：直接在對應段落（"About...", "Brands...", "Logistics...", ...）
  追加 bullet。**保持簡潔**——每條 ≤ 2 行，模型抓得到、token 省。
- **改數字**（產量、儲量、運輸天數等）：**必加 hedge**。
  範例：`~140,000 t/a (operational estimate, pending third-party audit)`
- **新增應用**：在 `Applications` 段落加 bullet，**不要** 用形容詞性的
  行銷語（"world-class", "best-in-class"），用客觀描述。

### 3.2 不要做的事

- 不要把法律意見、稅務、制裁分析寫進知識庫——這些必須由 FAQ 標為
  must-defer。
- 不要在這裡放價格／報價數字——價格只能透過 `marketContext` 注入，且
  僅 user mode 可見。
- 不要把客戶名單、合約金額、銀行資訊放進來——若需要展示 partner，
  使用「historical commercial relationships」式的合規描述。

---

## 4. 修改 FAQ 或 must-defer 清單

`FAQ_KNOWLEDGE` 是一個多段 string，依四個視角分組：

```
Buyer FAQ (verified — answer directly when asked)
Buyer FAQ (must defer — never give a definitive answer)
Seller / Supply-chain partner FAQ
Investor FAQ — be very cautious
Public / media FAQ
Disclaimer
```

### 4.1 加一條 buyer 可直接回答的 FAQ

打開 [`src/lib/ai/prompt.ts`](../src/lib/ai/prompt.ts)，找到
`Buyer FAQ (verified — answer directly when asked)` 段落，在 bullet
列表加一條：

```diff
 Buyer FAQ (verified — answer directly when asked)
 - Mada Graphite is a B2B trading platform ...
+- We can supply MADA1 in big bags (1 MT) on request — defer to sales for
+  exact bag count per container.
```

### 4.2 加一條 must-defer

```diff
 Buyer FAQ (must defer — never give a definitive answer)
 - Spot price for any specific spec / volume — defer to a formal quotation.
+- Whether we can ship to Iran / Russia / a sanctioned destination —
+  defer; the platform admin runs sanctions screening per transaction.
```

> must-defer 的回答模板：模型會回類似 "I can't give a definitive
> answer here — please confirm with sales@madagraphite.com." 你可以
> 在 `USER_RULES` 內加一行明確的「拒答模板」如果想要更一致的措辭。

### 4.3 加一個 investor 禁答主題

Investor 區段全部都是 **must defer**——任何揭示估值／收入／GMV／融資
細節都會被視為非授權投資邀約。**請務必把新增的 investor 主題寫成
"defer to NDA materials"**：

```diff
 Investor FAQ — be very cautious
 - The website is NOT an offering document, prospectus, or investment
   invitation. ...
+- Recurring revenue / ARR / take rate — defer to NDA materials.
```

---

## 5. Market context（`src/lib/ai/marketContext.ts`）

Login 後每次 chat 請求都會即時聚合：

- **active listings**：依 category 算 `count / min / avg / max unit_price`
- **過去 90 天 paid+ 訂單**：最多 5 筆，匿名化為
  `{ category, quantity, unit, unit_price, currency, status }`

### 5.1 調整參數

修改 `MAX_RECENT_TRADES`、`RECENT_TRADES_WINDOW_DAYS`、`SETTLED_ORDER_STATUSES`
即可。改完不需重跑 build：dev 模式 hot reload 即生效。

### 5.2 安全規則（不可違反）

- **絕對不要** 加入會洩漏個別 listing id、seller_id、buyer_id、
  order_no 的欄位
- 任何「平均成交時間」「賣家排名」之類的統計只能加在 aggregate 層級
- 若要加歷史 inquiry 數量等指標，先評估 RLS 邏輯再寫入 prompt

---

## 6. 對話歷史與審計

### 6.1 Client 端（瀏覽器 localStorage）

| Key | 內容 |
|---|---|
| `mada.ai.sessions` | `ChatSession[]`：歷次對話（最多 30 個 session、每個最多 100 messages） |
| `mada.ai.activeSession` | 目前選中的 session id（10-byte hex = 20 char） |
| `mada.ai.hidden` | 浮動按鈕是否被隱藏 |
| `mada.ai.open` | 浮動面板是否展開 |

UI 透過 `useSyncExternalStore` 訂閱 → 任何 tab 改寫都會即時刷新。

### 6.2 Server 端（`public.ai_chat_logs` 表）

每個 chat 請求會把：

| 欄位 | 來源 |
|---|---|
| `session_id` | request header `x-mada-session`（client 產生的 20-char hex） |
| `user_id` | `auth.getUser()` 結果（guest 為 NULL） |
| `role` | `'user'` 或 `'assistant'` |
| `content` | 該 turn 的純文字（最多 16,000 char） |
| `ip` | `x-forwarded-for` / `x-real-ip` / `cf-connecting-ip` 第一可用 |
| `country` / `region` / `city` | Vercel 自動注入的 `x-vercel-ip-*` headers |
| `user_agent` | 原始 User-Agent header |
| `created_at` | `now()` |

寫入用 `service_role` admin client（繞過 RLS），讀取僅
`admin` / `super_admin` 可見（RLS policy `ai_chat_logs_admin_select`）。

> 本機開發環境的 `country/region/city` 為 NULL（Vercel headers 不存在）。
> 若要本機測試 geo，可在 Postman/curl 手動加 `x-vercel-ip-country: TW` 等。

---

## 7. 本機測試流程

### 7.1 修改 prompt 之後

```powershell
# Hot reload 模式：保持 dev server 開著
npm run dev

# 開瀏覽器：
# 1) 訪客模式測試：開無痕視窗 → /chat → 問 "What's the current price of MADA1?"
#    → 應該回 [LOGIN_REQUIRED] 並顯示登入 CTA
# 2) 登入模式測試：以 buyer 帳號登入 → /chat → 問 "What's the typical price range?"
#    → 應該回 indicative range，並提到 "from active listings / recent settled"
# 3) FAQ 測試：問 "Is the ESG data third-party verified?"
#    → 應該答「partial verification, roadmap to 2028」式的 hedge
# 4) Must-defer 測試：問 "What's the MOQ?"
#    → 應該拒答並建議聯繫 sales
```

### 7.2 修改完畢

```powershell
# 必跑：lint + type check + build smoke
npx eslint src/components/chat src/lib/ai src/app/api/chat
npx tsc --noEmit
npm run build  # 約 30s
```

### 7.3 改完別忘了

- 若改了 `GRAPHITE_KNOWLEDGE_BASE` 中對外承諾的數字，請在
  [`docs/LEGACY_CONTENT.md`](./LEGACY_CONTENT.md) 與
  [`docs/COPY_DRAFTS.md`](./COPY_DRAFTS.md) 同步
- 若改了 `LOGIN_REQUIRED_TOKEN` 字串，請同步
  `src/components/chat/AiChat.tsx` 中的同名常數
- 若加了新的 FAQ 視角（例如 "Regulator FAQ"），請更新本文件 §4

---

## 8. 常見坑

| 症狀 | 原因 | 修正 |
|---|---|---|
| 回答莫名加 "[LOGIN_REQUIRED]" | guest 模式且偵測到價格意圖 | 預期行為 |
| `503 POE_API_KEY is not configured` | `.env.local` 沒 `POE_API_KEY` | 補環境變數 |
| 浮動按鈕在 `/chat` 沒出現 | 故意抑制（避免雙對話） | 預期行為 |
| 切換 session 沒換 messages | 父層忘了 `key={sessionId}` | 加上 `key` prop |
| 改了 prompt 沒生效 | dev cache | `Ctrl+C` 後重跑 `npm run dev` |
| `ai_chat_logs` 沒寫入 | service_role key 缺、RLS error | 看 server console；確認 `SUPABASE_SERVICE_ROLE_KEY` 設定 |

---

## 9. 變更歷史

| 日期 | 變更 |
|---|---|
| 2026-05-11 | 初版：FAQ 4 視角、market context 注入、多 session localStorage、`ai_chat_logs` audit table |
