import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("products");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

const BRAND_CHROME = [
  {
    logo: "/images/legacy/mada_logo_a.png",
    accentClass: "text-[color:var(--gold)]",
    borderClass: "border-[color:var(--gold)]/40",
    dotClass: "bg-[color:var(--gold)]",
  },
  {
    logo: "/images/legacy/mada_logo_b.png",
    accentClass: "text-sky-500 dark:text-sky-300 editorial:text-sky-700",
    borderClass:
      "border-sky-500/40 dark:border-sky-300/40 editorial:border-sky-700/40",
    dotClass: "bg-sky-500 dark:bg-sky-300 editorial:bg-sky-700",
  },
] as const;

const GRADES: { grade: string; fc: string; mesh: string }[] = [
  { grade: "+35 MESH", fc: "80–99%", mesh: "+35 MESH  80% MIN" },
  { grade: "+50 MESH", fc: "80–99%", mesh: "+50 MESH  80% MIN" },
  { grade: "+80 MESH", fc: "80–99%", mesh: "+80 MESH  80% MIN" },
  { grade: "+100 MESH", fc: "80–99%", mesh: "+100 MESH  80% MIN" },
  { grade: "+150 MESH", fc: "80–99%", mesh: "+150 MESH  80% MIN" },
  { grade: "−100 MESH", fc: "80–99%", mesh: "−100 MESH  80% MIN" },
];

export default async function ProductsPage() {
  const t = await getTranslations("products");
  const brands = (t.raw("brands") as Array<{
    name: string;
    subtitle: string;
    description: string;
    applications: string[];
  }>).map((brand, index) => ({
    ...brand,
    ...(BRAND_CHROME[index] ?? BRAND_CHROME[0]),
  }));

  return (
    <div className="bg-background text-foreground">
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 py-20 text-center space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--gold)]">
          {t("hero.eyebrow")}
        </p>
        <h1 className="text-4xl sm:text-5xl font-semibold leading-tight">
          {t("hero.title")}
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto text-base sm:text-lg">
          {t("hero.body")}
        </p>
      </section>

      {/* Brand cards */}
      <section className="mx-auto max-w-5xl px-6 pb-16 grid gap-8 md:grid-cols-2">
        {brands.map((brand) => (
          <div
            key={brand.name}
            className={cn(
              "rounded-xl border bg-card p-6 space-y-5",
              brand.borderClass
            )}
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
                <h2 className={cn("text-2xl font-bold", brand.accentClass)}>
                  {brand.name}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {brand.subtitle}
                </p>
              </div>
            </div>
            <p className="text-foreground/85 text-sm leading-relaxed">
              {brand.description}
            </p>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                {t("applicationsLabel")}
              </p>
              <ul className="space-y-1">
                {brand.applications.map((app) => (
                  <li
                    key={app}
                    className="flex items-center gap-2 text-sm text-foreground/85"
                  >
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full flex-shrink-0",
                        brand.dotClass
                      )}
                    />
                    {app}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </section>

      {/* Spec table */}
      <section className="bg-card border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-16 space-y-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">
              {t("standardGrades.title")}
            </h2>
            <p className="text-muted-foreground text-sm">
              {t("standardGrades.introBefore")}{" "}
              <span className="text-[color:var(--gold)]">
                {t("standardGrades.moisture")}
              </span>{" "}
              {t("standardGrades.introAfter")}
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted text-foreground">
                  <th className="px-4 py-3 text-left font-semibold">
                    {t("standardGrades.headers.grade")}
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    {t("standardGrades.headers.fixedCarbon")}
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    {t("standardGrades.headers.size")}
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    {t("standardGrades.headers.moisture")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {GRADES.map((g, idx) => (
                  <tr
                    key={g.grade}
                    className={cn(
                      "border-t border-border",
                      idx % 2 === 0 ? "bg-card" : "bg-muted/40"
                    )}
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-[color:var(--gold)]">
                      {g.grade}
                    </td>
                    <td className="px-4 py-3 text-foreground">{g.fc}</td>
                    <td className="px-4 py-3 text-foreground/85 font-mono text-xs">
                      {g.mesh}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      0.5% MAX
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-border bg-muted/20">
                  <td
                    colSpan={4}
                    className="px-4 py-3 text-xs text-muted-foreground italic"
                  >
                    {t("standardGrades.footnote")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/8 p-5 space-y-3">
            <h3 className="font-semibold text-[color:var(--gold)]">
              {t("custom.title")}
            </h3>
            <p className="text-sm text-foreground/90">
              {t.rich("custom.body", {
                strong: (chunks) => (
                  <strong className="text-foreground">{chunks}</strong>
                ),
                mono: (chunks) => (
                  <strong className="text-foreground font-mono">{chunks}</strong>
                ),
              })}
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link
                href="/register"
                className={cn(buttonVariants({ size: "sm" }))}
              >
                {t("custom.openAccount")}
              </Link>
              <Link
                href="/chat"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" })
                )}
              >
                {t("custom.askAi")}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
