# Full E2E 交易流程測試報告

| 項目 | 值 |
|---|---|
| Run ID | MPF018FD |
| Base URL | http://127.0.0.1:3000 |
| 訂單 | ORD-260521-a33910 |
| Order UUID | 54fc458c-0024-4db3-ac90-1c3845da6e71 |
| Inquiry UUID | 99984618-89f3-4f87-9ec3-6cffdcbc48ef |

## 步驟結果

| 步驟 | 結果 | 備註 |
|---|---|---|
| A1 Seller listing seeded (API) | ✅ | 6ef53f40-4ee9-4d99-a71b-26f740f34c6b |
| A2 Seller can open listing detail | ✅ | 6ef53f40-4ee9-4d99-a71b-26f740f34c6b |
| B1 Buyer inquiry seeded (API) | ✅ | 99984618-89f3-4f87-9ec3-6cffdcbc48ef |
| B2 Seller quote 4300 (seeded) | ✅ | fb0f91ea-06c2-4d22-8167-9743695e8d11 |
| B3 Buyer counter 4250 (seeded) | ✅ | — |
| B4 Seller counter 4280 (seeded) | ✅ | — |
| B5 Buyer accept -> order | ✅ | ORD-260521-a33910 |
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
| F5 Order completed (UI) | ✅ | ORD-260521-a33910 |

## 待修正問題

無 P0/P1 阻塞（請人工複核 UX）。
## 賣家／買家流程合理性（摘要）

請搭配本報告步驟表與 production 手動走測交叉驗證。