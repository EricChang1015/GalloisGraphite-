import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Products — Mada Graphite",
  description:
    "MADA1 and MADA2 natural flake graphite. Carbon content 75–99%, mesh sizes +35 to -100. Custom specs available.",
};

const BRANDS = [
  {
    name: "MADA1",
    logo: "/images/legacy/mada_logo_a.png",
    subtitle: "Premium grade — No.1 mine (Antsirakambo)",
    description:
      "MADA1 graphite has a perfect crystalline structure, high density, and in ash a very low content of substances unfavourable for purification. It is the first choice for high-technology applications.",
    applications: [
      "Spherical graphite for Li-ion battery anodes",
      "Expandable graphite (fire-proofing / intumescent)",
      "High-purity graphite",
      "Military & aerospace graphite",
      "Man-made diamond feedstock",
      "Advanced refractories",
    ],
    accent: "text-[color:var(--gold)]",
    border: "border-[color:var(--gold)]/30",
  },
  {
    name: "MADA2",
    logo: "/images/legacy/mada_logo_b.png",
    subtitle: "Industrial grade — No.2 mine (Marovintsy)",
    description:
      "MADA2 is a robust industrial-grade flake graphite well-suited for high-volume commodity applications with broad and proven track record across metallurgy and refractory sectors.",
    applications: [
      "Metallurgy",
      "Refractories",
      "Crucibles",
      "High-purity graphite feedstock",
      "Sealing materials",
      "Brake pads & pencils",
    ],
    accent: "text-blue-400",
    border: "border-blue-400/30",
  },
];

const GRADES: { grade: string; fc: string; mesh: string }[] = [
  { grade: "+35 MESH", fc: "75–99%", mesh: "+35 MESH  80% MIN" },
  { grade: "+50 MESH", fc: "75–99%", mesh: "+50 MESH  80% MIN" },
  { grade: "+80 MESH", fc: "75–99%", mesh: "+80 MESH  80% MIN" },
  { grade: "+100 MESH", fc: "75–99%", mesh: "+100 MESH  80% MIN" },
  { grade: "+150 MESH", fc: "75–99%", mesh: "+150 MESH  80% MIN" },
  { grade: "−100 MESH", fc: "75–99%", mesh: "−100 MESH  80% MIN" },
];

export default function ProductsPage() {
  return (
    <div className="bg-neutral-950 text-neutral-100">
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 py-20 text-center space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--gold)]">
          Natural Flake Graphite · Madagascar
        </p>
        <h1 className="text-4xl sm:text-5xl font-semibold leading-tight">
          Product Catalogue
        </h1>
        <p className="text-neutral-400 max-w-2xl mx-auto text-base sm:text-lg">
          Etablissements Gallois S.A. supplies natural flake graphite with fixed
          carbon ranging from 80% to 99%, flake sizes +32 to −100 mesh.
          Custom specifications available on request.
        </p>
      </section>

      {/* Brand cards */}
      <section className="mx-auto max-w-5xl px-6 pb-16 grid gap-8 md:grid-cols-2">
        {BRANDS.map((brand) => (
          <div
            key={brand.name}
            className={`rounded-xl border ${brand.border} bg-neutral-900 p-6 space-y-5`}
          >
            <div className="flex items-center gap-4">
              <div className="w-24 h-16 relative flex-shrink-0 bg-white rounded-lg overflow-hidden">
                <Image
                  src={brand.logo}
                  alt={`${brand.name} logo`}
                  fill
                  className="object-contain p-2"
                  unoptimized
                />
              </div>
              <div>
                <h2 className={`text-2xl font-bold ${brand.accent}`}>
                  {brand.name}
                </h2>
                <p className="text-xs text-neutral-400">{brand.subtitle}</p>
              </div>
            </div>
            <p className="text-neutral-300 text-sm leading-relaxed">
              {brand.description}
            </p>
            <div>
              <p className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
                Key Applications
              </p>
              <ul className="space-y-1">
                {brand.applications.map((app) => (
                  <li
                    key={app}
                    className="flex items-center gap-2 text-sm text-neutral-300"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${brand.accent} bg-current flex-shrink-0`} />
                    {app}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </section>

      {/* Spec table */}
      <section className="bg-neutral-900 border-t border-neutral-800">
        <div className="mx-auto max-w-5xl px-6 py-16 space-y-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">Standard Grades</h2>
            <p className="text-neutral-400 text-sm">
              All grades available in MADA1 and MADA2.{" "}
              <span className="text-[color:var(--gold)]">
                Moisture: 0.5% MAX
              </span>{" "}
              for all grades.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-neutral-700">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-neutral-800 text-neutral-300">
                  <th className="px-4 py-3 text-left font-semibold">Grade</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Fixed Carbon
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Size (min. retained)
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Moisture
                  </th>
                </tr>
              </thead>
              <tbody>
                {GRADES.map((g, idx) => (
                  <tr
                    key={g.grade}
                    className={`border-t border-neutral-700 ${
                      idx % 2 === 0 ? "bg-neutral-900" : "bg-neutral-800/40"
                    }`}
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-[color:var(--gold)]">
                      {g.grade}
                    </td>
                    <td className="px-4 py-3 text-neutral-200">{g.fc}</td>
                    <td className="px-4 py-3 text-neutral-300 font-mono text-xs">
                      {g.mesh}
                    </td>
                    <td className="px-4 py-3 text-neutral-400">0.5% MAX</td>
                  </tr>
                ))}
                <tr className="border-t border-neutral-700 bg-neutral-800/20">
                  <td
                    colSpan={4}
                    className="px-4 py-3 text-xs text-neutral-400 italic"
                  >
                    In addition to the standard grades listed above,
                    Etablissements Gallois can match many specifications to meet
                    individual customer requirements.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-[color:var(--gold)]/20 bg-[color:var(--gold)]/5 p-5 space-y-3">
            <h3 className="font-semibold text-[color:var(--gold)]">
              Custom Specifications
            </h3>
            <p className="text-sm text-neutral-300">
              Carbon content ranges from{" "}
              <strong className="text-neutral-100">80% to 99%</strong>. Flake
              sizes available:{" "}
              <strong className="text-neutral-100 font-mono">
                +32 / +50 / +80 / +100 / +150 / −100 mesh
              </strong>
              . Contact our sales team for custom orders and technical
              consultation.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link
                href="/register"
                className={cn(buttonVariants({ size: "sm" }))}
              >
                Open a trading account
              </Link>
              <Link
                href="/chat"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "bg-transparent text-neutral-100 hover:bg-neutral-800 border-neutral-600"
                )}
              >
                Ask the AI assistant
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
