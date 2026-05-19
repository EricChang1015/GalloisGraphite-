"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { updateCommercialProfile } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  CommercialProfileSchema,
  type CommercialProfileInput,
} from "@/lib/validations/auth";

type Props = {
  defaultValues: CommercialProfileInput;
  email: string;
  /** Show a banner that explains why we're asking (lazy-collect entry). */
  prompt?: "incomplete" | null;
  missingFields?: ("company_name" | "country")[];
};

export function CommercialProfileForm({
  defaultValues,
  email,
  prompt,
  missingFields,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const form = useForm<CommercialProfileInput>({
    resolver: zodResolver(CommercialProfileSchema),
    defaultValues,
    mode: "onBlur",
  });

  function onSubmit(values: CommercialProfileInput) {
    startTransition(async () => {
      const result = await updateCommercialProfile(values);
      if (result.error) {
        toast.error(result.error.message);
        if (result.error.fieldErrors) {
          for (const [key, msgs] of Object.entries(result.error.fieldErrors)) {
            if (msgs?.[0]) {
              form.setError(key as keyof CommercialProfileInput, {
                message: msgs[0],
              });
            }
          }
        }
        return;
      }
      toast.success("Profile saved.");
      router.refresh();
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {prompt === "incomplete" && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
            <p className="font-medium">
              A few details are still needed before you can transact.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {missingFields && missingFields.length > 0
                ? `Missing: ${missingFields
                    .map((f) => (f === "company_name" ? "company name" : "country"))
                    .join(", ")}.`
                : "Please complete your commercial profile."}
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Email
          </div>
          <p className="text-sm">{email}</p>
          <p className="text-[11px] text-muted-foreground">
            Email is managed by Supabase Auth.{" "}
            <Link
              href="/forgot-password"
              className="underline-offset-2 hover:underline"
            >
              Change password
            </Link>
          </p>
        </div>

        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full name</FormLabel>
              <FormControl>
                <Input
                  autoComplete="name"
                  placeholder="e.g. Jane Doe"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="company_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company name</FormLabel>
              <FormControl>
                <Input
                  autoComplete="organization"
                  placeholder="e.g. Acme Battery Materials"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="country"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Country</FormLabel>
              <FormControl>
                <Input
                  autoComplete="country-name"
                  placeholder="e.g. Germany"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone (optional)</FormLabel>
              <FormControl>
                <Input
                  autoComplete="tel"
                  placeholder="+49 …"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save profile"}
        </Button>
      </form>
    </Form>
  );
}
