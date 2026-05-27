"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { setLocaleFromString } from "@/actions/profile";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUPPORTED_LOCALES, type Locale } from "@/i18n/config";

type LocaleOptionKey = `options.${Locale}`;

/**
 * Renders a Select bound to the current locale.
 *
 * On change:
 *   1. Calls `setLocaleFromString` server action → writes profiles.locale
 *      AND sets the `mg-locale` cookie.
 *   2. Server action revalidates the root layout, so the next render uses
 *      the new dictionary.
 *
 * `useLocale()` reads the value from `NextIntlClientProvider`, which was
 * fed by the root layout. After the revalidation the new value flows back
 * through the same provider on the next request.
 */
export function LanguageSelector() {
  const t = useTranslations("settings.languageSection");
  const current = useLocale();
  const [isPending, startTransition] = useTransition();

  function handleChange(next: string | null) {
    if (!next || next === current || isPending) return;
    startTransition(async () => {
      const result = await setLocaleFromString(next);
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success(t("saved"));
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <label className="text-xs font-medium text-muted-foreground" htmlFor="mg-locale-select">
        {t("label")}
      </label>
      <Select
        value={current}
        onValueChange={handleChange}
        disabled={isPending}
      >
        <SelectTrigger className="h-9 w-full sm:w-64" id="mg-locale-select">
          {/*
            SelectValue accepts a render-prop so we show the human-readable
            label even though the underlying value is a BCP-47 code.
          */}
          <SelectValue>
            {(value) =>
              typeof value === "string" && value
                ? t(`options.${value as Locale}` as LocaleOptionKey)
                : t(`options.${current as Locale}` as LocaleOptionKey)
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LOCALES.map((locale) => (
            <SelectItem key={locale} value={locale}>
              {t(`options.${locale}` as LocaleOptionKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isPending && (
        <span className="text-xs text-muted-foreground">{t("saving")}</span>
      )}
    </div>
  );
}
