"use client";

import Link from "next/link";
import {
  ActivityIcon,
  RadioIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { type DashboardData } from "../types";

const STATUS_BAR: Record<string, string> = {
  draft: "bg-zinc-500",
  contract_generated: "bg-sky-400",
  signed: "bg-violet-400",
  payment_pending: "bg-amber-400",
  paid: "bg-emerald-400",
  shipped: "bg-cyan-400",
  delivered: "bg-teal-400",
  completed: "bg-emerald-300",
  disputed: "bg-red-400",
  cancelled: "bg-zinc-600",
};

const STATUS_FG: Record<string, string> = {
  draft: "text-zinc-300",
  contract_generated: "text-sky-300",
  signed: "text-violet-300",
  payment_pending: "text-amber-300",
  paid: "text-emerald-300",
  shipped: "text-cyan-300",
  delivered: "text-teal-300",
  completed: "text-emerald-200",
  disputed: "text-red-300",
  cancelled: "text-zinc-500",
};

export function TerminalDashboard({ data }: { data: DashboardData }) {
  const { profile, activeOrders, pendingInquiries } = data;

  const tickers = [
    {
      label: "ACTIVE",
      value: activeOrders.length.toString().padStart(3, "0"),
      tone: "text-emerald-300",
    },
    {
      label: "INQUIRIES",
      value: pendingInquiries.length.toString().padStart(3, "0"),
      tone: "text-amber-300",
    },
    {
      label: "TOTAL VAL",
      value:
        activeOrders.length === 0
          ? "0.0000"
          : activeOrders
              .reduce((sum, o) => sum + Number(o.total_amount ?? 0), 0)
              .toFixed(4),
      tone: "text-cyan-300",
    },
    {
      label: "KYC",
      value: `L${profile?.kyc_level ?? 0}`,
      tone: "text-violet-300",
    },
  ];

  return (
    <div className="font-mono">
      {/* Top status strip */}
      <div className="flex items-center gap-3 border border-emerald-400/20 bg-[#0a0e0b] px-3 py-2 text-[11px] text-emerald-200">
        <span className="inline-flex items-center gap-1.5">
          <span className="relative grid place-items-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/40" />
            <RadioIcon className="size-3 text-emerald-400" />
          </span>
          LIVE
        </span>
        <span className="text-emerald-400/40">|</span>
        <span>{profile?.company_name ?? "—"}</span>
        <span className="text-emerald-400/40">|</span>
        <span className="uppercase tracking-wider">{profile?.role}</span>
        <span className="ml-auto tabular-nums">
          {new Date().toISOString().replace("T", " ").slice(0, 19)} UTC
        </span>
      </div>

      {/* KPI ticker grid */}
      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-emerald-400/15 bg-emerald-400/10 md:grid-cols-4">
        {tickers.map((t) => (
          <div key={t.label} className="bg-[#0a0e0b] px-4 py-3">
            <p className="text-[10px] uppercase tracking-widest text-emerald-300/60">
              {t.label}
            </p>
            <p className={cn("mt-1 text-2xl tabular-nums", t.tone)}>
              {t.value}
            </p>
          </div>
        ))}
      </div>

      {/* Orders table */}
      <section className="mt-6">
        <TerminalHeading label="ORDERS · ACTIVE" href="/orders" />
        <div className="overflow-hidden rounded-sm border border-emerald-400/15">
          <div className="grid grid-cols-[8px_1fr_120px_140px_120px] gap-2 border-b border-emerald-400/15 bg-[#0a0e0b] px-3 py-2 text-[10px] uppercase tracking-widest text-emerald-300/60">
            <span />
            <span>ID</span>
            <span className="text-right">QTY/AMT</span>
            <span className="text-right">CCY</span>
            <span className="text-right">STATUS</span>
          </div>
          {activeOrders.length === 0 ? (
            <p className="bg-[#0a0e0b] px-3 py-6 text-center text-xs text-emerald-300/50">
              &gt; no active orders
            </p>
          ) : (
            <ul>
              {activeOrders.map((o) => (
                <li
                  key={o.id}
                  className="border-t border-emerald-400/10 first:border-t-0"
                >
                  <Link
                    href={`/orders/${o.id}`}
                    className="grid grid-cols-[8px_1fr_120px_140px_120px] items-center gap-2 bg-[#0a0e0b] px-3 py-2 text-[12px] text-emerald-100/90 hover:bg-emerald-400/5"
                  >
                    <span
                      className={cn(
                        "h-full min-h-4 w-0.5 rounded-sm",
                        STATUS_BAR[o.status] ?? "bg-zinc-500"
                      )}
                    />
                    <span className="truncate">{o.order_no}</span>
                    <span className="text-right tabular-nums">
                      {Number(o.total_amount).toFixed(4)}
                    </span>
                    <span className="text-right text-emerald-300/70">
                      {o.currency}
                    </span>
                    <span
                      className={cn(
                        "text-right text-[10px] uppercase tracking-widest",
                        STATUS_FG[o.status] ?? "text-zinc-400"
                      )}
                    >
                      {o.status.replace(/_/g, " ")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Inquiries table */}
      <section className="mt-6">
        <TerminalHeading label="INQUIRIES · PENDING" href="/inquiries" />
        <div className="overflow-hidden rounded-sm border border-emerald-400/15">
          <div className="grid grid-cols-[8px_1fr_120px_120px] gap-2 border-b border-emerald-400/15 bg-[#0a0e0b] px-3 py-2 text-[10px] uppercase tracking-widest text-emerald-300/60">
            <span />
            <span>CATEGORY</span>
            <span className="text-right">QTY (MT)</span>
            <span className="text-right">STATUS</span>
          </div>
          {pendingInquiries.length === 0 ? (
            <p className="bg-[#0a0e0b] px-3 py-6 text-center text-xs text-emerald-300/50">
              &gt; no pending inquiries
            </p>
          ) : (
            <ul>
              {pendingInquiries.map((inq) => (
                <li
                  key={inq.id}
                  className="border-t border-emerald-400/10 first:border-t-0"
                >
                  <Link
                    href="/inquiries"
                    className="grid grid-cols-[8px_1fr_120px_120px] items-center gap-2 bg-[#0a0e0b] px-3 py-2 text-[12px] text-emerald-100/90 hover:bg-emerald-400/5"
                  >
                    <span className="h-full min-h-4 w-0.5 rounded-sm bg-amber-400" />
                    <span className="truncate">
                      {inq.product_categories?.name ?? "—"}
                    </span>
                    <span className="text-right tabular-nums">
                      {Number(inq.requested_qty).toFixed(2)}
                    </span>
                    <span className="text-right text-[10px] uppercase tracking-widest text-amber-300">
                      pending
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function TerminalHeading({ label, href }: { label: string; href: string }) {
  return (
    <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-widest text-emerald-300/70">
      <ActivityIcon className="size-3.5" />
      <span>{label}</span>
      <Link
        href={href}
        className="ml-auto text-emerald-300/60 transition-colors hover:text-emerald-200"
      >
        view all →
      </Link>
    </div>
  );
}
