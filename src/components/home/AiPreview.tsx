"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { SparklesIcon, SendIcon, BotIcon, UserIcon, ArrowUpRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BgGrid } from "@/components/home/BgGrid";
import { cn } from "@/lib/utils";

/**
 * "Live AI assistant preview" — embedded chat mockup answering a real
 * procurement question. Plays a typing animation when scrolled into view.
 *
 * NOT connected to /api/chat; this is a marketing demo. The CTAs route to
 * the actual chat experience.
 */

type Turn =
  | { role: "user"; text: string }
  | { role: "assistant"; chunks: string[]; tail?: React.ReactNode };

const SCRIPT: Turn[] = [
  {
    role: "user",
    text: "What grade do I need for Li-ion anodes?",
  },
  {
    role: "assistant",
    chunks: [
      "For lithium-ion anode feedstock you typically want our ",
      "**MADA1** flake — the perfect crystalline structure and very low ",
      "purification-unfavorable ash make it the cleanest path to spherical graphite.",
      "\n\nA reasonable starting spec is:",
    ],
    tail: <SpecBlock />,
  },
  {
    role: "user",
    text: "Can you check container availability into Yokohama for July?",
  },
];

export function AiPreview() {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3, once: true });

  return (
    <section
      ref={ref}
      className="relative overflow-hidden border-y border-border bg-background"
    >
      <BgGrid pattern="dot" className="opacity-50" />
      {/* Soft signal halo behind chat */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-1/2 size-[40rem] -translate-y-1/2 rounded-full bg-signal/15 blur-3xl"
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-12 lg:gap-16">
        {/* Left: pitch */}
        <div className="space-y-6 lg:col-span-5">
          <p className="text-eyebrow">
            <SparklesIcon className="mr-1.5 inline size-3 text-signal animate-signal-pulse" />
            AI co-pilot
          </p>
          <h2 className="text-display-sm text-balance text-foreground">
            Stop guessing the right grade.{" "}
            <span className="text-signal">Ask the desk.</span>
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground">
            Mada Graphite&apos;s assistant matches your application against our
            COA library, surfaces the closest in-stock spec, and drafts the
            inquiry — all before you create an account. Logged in, it can also
            check live container availability and contract drafts.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              render={<Link href="/chat" />}
              size="lg"
              className="h-11 gap-2 bg-signal text-signal-foreground hover:bg-signal/90"
            >
              <SparklesIcon className="size-4" />
              Try the assistant
              <ArrowUpRightIcon className="size-4" />
            </Button>
            <Button
              render={<Link href="/register" />}
              size="lg"
              variant="outline"
              className="h-11 gap-2"
            >
              Open an account
            </Button>
          </div>

          <ul className="grid gap-2 pt-4 font-mono text-[11px] text-muted-foreground">
            {[
              "→ Spec-to-application matching across all grades",
              "→ Drafts an inquiry message you can edit & send",
              "→ Cites the source COA / fact in every answer",
              "→ Recognises buy intent — defers to your account-bound desk",
            ].map((line) => (
              <li key={line} className="text-foreground/80">
                <span className="text-signal">{line.slice(0, 1)}</span>
                {line.slice(1)}
              </li>
            ))}
          </ul>
        </div>

        {/* Right: chat mockup */}
        <ChatMockup active={inView} className="lg:col-span-7" />
      </div>
    </section>
  );
}

function ChatMockup({ active, className }: { active: boolean; className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card backdrop-blur-xl",
        "shadow-[0_30px_80px_-30px_color-mix(in_oklch,var(--signal)_40%,transparent)]",
        className
      )}
    >
      {/* Window header */}
      <div className="flex items-center justify-between border-b border-border bg-surface-2/50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-red-500/60" />
          <span className="size-2.5 rounded-full bg-amber-400/70" />
          <span className="size-2.5 rounded-full bg-emerald-400/70" />
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-emerald-400 animate-signal-pulse" />
          mada · ai assistant
        </div>
        <span className="size-2.5" />
      </div>

      {/* Conversation */}
      <div className="space-y-4 px-5 py-6 sm:px-6 sm:py-8">
        {SCRIPT.map((turn, i) => (
          <Bubble key={i} turn={turn} delay={i * 1.1} active={active} isLast={i === SCRIPT.length - 1} />
        ))}
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-surface-1/60 p-3">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
          <SparklesIcon className="size-4 text-signal" />
          <input
            disabled
            placeholder="Ask anything about specs, lots or routes…"
            className="flex-1 bg-transparent text-sm text-foreground/70 placeholder:text-muted-foreground/70 outline-none"
          />
          <button
            disabled
            className="inline-flex size-7 items-center justify-center rounded-md bg-signal text-signal-foreground"
          >
            <SendIcon className="size-3.5" />
          </button>
        </div>
        <p className="mt-2 px-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Demo · Try the live assistant on the chat page
        </p>
      </div>
    </div>
  );
}

function Bubble({
  turn,
  delay,
  active,
  isLast,
}: {
  turn: Turn;
  delay: number;
  active: boolean;
  isLast: boolean;
}) {
  const isAssistant = turn.role === "assistant";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={active ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, delay }}
      className={cn(
        "flex items-start gap-3",
        isAssistant ? "" : "flex-row-reverse"
      )}
    >
      <span
        className={cn(
          "mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg border",
          isAssistant
            ? "border-signal/40 bg-signal/10 text-signal"
            : "border-border bg-muted text-muted-foreground"
        )}
      >
        {isAssistant ? <BotIcon className="size-3.5" /> : <UserIcon className="size-3.5" />}
      </span>

      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isAssistant
            ? "border border-border bg-background/60 text-foreground"
            : "bg-muted text-foreground"
        )}
      >
        {turn.role === "user" ? (
          <p>{turn.text}</p>
        ) : (
          <AssistantBody turn={turn} delay={delay} active={active} typing={isLast === false ? false : false} />
        )}
        {turn.role === "assistant" && turn.tail && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={active ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: delay + 1.4 }}
          >
            {turn.tail}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function AssistantBody({
  turn,
  delay,
  active,
}: {
  turn: Extract<Turn, { role: "assistant" }>;
  delay: number;
  active: boolean;
  typing?: boolean;
}) {
  return (
    <div className="space-y-2">
      {turn.chunks.map((c, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0 }}
          animate={active ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: delay + 0.2 + i * 0.35 }}
          className="block whitespace-pre-line"
          dangerouslySetInnerHTML={{ __html: renderInline(c) }}
        />
      ))}
    </div>
  );
}

/** Cheap inline renderer: only **bold** is supported. */
function renderInline(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong class="text-signal">$1</strong>');
}

function SpecBlock() {
  const rows: Array<[string, string]> = [
    ["brand", "MADA1"],
    ["mesh", "+150 mesh"],
    ["fixed_carbon", "≥ 95%"],
    ["ash", "≤ 4%"],
    ["target_app", "Spheroidization → Li-ion anode"],
  ];
  return (
    <div className="mt-3 rounded-xl border border-signal/30 bg-card/70 p-3 font-mono text-[11px]">
      <p className="mb-1.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        Suggested spec
      </p>
      <ul className="space-y-1">
        {rows.map(([k, v]) => (
          <li key={k} className="flex items-baseline justify-between gap-3">
            <span className="text-muted-foreground">{k}</span>
            <span className="text-foreground">{v}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground/80">
        Cited from MADA1 reference COA · Updated 2026-05
      </p>
    </div>
  );
}
