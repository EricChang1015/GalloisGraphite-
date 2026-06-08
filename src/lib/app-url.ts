/**
 * Canonical site URL for auth redirects and transactional email links.
 *
 * Priority:
 * 1. APP_URL (server runtime — not inlined at build; used on self-host UAT)
 * 2. NEXT_PUBLIC_APP_URL (set explicitly in Vercel / .env.local)
 * 3. VERCEL_URL (auto on Vercel preview/production if APP_URL missing)
 * 4. localhost (local dev only)
 */
export function getAppUrl(): string {
  const serverOnly = process.env.APP_URL?.trim();
  if (serverOnly) {
    return serverOnly.replace(/\/$/, "");
  }

  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return `https://${vercel.replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}

/**
 * PKCE email links (signup confirm, resend) must land on `/auth/callback`
 * so `exchangeCodeForSession` runs — not on `/verify` (that page only shows copy).
 */
export function getAuthCallbackUrl(next = "/dashboard"): string {
  const base = getAppUrl();
  const path = next.startsWith("/") ? next : `/${next}`;
  return `${base}/auth/callback?next=${encodeURIComponent(path)}`;
}
