import { createHash } from "node:crypto";

/**
 * Normalise a URL for de-duplication. Removes tracking params and anchors,
 * lowercases the host, strips a trailing slash.
 *
 * - utm_*, fbclid, gclid, mc_*, ref, ref_src, source are dropped.
 * - We keep the path case-sensitive (some CMSes are case-sensitive).
 */
export function normalizeUrl(input: string): string | null {
  try {
    const u = new URL(input.trim());
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    if (u.hostname.startsWith("www.")) u.hostname = u.hostname.slice(4);
    const dropParams = new Set([
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "utm_id",
      "fbclid",
      "gclid",
      "mc_cid",
      "mc_eid",
      "ref",
      "ref_src",
      "source",
      "_hsenc",
      "_hsmi",
    ]);
    for (const key of [...u.searchParams.keys()]) {
      if (dropParams.has(key.toLowerCase())) u.searchParams.delete(key);
    }
    let normalized = u.toString();
    if (normalized.endsWith("/") && u.pathname !== "/") {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return null;
  }
}

/** Normalise a news title for hash-based dedup (lowercase, alnum + single spaces). */
export function normalizeTitle(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hashUrl(input: string): string | null {
  const n = normalizeUrl(input);
  return n ? sha256(n) : null;
}

export function hashTitle(input: string): string {
  return sha256(normalizeTitle(input));
}

/**
 * Slugify a title into a URL-safe path component. Keeps ASCII letters,
 * digits and hyphens. Caller is responsible for resolving collisions.
 */
export function slugify(title: string, maxLen = 80): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen)
    .replace(/-+$/g, "");
  return base || "article";
}
