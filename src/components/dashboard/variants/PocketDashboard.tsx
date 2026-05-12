"use client";

import Link from "next/link";
import {
  ShoppingBagIcon,
  PackageIcon,
  ClipboardListIcon,
  PlusIcon,
  SparklesIcon,
  ArrowUpRightIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { STATUS_TINT, type DashboardData } from "../types";

export function PocketDashboard({ data }: { data: DashboardData }) {
  const { profile, activeOrders, pendingInquiries, isSeller } = data;

  return (
    <div className="mx-auto w-full max-w-md space-y-5">
      {/* Greeting */}
      <header className="px-1 pt-2">
        <p className="text-sm text-muted-foreground">
          {greetingForNow()}
          {profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {profile?.company_name ?? "Mada Graphite"}
        </h1>
      </header>

      {/* Hero AI tile */}
      <Link
        href="/chat"
        className="relative block overflow-hidden rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-500/20 via-amber-400/5 to-transparent p-5 shadow-lg shadow-amber-500/5"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-amber-300/90">
              AI co-pilot
            </p>
            <p className="mt-1 text-base font-medium leading-snug">
              Ask anything about your{" "}
              <span className="text-amber-300">orders, listings & specs</span>.
            </p>
          </div>
          <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-400/15 text-amber-300">
            <SparklesIcon className="size-5" />
          </div>
        </div>
        <p className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground">
          Start a chat <ArrowUpRightIcon className="size-3" />
        </p>
      </Link>

      {/* Big stat row */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          value={activeOrders.length}
          label="Active orders"
          href="/orders"
          accent="from-cyan-500/15 to-cyan-500/0 text-cyan-300"
        />
        <StatTile
          value={pendingInquiries.length}
          label="Pending inquiries"
          href="/inquiries"
          accent="from-violet-500/15 to-violet-500/0 text-violet-300"
        />
      </div>

      {/* Quick action chip row */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
        <ChipLink href="/market" icon={<ShoppingBagIcon className="size-4" />} label="Market" />
        <ChipLink href="/orders" icon={<PackageIcon className="size-4" />} label="Orders" />
        <ChipLink
          href="/inquiries"
          icon={<ClipboardListIcon className="size-4" />}
          label="Inquiries"
        />
        {isSeller && (
          <ChipLink
            href="/listings/new"
            icon={<PlusIcon className="size-4" />}
            label="New listing"
            primary
          />
        )}
      </div>

      {/* Active orders carousel */}
      <section>
        <SectionRow title="Active orders" href="/orders" />
        {activeOrders.length === 0 ? (
          <EmptyCard>No active orders yet. Browse the market to get started.</EmptyCard>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
            {activeOrders.map((o) => (
              <Link
                key={o.id}
                href={`/orders/${o.id}`}
                className="snap-start min-w-[78%] rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:bg-card/80"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {o.order_no}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn("text-[10px]", STATUS_TINT[o.status] ?? "")}
                  >
                    {o.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <p className="mt-3 text-2xl font-semibold tabular-nums">
                  {o.total_amount}
                </p>
                <p className="text-xs text-muted-foreground">{o.currency}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Pending inquiries list */}
      <section>
        <SectionRow title="Pending inquiries" href="/inquiries" />
        {pendingInquiries.length === 0 ? (
          <EmptyCard>No pending inquiries.</EmptyCard>
        ) : (
          <div className="space-y-2">
            {pendingInquiries.map((inq) => (
              <Link
                key={inq.id}
                href="/inquiries"
                className="flex items-center justify-between rounded-2xl border border-border/60 bg-card px-4 py-3 transition-colors hover:bg-card/80"
              >
                <div>
                  <p className="text-sm font-medium">
                    {inq.product_categories?.name ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {inq.requested_qty} MT requested
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] text-yellow-400 border-yellow-400/40"
                >
                  pending
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function greetingForNow() {
  const h = new Date().getHours();
  if (h < 5) return "Late shift";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function StatTile({
  value,
  label,
  href,
  accent,
}: {
  value: number | string;
  label: string;
  href: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-2xl border border-border/60 bg-gradient-to-br p-4 transition-colors hover:border-primary/40",
        accent
      )}
    >
      <p className="text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </Link>
  );
}

function ChipLink({
  href,
  icon,
  label,
  primary,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "snap-start inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-sm transition-colors",
        primary
          ? "border-amber-400/40 bg-amber-400/10 text-amber-200 hover:bg-amber-400/15"
          : "border-border/60 bg-card hover:bg-muted"
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function SectionRow({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-2 flex items-center justify-between px-1">
      <h2 className="text-sm font-medium">{title}</h2>
      <Link
        href={href}
        className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
      >
        See all <ArrowUpRightIcon className="size-3" />
      </Link>
    </div>
  );
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 px-4 py-6 text-center text-xs text-muted-foreground">
      {children}
    </div>
  );
}
