"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  CATEGORY_LABEL,
  MILESTONE_LABEL,
  TIME_BASED_MILESTONES,
  getMilestonesForCategory,
  type Incoterm,
  type PaymentCategory,
  type PaymentMilestone,
  type PaymentScheduleEntry,
} from "@/lib/validations/payment-schedule";

const CATEGORIES: PaymentCategory[] = ["prepayment", "regular_payment", "postpayment"];

type Entry = PaymentScheduleEntry & { _key: string };

interface Props {
  incoterm: Incoterm;
  value: PaymentScheduleEntry[];
  onChange: (next: PaymentScheduleEntry[]) => void;
  /** Snapshot of order total so we can render real amounts. */
  totalAmount: number;
  currency: string;
  className?: string;
}

interface Template {
  label: string;
  build: (incoterm: Incoterm) => PaymentScheduleEntry[];
}

const TEMPLATES: Template[] = [
  {
    label: "100% prepay (on signing)",
    build: () => [
      { category: "prepayment", milestone: "contract_signed", percentage: 100 },
    ],
  },
  {
    label: "30 / 70 (before-shipment / arrival)",
    build: () => [
      { category: "prepayment", milestone: "before_shipment", percentage: 30 },
      { category: "postpayment", milestone: "arrived_at_port", percentage: 70 },
    ],
  },
  {
    label: "30 / 40 / 30 (signing / B/L / arrival)",
    build: (incoterm) => [
      { category: "prepayment", milestone: "contract_signed", percentage: 30 },
      {
        category: "regular_payment",
        milestone:
          incoterm === "CIF" ? "bl_plus_insurance_received" : "bl_received",
        percentage: 40,
      },
      { category: "postpayment", milestone: "arrived_at_port", percentage: 30 },
    ],
  },
  {
    label: "50 / 50 (before-loading / B/L+30d)",
    build: () => [
      { category: "prepayment", milestone: "before_loading", percentage: 50 },
      {
        category: "postpayment",
        milestone: "bl_date_plus_30",
        percentage: 50,
        bl_offset_days: 30,
      },
    ],
  },
];

/** Stable list keys across percentage edits (must not depend on stale useMemo). */
function entryKey(e: PaymentScheduleEntry, idx: number) {
  return `${idx}-${e.category}-${e.milestone}`;
}

export function PaymentScheduleBuilder({
  incoterm,
  value,
  onChange,
  totalAmount,
  currency,
  className,
}: Props) {
  const entries: Entry[] = value.map((e, idx) => ({
    ...e,
    _key: entryKey(e, idx),
  }));

  const total = entries.reduce((acc, e) => acc + (Number(e.percentage) || 0), 0);
  const totalsOk = Math.abs(total - 100) < 0.01;

  function update(idx: number, patch: Partial<PaymentScheduleEntry>) {
    const next = value.map((e, i) => (i === idx ? { ...e, ...patch } : e));
    onChange(next);
  }
  function add(category: PaymentCategory) {
    const milestones = getMilestonesForCategory(category, incoterm);
    const firstAvailable = milestones.find(
      (m) => !value.some((e) => e.category === category && e.milestone === m)
    );
    if (!firstAvailable) return;
    const newEntry: PaymentScheduleEntry = {
      category,
      milestone: firstAvailable,
      percentage: 0,
    };
    if (TIME_BASED_MILESTONES.has(firstAvailable)) {
      newEntry.bl_offset_days =
        firstAvailable === "bl_date_plus_30"
          ? 30
          : firstAvailable === "bl_date_plus_60"
            ? 60
            : 90;
    }
    onChange([...value, newEntry]);
  }
  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }
  function applyTemplate(t: Template) {
    onChange(t.build(incoterm));
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-lg border p-3 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs font-medium">Quick templates</p>
          <p className="text-[10px] text-muted-foreground">
            Adjust afterwards as needed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <Button
              key={t.label}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => applyTemplate(t)}
              className="text-xs"
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>

      {CATEGORIES.map((category) => {
        const sectionEntries = entries
          .map((e, idx) => ({ e, idx }))
          .filter(({ e }) => e.category === category);
        const milestones = getMilestonesForCategory(category, incoterm);
        const canAdd = sectionEntries.length < milestones.length;

        return (
          <div key={category} className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{CATEGORY_LABEL[category]}</p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!canAdd}
                onClick={() => add(category)}
                className="h-7 text-xs"
              >
                <Plus className="size-3.5 mr-1" />
                Add installment
              </Button>
            </div>

            {sectionEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground">No installment yet.</p>
            ) : (
              <ul className="space-y-3">
                {sectionEntries.map(({ e, idx }) => (
                  <li
                    key={e._key}
                    className="grid gap-2 sm:grid-cols-[1.4fr_90px_120px_36px] items-end"
                  >
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Milestone
                      </Label>
                      <Select
                        value={e.milestone}
                        onValueChange={(v) => {
                          const m = v as PaymentMilestone;
                          const patch: Partial<PaymentScheduleEntry> = { milestone: m };
                          if (TIME_BASED_MILESTONES.has(m)) {
                            patch.bl_offset_days =
                              m === "bl_date_plus_30"
                                ? 30
                                : m === "bl_date_plus_60"
                                  ? 60
                                  : 90;
                          } else {
                            patch.bl_offset_days = undefined;
                          }
                          update(idx, patch);
                        }}
                      >
                        <SelectTrigger className="w-full text-xs h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {milestones.map((m) => (
                            <SelectItem key={m} value={m}>
                              {MILESTONE_LABEL[m]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        %
                      </Label>
                      <Input
                        type="number"
                        min={0.01}
                        max={100}
                        step={0.01}
                        value={Number.isFinite(e.percentage) ? e.percentage : 0}
                        onChange={(ev) => {
                          const raw = ev.target.value;
                          const parsed = raw === "" ? 0 : Number.parseFloat(raw);
                          update(idx, {
                            percentage: Number.isFinite(parsed) ? parsed : 0,
                          });
                        }}
                        className="text-xs h-8"
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <Label className="text-[10px] uppercase tracking-wider">Amount</Label>
                      <p className="h-8 flex items-center font-medium text-foreground">
                        {((totalAmount * (Number(e.percentage) || 0)) / 100).toFixed(2)}{" "}
                        <span className="text-muted-foreground ml-1">{currency}</span>
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => remove(idx)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400"
                      aria-label="Remove installment"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      <div
        className={cn(
          "rounded-lg border p-3 text-sm flex items-center justify-between",
          totalsOk ? "border-emerald-400/40 text-emerald-400" : "border-amber-400/50 text-amber-400"
        )}
      >
        <span>
          Total: <strong>{total.toFixed(2)}%</strong>
          {!totalsOk && (
            <span className="text-muted-foreground ml-2">
              (must equal 100% to draft)
            </span>
          )}
        </span>
        <span className="text-xs text-muted-foreground">
          {(totalAmount * (total / 100)).toFixed(2)} {currency}
        </span>
      </div>
    </div>
  );
}
