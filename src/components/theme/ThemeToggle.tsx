"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { MoonIcon, SunIcon, BookOpenIcon, CheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const THEME_OPTIONS = [
  {
    value: "light",
    label: "Light",
    description: "Daylight reading",
    icon: SunIcon,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Graphite + gold",
    icon: MoonIcon,
  },
  {
    value: "editorial",
    label: "Editorial",
    description: "Paper-like long-form",
    icon: BookOpenIcon,
  },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Render a stable button on SSR / before hydration to avoid layout shift
  // and `useTheme` returning undefined during render.
  const Active =
    THEME_OPTIONS.find((o) => o.value === theme) ?? THEME_OPTIONS[1];
  const ActiveIcon = mounted ? Active.icon : MoonIcon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Switch theme"
            className="text-muted-foreground hover:text-foreground"
          />
        }
      >
        <ActiveIcon className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuSeparator />
        </DropdownMenuGroup>
        <DropdownMenuGroup>
        {THEME_OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = mounted && theme === option.value;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setTheme(option.value)}
              className="flex items-start gap-2"
            >
              <Icon className="mt-0.5 size-4 shrink-0" />
              <span className="flex-1 leading-tight">
                <span className="block font-medium">{option.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {option.description}
                </span>
              </span>
              {active && <CheckIcon className="mt-0.5 size-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
