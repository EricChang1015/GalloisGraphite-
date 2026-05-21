# B2B 交易全流程 E2E 測試報告

| 項目 | 值 |
|---|---|
| 測試日期 | 2026-05-21 |
| 環境 | 本機 dev server（`npm run dev` + `.env.local` 連線 production Supabase） |
| Run ID | MPEXSYJV |
| 測試訂單 | **ORD-260521-1e7c84**（`91b8dc87-b94f-41e1-abfb-2d2e2e5a0f53`） |
| 測試詢價 | `9392df27-c011-4be6-be19-8069b3e2a8ef` |
| 帳號 | `+seller@` / `+buyer@`（見 `docs/TESTING.md`） |
| 自動化 | `node scripts/e2e-full-trading.mjs` |

---

## 1. 執行摘要

| 階段 | 賣家視角 | 買家視角 | 結果 |
|---|---|---|---|
| A 上架 | 建立 listing `QA-FULL-*` | — | ✅ |
| B 詢價／議價 | 報價 4300 → counter 4280 | 詢價 → counter 4250 → **Accept** | ✅（修復 `listing_id` 後） |
| C 合約 | 起草 v1 → 買方退回 → 30/70 重擬 → 雙簽 | 退回修改 → Approve → 上傳簽名 | ✅（DB 已 `in_production`） |
| D 付款 | Seller Verify | Pay Early 兩期皆付清 | ⚠️ 見 B007 |
| E 物流 | Ready to ship | — | ⚠️ 未走完 `shipped → arrived` |
| F 結案 | — | Customs（需 `arrived`） | ❌ 卡在 `ready_to_ship` |

**結論**：議價接單、合約修改／核准／雙簽、付款提交與賣家審核在修復後可運作；**最嚴重阻斷已確認為 counter 報價遺失 `listing_id`**（已在本分支修復）。Production 若未部署同批修復，仍會重現上架靜默失敗與 Accept 無訂單。

---

## 2. 步驟結果（自動化 + DB 交叉驗證）

| 步驟 | 結果 | 備註 |
|---|---|---|
| A1 Seller create listing | ✅ | |
| A2 Listing on market | ✅ | 偶爾需 reload（SSR 快取） |
| B1 Buyer inquiry | ✅ | |
| B2 Seller quotation 4300 | ⚠️ | Toast 判定不穩；報價列實際存在 |
| B3–B4 Counter | ✅ | |
| B5 Buyer accept → order | ✅ | 修復前：60s 無導向、無 toast |
| C1–C5 Contract draft / reject / redraft / approve / buyer sign | ✅ | |
| C6 Both signed → in_production | ⚠️ | UI 刷新慢；DB 已 `in_production` |
| D1–D2 Payment + verify | ✅ | 使用 `placeholder="0x..."` |
| E Shipping 線性流程 | ❌ | 腳本順序與狀態機不符；訂單停 `ready_to_ship` |
| F Completed | ❌ | 兩期已 `paid` 但未到 `customs_cleared` |

**ORD-260521-1e7c84 最終 DB 狀態**（手動延續測試後）：

```text
orders.status = ready_to_ship
payment_schedules: 30% before_shipment = paid, 70% arrived_at_port = paid
payments: 2 × verified
```

→ **所有款項已付清，但訂單無法自動 completed**（`maybeAutoComplete` 僅在 `customs_cleared` 觸發）。營運上會看到「錢付完了、單還沒結」。

---

## 3. 買家／賣家流程合理性

### 3.1 賣家（Seller）

