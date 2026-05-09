import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangleIcon,
  MapIcon,
  MapPinIcon,
  BuildingIcon,
  PackageCheckIcon,
  AlertCircleIcon,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "The China+1 Case for Madagascar Graphite — Mada Graphite",
  description:
    "Why supply-chain professionals, OEMs and government buyers use Madagascar graphite as an additional China+1 sourcing option for resilience and traceability.",
};

const CRITICAL_LISTS = [
  {
    region: "🇺🇸 United States",
    instrument: "Critical Minerals List (2022 update)",
    note: "Graphite designated as critical; IIJA and IRA funding tied to domestic/allied sourcing.",
  },
  {
    region: "🇪🇺 European Union",
    instrument: "Critical Raw Materials Act (2024)",
    note: "Graphite listed as strategic raw material with domestic/diversified sourcing benchmarks.",
  },
  {
    region: "🇯🇵 Japan",
    instrument: "METI Strategic Minerals Policy",
    note: "Graphite included in Japan's critical minerals framework for battery supply security.",
  },
  {
    region: "🇰🇷 South Korea",
    instrument: "MOTIE Critical Resources Act",
    note: "Graphite among 33 core minerals targeted for supply-chain diversification.",
  },
  {
    region: "🇮🇳 India",
    instrument: "Critical Minerals Mission (2023)",
    note: "Graphite designated; India seeking diversified anode material options for domestic gigafactory pipeline.",
  },
];

const MADAGASCAR_ADVANTAGES = [
  {
    title: "Country-level sanctions position",
    detail:
      "As of May 2026, Madagascar is not subject to broad country-level US, EU, UK, or UN sanctions. Each shipment still requires counterparty, beneficial ownership, bank, vessel, and end-use screening.",
  },
  {
    title: "AGOA eligibility",
    detail:
      "Madagascar is currently listed as AGOA-eligible by USTR. Any preferential tariff outcome depends on HS code, rules of origin, direct shipment, importer documentation, and CBP determination.",
  },
  {
    title: "Deep-water port 45 km from Site No. 1",
    detail:
      "The international port of Toamasina is the closest major Indian Ocean port to the mine. Transit times: Europe 20–30 days, East Asia 15–20 days, US East Coast 30–45 days.",
  },
  {
    title: "Stable operating environment since 2018",
    detail:
      "Madagascar has maintained a functioning constitutional government since the 2018 election. The IMF Article IV consultation is consistently positive on macro fundamentals.",
  },
];

const WHAT_WE_OFFER = [
  "Long-term supply agreements with locked volumes and USD floor pricing",
  "Origin-traceable lots with mine-to-port chain-of-custody documentation",
  "AI-assisted grade comparison to support sample qualification, COA review, and application-specific testing",
  "KYC pack including entity verification, beneficial ownership declaration, and export licence copies",
  "Dual-source structure: position Mada Graphite as a strategic second source, not your only one",
];

const HONEST_RISKS = [
  {
    risk: "Cyclone season",
    mitigation:
      "The Indian Ocean cyclone season (November–April) can affect Toamasina port operations for days to weeks. We mitigate with forward inventory held at the port warehouse.",
  },
  {
    risk: "Currency: Malagasy Ariary volatility",
    mitigation:
      "All Gallois contracts are denominated in USD. Ariary exposure is on the production cost side only, not on the buyer's payable.",
  },
  {
    risk: "Single-country exposure",
    mitigation:
      "Yes, Madagascar is one country. We offset this with two active mining sites (No. 1 + No. 2) and a third site (Ambalafotaka) held in reserve — not a single-site operation.",
  },
  {
    risk: "Exploration upside (unverified scale)",
    mitigation:
      "Only 1% of the 280 km² concession has been explored. The 240M-tonne reserve figure is an Australian geologist estimate — treat as indicative, not certified.",
  },
];

