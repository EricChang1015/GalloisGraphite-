"use client";

import Link from "next/link";
import {
  ArrowRightIcon,
  CommandIcon,
  CircleDotIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { STATUS_TINT, type DashboardData } from "../types";

export function CommandDashboard({ data }: { data: DashboardData }) {
  const { profile, activeOrders, pendingInquiries, isSeller, isAdmin } = data;

  const stats = [
    { label: "Active orders", value: activeOrders.length, href: "/orders" },
    {
      label: "Pending inquiries",
      value: pendingInquiries.length,
      href: "/inquiries",
    },
    { label: "Role", value: profile?.role ?? "—" },
    { label: "KYC level", value: profile?.kyc_level ?? 0 },
  ];

  const quickLinks: Array<{ kbd: string; label: string; href: string }> = [
    { kbd: "M", label: "Open market", href: "/market" },
    { kbd: "O", label: "Open orders", href: "/orders" },
    { kbd: "I", label: "Open inquiries", href: "/inquiries" },
  ];
  if (isSeller) {
    quickLinks.push({ kbd: "L", label: "New listing", href: "/listings/new" });
  }
  if (isAdmin) {
    quickLinks.push({ kbd: "A", label: "Admin console", href: "/admin" });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header className="space-y-3">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <CommandIcon className="size-3.5" />
          <span>graphite / dashboard</span>
          <span className="ml-auto">{new Date().toISOString().slice(0, 10)}</span>
        </div>
        <h1 className="text-2xl font-medium tracking-tight">
          {profile?.full_name ?? "Welcome"}
          <span className="ml-3 text-muted-foreground">
            {profile?.company_name}
          </span>
        </h1>
      </header>

      <section>
        <div className="grid grid-cols-2 divide-x divide-border/60 border-y border-border/60 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="px-4 py-4">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {s.label}
              </p>
              <p className="mt-1 font-mono text-2xl tabular-nums">
                {String(s.value).replace(/_/g, " ")}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading label="Quick actions" hint="Single key" />
        <ul className="divide-y divide-border/60 border-y border-border/60">
          {quickLinks.map((link) => (
            <li key={link.label}>
              <Link
                href={link.href}
                className="flex items-center justify-between px-2 py-3 text-sm transition-colors hover:bg-muted/40"
              >
                <span>{link.label}</span>
                <span className="flex items-center gap-2">
                  <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {link.kbd}
                  </kbd>
                  <ArrowRightIcon className="size-3.5 text-muted-foreground" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionHeading label="Active orders" href="/orders" />
        {activeOrders.length === 0 ? (
          <EmptyLine>No active orders.</EmptyLine>
        ) : (
          <ul className="divide-y divide-border/60 border-y border-border/60">
            {activeOrders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/orders/${o.id}`}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-2 py-3 text-sm transition-colors hover:bg-muted/40"
                >
                  <span className="flex items-center gap-2">
                    <CircleDotIcon
                      className={cn(
                        "size-3",
                        STATUS_TINT[o.status]?.split(" ")[0] ?? "text-muted-foreground"
                      )}
                    />
                    <span className="font-mono text-xs">{o.order_no}</span>
                  </span>
                  <span className="font-mono tabular-nums">
                    {o.total_amount} {o.currency}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-mono text-[10px] uppercase tracking-wider",
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
      </section>

      <section>
        <SectionHeading label="Pending inquiries" href="/inquiries" />
        {pendingInquiries.length === 0 ? (
          <EmptyLine>No pending inquiries.</EmptyLine>
        ) : (
          <ul className="divide-y divide-border/60 border-y border-border/60">
            {pendingInquiries.map((inq) => (
              <li key={inq.id}>
                <Link
                  href="/inquiries"
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-2 py-3 text-sm transition-colors hover:bg-muted/40"
                >
                  <span>{inq.product_categories?.name ?? "—"}</span>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {inq.requested_qty} MT
                  </span>
                  <Badge
                    variant="outline"
                    className="font-mono text-[10px] uppercase tracking-wider text-yellow-400 border-yellow-400/40"
                  >
                    pending
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SectionHeading({
  label,
  href,
  hint,
}: {
  label: string;
  href?: string;
  hint?: string;
}) {
  return (
    <div className="mb-2 flex items-baseline justify-between px-2">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </h2>
      {hint && (
        <span className="font-mono text-[10px] tracking-wider text-muted-foreground/70">
          {hint}
        </span>
      )}
      {href && (
        <Link
          href={href}
          className="font-mono text-[10px] tracking-wider text-muted-foreground transition-colors hover:text-foreground"
        >
          view all →
        </Link>
      )}
    </div>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-y border-dashed border-border/60 px-2 py-6 text-center font-mono text-xs text-muted-foreground">
      {children}
    </p>
  );
}
