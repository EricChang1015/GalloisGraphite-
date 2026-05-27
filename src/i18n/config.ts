/**
 * i18n configuration — single source of truth for supported locales.
 *
 * Add a new locale here, drop a new folder under `src/i18n/messages/<code>/`,
 * and extend the CHECK constraint on `profiles.locale` (migration).
 *
 * Routing: this project intentionally uses **cookie-based** locale
 * resolution (no `/[locale]/...` URL prefix). See `docs/I18N_PLAN.md`.
 */

export const SUPPORTED_LOCALES = ["en", "zh-CN"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Cookie name used to persist the user's UI language across requests. */
export const LOCALE_COOKIE = "mg-locale";

/**
 * 1 year in seconds — locale is a soft preference, no security implication.
 * Surfaces consistently for unauthenticated users too.
 */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isSupportedLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

/**
 * Normalise a tag like `zh-TW`, `zh-HK`, `zh`, `ZH-Hant` into one of our
 * supported codes. Returns `null` when no rule matches so callers can fall
 * back to the next resolution layer (cookie → DB → header → default).
 *
 * Rules (most specific first):
 *  - `zh-CN`, `zh-Hans`, `zh-Hans-*` → `zh-CN`
 *  - any other `zh-*` and bare `zh`  → `zh-CN` (we only ship Simplified for now)
 *  - `en`, `en-*`                    → `en`
 *  - exact match against SUPPORTED_LOCALES (case-insensitive)
 */
export function normaliseLocaleTag(tag: string | null | undefined): Locale | null {
  if (!tag) return null;
  const lower = tag.trim().toLowerCase();
  if (!lower) return null;

  if (lower === "zh-cn" || lower.startsWith("zh-hans")) return "zh-CN";
  if (lower.startsWith("zh")) return "zh-CN";
  if (lower === "en" || lower.startsWith("en-")) return "en";

  for (const supported of SUPPORTED_LOCALES) {
    if (supported.toLowerCase() === lower) return supported;
  }
  return null;
}

/**
 * Parse an `Accept-Language` header and pick the highest-q tag we can
 * map to a supported locale. Quietly returns `null` when nothing fits.
 */
export function pickAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const parts = header
    .split(",")
    .map((raw) => {
      const [tag, ...params] = raw.trim().split(";");
      let q = 1;
      for (const p of params) {
        const [k, v] = p.trim().split("=");
        if (k === "q" && v) {
          const parsed = Number(v);
          if (!Number.isNaN(parsed)) q = parsed;
        }
      }
      return { tag: tag.trim(), q };
    })
    .filter((p) => p.tag)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of parts) {
    const normalised = normaliseLocaleTag(tag);
    if (normalised) return normalised;
  }
  return null;
}
