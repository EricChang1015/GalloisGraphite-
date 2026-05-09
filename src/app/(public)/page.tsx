import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HeroNarrative } from "@/components/home/HeroNarrative";
import { GeopoliticsSection } from "@/components/home/GeopoliticsSection";
import { SustainabilitySection } from "@/components/home/SustainabilitySection";

const STATS = [
  { value: "1901", label: "Year Founded" },
  { value: "120+", label: "Years of Production" },
  { value: "240M t", label: "Estimated Reserves" },
  { value: "140,000 t", label: "Reported Capacity" },
];

const PRODUCTS = [
  {
    name: "MADA1",
    description:
      "Natural flake graphite feedstock for downstream spheroidization, purification, expandable graphite, high-purity graphite, aerospace & military.",
    href: "/products",
  },
  {
    name: "MADA2",
    description:
      "Industrial flake for refractories, metallurgy, crucibles, and feedstock for high-purity production.",
    href: "/products",
  },
  {
    name: "Custom Grades",
    description:
      "80–99% fixed carbon, +32 to −100 mesh. Tailored to your application and volume requirements.",
    href: "/products",
  },
];

const APPLICATIONS = [
  "Li-ion Battery Anodes",
  "Expandable Graphite",
  "High-Purity Graphite",
  "Refractories",
  "Metallurgy & Crucibles",
  "Sealing Materials",
  "Military & Aerospace",
  "Man-made Diamond",
];

const PARTNERS = [
  {
    name: "Vesuvius",
    href: "https://www.vesuvius.com/en/index.html",
    logo: "/images/partners/vesuvius.svg",
  },
  {
    name: "AMG Graphite GK",
    href: "https://www.maaxlubritech.com/amg-graphite-gk/",
    logo: "/images/partners/amg-graphite-gk.png",
  },
  {
    name: "Asbury",
    href: "https://www.asbury.com/",
    logo: "/images/partners/asbury.svg",
  },
  {
    name: "Minchem Impex",
    href: "https://minchem.in/",
    logo: "/images/partners/minchem-impex.png",
  },
  {
    name: "SGL Carbon",
    href: "https://www.sglcarbon.com/",
    logo: "/images/partners/sgl-carbon.svg",
  },
  {
    name: "Krosaki Harima Corporation",
    href: "https://www.krosaki.co.jp/en",
    logo: "/images/partners/krosaki-harima.png",
  },
  {
    name: "RHI Magnesita",
    href: "https://www.rhimagnesita.com/",
    logo: "/images/partners/rhi-magnesita.svg",
  },
  {
    name: "Graphite Machining, Inc. (GMI)",
    href: "https://www.graphitemachininginc.com/",
    logo: "/images/partners/gmi.png",
  },
  {
    name: "Superior Graphite",
    href: "https://superiorgraphite.com/",
    logo: "/images/partners/superior-graphite.svg",
  },
  {
    name: "Morgan Advanced Materials",
    href: "https://www.morganadvancedmaterials.com/",
    logo: "/images/partners/morgan-advanced-materials.svg",
  },
  {
    name: "Carbon Graphite Materials, Inc. (CGM)",
    href: "https://www.cgmgraphite.com/",
    logo: "/images/partners/cgm.jpg",
  },
  {
    name: "Zircar Refractories Limited",
    href: "https://zircarrefractories.in/",
    logo: "/images/partners/zircar-refractories.png",
  },
  {
    name: "Aug. Gundlach KG (Mars-Tiegel)",
    href: "https://www.aug-gundlach.de/",
    logo: "/images/partners/aug-gundlach.jpg",
  },
  {
    name: "AGC PPL",
    href: "#",
    logo: "/images/partners/agc-ppl.png",
  },
  {
    name: "UNIMEX",
    href: "https://unimextr.com/",
    logo: "/images/partners/unimex.png",
  },
] as const;