| 環節 | 是否合理 | 說明 |
|---|---|---|
| 上架 | ⚠️ → ✅（修復後） | 空 `available_from/to` 送 `""` 會 PG 錯誤且無 field 提示（production 未部署前仍壞） |
| 報價 Dialog | ✅ | `Send Quotation` + `QuotationForm` 符合預期 |
| 議價 Counter | ✅ | 來回 counter 正常 |
| 接單 | — | 由買方 Accept；賣家收到通知草稿合約 |
| 合約起草／重擬 | ✅ | 100% → 買方退回 → 30/70 模板可用 |
| 簽名上傳 | ✅ | 需買方先 Approve；雙簽後自動 `in_production` |
| 出貨按鈕 | ⚠️ | **Overview** tab 的 `OrderPhaseActions`，非 Shipment tab；須依狀態順序：`in_production` → ready → **Shipment 表單 shipped** → in_transit → arrived |
| 付款審核 | ✅ | Payment tab「Verify」；主審為 seller |

### 3.2 買家（Buyer）

| 環節 | 是否合理 | 說明 |
|---|---|---|
| Market 詢價 | ✅ | |
| 議價 Accept | ❌→✅ | **Counter 後 live 報價 `listing_id` 為 null 時 Accept 失敗**（已修） |
| 合約退回修改 | ✅ | `Return for revision` |
| 合約 Approve + 簽名 | ✅ | |
| 付款 Pay Early | ⚠️ | 允許 `scheduled` 期提前付；**可跳過物流 milestone**（見 B007） |
| 通關確認 | ✅ | 僅在 `arrived` 顯示「Confirm Customs Cleared」 |

---

## 4. 問題清單（請依優先級修正）

### B001 [P0] 上架表單靜默失敗（production 未部署修復前）

- **現象**：Seller 填 listing 後無錯誤提示、未導向 `/listings`。
- **根因**：`createListing` 將空字串 `available_from` / `available_to` 寫入 `date` 欄位 → Postgres `invalid input syntax for type date: ""`。
- **修復**：`src/actions/listing.ts` 改為 `?.trim() || null`；`ListingForm` 顯示 `fieldErrors`。
- **驗證**：本機 A1 ✅。

### B002 [P0] 報價 shipping window 空字串（同上）

- **根因**：`shipping_window_from/to` 送 `""`。
- **修復**：`src/actions/quotation.ts` `submitQuotation` / `counterQuotation` 已 trim → null。

### B003 [P0] 議價後 Accept 無法建立訂單 ✅ 已修（本分支）

- **現象**：買方點 Accept，不導向 `/orders/`，常無 sonner toast（或 toast：*Quotation must reference a listing*）。
- **根因**：`counterQuotation` 插入新列時 `listing_id: parsed.data.listing_id ?? null`，表單未帶 `listing_id` → **counter 鏈最後一筆 `sent` 報價 `listing_id = null`**，`acceptQuotation` 拒絕建單。
- **修復**：
  - `counterQuotation` 繼承 parent / inquiry 的 `listing_id`。
  - `acceptQuotation` 對舊資料 fallback 查 `inquiries.listing_id`。
- **驗證**：B5 ✅ → ORD-260521-1e7c84。

### B004 [P1] Inquiries 列表「Accept」語意混淆

- **位置**：`/inquiries` 列表 `InquiryActions`。
- **現象**：按鈕文案為 **Accept**，實際呼叫 `acceptInquiry`（自動送一筆預設報價），非買方接受報價。
- **建議**：改為「Quick quote」／「Send default quotation」；真正接單僅在詳情頁 `QuotationActions` → **Accept Quotation**。

### B005 [P1] 未雙簽仍可 Pay Early（production 曾驗證）

- **現象**：訂單仍 `contract_pending` 時，Payment tab 可提前付款；賣家 Overview 無出貨按鈕。
- **建議**：`submitPayment` 檢查 `orders.status` 至少 `contract_signed`（或雙簽完成）；或 UI 隱藏 Pay Early。

### B006 [P2] 合約／付款頁需手動 F5

- **原因**：無 Supabase Realtime 訂閱訂單狀態。
- **建議**：Phase 2 加 `revalidatePath` 輪詢或 Realtime。

