"use client";

import { CheckIcon, SparklesIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { DASHBOARD_STYLES, type DashboardStyleId } from "./types";

type PreviewProps = {
  id: DashboardStyleId;
  className?: string;
};

function StylePreview({ id, className }: PreviewProps) {
  const baseClass =
    "relative h-12 w-full overflow-hidden rounded-md border border-border/60";

  if (id === "aurora") {
    return (
      <div className={cn(baseClass, "bg-[#0b0b10]", className)}>
        <div className="absolute -left-3 -top-3 h-12 w-12 rounded-full bg-amber-400/40 blur-xl" />
        <div className="absolute -right-3 -bottom-3 h-14 w-14 rounded-full bg-violet-500/40 blur-xl" />
        <div className="absolute inset-x-2 top-2 h-2 rounded-sm bg-white/80" />
        <div className="absolute inset-x-2 top-5 h-1.5 rounded-sm bg-white/30" />
        <div className="absolute inset-x-2 bottom-1.5 h-3 rounded-sm bg-white/10 backdrop-blur-sm" />
      </div>
    );
  }

  if (id === "command") {
    return (
      <div className={cn(baseClass, "bg-background", className)}>
        <div className="absolute inset-x-2 top-1.5 flex gap-1">
          <div className="h-1 w-6 rounded-sm bg-foreground/80" />
          <div className="ml-auto h-1 w-3 rounded-sm bg-amber-400/60" />
        </div>
        <div className="absolute inset-x-2 top-4 space-y-1">
          <div className="h-px bg-border" />
          <div className="flex items-center gap-1">
            <div className="h-1 w-12 rounded-sm bg-foreground/40" />
            <div className="ml-auto h-1 w-4 rounded-sm bg-foreground/30" />
          </div>
          <div className="h-px bg-border" />
          <div className="flex items-center gap-1">
            <div className="h-1 w-10 rounded-sm bg-foreground/40" />
            <div className="ml-auto h-1 w-4 rounded-sm bg-foreground/30" />
          </div>
          <div className="h-px bg-border" />
        </div>
      </div>
    );
  }

  if (id === "pocket") {
    return (
      <div className={cn(baseClass, "bg-background", className)}>
        <div className="absolute inset-x-3 top-1.5 h-3 rounded-md bg-foreground/85" />
        <div className="absolute inset-x-3 top-5 h-2.5 rounded-md bg-amber-400/70" />
        <div className="absolute inset-x-3 bottom-1.5 flex gap-1">
          <div className="h-3 flex-1 rounded-md bg-foreground/15" />
          <div className="h-3 flex-1 rounded-md bg-foreground/15" />
          <div className="h-3 flex-1 rounded-md bg-foreground/15" />
        </div>
      </div>
    );
  }

  // terminal
  return (
    <div className={cn(baseClass, "bg-[#0d0f0c] font-mono", className)}>
      <div className="absolute inset-x-2 top-1.5 flex gap-1">
        <div className="h-1 w-1 rounded-sm bg-emerald-400" />
        <div className="h-1 w-1 rounded-sm bg-amber-300" />
        <div className="h-1 w-1 rounded-sm bg-cyan-400" />
        <div className="ml-auto h-1 w-6 rounded-sm bg-emerald-300/80" />
      </div>
      <div className="absolute inset-x-2 top-4 space-y-0.5">
        <div className="flex items-center gap-1">
          <div className="h-0.5 w-1.5 rounded-sm bg-amber-400" />
          <div className="h-1 w-10 rounded-sm bg-emerald-200/40" />
          <div className="ml-auto h-1 w-3 rounded-sm bg-emerald-300/80" />
        </div>
        <div className="flex items-center gap-1">
          <div className="h-0.5 w-1.5 rounded-sm bg-cyan-400" />
          <div className="h-1 w-9 rounded-sm bg-emerald-200/40" />
          <div className="ml-auto h-1 w-3 rounded-sm bg-emerald-300/80" />
        </div>
        <div className="flex items-center gap-1">
          <div className="h-0.5 w-1.5 rounded-sm bg-red-400" />
          <div className="h-1 w-11 rounded-sm bg-emerald-200/40" />
          <div className="ml-auto h-1 w-3 rounded-sm bg-emerald-300/80" />
        </div>
      </div>
    </div>
  );
}

type Props = {
  current: DashboardStyleId;
  onChange: (style: DashboardStyleId) => void;
};

export function DashboardStyleSwitcher({ current, onChange }: Props) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-3 backdrop-blur-sm">
      <div className="mb-2 flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
        <SparklesIcon className="size-3.5" />
        <span className="font-medium tracking-wide uppercase">
          Dashboard skin
        </span>
        <span className="ml-auto text-[10px]">
          Saved to this browser
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {DASHBOARD_STYLES.map((style) => {
          const active = style.id === current;
          return (
            <button
              key={style.id}
              type="button"
              onClick={() => onChange(style.id)}
              aria-pressed={active}
              className={cn(
                "group relative flex flex-col gap-2 rounded-lg border p-2 text-left transition-all",
                "hover:border-primary/40 hover:bg-muted/40",
                active
                  ? "border-primary/60 bg-muted/50 ring-1 ring-primary/30"
                  : "border-border/60"
              )}
            >
              <StylePreview id={style.id} />
              <div className="px-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium leading-none">
                    {style.label}
                  </span>
                  {active && (
                    <CheckIcon className="size-3.5 text-primary" />
                  )}
                </div>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {style.tagline}
                </p>
                <p className="mt-1 text-xs leading-tight text-muted-foreground line-clamp-2">
                  {style.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
