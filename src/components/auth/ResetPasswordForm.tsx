"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { UpdatePasswordSchema } from "@/lib/validations/auth";
import { updatePassword } from "@/actions/auth";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

type UpdatePasswordValues = z.infer<typeof UpdatePasswordSchema>;

interface ResetPasswordFormProps {
  /**
   * Email of the currently-authenticated user (passed from the server page).
   * Helps the user confirm which account they're resetting (especially when
   * an OAuth user is adding a password for the first time).
   */
  userEmail: string | null;
}

export function ResetPasswordForm({ userEmail }: ResetPasswordFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<UpdatePasswordValues>({
    resolver: zodResolver(UpdatePasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  function onSubmit(values: UpdatePasswordValues) {
    setFormError(null);
    startTransition(async () => {
      const result = await updatePassword(values);
      if (result.error) {
        if (result.error.fieldErrors) {
          Object.entries(result.error.fieldErrors).forEach(([field, messages]) => {
            if (!messages?.length) return;
            form.setError(field as keyof UpdatePasswordValues, {
              message: messages[0],
            });
          });
        }
        setFormError(result.error.message);
        return;
      }

      toast.success("Password updated. You can now log in with email or Google.");
      router.replace("/dashboard");
      router.refresh();
    });
  }

  if (!userEmail) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reset link expired</CardTitle>
          <CardDescription>
            We couldn&apos;t verify your reset link. It may have already been
            used or expired (links last for 1 hour).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Button render={<Link href="/forgot-password" />} className="w-full">
            Request a new reset email
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set a new password</CardTitle>
        <CardDescription>
          Choose a password for{" "}
          <span className="font-medium text-foreground">{userEmail}</span>.
          After this you can sign in with either email/password or Google on
          the same account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>At least 8 characters.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
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
              {isPending ? "Updating..." : "Update password"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
