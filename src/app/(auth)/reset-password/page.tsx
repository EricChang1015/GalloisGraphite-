import { createServerClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata = { title: "Reset password" };

/**
 * Reset-password page.
 *
 * Two entry paths land here:
 *  1. Recovery — user clicked the password-reset email link, the callback
 *     route exchanged the code for a session, and redirected here. The
 *     session cookie is now set so getUser() returns the user.
 *  2. Logged-in settings flow (future) — a normally-authenticated user can
 *     visit this page from their settings to change their password.
 *
 * If there's no authenticated user (expired / invalid link), the form
 * renders an "expired link" state pointing back to /forgot-password.
 */
export default async function ResetPasswordPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <ResetPasswordForm userEmail={user?.email ?? null} />;
}
