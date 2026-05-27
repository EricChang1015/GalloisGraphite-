/**
 * Contract HTML renderer.
 *
 * Tightly coupled with `docs/CONTRACT_TEMPLATE.md`. The "Download PDF"
 * flow uses client-side `window.print()` on the rendered HTML — good
 * enough for MVP.
 *
 * Post-013/014 cutover: payment terms are no longer encoded as a single
 * `full_prepay`/`net_after_arrival` flag. The renderer now emits a
 * formal payment-schedule table from the array passed in.
 *
 * =====================================================================
 * !! DO NOT INTERNATIONALIZE — legal documents are English-only !!
 * ---------------------------------------------------------------------
 * Per docs/I18N_PLAN.md (business decision): contracts always render
 * in English regardless of the buyer or seller's UI locale. Do NOT
 * import `getTranslations()` / `useTranslations()` in this file or in
 * downstream renderers (PDF export, signed scan composer).
 *
 * Likewise:
 *   - Email notifications (src/lib/email/*) remain English.
 *   - SMS messages remain English (and short).
 *   - Audit log entries remain English.
 *
 * Only the UI *chrome* around the contract (e.g. "Print / Save PDF"
 * button label, "Pending upload." placeholder, signature pane labels)
 * may be translated — that lives in `ContractPreview.tsx`.
 * =====================================================================
 */

import {
  CATEGORY_LABEL,
  MILESTONE_LABEL,
  type PaymentScheduleEntry,
} from "@/lib/validations/payment-schedule";

export interface ContractContext {
  contract: {
    contract_no: string;
    seller_signed_at?: string | null;
    buyer_signed_at?: string | null;
  };
  order: {
    order_no: string;
    quantity: number;
    unit_price: number;
    total_amount: number;
    currency: string;
    destination?: string | null;
    shipment_from?: string | null;
    shipment_eta?: string | null;
    created_at: string;
    incoterm: string;
  };
  listing: {
    category_name: string;
    specs: Record<string, unknown>;
    origin_location: string;
    unit: string;
  };
  buyer: PartyInfo;
  seller: PartyInfo;
  platform: PlatformInfo;
  paymentSchedule: PaymentScheduleEntry[];
  governing?: GoverningInfo;
}

export interface PartyInfo {
  full_name?: string | null;
  company_name?: string | null;
  email?: string | null;
  country?: string | null;
  phone?: string | null;
  address?: string | null;
  title?: string | null;
}

export interface PlatformInfo {
  usdt_trc20?: string;
  usdt_erc20?: string;
  usdi_address?: string;
  mup_address?: string;
  bank_info?: string;
}

export interface GoverningInfo {
  arbitration_body: string;
  seat: string;
}

const DEFAULT_GOVERNING: GoverningInfo = {
  arbitration_body: "Madagascar Arbitration Center (CAM)",
  seat: "Antananarivo, Madagascar",
};

/**
 * Render a printable contract HTML string. Iterates the agreed
 * payment-schedule entries to produce a per-installment table.
 */
