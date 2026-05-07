"use server";

import { z } from "zod";

import { createServerClient } from "@/lib/supabase/server";

// Schema is exported so the client form can re-use the same validation.
export const SignUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(1),
  company_name: z.string().min(1),
  country: z.string().min(2),
  role: z.enum(["buyer", "seller"]),
});

export const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type ActionResult<T> =
  | { data: T; error: null }
  | { data: null; error: { message: string; fieldErrors?: Record<string, string[]> } };

/* TODO: implement signUp / signIn / signOut / resendVerification.
 * Pattern:
 *   const supabase = await createServerClient()
 *   const parsed = SignUpSchema.safeParse(input)
 *   if (!parsed.success) return { data: null, error: { message: "..."} }
 *   const { error } = await supabase.auth.signUp({
 *     email, password,
 *     options: { data: { full_name, company_name, country, role } }
 *   })
 *   ...
 */

export async function signOut(): Promise<ActionResult<true>> {
  const supabase = await createServerClient();
  const { error } = await supabase.auth.signOut();
  if (error) return { data: null, error: { message: error.message } };
  return { data: true, error: null };
}
