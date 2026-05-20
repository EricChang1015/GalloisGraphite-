import { Check, Circle, AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  getProgressStages,
  getStageIndex,
  STATUS_LABEL,
  type OrderStatus,
} from "@/lib/order/stateMachine";

interface OrderProgressBarProps {
  status: OrderStatus;
  /** Optional payment progress summary rendered as a micro-badge. */
  paymentsSummary?: {
    paid: number;
    total: number;
  };
  className?: string;
}

/**
 * Linear 12-step progress bar for an order. Payment is intentionally not
 * a step in this bar — it lives on `payment_schedules` and is surfaced
 * separately. Pass `paymentsSummary` to show a `Payments: 1 / 3 paid`
 * micro-badge alongside the stage counter.
 */
export function OrderProgressBar({
  status,
  paymentsSummary,
  className,
}: OrderProgressBarProps) {
  const isOffTrack = status === "disputed" || status === "cancelled";

  if (isOffTrack) {
    return (
      <div
        className={cn(
          "rounded-lg border border-red-400/40 bg-red-500/5 p-4 flex items-center gap-3 text-sm",
          className
        )}
      >
        <AlertTriangle className="size-5 text-red-400" />
        <div>
          <p className="font-medium text-red-400">{STATUS_LABEL[status]}</p>
          <p className="text-xs text-muted-foreground">
            This order is off the standard tracking path. Contact admin for resolution.
          </p>
        </div>
      </div>
    );
  }

  const stages = getProgressStages();
  const currentIdx = getStageIndex(status);
  const isFullyDone = status === "completed";

  const paymentsOutstanding =
    paymentsSummary && paymentsSummary.total > 0
      ? paymentsSummary.total - paymentsSummary.paid
      : 0;
  const completedButUnpaid = isFullyDone && paymentsOutstanding > 0;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground gap-2 flex-wrap">
        <span>
          Stage <span className="font-medium text-foreground">{Math.max(0, currentIdx) + 1}</span>{" "}
          / {stages.length}
        </span>
        {paymentsSummary && paymentsSummary.total > 0 && (
          <span
            className={cn(
              "rounded border px-2 py-0.5 text-[11px]",
              paymentsSummary.paid === paymentsSummary.total
                ? "border-emerald-400/40 text-emerald-400"
                : "border-amber-400/40 text-amber-400"
            )}
          >
            Payments: {paymentsSummary.paid} / {paymentsSummary.total} paid
          </span>
        )}
      </div>

      {completedButUnpaid && (
        <div className="rounded-lg border border-red-400/40 bg-red-500/5 p-3 flex items-start gap-2 text-xs">
          <AlertTriangle className="size-4 text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-red-400">
              Payments outstanding ({paymentsOutstanding})
            </p>
            <p className="text-muted-foreground mt-0.5">
              This order is marked completed but {paymentsOutstanding} payment
              installment{paymentsOutstanding === 1 ? "" : "s"} are still unpaid.
              Open the Payment tab to settle them.
            </p>
          </div>
        </div>
      )}

      {/* Desktop horizontal */}
      <ol className="hidden md:flex items-start gap-1">
        {stages.map((stage, idx) => {
          const state = isFullyDone
            ? "done"
            : idx < currentIdx
              ? "done"
              : idx === currentIdx
                ? "current"
                : "future";
          return (
            <li key={stage} className="flex-1 min-w-0">
              <div className="flex items-center">
                <div
                  className={cn(
                    "size-6 rounded-full flex items-center justify-center shrink-0 border",
                    state === "done" && "bg-emerald-500/20 border-emerald-400 text-emerald-400",
                    state === "current" && "bg-primary/20 border-primary text-primary",
                    state === "future" && "border-border text-muted-foreground"
                  )}
                >
                  {state === "done" ? (
                    <Check className="size-3.5" />
                  ) : state === "current" ? (
                    <Circle className="size-2 fill-current" />
                  ) : (
                    <span className="text-[10px]">{idx + 1}</span>
                  )}
                </div>
                {idx < stages.length - 1 && (
                  <div
                    className={cn(
                      "h-px flex-1 mx-1",
                      idx < currentIdx ? "bg-emerald-400/60" : "bg-border"
                    )}
                  />
                )}
              </div>
              <p
                className={cn(
                  "mt-2 text-[10px] leading-tight pr-1 truncate",
                  state === "done" && "text-emerald-400/80",
                  state === "current" && "text-foreground font-medium",
                  state === "future" && "text-muted-foreground"
                )}
                title={STATUS_LABEL[stage]}
              >
                {STATUS_LABEL[stage]}
              </p>
            </li>
          );
        })}
      </ol>

      {/* Mobile vertical */}
      <ol className="md:hidden space-y-2">
        {stages.map((stage, idx) => {
          const state = isFullyDone
            ? "done"
            : idx < currentIdx
              ? "done"
              : idx === currentIdx
                ? "current"
                : "future";
          return (
            <li key={stage} className="flex items-center gap-3">
              <div
                className={cn(
                  "size-5 rounded-full flex items-center justify-center shrink-0 border",
                  state === "done" && "bg-emerald-500/20 border-emerald-400 text-emerald-400",
                  state === "current" && "bg-primary/20 border-primary text-primary",
                  state === "future" && "border-border text-muted-foreground"
                )}
              >
                {state === "done" ? (
                  <Check className="size-3" />
                ) : state === "current" ? (
                  <Circle className="size-2 fill-current" />
                ) : (
                  <span className="text-[10px]">{idx + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  "text-xs",
                  state === "current" && "font-medium text-foreground",
                  state === "future" && "text-muted-foreground",
                  state === "done" && "text-emerald-400/80"
                )}
              >
                {STATUS_LABEL[stage]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
