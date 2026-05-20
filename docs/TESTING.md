# Testing Accounts & End-to-End Walkthrough

> 本文件記錄 production / staging Supabase 的測試帳號與完整 happy-path
> 走測腳本。請勿把帳號改成真實 email 發信目的地——
> 這些 email 是 Gmail alias（`+suffix` 形式），只在 Supabase 留登入紀錄用。

---

## 1. 測試帳號（production: `galloisgraphite.vercel.app`）

| 角色 | Email | Password | 備註 |
|---|---|---|---|
| **Admin (super_admin)** | `eric.chang.1015+admin@gmail.com` | `a1234567` | 可進 `/admin/*`、人工審核付款 |
| **Seller** | `eric.chang.1015+seller@gmail.com` | `a1234567` | 可上架 listings、發 quotations、起草合約 |
| **Buyer** | `eric.chang.1015+buyer@gmail.com` | `a1234567` | 詢價、議價、簽合約、付款 |

**所有帳號都是 Gmail alias**：`+admin` / `+seller` / `+buyer` 三個地址實際上都會
進到 `eric.chang.1015@gmail.com` 同一個收件夾，但 Supabase Auth 視為三個獨立帳號。

> ✅ **2026-05-20 起 transactional email 已能正常寄達**：通知信改走 **AWS SES SMTP**
> （`src/lib/email/smtp.ts`，nodemailer）。三個 Gmail alias（`+admin` / `+seller` /
> `+buyer`）都會收進 `eric.chang.1015@gmail.com` 同一個收件夾，**可以**用來驗證信件
> 內容。`/admin/settings → Send test email` 提供一鍵連線驗證。

### 1.1 切換登入

Chrome 推薦做法：開三個 **incognito profile** 或用 **Profiles**（左上角 avatar）
建立 Seller / Buyer / Admin 三個 profile，互不干擾 cookie。或者用 Edge + Firefox
+ Chrome 三個瀏覽器各登一個角色。

### 1.2 升級為 super_admin

第一次部署後，admin 帳號的 `profiles.role` 預設是 `buyer`。需要手動 SQL 升級：

```sql
update public.profiles
set role = 'super_admin'
where email = 'eric.chang.1015+admin@gmail.com';
```

