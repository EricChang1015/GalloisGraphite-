/**
 * Server-side Supabase clients should not auto-refresh tokens in the
 * background. Session refresh is handled once per request in
 * `updateSession()` (proxy). Background refresh in RSC was surfacing
 * `AuthApiError: refresh_token_not_found` in the Next.js dev overlay.
 */
export const SERVER_AUTH_OPTIONS = {
  autoRefreshToken: false,
  detectSessionInUrl: false,
} as const;

export function isRecoverableAuthError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code =
    "code" in error && typeof error.code === "string" ? error.code : "";
  return (
    code === "refresh_token_not_found" ||
    code === "invalid_refresh_token" ||
    code === "session_not_found"
  );
}
