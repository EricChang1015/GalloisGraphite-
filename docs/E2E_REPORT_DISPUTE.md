# A7 Dispute / Cancel / Force E2E

| Run ID | MPJI1XHO |
| Base URL | http://127.0.0.1:3000 |

| 步驟 | 結果 | 備註 |
|---|---|---|
| G1 Buyer raise dispute -> disputed | ✅ | ORD-QA-DC-MPJI1XHO-IN_P |
| G2 audit_logs raise_dispute | ✅ | — |
| G3 Admin force disputed -> in_production | ✅ | — |
| G4 audit_logs force_transition | ✅ | — |
| G5 Buyer cancel contract_pending -> cancelled | ✅ | ORD-QA-DC-MPJI1XHO-CONT |
| G6 audit_logs cancel_order | ✅ | — |