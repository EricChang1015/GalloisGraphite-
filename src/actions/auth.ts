"use server";

import { z } from "zod";

import { getAppUrl, getAuthCallbackUrl } from "@/lib/app-url";
import { createServerClient } from "@/lib/supabase/server";
import {
  SignUpSchema,
  SignInSchema,
  ForgotPasswordSchema,
  UpdatePasswordSchema,
} from "@/lib/validations/auth";

export type ActionResult<T> =
  | { data: T; error: null }
  | {
      data: null;
      error: {
        message: string;
        /** Optional machine-readable code (e.g. `"PROFILE_INCOMPLETE"`). */
        code?: string;
        /** zod field-level errors keyed by field path. */
        fieldErrors?: Record<string, string[]>;
        /** Optional list of missing/required field names for the UI. */
        fields?: string[];
        /** KYC gate: minimum level required for the action. */
        requiredLevel?: number;
        /** KYC gate: caller's current kyc_level. */
        currentLevel?: number;
      };
    };

function validationError(error: z.ZodError): { message: string; fieldErrors?: Record<string, string[]> } {
  return {
    message: "Please check the highlighted fields.",
    fieldErrors: z.flattenError(error).fieldErrors,
  };
}

/** Map Supabase Auth API errors to clearer user-facing copy (Traditional Chinese). */
function formatAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("email rate limit") || lower.includes("rate limit exceeded")) {
    return (
      "驗證信寄送頻率已達 Supabase 上限（內建 SMTP 免費方案約每小時 2 封）。請稍後再試（通常 1 小時內恢復），" +
      "或改用「Continue with Google」註冊；若需大量測試，請在 Supabase Dashboard → Authentication → Rate Limits 調高限制，" +
      "或設定自訂 SMTP（Authentication → Emails → SMTP Settings）。"
    );
  }
  if (lower.includes("error sending confirmation email") || lower.includes("error sending email")) {
    return (
      "無法寄出驗證信（Supabase 自訂 SMTP 連線或寄信被拒）。請檢查：① Host 應為 email-smtp.us-west-2.amazonaws.com（不是 mail-smtp）；" +
      "② Password 須為 AWS SES「SMTP credentials」專用密碼，不是 IAM Secret Key；③ Sender test@aspectgaming.com 須在 SES 已驗證；" +
      "④ 若 SES 仍在 Sandbox，收件人信箱也須先驗證，或申請 production access。"
    );
  }
  return message;
}

export async function signUp(
  input: z.input<typeof SignUpSchema>
): Promise<ActionResult<{ needsEmailVerification: true }>> {
  const parsed = SignUpSchema.safeParse(input);
  if (!parsed.success) {
    return { data: null, error: validationError(parsed.error) };
  }

  const supabase = await createServerClient();
  const { email, password, full_name, company_name, country, role } = parsed.data;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getAuthCallbackUrl("/dashboard"),
      data: { full_name, company_name, country, role },
    },
  });

  if (error) {
    return { data: null, error: { message: formatAuthError(error.message) } };
  }

  // Supabase obfuscates "email already exists" by returning a fake success
  // with an empty identities array (this prevents user-enumeration attacks).
  // We surface a clear message so OAuth-only users know to use Forgot
  // Password instead of waiting for a verification email that will never
  // arrive.
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return {
      data: null,
      error: {
        message:
          "This email is already registered. If you signed up with Google, use the Forgot Password link to set a password and enable email login.",
      },
    };
  }

  return { data: { needsEmailVerification: true }, error: null };
}

export async function signIn(
  input: z.input<typeof SignInSchema>
): Promise<ActionResult<{ userId: string }>> {
  const parsed = SignInSchema.safeParse(input);
  if (!parsed.success) {
    return { data: null, error: validationError(parsed.error) };
  }

  const supabase = await createServerClient();
  const { error, data } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    return {
      data: null,
      error: { message: error?.message ?? "Unable to sign in with these credentials." },
    };
  }

  return { data: { userId: data.user.id }, error: null };
}

export async function resendVerification(
  input: Pick<z.input<typeof SignInSchema>, "email">
): Promise<ActionResult<true>> {
  const parsed = z.object({ email: z.string().email() }).safeParse(input);
  if (!parsed.success) {
    return { data: null, error: validationError(parsed.error) };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: {
      emailRedirectTo: getAuthCallbackUrl("/dashboard"),
    },
  });

  if (error) {
    return { data: null, error: { message: formatAuthError(error.message) } };
  }

  return { data: true, error: null };
}

export async function signOut(): Promise<ActionResult<true>> {
  const supabase = await createServerClient();
  const { error } = await supabase.auth.signOut();
  if (error) return { data: null, error: { message: error.message } };
  return { data: true, error: null };
}

/**
 * Trigger a password-reset email. The email contains a recovery link that
 * lands on `/auth/callback?type=recovery&code=...`; our callback handler
 * exchanges the code for a session and then redirects to /reset-password,
 * where the user can choose a new password.
 *
 * This is also the canonical way for OAuth-only users (e.g. signed up via
 * Google) to attach a password to their existing account so they can use
 * email/password login afterwards.
 *
 * For privacy, this action always returns success regardless of whether the
 * email is actually registered — Supabase silently skips delivery for
 * unknown addresses to prevent user enumeration.
 */
export async function requestPasswordReset(
  input: z.input<typeof ForgotPasswordSchema>
): Promise<ActionResult<true>> {
  const parsed = ForgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { data: null, error: validationError(parsed.error) };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getAppUrl()}/auth/callback?type=recovery&next=/reset-password`,
  });

  if (error) {
    return { data: null, error: { message: error.message } };
  }

  return { data: true, error: null };
}

/**
 * Set a new password for the currently authenticated user.
 *
 * Two scenarios call this:
 *  1. Recovery flow — user clicked the email link, exchangeCodeForSession()
 *     ran in /auth/callback, the recovery cookies are now on the request,
 *     and the user lands on /reset-password to pick a new password.
 *  2. (Future) account settings — a logged-in user updates their password
 *     from a profile page.
 *
 * In both cases the call is the same: `auth.updateUser({ password })`.
 * Supabase ensures the change attaches an `email` provider identity to
 * the user record if it wasn't there yet — enabling email/password login
 * alongside Google OAuth on the same account.
 */
export async function updatePassword(
  input: z.input<typeof UpdatePasswordSchema>
): Promise<ActionResult<true>> {
  const parsed = UpdatePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { data: null, error: validationError(parsed.error) };
  }

  const supabase = await createServerClient();

  // Must be authenticated. In the recovery flow, the cookies were just set
  // by the callback's exchangeCodeForSession; in the settings flow the user
  // is already logged in normally.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      data: null,
      error: {
        message:
          "Your reset link has expired. Please request a new password reset email.",
      },
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { data: null, error: { message: error.message } };
  }

  return { data: true, error: null };
}
