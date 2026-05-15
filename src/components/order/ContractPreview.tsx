"use client";

import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";

interface Props {
  contractNo: string;
  revision: number;
  contentHtml: string | null;
  /** Long-lived signed URL of the buyer's signed scan (PDF or image). */
  buyerSignedUrl?: string | null;
  /** Long-lived signed URL of the seller's signed scan. */
  sellerSignedUrl?: string | null;
  buyerSignedAt?: string | null;
  sellerSignedAt?: string | null;
}

/** Detect whether a Supabase signed URL points at an image. */
function isImageUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return /\.(png|jpe?g|webp|heic|heif|gif)$/.test(path);
  } catch {
    return false;
  }
}

function isPdfUrl(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith(".pdf");
  } catch {
    return false;
  }
}

/** A signature pane that picks the right rendering for the file type. */
function SignaturePane({
  label,
  url,
  signedAt,
}: {
  label: string;
  url: string | null | undefined;
  signedAt: string | null | undefined;
}) {
  return (
    <div className="rounded-lg border bg-white text-black p-3 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold uppercase tracking-wider">{label}</span>
        {signedAt && (
          <span className="text-gray-500">
            Signed {new Date(signedAt).toLocaleDateString()}
          </span>
        )}
      </div>
      {!url ? (
        <p className="text-xs text-gray-500 italic">Pending upload.</p>
      ) : isImageUrl(url) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={`${label} signed scan`}
          className="max-h-72 w-auto mx-auto rounded border"
        />
      ) : isPdfUrl(url) ? (
        <iframe
          src={url}
          title={`${label} signed scan`}
          className="w-full h-72 rounded border"
        />
      ) : (
        <p className="text-xs">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            Open signed scan
          </a>
        </p>
      )}
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] uppercase tracking-wider text-blue-600 underline"
        >
          Download original
        </a>
      )}
    </div>
  );
}

export function ContractPreview({
  contractNo,
  revision,
  contentHtml,
  buyerSignedUrl,
  sellerSignedUrl,
  buyerSignedAt,
  sellerSignedAt,
}: Props) {
  const bothSigned = !!buyerSignedUrl && !!sellerSignedUrl;

  function buildPrintableDoc(): string {
    // Append the signature scans into a self-contained HTML document so the
    // print window / Save as PDF flow renders the actual signatures next to
    // the contract text rather than the placeholder "Date: ____" block.
    const sigBlock = `
      <h2 style="border-bottom:1px solid #999;padding-bottom:4px;margin-top:32px;">
        Signature Scans (uploaded by the parties)
      </h2>
      <div style="display:flex;gap:24px;margin-top:12px;">
        <div style="flex:1;border:1px solid #999;padding:8px;">
          <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#444;">Buyer</div>
          ${
            buyerSignedUrl
              ? isImageUrl(buyerSignedUrl)
                ? `<img src="${buyerSignedUrl}" style="max-width:100%;height:auto;display:block;margin-top:6px;" alt="Buyer signed scan" />`
                : `<p style="margin-top:6px;font-size:12px;"><a href="${buyerSignedUrl}">${buyerSignedUrl}</a></p>`
              : '<p style="margin-top:6px;font-size:12px;color:#888;font-style:italic;">Pending upload.</p>'
          }
          ${
            buyerSignedAt
              ? `<p style="margin-top:4px;font-size:11px;color:#666;">Signed ${new Date(buyerSignedAt).toLocaleString()}</p>`
              : ""
          }
        </div>
        <div style="flex:1;border:1px solid #999;padding:8px;">
          <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#444;">Seller</div>
          ${
            sellerSignedUrl
              ? isImageUrl(sellerSignedUrl)
                ? `<img src="${sellerSignedUrl}" style="max-width:100%;height:auto;display:block;margin-top:6px;" alt="Seller signed scan" />`
                : `<p style="margin-top:6px;font-size:12px;"><a href="${sellerSignedUrl}">${sellerSignedUrl}</a></p>`
              : '<p style="margin-top:6px;font-size:12px;color:#888;font-style:italic;">Pending upload.</p>'
          }
          ${
            sellerSignedAt
              ? `<p style="margin-top:4px;font-size:11px;color:#666;">Signed ${new Date(sellerSignedAt).toLocaleString()}</p>`
              : ""
          }
        </div>
      </div>`;

    if (!contentHtml) return sigBlock;
    // Inject the signature block just before </body> if present; otherwise
    // append at the end so even hand-edited contracts get the signatures.
    if (/<\/body>/i.test(contentHtml)) {
      return contentHtml.replace(/<\/body>/i, `${sigBlock}</body>`);
    }
    return `${contentHtml}${sigBlock}`;
  }

  function handlePrint() {
    if (!contentHtml) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(buildPrintableDoc());
    win.document.close();
    // Wait a tick so embedded images / iframes start loading before print.
    setTimeout(() => win.print(), 400);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm font-medium">
          {contractNo}{" "}
          <span className="text-xs text-muted-foreground font-normal">
            · Revision {revision}
            {bothSigned && (
              <span className="ml-2 text-emerald-400">· Fully signed</span>
            )}
          </span>
        </p>
        {contentHtml && (
          <Button size="sm" variant="outline" onClick={handlePrint}>
            {bothSigned ? (
              <Download className="size-3.5 mr-1" />
            ) : (
              <Printer className="size-3.5 mr-1" />
            )}
            {bothSigned ? "Download signed contract" : "Print / Save PDF"}
          </Button>
        )}
      </div>
      {contentHtml && (
        <div
          className="rounded border bg-white text-black p-4 text-xs max-h-96 overflow-y-auto"
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
      )}
      {(buyerSignedUrl || sellerSignedUrl) && (
        <div className="grid sm:grid-cols-2 gap-3">
          <SignaturePane
            label="Buyer Signature"
            url={buyerSignedUrl}
            signedAt={buyerSignedAt}
          />
          <SignaturePane
            label="Seller Signature"
            url={sellerSignedUrl}
            signedAt={sellerSignedAt}
          />
        </div>
      )}
    </div>
  );
}