export default function GeopoliticsPage() {
  return (
    <div className="bg-background text-foreground">
      {/* ── Hero ── */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-3xl px-6 py-20 space-y-5">
          <p className="text-xs uppercase tracking-[0.3em] text-sky-600 dark:text-sky-400">
            Strategic Mineral · China+1 Optionality
          </p>
          <h1 className="text-4xl sm:text-5xl font-semibold leading-tight">
            The China+1 case for Madagascar graphite.
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-2xl">
            Graphite is on every critical-mineral list — US, EU, Japan, Korea,
            India. China remains the graphite industry&apos;s central supplier
            and processing hub. If you build batteries, refractories, or
            anything that pours metal, your supply map benefits from an
            additional China+1 option.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/register"
              className={cn(buttonVariants({ size: "lg" }))}
            >
              Request KYC pack
            </Link>
            <Link
              href="/chat"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              Ask the AI assistant
            </Link>
          </div>
        </div>
      </section>

      {/* ── Section 1: The 2023 Inflection ── */}
      <section className="mx-auto max-w-3xl px-6 py-16 space-y-5">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-sky-50 dark:bg-sky-900/20 p-3 shrink-0">
            <AlertTriangleIcon className="size-6 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold">
              1 — The October 2023 inflection
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              In October 2023, China&apos;s Ministry of Commerce announced
              export-licensing controls on natural graphite — including the
              high-purity, high-hardness, and large-flake grades most relevant
              to battery anodes and aerospace applications. The controls are not
              an outright ban: they add documentation and licensing steps for
              certain export categories.
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              What licensing latency means in practice: lead times lengthen by
              weeks, shipment volumes become uncertain, and price discovery
              becomes less transparent. In 2024–2025, this created visible spot
              price volatility and accelerated Western OEM procurement reviews.
            </p>
            <div className="rounded-lg border border-sky-500/30 bg-sky-50/50 dark:bg-sky-900/10 p-4">
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Note:</strong> The licensing
                regime highlights why many buyers prefer China+1 redundancy.
                Gallois shipments add a Madagascar-origin lane with standard
                Malagasy export documentation and the buyer&apos;s import clearance.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="border-t border-border" />

      {/* ── Section 2: Critical-Mineral Map ── */}
      <section className="mx-auto max-w-3xl px-6 py-16 space-y-5">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-sky-50 dark:bg-sky-900/20 p-3 shrink-0">
            <MapIcon className="size-6 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="space-y-4 w-full">
            <h2 className="text-2xl font-semibold">
              2 — The critical-mineral map
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Graphite is now a designated critical mineral in every major
              industrialised economy. This drives procurement policy, incentive
              eligibility, and in some cases mandatory supply-chain audits for
              downstream manufacturers.
            </p>
            <div className="space-y-3">
              {CRITICAL_LISTS.map((item) => (
                <div
                  key={item.region}
                  className="rounded-lg border border-border bg-card p-4 space-y-1"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-semibold text-sm text-foreground">
                      {item.region}
                    </p>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {item.instrument}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.note}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="border-t border-border" />

      {/* ── Section 3: Why Madagascar ── */}
      <section className="mx-auto max-w-3xl px-6 py-16 space-y-5">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-sky-50 dark:bg-sky-900/20 p-3 shrink-0">
            <MapPinIcon className="size-6 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="space-y-4 w-full">
            <h2 className="text-2xl font-semibold">3 — Why Madagascar</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {MADAGASCAR_ADVANTAGES.map((a) => (
                <div
                  key={a.title}
                  className="rounded-lg border border-border bg-card p-4 space-y-1.5"
                >
                  <p className="font-semibold text-sm text-foreground">
                    {a.title}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {a.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="border-t border-border" />

      {/* ── Section 4: Why Gallois ── */}
      <section className="mx-auto max-w-3xl px-6 py-16 space-y-5">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-sky-50 dark:bg-sky-900/20 p-3 shrink-0">
            <BuildingIcon className="size-6 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold">4 — Why Gallois specifically</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Etablissements Gallois is not a junior miner. Operating since 1901
              and scaled to 140,000 tonnes annual capacity under Graphite Energy
              Inc., it represents established infrastructure with a documented
              track record — the kind of supplier that passes procurement audits,
              not just spot enquiries.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>
                <strong className="text-foreground">
                  Major China+1 natural flake graphite source
                </strong>{" "}
                by reported capacity (140,000 t/a across two active sites)
              </li>
              <li>
                <strong className="text-foreground">Same metallurgy</strong> as
                Heilongjiang and Inner Mongolia benchmarks — crystalline flake
                with high carbon purity, suitable for the same downstream
                processing routes
              </li>
              <li>
                <strong className="text-foreground">Documented buyer roster</strong>{" "}
                including Vesuvius, SGL Carbon, RHI Magnesita, Morgan Advanced
                Materials, and Superior Graphite
              </li>
              <li>
                <strong className="text-foreground">
                  AI-assisted spec matching
                </strong>{" "}
                — our platform can map your current reference grade against Mada
                Graphite grades and flag potential equivalence or required
                adjustment for technical review
              </li>
            </ul>
            <p className="text-xs text-muted-foreground/70 border-l-2 border-sky-500/30 pl-3">
              Policy and tariff statements are informational only and should be
              reviewed by the buyer&apos;s customs, sanctions, and export-control
              counsel before shipment.
            </p>
          </div>
        </div>
      </section>

      <div className="border-t border-border" />

      {/* ── Section 5: What we offer ── */}
      <section className="mx-auto max-w-3xl px-6 py-16 space-y-5">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-sky-50 dark:bg-sky-900/20 p-3 shrink-0">
            <PackageCheckIcon className="size-6 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">
              5 — What we offer buyers re-mapping their supply
            </h2>
            <ul className="space-y-3">
              {WHAT_WE_OFFER.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm text-muted-foreground"
                >
                  <span className="mt-1.5 size-1.5 rounded-full bg-sky-500 dark:bg-sky-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="border-t border-border" />

      {/* ── Section 6: Honest risks ── */}
      <section className="mx-auto max-w-3xl px-6 py-16 space-y-5">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 shrink-0">
            <AlertCircleIcon className="size-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="space-y-4 w-full">
            <h2 className="text-2xl font-semibold">
              6 — Honest risks (and mitigations)
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              We believe credible sourcing narratives require naming real risks,
              not just listing advantages.
            </p>
            <div className="space-y-3">
              {HONEST_RISKS.map((item) => (
                <div
                  key={item.risk}
                  className="rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-900/10 p-4 space-y-1.5"
                >
                  <p className="font-semibold text-sm text-foreground">
                    ⚠ {item.risk}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {item.mitigation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-3xl px-6 py-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <p className="font-semibold text-foreground">
              Ready to diversify your graphite supply?
            </p>
            <p className="text-sm text-muted-foreground">
              Register for a trading account to access long-term supply
              agreements, KYC documentation, and AI-assisted spec matching.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link
              href="/register"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Open an account
            </Link>
            <Link
              href="/products"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              View product grades
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
