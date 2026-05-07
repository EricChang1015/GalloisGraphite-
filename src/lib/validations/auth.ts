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
