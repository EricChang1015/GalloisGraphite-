# Full E2E 交易流程測試報告

| 項目 | 值 |
|---|---|
| Run ID | MPJHUTWK |
| Base URL | http://127.0.0.1:3000 |
| 訂單 | ORD-260524-f4e88b |
| Order UUID | 524f38f0-594b-4a87-b164-f5846ddeb7fc |
| Inquiry UUID | fb7403a1-30b4-479c-922c-eef17e81f858 |

## 步驟結果

| 步驟 | 結果 | 備註 |
|---|---|---|
| A1 Seller listing seeded (API) | ✅ | 3e76cc42-66d7-4bef-90b2-6895db0d936e |
| A2 Seller can open listing detail | ✅ | 3e76cc42-66d7-4bef-90b2-6895db0d936e |
| B1 Buyer inquiry seeded (API) | ✅ | fb7403a1-30b4-479c-922c-eef17e81f858 |
| B2 Seller quote 4300 (seeded) | ✅ | bc779bde-2b21-4b8e-9dd8-7062f46497a3 |
| B3 Buyer counter 4250 (seeded) | ✅ | — |
| B4 Seller counter 4280 (seeded) | ✅ | — |
| B5 Buyer accept -> order | ✅ | ORD-260524-f4e88b |
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
| F5 Order completed (UI) | ✅ | ORD-260524-f4e88b |

## 待修正問題

無 P0/P1 阻塞（請人工複核 UX）。
## 賣家／買家流程合理性（摘要）

請搭配本報告步驟表與 production 手動走測交叉驗證。