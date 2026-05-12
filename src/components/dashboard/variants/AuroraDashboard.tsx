"use client";

import Link from "next/link";
import {
  SparklesIcon,
  ArrowRightIcon,
  ShoppingBagIcon,
  PackageIcon,
  ClipboardListIcon,
  MessageSquareIcon,
  PlusIcon,
  ZapIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { STATUS_TINT, type DashboardData } from "../types";

const PROMPT_HINTS = [
  "Find +80 mesh MADA1 listings under USDT 1,200",
  "Summarise my pending payments and what's blocking them",
  "Draft an inquiry for 200 MT MADA2 to Rotterdam",
];

export function AuroraDashboard({ data }: { data: DashboardData }) {
  const { profile, activeOrders, pendingInquiries, isSeller, isAdmin } = data;

  return (
    <div className="relative isolate -m-4 sm:-m-8">
      {/* Animated aurora backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-20 h-[28rem] w-[28rem] rounded-full bg-amber-500/20 blur-3xl animate-aurora-slow" />
        <div className="absolute -bottom-40 right-0 h-[32rem] w-[32rem] rounded-full bg-violet-500/15 blur-3xl animate-aurora-slower" />
        <div className="absolute top-1/3 left-1/2 h-[20rem] w-[20rem] -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl animate-aurora" />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      <div className="space-y-8 p-4 sm:p-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/5 px-2.5 py-1 text-[11px] uppercase tracking-wider text-amber-300/90 backdrop-blur-sm">
              <ZapIcon className="size-3" /> AI-Native console
            </div>
            <h1 className="mt-3 bg-gradient-to-br from-foreground via-foreground to-amber-200/70 bg-clip-text text-3xl font-semibold text-transparent sm:text-4xl">
              Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}.
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {profile?.company_name ?? "—"}{" "}
              <span className="mx-1.5 opacity-40">·</span>
              <Badge variant="secondary" className="text-[10px]">
                {profile?.role}
              </Badge>
            </p>
          </div>
          {isAdmin && (
            <Button
              variant="outline"
              render={<Link href="/admin" />}
              className="backdrop-blur-sm"
            >
              Admin Console
            </Button>
          )}
        </div>

        {/* AI Prompt bar */}
        <Link
          href="/chat"
          className="group relative block overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur-xl transition-all hover:border-primary/40 hover:bg-card/60"
        >
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-amber-400/0 via-amber-400/10 to-amber-400/0 opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-300">
              <SparklesIcon className="size-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Ask the trading co-pilot</p>
              <p className="text-xs text-muted-foreground">
                Search listings, draft inquiries, or summarise orders in
                natural language.
              </p>
            </div>
            <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {PROMPT_HINTS.map((hint) => (
              <span
                key={hint}
                className="rounded-full border border-border/50 bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground backdrop-blur-sm"
              >
                {hint}
              </span>
            ))}
          </div>
        </Link>

        {/* KPI tiles */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <GlassTile
            href="/market"
            icon={<ShoppingBagIcon className="size-5 text-amber-300" />}
            title="Browse market"
            subtitle="Live listings"
            accent="amber"
          />
          <GlassTile
            href="/orders"
            icon={<PackageIcon className="size-5 text-cyan-300" />}
            title="My orders"
            subtitle={`${activeOrders.length} active`}
            accent="cyan"
          />
          <GlassTile
            href="/inquiries"
            icon={<ClipboardListIcon className="size-5 text-violet-300" />}
            title="Inquiries"
            subtitle={`${pendingInquiries.length} pending`}
            accent="violet"
          />
          {isSeller ? (
            <GlassTile
              href="/listings/new"
              icon={<PlusIcon className="size-5 text-emerald-300" />}
              title="New listing"
              subtitle="Post a product"
              accent="emerald"
            />
          ) : (
            <GlassTile
              href="/messages"
              icon={<MessageSquareIcon className="size-5 text-blue-300" />}
              title="Messages"
              subtitle="Talk to sellers"
              accent="blue"
            />
          )}
        </div>

        {/* Panels */}
        <div className="grid gap-6 lg:grid-cols-2">
          <GlassPanel title="Active orders" href="/orders">
            {activeOrders.length === 0 ? (
              <EmptyHint>No active orders yet.</EmptyHint>
            ) : (
              <ul className="divide-y divide-border/40">
                {activeOrders.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/orders/${o.id}`}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted/50"
                    >
                      <span className="font-mono text-xs text-muted-foreground">
                        {o.order_no}
                      </span>
                      <span className="font-medium tabular-nums">
                        {o.total_amount} {o.currency}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          STATUS_TINT[o.status] ?? ""
                        )}
                      >
                        {o.status.replace(/_/g, " ")}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </GlassPanel>

          <GlassPanel title="Pending inquiries" href="/inquiries">
            {pendingInquiries.length === 0 ? (
              <EmptyHint>No pending inquiries.</EmptyHint>
            ) : (
              <ul className="divide-y divide-border/40">
                {pendingInquiries.map((inq) => (
                  <li key={inq.id}>
                    <Link
                      href="/inquiries"
                      className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted/50"
                    >
                      <span className="font-medium">
                        {inq.product_categories?.name ?? "—"}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {inq.requested_qty} MT
                      </span>
                      <Badge
                        variant="outline"
                        className="text-xs text-yellow-400 border-yellow-400/40"
                      >
                        pending
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}

const ACCENT_RING: Record<string, string> = {
  amber: "group-hover:ring-amber-400/40",
  cyan: "group-hover:ring-cyan-400/40",
  violet: "group-hover:ring-violet-400/40",
  emerald: "group-hover:ring-emerald-400/40",
  blue: "group-hover:ring-blue-400/40",
};

function GlassTile({
  href,
  icon,
  title,
  subtitle,
  accent,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accent: keyof typeof ACCENT_RING;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-xl transition-all",
        "hover:bg-card/70 hover:ring-2",
        ACCENT_RING[accent]
      )}
    >
      <div className="flex items-center gap-3">
        <div className="grid size-9 place-items-center rounded-lg border border-border/60 bg-background/40">
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </Link>
  );
}

function GlassPanel({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40 backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <h2 className="text-sm font-medium">{title}</h2>
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={href} />}
          className="h-7 text-xs"
        >
          View all <ArrowRightIcon className="ml-1 size-3" />
        </Button>
      </div>
      <div className="p-2">{children}</div>
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 py-6 text-center text-xs text-muted-foreground">
      {children}
    </p>
  );
}
