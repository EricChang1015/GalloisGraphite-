"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("settings.profileForm");
  const tMissing = useTranslations("settings.profileForm.missing");
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
      toast.success(t("toast.saved"));
      router.refresh();
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {prompt === "incomplete" && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
            <p className="font-medium">{t("incompleteTitle")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {missingFields && missingFields.length > 0
                ? `${t("missingPrefix")} ${missingFields
                    .map((f) => tMissing(f))
                    .join(", ")}.`
                : t("missingFallback")}
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("emailLabel")}
          </div>
          <p className="text-sm">{email}</p>
          <p className="text-[11px] text-muted-foreground">
            {t("emailHint")}{" "}
            <Link
              href="/forgot-password"
              className="underline-offset-2 hover:underline"
            >
              {t("changePassword")}
            </Link>
          </p>
        </div>

        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("fields.fullName")}</FormLabel>
              <FormControl>
                <Input
                  autoComplete="name"
                  placeholder={t("fields.fullNamePlaceholder")}
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
              <FormLabel>{t("fields.companyName")}</FormLabel>
              <FormControl>
                <Input
                  autoComplete="organization"
                  placeholder={t("fields.companyNamePlaceholder")}
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
              <FormLabel>{t("fields.country")}</FormLabel>
              <FormControl>
                <Input
                  autoComplete="country-name"
                  placeholder={t("fields.countryPlaceholder")}
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
              <FormLabel>{t("fields.phone")}</FormLabel>
              <FormControl>
                <Input
                  autoComplete="tel"
                  placeholder={t("fields.phonePlaceholder")}
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
          {isPending ? t("saving") : t("save")}
        </Button>
      </form>
    </Form>
  );
}
