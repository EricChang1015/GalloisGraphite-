/**
 * Prepare stored contract HTML for in-app preview without leaking global CSS.
 *
 * Contract documents are full HTML pages with `<style>body { color: #111 }</style>`.
 * Injecting them via dangerouslySetInnerHTML would apply `body` rules to the
 * entire page and break dark-mode foreground colors on sibling UI (e.g. re-draft form).
 */

export const CONTRACT_PREVIEW_ROOT_CLASS = "contract-preview-root";

export interface PreparedContractPreview {
  /** Scoped CSS safe to inject inside the preview container. */
  scopedStyles: string;
  /** Body inner HTML (no document shell). */
  markup: string;
}

/** Rewrite global document selectors to the preview root class. */
export function scopeContractStyles(css: string): string {
  const scoped = css
    .replace(/\.contract-document\b/g, `.${CONTRACT_PREVIEW_ROOT_CLASS}`)
    .replace(/\bhtml\b/g, `.${CONTRACT_PREVIEW_ROOT_CLASS}`)
    .replace(/\bbody\b/g, `.${CONTRACT_PREVIEW_ROOT_CLASS}`);

  // Always render as a light paper document regardless of app theme.
  return `${scoped}
.${CONTRACT_PREVIEW_ROOT_CLASS} {
  background-color: #fff;
  color: #111;
}`;
}

function extractStyleBlocks(html: string): string {
  const styles: string[] = [];
  const re = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    styles.push(match[1].trim());
  }
  return styles.join("\n");
}

function extractBodyMarkup(html: string): string {
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) return bodyMatch[1].trim();

  // Fallback: strip document shell if present.
  return html
    .replace(/<!doctype[^>]*>/gi, "")
    .replace(/<\/?html\b[^>]*>/gi, "")
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<\/?body\b[^>]*>/gi, "")
    .trim();
}

/**
 * Strip global `<style>` / document wrappers and scope CSS to the preview root.
 * Compatible with legacy contracts (`body { … }`) and new ones (`.contract-document`).
 */
export function prepareContractHtmlForPreview(fullHtml: string): PreparedContractPreview {
  const rawStyles = extractStyleBlocks(fullHtml);
  const scopedStyles = rawStyles ? scopeContractStyles(rawStyles) : "";
  const markup = extractBodyMarkup(fullHtml);

  return { scopedStyles, markup };
}
