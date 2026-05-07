# Mada Graphite Platform — Product Requirements (MVP)

> 此文件是基於原始 `Requirements.md` 重新整理出的可執行 PRD。
> 原始需求保留於 [`docs/Requirements.md`](./Requirements.md)。

## 1. 願景

打造一個結合 AI 智能諮詢、市場情報、B2B 交易的石墨產業平台,連接全球買家與
馬達加斯加在地賣家(Graphite Energy Inc. 自有礦場為主要供應方)。

## 2. 兩天 MVP 範圍

### IN SCOPE
1. **品牌官網**:首頁 / About / Products / News(整合舊 madagraphite.com 內容)
2. **AI 助手**:訪客可問石墨知識/公司介紹;碰到報價/購買意圖即提示登入
3. **註冊/登入**:Email + 驗證信(Supabase Auth);角色 buyer / seller
4. **超級管理員後台**:用戶凍結/解凍、品類管理、訂單與付款審核、新聞管理
5. **賣家上貨**:選品類 → 規格 / 數量 / 出貨地 / 出貨時間區間 / 價格 / 幣別 / Incoterm
6. **買家市場/詢價**:瀏覽 listings、發起詢價;賣家接受 → 自動建立訂單
7. **訂單**:完整狀態機(Draft → Signed → Paid → Shipped → Delivered → Completed)
8. **合約生成**:從模板渲染 HTML,可印出簽名,雙方上傳掃描檔
9. **付款人工審核**:用戶提交 tx_hash 或匯款憑證圖,Admin 在後台核驗
10. **站內 IM**:訂單內即時聊天(Supabase Realtime),含圖片附件
11. **基礎 KYC**:Email 驗證為主;之後可上傳企業登記/身份證件以提升 kyc_level

### OUT OF SCOPE (此次 MVP 不做)
- 區塊鏈/錢包整合(WalletConnect、Web3、Fireblocks 等一律不做)
- DocuSign / 電子簽名服務(平台自證即可)
- 即時石墨價格與歷史走勢圖(規格分散、單一報價偏差大,延後)
- 自動爬取石墨新聞(改為 admin 手動發布)
- 多語系(架構預留,但 MVP 僅英文 + 預留中繁/法文 i18n key)
- 自動化爭議仲裁(僅 admin 介入,合約 + 平台方為準)

## 3. 角色與權限

| 角色 | 描述 | 權限要點 |
|---|---|---|
| guest | 未登入訪客 | 看公開頁、用 AI(限知識性問答) |
| buyer | 已驗證買家 | 詢價、下單、付款、確認收貨、IM |
| seller | 已驗證賣家(僅自有/合作礦商) | 上貨、回應詢價、出貨更新、IM |
| admin | 平台運維 | 用戶/品類/訂單/付款/新聞/IM 介入 |
| super_admin | 平台所有人 | 管理 admin、敏感設定、平台錢包 |

## 4. 核心使用者流程

### 4.1 註冊
1. 使用者填 email + 密碼 + 角色(buyer/seller) + 公司名/國家
2. Supabase 寄驗證信 → 點擊驗證連結
3. `profiles.status` 由 `pending` 轉為 `active`
4. 超管可在後台凍結/解凍(`status='frozen'`)

### 4.2 賣家上貨
1. 賣家進入 `/listings/new`
2. 選擇品類,根據 `category.spec_schema` 動態生成規格欄位
3. 填:數量、單位(MT/KG)、出貨地、可出貨時間區間、單價、幣別、Incoterm、備註圖
4. 提交 → `listings.status = active`,進入買家市場頁

### 4.3 買家詢價 → 訂單
1. 買家在 `/market` 瀏覽,進詳情頁,點「Inquire」
2. 填:數量、目標價、目的地港、留言
3. 賣家收到通知(Email + 站內),在 `/inquiries` 看到
4. 賣家「Accept」 → 自動建立 `orders.status = draft`,雙方導向訂單頁

### 4.4 訂單核心流程
```
draft
  └─ seller / buyer 任一方點「生成合約」 → contract_generated
       └─ 雙方上傳簽名掃描 → signed
            └─ 買家提交付款資訊 → payment_pending
                 └─ admin 審核通過 → paid
                      └─ 賣家更新出貨資訊 → shipped
                           └─ 標記實際送達 → delivered
                                └─ 買家確認收貨 → completed
                                     └─ admin 放款給賣家(平台外操作 + 後台標記)
```
任何一步可進入 `disputed` 或 `cancelled`(僅雙方 + admin 可觸發)。

### 4.5 付款(MVP 簡化)
- 平台顯示自有錢包/帳戶資訊(USDT TRC20/ERC20、USDI、MUP、銀行)
- 買家在訂單頁付款 Tab 提交:方法 / 金額 / tx_hash / 憑證圖
- `payments.status = pending` → admin 在 `/admin/payments` 審核
- 通過 → `payments.status = verified` + `orders.status = paid`

### 4.6 站內 IM
- 建立訂單時自動建 `chat_rooms (type='order')`
- 成員: buyer + seller(+ admin 可選擇加入)
- 走 Supabase Realtime,訊息表 `messages`
- 支援文字 + 圖片附件(Storage `chat` bucket)

## 5. 非功能需求

| 類別 | 要求 |
|---|---|
| 部署 | Vercel(前端 + Server Actions),Supabase(Postgres / Auth / Storage / Realtime) |
| 效能 | 公開頁 SSG/ISR;市場頁 SSR + RSC;首屏 LCP < 2.5s(WiFi) |
| 安全 | 全表 RLS、service_role key 永不入 client、輸入用 zod |
| 可觀測性 | `audit_logs` 表記錄 admin 動作;Vercel Logs;後續可接 Sentry |
| 國際化 | i18n 結構預留(next-intl key),MVP 僅 en;合約必須英文版 |

## 6. 內容資產

- 舊 madagraphite.com 鏡像位於 `docs/oldSite/madagraphite.com-mirror/`,
  從中抽取公司介紹、產品規格、礦場照片;整理至 `docs/LEGACY_CONTENT.md`。
- 合約範本參考 `docs/contract/113-26 contract GRAPHITE ENERGY INC vs DOMINIK.docx`;
  抽取後續可動態填充欄位,寫入 `docs/CONTRACT_TEMPLATE.md`。

## 7. 成功指標(MVP 上線後 30 天觀察)

- 註冊用戶 > 50(買家:賣家比例約 3:1)
- 完成首筆完整流程(詢價 → 簽約 → 付款 → 出貨 → 確認)
- AI 助手問答觸發登入 CTA 轉換率 > 10%
- Admin 平均審核付款時間 < 24h
