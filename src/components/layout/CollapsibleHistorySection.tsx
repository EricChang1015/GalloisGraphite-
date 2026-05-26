"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface CollapsibleHistorySectionProps {
  title: string;
  count: number;
  /** Query param that forces the section open (default: `history`). */
  queryKey?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsibleHistorySection({
  title,
  count,
  queryKey = "history",
  defaultOpen = false,
  children,
}: CollapsibleHistorySectionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen]);

  if (count === 0) return null;

  function toggle() {
    const next = !open;
    setOpen(next);

    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.set(queryKey, "1");
    } else {
      params.delete(queryKey);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <section className="mt-8">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-md border border-dashed px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
      >
        <ChevronDownIcon
          className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")}
        />
        <span>
          {title} ({count})
        </span>
      </button>
      {open ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}