可以透過 `scripts/apply-migrations.mjs` 的 query helper 跑（見
[`.cursor/rules/migrations.mdc`](../.cursor/rules/migrations.mdc#helper-queries)）。

### 1.3 切換 buyer ↔ seller

`/admin/users` 提供 role picker（super_admin 才能 promote 為 admin / super_admin）。
測試 seller 需要先在 admin 後台把 `eric.chang.1015+seller@gmail.com` 從預設的
`buyer` 改成 `seller`。

### 1.4 SMS 交易通知（可選）

1. 在 `.env.local` 填入 `SMS_BASE_URL`、`SMS_APP_ID`（可選 `SMS_TYPE`）。
2. 以 admin 登入 → `/admin/settings` → 開啟 **SMS notifications**。
3. 買/賣双方在 `/settings` 填寫 **phone**（含國碼）。
4. 走一筆詢價→報價→訂單流程，確認閘道收到 SMS；關閉開關後應只發 Email。

完整觸發點清單見 [`ARCHITECTURE.md` §8](./ARCHITECTURE.md#8-通知系統)。

---

## 2. End-to-End Happy Path 腳本（full_prepay 分支）

下面這條路徑會走過 13-stage state machine 的主要節點。每一步預期看到的畫面
與資料庫狀態都列在右側。

### Phase A — 上架（Seller）

| # | 動作 | 預期結果 |
|---|---|---|
| A1 | 登入 Seller 帳號 → `/listings/new` | 進入上架表單 |
| A2 | 選 category（e.g. `MADA1 — +80 Mesh`）、qty 50 MT、price 4500 USD、CFR、origin Tamatave | 表單通過 zod 驗證 |
| A3 | Submit | listings.status='active'，跳轉 `/listings`，新 listing 出現在 `/market` |

### Phase B — 詢價 + 議價（Buyer ↔ Seller）

| # | 動作 | 預期結果 |
|---|---|---|
| B1 | Buyer 登入 → `/market` → 點 listing → `<InquiryDialog />` 填 requested_qty / target_price / destination / message | `inquiries.status='pending'`，seller 收 email |
| B2 | Seller → `/inquiries` Received tab → `<QuotationForm />` 開報價（price/incoterm/validity） | `quotations.status='sent'`，`inquiries.status='quoted'` |
| B3 | Buyer → `/inquiries/[id]` → `<QuotationActions />` 「Counter」回一個新價 | parent quotation `'countered'`，新 quotation `'sent'`，`inquiries.status='negotiating'` |
| B4 | Seller 再 counter 一次 → Buyer 最終 「Accept」 | `quotations.status='accepted'`，**`orders` insert (`status='contract_pending'`, `current_quotation_id=q.id`)**，`inquiries.status='converted'` |

### Phase C — 合約（Seller draft → Buyer review → 簽名）

| # | 動作 | 預期結果 |
|---|---|---|
| C1 | Seller → `/orders/[id]` → Contract Tab → `<ContractDraftForm />` 選 `full_prepay` + Days 5 → 「Draft Contract」 | `contracts.revision_no=1`，`contracts.content_html` 有渲染好的 HTML，`orders.payment_terms='full_prepay'`，order 維持 `contract_pending`，timeline append `contract_redrafted` |
| C2 | Buyer 切到 Contract Tab → 看 `<ContractPreview />` → 「Approve Contract」 | `contracts.buyer_approved_at` 寫入；UI 顯示「You have approved this contract.」 |
| C3 | Seller 與 Buyer 各自上傳簽名掃描（任意 PNG / PDF） | 兩份都齊 + buyer approved → **自動 `contract_signed` → 再自動 `payment_pending`**（full_prepay 分支），timeline 連續記錄 |

### Phase D — 付款 + 出貨

| # | 動作 | 預期結果 |
|---|---|---|
| D1 | Buyer → Payment Tab → 對 `due`（或 `scheduled` 列 Pay Early）填 method=`usdt_trc20` + amount + tx_hash + note → Submit | `payments.status='pending'` + `schedule.status='awaiting_review'`，**seller 收 email/SMS（主收）、admin 收 email CC** |
| D2 | **Seller**（or Admin）→ `/orders/[id]` Payment Tab →`<PaymentVerifyActions />` 「Verify」（可填 reviewer note） | `payments.status='verified'`、`schedule.status='paid'`、`schedule.paid_payment_id=payment.id`；buyer 收信標明 verified by Seller / Admin。**訂單 status 不變**（除非 customs_cleared 且全部 schedule 都 paid → `autoCompleteIfReady` 自動 → `completed`） |
| D3 | Seller → `/orders/[id]` → 「Mark Ready to Ship」 | status → `ready_to_ship` |
| D4 | Seller → `<ShipmentForm />` 填 B/L No、vessel_name、container_numbers、ETD/ATD/ETA → **(optional)** 上傳 B/L scan + Inspection Report (COA/SGS) → Submit | status → `shipped`，buyer 收 email；optional 檔案寫進 `order_documents`（type=`bill_of_lading` / `inspection_report`） |
| D5 | Seller → 「Mark In Transit」 | status → `in_transit` |
| D6 | Seller / Buyer / Admin → `<MarkArrived />` 填 ATA | status → `arrived`；觸發 `arrived_at_port` milestone，相關 schedule `scheduled→due` |

### Phase E — 結案

| # | 動作 | 預期結果 |
|---|---|---|
| E1 | Buyer → 「Customs Cleared」 | full_prepay 流：status → `customs_cleared` → 自動 `completed`，admin 收 email |
| E2 | 切回 Admin → `/admin/orders/[id]` 看 Timeline | 13+ 筆事件，狀態欄 `Completed` |

---

## 3. Net-after-arrival 分支差異

C1 起選 `net_after_arrival` + Days 30，後面：

- C3 雙方簽完 + buyer approved → **直接 `contract_signed` → `in_production`**（跳過 `payment_pending` / `paid`）
- D1–D2 跳過
- E1 Buyer 確認通關 → 直接 → `payment_pending`（**不是 completed**），UI 顯示 `payment_due_date`
- E2 Buyer 補做 D1（submit payment）
- E3 Admin verify → **`paid` → `completed`**（**不再進 `in_production`**）

---

## 4. Dispute / Cancel 旁支

| 動作 | 觸發者 | 結果 |
|---|---|---|
| Raise Dispute | 任一方（非終止狀態） | status → `disputed`，admin 收 email，audit_logs |
| Cancel Order | 任一方（pre-shipment 階段） | status → `cancelled` |
| Admin Force Transition | super_admin / admin | 從 `disputed` 強推回 `completed` / `cancelled` / 任意目標；audit_logs metadata 記錄 from/to/reason |

---

## 5. 已知阻塞

1. ✅ ~~**`order-documents` Storage bucket 尚未建立**~~ — 已由 `010_storage_order_documents.sql` 建立
2. ✅ ~~**Resend domain DNS 未驗證**~~ — 2026-05-20 改 **AWS SES SMTP**（`src/lib/email/smtp.ts`），通知信已能正常寄達；`/admin/settings` 有「Send test email」可即時驗證連線
3. ⚠️ **A2 站內 IM 未實作** — 訂單 Tab 沒有 chat 欄位
4. ✅ ~~**`(app)` layout sidebar 缺 Logout 按鈕**~~ — 已掛上 `<Navbar />` + `<MobileNav />`
5. ⚠️ **net_after_arrival 走測尚未完成** — 路徑與 actions 與 full_prepay 共用，但分支跳轉時點不同，需各跑一次
6. ⚠️ **KYC 文件上傳尚未實作** — commercial profile gate 已完成（缺欄會回 `PROFILE_INCOMPLETE`），但 `kyc` bucket / `<KycUploadForm />` / admin 升級 `kyc_level` 仍待補（ROADMAP §A6）

---

## 6. 走測紀錄

### 2026-05-15 — Full prepay flow 端到端通過

`ORD-TEST-MP6PL7MZ` 從 `negotiating` 一路推到 `completed`，每個階段的 timeline event 都正確記錄：

| 階段 | 操作者 | 動作 | 結果 |
|---|---|---|---|
| `quotation_pending → quoted` | Seller | `<QuotationForm />` 報價 | `inquiries.status='quoted'` |
| `quoted → negotiating` | Buyer | counter-offer | parent quotation 變 `countered` |
| `negotiating → contract_pending` | Buyer | `acceptQuotation` | order insert |
| `contract_pending → contract_pending` (redraft) | Seller | `<ContractDraftForm />` 選 `full_prepay` / 5d | `contracts.revision_no=1` |
| Buyer approve + 雙方上傳簽名掃描 | Both | `<SignedScanUploader />` | `contract_signed` → 自動 `payment_pending`，預覽自動嵌入簽名 |
| `payment_pending → paid` | Buyer / Admin | `submitPayment` (`bank_transfer`+proof) → `verifyPayment` | `paid → in_production` 自動推 |
| `in_production → ready_to_ship → shipped` | Seller | `markReadyToShip` + `<ShipmentForm />`（B/L MAEU260515E2E、vessel MAERSK SOUTH） | 全部欄位寫入 |
| `shipped → in_transit → arrived` | Seller | `markInTransit` + `markArrived` (ATA 2026-05-15) | `orders.ata` 寫入 |
| `arrived → customs_cleared → completed` | Buyer | `markCustomsCleared` | `customs_cleared_at` 寫入，自動進 `completed` |

驗證項目：
- ✅ Buyer 列表頁訂單顯示 `completed` 徽章
- ✅ Timeline tab 完整顯示 15 筆 transition events
- ✅ OrderProgressBar 第 14 階段顯示為綠色「Done」
- ✅ `npm run build` exit 0、無 lint error、無新 console error

---

### 2026-05-20 — Payment seller-review + Pay Early + Email migration 煙霧通過

驗證項目：
- ✅ Buyer 對 `ORD-260520-601b6b` `scheduled` 列點「Pay Early」→ schedule 進 `awaiting_review`、seller 收 email
- ✅ Seller 在訂單 Payment Tab 直接 `<PaymentVerifyActions />` Verify → schedule `paid`、buyer 收信標明「verified by Seller」
- ✅ 所有 schedule paid 後 `autoCompleteIfReady` 才把訂單推到 `completed`（修正先前 count bug，未付完款不再誤推）
- ✅ `/admin/settings → Send test email` 在 admin Gmail 收件夾收到測試信（AWS SES SMTP）
- ✅ `<ContractDraftForm />` Incoterm 帶到議價最後一輪的 q.incoterm（非 listing 原值）
- ✅ `<ShipmentForm />` 在不上傳 B/L / Inspection Report 時仍可 Mark Shipped；上傳時寫進 `order_documents`
- ✅ `<SelectItem />` 在 hover 時前景 / 背景對比清楚
- ✅ `node scripts/check-dev-errors.mjs` exit 0（過濾掉 MCP / Bitdefender 注入的 hydration false positive）

---

## 7. 變更歷史

| 日期 | 變更 |
|---|---|
| 2026-05-15 | 初版：3 個測試帳號、full_prepay / net_after_arrival 走測腳本、dispute/cancel 旁支 |
| 2026-05-15 | Full prepay 端到端走測通過；`order-documents` bucket 建好（010） |
| 2026-05-20 | Payment seller-review + Pay Early + Email (AWS SES SMTP) 煙霧通過；§1 移除「不要驗 email」警示、§5 阻塞列 #2/#4 標完成、§2 Phase D 改寫成 seller-primary review 流程；新增已知阻塞 #6 KYC 上傳 |
