"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { ForgotPasswordSchema } from "@/lib/validations/auth";
import { requestPasswordReset } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

type ForgotPasswordValues = z.infer<typeof ForgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(ForgotPasswordSchema),
    defaultValues: { email: "" },
  });

  function onSubmit(values: ForgotPasswordValues) {
    setFormError(null);
    startTransition(async () => {
      const result = await requestPasswordReset(values);
      if (result.error) {
        if (result.error.fieldErrors) {
          Object.entries(result.error.fieldErrors).forEach(([field, messages]) => {
            if (!messages?.length) return;
            form.setError(field as keyof ForgotPasswordValues, {
              message: messages[0],
            });
          });
        }
        setFormError(result.error.message);
        return;
      }
      setSubmittedEmail(values.email);
    });
  }

  if (submittedEmail) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Check your inbox</CardTitle>
          <CardDescription>
            If <span className="font-medium text-foreground">{submittedEmail}</span> is
            a registered account, we just sent it a password reset link. Open
            the link to set a new password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            The link expires in 1 hour. Didn&apos;t receive it? Check your spam
            folder, then try again with the exact email you signed up with
            (including Google sign-ups).
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setSubmittedEmail(null);
                form.reset();
              }}
            >
              Try another email
            </Button>
            <Button render={<Link href="/login" />} className="flex-1">
              Back to log in
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forgot password</CardTitle>
        <CardDescription>
          Enter the email you signed up with — including Google OAuth
          accounts — and we&apos;ll send you a reset link. After resetting,
          you can use either Google or email/password to log in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="you@company.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

            <Button
              type="submit"
              disabled={isPending || form.formState.isSubmitting}
              className="w-full"
            >
              {isPending ? "Sending..." : "Send reset link"}
            </Button>
          </form>
        </Form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link href="/login" className="text-foreground underline underline-offset-4">
            Back to log in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
