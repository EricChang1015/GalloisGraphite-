# Graphite Sales Contract Template

> 此文件為 MVP 動態合約生成的 **基礎模板**。
> 原始參考合約位於
> [`docs/contract/113-26 contract GRAPHITE ENERGY INC vs DOMINIK.docx`](./contract/113-26%20contract%20GRAPHITE%20ENERGY%20INC%20vs%20DOMINIK.docx)
> (請使用 Word 開啟對照),Cursor / 工程師需依該檔內容**核對與補完**下列模板;
> 若文字有差異以原始 docx 為準。

雙花括號 `{{var}}` 表示動態欄位,渲染器會以訂單資料填入。
未列出但範本內出現的條款請**保留原樣**。

---

## SALES CONTRACT

**Contract No.**: {{contract.contract_no}}
**Date**: {{order.created_at | date:"YYYY-MM-DD"}}

### Between

**Seller**:
- Company: **{{seller.company_name}}**
- Address: {{seller.address}}
- Country: {{seller.country}}
- Contact: {{seller.full_name}} <{{seller.email}}>
- Phone: {{seller.phone}}

**Buyer**:
- Company: **{{buyer.company_name}}**
- Address: {{buyer.address}}
- Country: {{buyer.country}}
- Contact: {{buyer.full_name}} <{{buyer.email}}>
- Phone: {{buyer.phone}}

### 1. Product

| Item | Description |
|---|---|
| Commodity | {{listing.category_name}} |
| Specifications | {{listing.specs | json}} |
| Origin | {{listing.origin_location}} |
| Quantity | {{order.quantity}} {{listing.unit}} (±5% at Seller's option) |
| Packaging | 50 kg PP woven bags in 20'/40' container as per Buyer's request |

### 2. Price & Total Value

- Unit Price: **{{order.unit_price}} {{order.currency}} / {{listing.unit}}**
- Incoterm: **{{listing.incoterm}}** {{order.destination}}
- Total Contract Value: **{{order.total_amount}} {{order.currency}}**

### 3. Shipment

- Shipment From: {{order.shipment_from | default:"Toamasina, Madagascar"}}
- Latest Shipment Date: {{order.shipment_eta | date:"YYYY-MM-DD"}}
- Partial shipment: not allowed unless agreed in writing.
- Transhipment: allowed.

### 4. Payment Terms

Buyer shall pay 100% of the Total Contract Value within five (5) business days
after both Parties sign this Contract, via one of the following channels
designated by the Platform:

- USDT (TRC20): `{{platform.usdt_trc20}}`
- USDT (ERC20): `{{platform.usdt_erc20}}`
- USDI: `{{platform.usdi_address}}`
- MUP: `{{platform.mup_address}}`
- Bank Transfer: {{platform.bank_info}}

After payment, Buyer shall submit transaction hash or remittance receipt on
the Platform for verification by the Platform's administrator. Funds are
released to Seller after Buyer confirms receipt of goods on the Platform.

### 5. Inspection

- Pre-shipment: SGS or other independent surveyor agreed by both Parties
  (cost borne by Buyer unless specified otherwise).
- At destination: Buyer may engage SGS within 7 days of arrival; results
  reported to the Platform within 14 days of arrival.

### 6. Quality & Quantity Tolerance

- Quantity tolerance: ±5%, settled at the unit price.
- Quality: as per Specifications above. Disputes follow Article 9.

### 7. Force Majeure

Neither Party shall be liable for failure or delay due to fire, flood, war,
strikes, embargoes, government actions, or any other cause beyond reasonable
control. The affected Party shall notify the other within 7 days.

### 8. Confidentiality

Each Party agrees to hold confidential all information disclosed under this
Contract for a period of 3 years after termination.

### 9. Governing Law & Dispute Resolution

- Governing Law: **Laws of the Republic of Madagascar / Hong Kong SAR**
  (依原始 docx 為準,渲染時固定文字)
- Disputes shall first be resolved through the Platform's mediation. Failing
  resolution, disputes shall be submitted to arbitration administered by
  **{{governing.arbitration_body}}**, in **{{governing.seat}}**, in English.
- This Contract is signed in English; the English version prevails.

### 10. Platform Self-Certification

The signed scanned copies of this Contract uploaded by both Parties to the
Platform constitute conclusive evidence of execution. The Platform records
shall prevail in case of any inconsistency between offline and online copies.

### 11. Notices

All notices shall be sent through the Platform's messaging system or to the
email addresses listed above.

### 12. Entire Agreement

This Contract is the entire agreement between the Parties relating to its
subject matter and supersedes all prior negotiations or agreements, whether
written or oral.

---

**Signed for and on behalf of the Seller**

| | |
|---|---|
| Name: | {{seller.full_name}} |
| Title: | {{seller.title | default:"Authorized Signatory"}} |
| Signature: | _____________________ |
| Date: | {{contract.seller_signed_at | date:"YYYY-MM-DD"}} |

**Signed for and on behalf of the Buyer**

| | |
|---|---|
| Name: | {{buyer.full_name}} |
| Title: | {{buyer.title | default:"Authorized Signatory"}} |
| Signature: | _____________________ |
| Date: | {{contract.buyer_signed_at | date:"YYYY-MM-DD"}} |

---

## 動態欄位清單(供 `src/lib/contract/template.ts` 渲染器使用)

| Key | Source |
|---|---|
| `contract.contract_no` | 自動生成,format `MG-{YY}-{order_no.suffix}` |
| `order.*` | `orders` row |
| `listing.*` | `listings` row(含 `category_name` join) |
| `seller.*` / `buyer.*` | `profiles` row |
| `platform.*` | 環境變數(見 `.env.example` 中 `PLATFORM_*`) |
| `governing.*` | 平台設定常數(`src/lib/contract/constants.ts`) |

> ⚠️ **重要**: 第一次正式上線前,必須由法務人員(或公司負責人)
> 把原始 docx 的所有條款逐條核對到本模板,確認文意一致。
> 凡是 `{{...}}` 之外的條款文字,**請勿任意改動**。
