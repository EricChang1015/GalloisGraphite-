"use server";

import { z } from "zod";

import { createServerClient } from "@/lib/supabase/server";
import {
  SignUpSchema,
  SignInSchema,
  ForgotPasswordSchema,
  UpdatePasswordSchema,
} from "@/lib/validations/auth";

export type ActionResult<T> =
  | { data: T; error: null }
  | { data: null; error: { message: string; fieldErrors?: Record<string, string[]> } };

function validationError(error: z.ZodError): { message: string; fieldErrors?: Record<string, string[]> } {
  return {
    message: "Please check the highlighted fields.",
    fieldErrors: z.flattenError(error).fieldErrors,
  };
}

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
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
      emailRedirectTo: `${appUrl()}/verify`,
      data: { full_name, company_name, country, role },
    },
  });

  if (error) {
    return { data: null, error: { message: error.message } };
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
      emailRedirectTo: `${appUrl()}/verify`,
    },
  });

  if (error) {
    return { data: null, error: { message: error.message } };
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
    redirectTo: `${appUrl()}/auth/callback?type=recovery&next=/reset-password`,
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