export default function HomePage() {
  return (
    <>
      {/* ─── 1. Three-narrative hero ─── */}
      <HeroNarrative />

      {/* ─── 2. Key Stats ─── */}
      <section className="border-b border-border bg-card text-foreground">
        <div className="mx-auto max-w-5xl px-6 py-10 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {STATS.map((s) => (
            <div key={s.label} className="space-y-1">
              <p className="text-3xl sm:text-4xl font-bold text-[color:var(--gold)]">
                {s.value}
              </p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── 3. Mine Introduction ─── */}
      <section className="mx-auto max-w-5xl px-6 py-16 grid gap-10 md:grid-cols-2 items-center">
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">
            A Major Long-Operating Madagascar Graphite Operation
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Located in the Tamatave province of northeast Madagascar, the
            Gallois mine covers 280 km² of high-grade flake graphite deposit —
            with an average ore carbon content of ~10%, rare globally.
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Since taking over in 2016, Graphite Energy Inc. has driven annual
            production from under 5,000 tonnes toward a reported 140,000 t/a
            capacity across two active sites. A third site (Ambalafotaka) remains
            unexploited, and only 1% of the total area has been explored, with
            240 million tonnes of estimated reserves reported by prior geological
            review.
          </p>
          <Link
            href="/about"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-2")}
          >
            Learn more about the mine
          </Link>
        </div>
        <div className="rounded-xl overflow-hidden border border-border">
          <Image
            src="/images/legacy/map_a.png"
            alt="Madagascar graphite mine location"
            width={600}
            height={400}
            className="w-full object-contain bg-white p-4"
            unoptimized
          />
        </div>
      </section>

      {/* ─── 4. Geopolitics section ─── */}
      <GeopoliticsSection />

      {/* ─── 5. Products ─── */}
      <section className="bg-background border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-16 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">
              Our Products
            </h2>
            <p className="text-muted-foreground text-sm">
              Two brands, six standard grades, unlimited custom specs.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {PRODUCTS.map((p) => (
              <Link key={p.name} href={p.href}>
                <div className="rounded-xl border border-border bg-card p-6 space-y-3 h-full hover:border-[color:var(--gold)]/50 transition-colors cursor-pointer">
                  <h3 className="text-lg font-semibold text-[color:var(--gold)]">
                    {p.name}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {p.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
          <div className="text-center">
            <Link href="/products" className={cn(buttonVariants({ size: "sm" }))}>
              View full product catalogue
            </Link>
          </div>
        </div>
      </section>

      {/* ─── 6. Sustainability section ─── */}
      <SustainabilitySection />

      {/* ─── 7. Applications ─── */}
      <section className="border-t border-border mx-auto max-w-5xl px-6 py-16 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">
            Applications
          </h2>
          <p className="text-muted-foreground text-sm">
            Gallois graphite serves every major segment of the global carbon
            industry.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {APPLICATIONS.map((app) => (
            <span
              key={app}
              className="rounded-full border border-border bg-muted px-4 py-2 text-sm text-foreground/90"
            >
              {app}
            </span>
          ))}
        </div>
      </section>

      {/* ─── 8. Partners ─── */}
      <section className="bg-card border-y border-border">
        <div className="mx-auto max-w-5xl px-6 py-16 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">
              Partners in the world
            </h2>
            <p className="text-muted-foreground text-sm">
              Historical commercial relationships across the global graphite and
              refractory supply chain.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {PARTNERS.map((partner) => {
              const card = (
                <div className="h-full rounded-xl border border-border bg-background p-4 hover:border-[color:var(--gold)]/50 transition-colors">
                  <div className="relative h-12 w-full">
                    <Image
                      src={partner.logo}
                      alt={`${partner.name} logo`}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                  <p className="mt-3 text-center text-xs text-foreground/85 leading-snug">
                    {partner.name}
                  </p>
                </div>
              );

              if (partner.href === "#") {
                return <div key={partner.name}>{card}</div>;
              }

              return (
                <Link
                  key={partner.name}
                  href={partner.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Visit ${partner.name} website`}
                >
                  {card}
                </Link>
              );
            })}
          </div>
          <p className="text-center text-xs text-muted-foreground/70">
            Logos identify historical commercial relationships or public company
            references only; they do not imply endorsement unless expressly
            stated.
          </p>
        </div>
      </section>

      {/* ─── 9. AI Assistant CTA ─── */}
      <section className="bg-background border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">
            Not sure what grade you need?
          </h2>
          <p className="text-muted-foreground text-sm max-w-xl mx-auto">
            Our AI assistant can help you find the right product for your
            application, answer technical questions, and guide you through the
            inquiry process — no account required.
          </p>
          <div className="flex flex-wrap gap-3 justify-center pt-2">
            <Link href="/chat" className={cn(buttonVariants({ size: "lg" }))}>
              Ask the AI assistant
            </Link>
            <Link
              href="/register"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              Start trading
            </Link>
          </div>
        </div>
      </section>

      {/* ─── 10. Mine photos strip ─── */}
      <section className="border-t border-border overflow-hidden">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="relative flex-1 aspect-[3/2] min-w-0">
              <Image
                src={`/images/legacy/mining/header/${n}.jpg`}
                alt={`Mine site photo ${n}`}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