export function renderContractHtml(ctx: ContractContext): string {
  const governing = ctx.governing ?? DEFAULT_GOVERNING;
  const date = new Date(ctx.order.created_at).toISOString().slice(0, 10);

  const scheduleRows = ctx.paymentSchedule
    .map((entry, idx) => {
      const amount = ((ctx.order.total_amount * entry.percentage) / 100).toFixed(2);
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(CATEGORY_LABEL[entry.category])}</td>
          <td>${escapeHtml(MILESTONE_LABEL[entry.milestone])}</td>
          <td style="text-align:right">${entry.percentage.toFixed(2)}%</td>
          <td style="text-align:right">${amount} ${escapeHtml(ctx.order.currency)}</td>
        </tr>`;
    })
    .join("");

  return /* html */ `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Contract ${escapeHtml(ctx.contract.contract_no)}</title>
  <style>
    .contract-document { font-family: "Times New Roman", serif; max-width: 820px;
           margin: 0 auto; color: #111; line-height: 1.6; padding: 0 24px; }
    h1 { text-align: center; letter-spacing: 0.05em; }
    h2 { border-bottom: 1px solid #999; padding-bottom: 4px; margin-top: 28px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { border: 1px solid #999; padding: 6px 8px; vertical-align: top; }
    .meta { display: flex; justify-content: space-between; gap: 24px; }
    .meta > div { flex: 1; }
    .signature { margin-top: 40px; display: flex; gap: 32px; }
    .signature > div { flex: 1; border-top: 1px solid #333; padding-top: 8px; }
  </style>
</head>
<body>
  <div class="contract-document">
  <h1>SALES CONTRACT</h1>
  <p><strong>Contract No.</strong>: ${escapeHtml(ctx.contract.contract_no)}<br />
     <strong>Date</strong>: ${date}</p>

  <h2>Parties</h2>
  <div class="meta">
    <div>
      <strong>Buyer (Purchaser)</strong><br />
      ${escapeHtml(ctx.buyer.company_name ?? "")}<br />
      ${escapeHtml(ctx.buyer.address ?? "")}<br />
      ${escapeHtml(ctx.buyer.country ?? "")}<br />
      Contact: ${escapeHtml(ctx.buyer.full_name ?? "")} &lt;${escapeHtml(ctx.buyer.email ?? "")}&gt;<br />
      Phone: ${escapeHtml(ctx.buyer.phone ?? "")}
    </div>
    <div>
      <strong>Seller</strong><br />
      ${escapeHtml(ctx.seller.company_name ?? "")}<br />
      ${escapeHtml(ctx.seller.address ?? "")}<br />
      ${escapeHtml(ctx.seller.country ?? "")}<br />
      Contact: ${escapeHtml(ctx.seller.full_name ?? "")} &lt;${escapeHtml(ctx.seller.email ?? "")}&gt;<br />
      Phone: ${escapeHtml(ctx.seller.phone ?? "")}
    </div>
  </div>

  <h2>1. Product</h2>
  <table>
    <tr><th>Commodity</th><td>${escapeHtml(ctx.listing.category_name)}</td></tr>
    <tr><th>Specifications</th><td><pre>${escapeHtml(JSON.stringify(ctx.listing.specs, null, 2))}</pre></td></tr>
    <tr><th>Origin</th><td>${escapeHtml(ctx.listing.origin_location)}</td></tr>
    <tr><th>Quantity</th><td>${ctx.order.quantity} ${escapeHtml(ctx.listing.unit)} (&plusmn;5% at Seller's option)</td></tr>
  </table>

  <h2>2. Price &amp; Total Value</h2>
  <p>
    Unit Price: <strong>${ctx.order.unit_price} ${escapeHtml(ctx.order.currency)} / ${escapeHtml(ctx.listing.unit)}</strong><br />
    Incoterm: <strong>${escapeHtml(ctx.order.incoterm)} ${escapeHtml(ctx.order.destination ?? "")}</strong><br />
    Total: <strong>${ctx.order.total_amount} ${escapeHtml(ctx.order.currency)}</strong>
  </p>

  <h2>3. Shipment</h2>
  <p>
    Shipment From: ${escapeHtml(ctx.order.shipment_from ?? "Toamasina, Madagascar")}<br />
    Latest Shipment Date: ${escapeHtml(ctx.order.shipment_eta ?? "TBD")}
  </p>

  <h2>4. Payment Schedule</h2>
  <table>
    <thead>
      <tr>
        <th style="width:48px">#</th>
        <th>Category</th>
        <th>Milestone</th>
        <th style="text-align:right">%</th>
        <th style="text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>${scheduleRows}</tbody>
  </table>
  <p>Buyer shall remit each installment via one of the platform-designated channels
  once the corresponding milestone is reached:</p>
  <ul>
    ${ctx.platform.usdt_trc20 ? `<li>USDT (TRC20): <code>${escapeHtml(ctx.platform.usdt_trc20)}</code></li>` : ""}
    ${ctx.platform.usdt_erc20 ? `<li>USDT (ERC20): <code>${escapeHtml(ctx.platform.usdt_erc20)}</code></li>` : ""}
    ${ctx.platform.usdi_address ? `<li>USDI: <code>${escapeHtml(ctx.platform.usdi_address)}</code></li>` : ""}
    ${ctx.platform.mup_address ? `<li>MUP: <code>${escapeHtml(ctx.platform.mup_address)}</code></li>` : ""}
    ${ctx.platform.bank_info ? `<li>Bank Transfer: ${escapeHtml(ctx.platform.bank_info)}</li>` : ""}
  </ul>
  <p>After remitting, Buyer submits the transaction hash or remittance receipt
  on the Platform; the installment is marked verified by an authorised
  administrator before being released to Seller.</p>

  <h2>5&ndash;8. Inspection / Tolerance / Force Majeure / Confidentiality</h2>
  <p>(Per the master template &mdash; see docs/CONTRACT_TEMPLATE.md.)</p>

  <h2>9. Governing Law &amp; Dispute Resolution</h2>
  <p>Disputes shall be administered by ${escapeHtml(governing.arbitration_body)},
  in ${escapeHtml(governing.seat)}, in English.</p>

  <h2>10. Platform Self-Certification</h2>
  <p>The signed scanned copies of this Contract uploaded by both Parties to the
  Platform constitute conclusive evidence of execution.</p>

  <div class="signature">
    <div>
      <strong>Buyer (Purchaser)</strong><br />
      Name: ${escapeHtml(ctx.buyer.full_name ?? "")}<br />
      Title: ${escapeHtml(ctx.buyer.title ?? "Authorized Signatory")}<br />
      Date: ${escapeHtml(ctx.contract.buyer_signed_at ?? "______________")}
    </div>
    <div>
      <strong>Seller</strong><br />
      Name: ${escapeHtml(ctx.seller.full_name ?? "")}<br />
      Title: ${escapeHtml(ctx.seller.title ?? "Authorized Signatory")}<br />
      Date: ${escapeHtml(ctx.contract.seller_signed_at ?? "______________")}
    </div>
  </div>
  </div>
</body>
</html>`;
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
