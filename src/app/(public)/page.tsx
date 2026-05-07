import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function HomePage() {
  return (
    <>
      <section className="relative bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-800 text-neutral-100">
        <div className="mx-auto max-w-5xl px-6 py-24 sm:py-32 text-center space-y-6">
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--gold)]">
            Mada Graphite — B2B Trading Platform
          </p>
          <h1 className="text-4xl sm:text-6xl font-semibold leading-tight">
            First-class Madagascar flake graphite,
            <br />
            <span className="text-[color:var(--gold)]">
              traded transparently worldwide.
            </span>
          </h1>
          <p className="text-base sm:text-lg text-neutral-300 max-w-2xl mx-auto">
            Connect with verified buyers and sellers. Generate contracts, settle
            payments, and ship — all backed by Graphite Energy Inc. and the
            Etablissements Gallois mine, in continuous production since 1901.
          </p>
          <div className="flex flex-wrap gap-3 justify-center pt-2">
            <Link
              href="/register"
              className={cn(buttonVariants({ size: "lg" }))}
            >
              Open an account
            </Link>
            <Link
              href="/chat"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "bg-transparent text-neutral-100 hover:bg-neutral-800"
              )}
            >
              Ask the AI assistant
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16 grid gap-6 sm:grid-cols-3">
        {[
          {
            t: "MADA1",
            d: "Spherical graphite (Li-ion battery anode), expandable graphite, high-purity graphite.",
          },
          {
            t: "MADA2",
            d: "Industrial flake for refractories, metallurgy, crucibles, and feedstock.",
          },
          {
            t: "Custom",
            d: "Specs from 80–99% C, +35 ~ -100 mesh. Tailored to your application.",
          },
        ].map((card) => (
          <div
            key={card.t}
            className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <h3 className="text-lg font-semibold">{card.t}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{card.d}</p>
          </div>
        ))}
      </section>
    </>
  );
}
