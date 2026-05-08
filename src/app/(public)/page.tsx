import Link from "next/link";
import Image from "next/image";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATS = [
  { value: "1901", label: "Year Founded" },
  { value: "120+", label: "Years of Production" },
  { value: "240M t", label: "Graphite Reserves" },
  { value: "140,000 t", label: "Annual Capacity" },
];

const PRODUCTS = [
  {
    name: "MADA1",
    description:
      "Spherical graphite (Li-ion battery anode), expandable graphite, high-purity graphite, aerospace & military.",
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

export default function HomePage() {
  return (
    <>
      {/* ─── Hero ─── */}
      <section className="relative bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-800 text-neutral-100 overflow-hidden">
        <div className="mx-auto max-w-5xl px-6 py-24 sm:py-36 text-center space-y-6">
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

      {/* ─── Key Stats ─── */}
      <section className="border-y border-neutral-800 bg-neutral-900 text-neutral-100">
        <div className="mx-auto max-w-5xl px-6 py-10 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {STATS.map((s) => (
            <div key={s.label} className="space-y-1">
              <p className="text-3xl sm:text-4xl font-bold text-[color:var(--gold)]">
                {s.value}
              </p>
              <p className="text-xs text-neutral-400 uppercase tracking-wider">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Mine Introduction ─── */}
      <section className="mx-auto max-w-5xl px-6 py-16 grid gap-10 md:grid-cols-2 items-center">
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-neutral-100">
            The World&apos;s Most Productive Graphite Mine
          </h2>
          <p className="text-neutral-400 text-sm leading-relaxed">
            Located in the Tamatave province of northeast Madagascar, the
            Gallois mine covers 280 km² of high-grade flake graphite deposit —
            with an average ore carbon content of ~10%, rare globally.
          </p>
          <p className="text-neutral-400 text-sm leading-relaxed">
            Since taking over in 2016, Graphite Energy Inc. has driven annual
            production from under 5,000 tonnes to over 140,000 tonnes across two
            active sites. A third site (Ambalafotaka) remains unexploited, and
            only 1% of the total area has been explored, with 240 million tonnes
            of estimated reserves.
          </p>
          <Link
            href="/about"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "mt-2 border-neutral-600 text-neutral-200 hover:bg-neutral-800"
            )}
          >
            Learn more about the mine
          </Link>
        </div>
        <div className="rounded-xl overflow-hidden border border-neutral-800">
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

      {/* ─── Products ─── */}
      <section className="bg-neutral-900 border-t border-neutral-800">
        <div className="mx-auto max-w-5xl px-6 py-16 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold text-neutral-100">
              Our Products
            </h2>
            <p className="text-neutral-400 text-sm">
              Two brands, six standard grades, unlimited custom specs.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {PRODUCTS.map((p) => (
              <Link key={p.name} href={p.href}>
                <div className="rounded-xl border border-neutral-700 bg-neutral-800/50 p-6 space-y-3 h-full hover:border-[color:var(--gold)]/50 transition-colors cursor-pointer">
                  <h3 className="text-lg font-semibold text-[color:var(--gold)]">
                    {p.name}
                  </h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    {p.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
          <div className="text-center">
            <Link
              href="/products"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              View full product catalogue
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Applications ─── */}
      <section className="mx-auto max-w-5xl px-6 py-16 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold text-neutral-100">
            Applications
          </h2>
          <p className="text-neutral-400 text-sm">
            Gallois graphite serves every major segment of the global carbon
            industry.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {APPLICATIONS.map((app) => (
            <span
              key={app}
              className="rounded-full border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-neutral-300"
            >
              {app}
            </span>
          ))}
        </div>
      </section>

      {/* ─── AI Assistant CTA ─── */}
      <section className="bg-neutral-900 border-t border-neutral-800">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center space-y-4">
          <h2 className="text-2xl font-semibold text-neutral-100">
            Not sure what grade you need?
          </h2>
          <p className="text-neutral-400 text-sm max-w-xl mx-auto">
            Our AI assistant can help you find the right product for your
            application, answer technical questions, and guide you through the
            inquiry process.
          </p>
          <div className="flex flex-wrap gap-3 justify-center pt-2">
            <Link
              href="/chat"
              className={cn(buttonVariants({ size: "lg" }))}
            >
              Ask the AI assistant
            </Link>
            <Link
              href="/register"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "bg-transparent text-neutral-100 hover:bg-neutral-800 border-neutral-600"
              )}
            >
              Start trading
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Mine photos strip ─── */}
      <section className="border-t border-neutral-800 overflow-hidden">
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
