"use server";

import { z } from "zod";

import { createServerClient } from "@/lib/supabase/server";
import { SignUpSchema, SignInSchema } from "@/lib/validations/auth";

export type ActionResult<T> =
  | { data: T; error: null }
  | { data: null; error: { message: string; fieldErrors?: Record<string, string[]> } };

function validationError(error: z.ZodError): ActionResult<never>["error"] {
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
  const { error } = await supabase.auth.signUp({
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
