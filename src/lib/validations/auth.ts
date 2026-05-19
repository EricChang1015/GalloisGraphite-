import { z } from "zod";

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

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const UpdatePasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirm: z.string().min(8),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Passwords do not match.",
    path: ["confirm"],
  });

/**
 * Profile fields a user must have populated before they can submit an
 * inquiry, create a listing, or make a payment. Phone is optional in MVP
 * but encouraged for support contact; KYC documents are a separate
 * concern (see ROADMAP §A6) and not enforced here.
 */
export const CommercialProfileSchema = z.object({
  full_name: z.string().min(1, "Required"),
  company_name: z.string().min(1, "Required"),
  country: z.string().min(2, "Required"),
  phone: z.string().optional(),
});

export type CommercialProfileInput = z.infer<typeof CommercialProfileSchema>;
