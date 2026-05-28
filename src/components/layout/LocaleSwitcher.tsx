"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, GlobeIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { setLocaleCookieOnly } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SUPPORTED_LOCALES, type Locale } from "@/i18n/config";

type LocaleOptionKey = `options.${Locale}`;
type LocaleShortKey = `localeSwitcher.short.${Locale}`;

export function LocaleSwitcher({ className }: { className?: string }) {
  const router = useRouter();
  const current = useLocale();
  const tNav = useTranslations("nav");
  const tSettings = useTranslations("settings.languageSection");
  const [isPending, startTransition] = React.useTransition();

  function switchLocale(locale: Locale) {
    if (locale === current || isPending) return;
    startTransition(async () => {
      const result = await setLocaleCookieOnly(locale);
      if (!result.error) router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={tNav("localeSwitcher.label")}
            className={className}
          />
        }
      >
        <GlobeIcon className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{tNav("localeSwitcher.label")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
        </DropdownMenuGroup>
        <DropdownMenuGroup>
          {SUPPORTED_LOCALES.map((locale) => {
            const active = locale === current;
            return (
              <DropdownMenuItem
                key={locale}
                onClick={() => switchLocale(locale)}
                className="flex items-center gap-2"
                data-disabled={isPending ? "" : undefined}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background font-mono text-[10px] uppercase text-muted-foreground">
                  {tNav(`localeSwitcher.short.${locale}` as LocaleShortKey)}
                </span>
                <span className="flex-1">
                  {tSettings(`options.${locale}` as LocaleOptionKey)}
                </span>
                {active && <CheckIcon className="size-4 text-primary" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
