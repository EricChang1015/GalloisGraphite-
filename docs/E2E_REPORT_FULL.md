# Full E2E 交易流程測試報告

| 項目 | 值 |
|---|---|
| Run ID | MPLF5O93 |
| Base URL | http://127.0.0.1:3000 |
| 訂單 | ORD-260525-67fdd1 |
| Order UUID | b9d4d54a-3d0d-4562-b8e0-03d02044fff0 |
| Inquiry UUID | c12a1a7a-2989-4ce7-abf5-9a6ae3068511 |

## 步驟結果

| 步驟 | 結果 | 備註 |
|---|---|---|
| A1 Seller listing seeded (API) | ✅ | 354cfe29-f2e3-4323-94f8-0382c3072ff4 |
| A2 Seller can open listing detail | ✅ | 354cfe29-f2e3-4323-94f8-0382c3072ff4 |
| B1 Buyer inquiry seeded (API) | ✅ | c12a1a7a-2989-4ce7-abf5-9a6ae3068511 |
| B2 Seller quote 4300 (seeded) | ✅ | 251b048b-ad86-48ad-8376-0f73e00923d0 |
| B3 Buyer counter 4250 (seeded) | ✅ | — |
| B4 Seller counter 4280 (seeded) | ✅ | — |
| B5 Buyer accept -> order | ✅ | ORD-260525-67fdd1 |
| C1 Seller draft contract v1 | ✅ | — |
| C2 Buyer reject contract | ✅ | — |
| C3 Seller re-draft contract v2 | ✅ | — |
| C4 Buyer approve contract | ✅ | — |
| C5 Buyer upload signature | ✅ | — |
| C6 Both signed -> in_production | ✅ | DB ok |
| D1 Buyer pay 30% (before_shipment) | ✅ | — |
| D2 Seller verify 30% | ✅ | — |
| E1 Mark ready to ship | ✅ | — |
| E2 Mark shipped | ✅ | — |
| E3 Mark in transit | ✅ | — |
| E4 Mark arrived | ✅ | — |
| F1 Buyer customs cleared | ✅ | — |
| F2 Buyer pay 70% (arrived_at_port) | ✅ | — |
| F3 Seller verify 70% | ✅ | — |
| F4 Order completed (DB) | ✅ | status=completed, allPaid=true |
| F5 Order completed (UI) | ✅ | ORD-260525-67fdd1 |

## 待修正問題

無 P0/P1 阻塞（請人工複核 UX）。
## 賣家／買家流程合理性（摘要）

請搭配本報告步驟表與 production 手動走測交叉驗證。