### B007 [P1] Pay Early 付清所有期數但訂單卡在物流中段

- **現象**：ORD-260521-1e7c84 在 `ready_to_ship`，兩筆 schedule 均已 `paid`，無法 `completed`。
- **原因**：
  1. `maybeAutoComplete` 僅在 `customs_cleared` + 全 schedule paid。
  2. 測試使用 30/70 模板（`before_shipment` + `arrived_at_port`），買家可對仍 `scheduled` 的尾款 Pay Early。
  3. 自動化未依序完成 `shipped → in_transit → arrived → customs_cleared`。
- **建議**：
  - 產品：全額 paid 但 `status < customs_cleared` 時顯示橫幅「物流未完成，無法結案」。
  - 可選：限制 postpayment 的 Pay Early 至 milestone 已觸發或 order ≥ `arrived`。
  - QA：更新 `docs/TESTING.md` 腳本順序（見 §5）。

### B008 [P2] 付款 Dialog 無障礙 label

- **現象**：`Transaction Hash` 的 `<Label>` 未綁 `htmlFor`，Playwright `getByLabel` 失敗。
- **建議**：`PaymentScheduleTable.tsx` 為 Input 加 `id` + `htmlFor`，或 E2E 用 `getByPlaceholder('0x...')`（腳本已改）。

### B009 [P2] E2E 腳本與狀態機順序不一致

- **正確順序**（賣家）：`in_production` → Mark Ready to Ship → **Shipment: Mark as Shipped** → Mark In Transit → Mark Arrived →（買家）Customs。
- **錯誤**：在 `ready_to_ship` 點 In Transit / Arrived（按鈕不顯示或 transition 失敗）。

### B010 [P3] Market 新 listing 偶爾需 reload

- **建議**：`createListing` 後 `revalidatePath('/market')`。

---

## 5. 建議人工走測腳本（修正版）

對齊 `docs/TESTING.md` 情境 B（30/70），**務必在雙簽 + `in_production` 之後**再付款，並依序物流：

1. Seller：上架 → Buyer：詢價 → Seller：報價 → 雙方 counter → **Buyer：詳情頁 Accept（live `sent` 列）**
2. Seller：Contract → Draft（30/70）→ Buyer：Approve → 雙方上傳簽名 → 確認狀態 **In Production**
3. Buyer：付 30%（`before_shipment` 變 `due` 或 Pay Early）→ Seller：Verify
4. Seller：Overview → Ready to Ship → **Shipment tab → Mark as Shipped** → In Transit → Arrived
5. Buyer：Overview → Confirm Customs Cleared
6. Buyer：付 70%（若仍 scheduled 且 milestone 已觸發）→ Seller：Verify → 狀態 **Completed**

---

## 6. 本分支已含修復（待 deploy）

| 檔案 | 變更 |
|---|---|
| `src/actions/quotation.ts` | counter `listing_id` 繼承；accept fallback；date trim |
| `src/actions/listing.ts` | `available_*` 空字串 → null |
| `src/components/listing/ListingForm.tsx` | server `fieldErrors` → 表單 |
| `scripts/e2e-full-trading.mjs` | 全路徑 Playwright + 報告輸出 |

**部署前請在 production 重跑 B003 與 A1 Regression。**

---

## 7. 資料修復（可選）

歷史 counter 報價若 `listing_id IS NULL` 且仍 `sent`，可執行（替換 inquiry id）：

```sql
update quotations q
set listing_id = i.listing_id
from inquiries i
where q.inquiry_id = i.id
  and q.listing_id is null
  and q.status = 'sent'
  and i.listing_id is not null;
```

---

## 8. 附錄：重現指令

```bash
npm run dev
export E2E_BASE_URL="<your-local-next-dev-url>"
node scripts/e2e-full-trading.mjs
# 報告：docs/E2E_REPORT_FULL.md
# JSON：scripts/e2e-full-trading-result.json
```
