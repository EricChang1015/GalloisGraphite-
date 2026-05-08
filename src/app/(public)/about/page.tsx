import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "About — Mada Graphite",
  description:
    "Graphite Energy Inc. is the exclusive sales agent of Etablissements Gallois S.A., operating the world's most productive natural flake graphite mine in Madagascar since 1901.",
};

const STATS = [
  { value: "120+", label: "Years of production" },
  { value: "280 km²", label: "Mine area" },
  { value: "240M t", label: "Estimated graphite reserves" },
  { value: "140,000 t", label: "Annual capacity (No.1 + No.2)" },
];

const SECTIONS = [
  {
    title: "History & Location",
    image: "/images/legacy/map_a.png",
    imageAlt: "Madagascar mine location map",
    paragraphs: [
      "The natural flake graphite mine of Etablissements Gallois S.A. is located in the northeast of Madagascar, in the province of Tamatave. The mining operation was created in 1901 by the Gallois family, who started to produce graphite exported to the United States and Europe.",
      "Along with successive global industrial revolutions, the Gallois mine has never stopped producing over the past 120 years. Because of its specificities and special quality, Gallois graphite has always been considered as a first choice by the global carbon industry.",
      "In 2016, the mine was taken over by a new operator who made significant investments to replace outdated production equipment with the most advanced technology. Annual production increased from less than 5,000 tons to 60,000 tons in 2017.",
      "The Gallois mine covers 280 square kilometres. The deposit is entirely formed by weathering. The average carbon content of the ore is around 10%, which is quite rare in the world. Open-cast mining makes operations easy and safe; the carbon content can be easily increased to a high level by simple flotation. A team of Australian geologists has already estimated 240 million tons of graphite reserves while less than 1% of the total area has been explored.",
      "Madagascar, an island country with a stable political environment, has a mild climate throughout the year (15–35 °C) and rich water resources — enabling uninterrupted year-round production.",
    ],
  },
  {
    title: "Three Mining Sites",
    image: "/images/legacy/map_c.png",
    imageAlt: "Three mining sites map",
    paragraphs: [
      "There are three major mining sites: No. 1 (Antsirakambo), No. 2 (Marovintsy), and No. 3 (Ambalafotaka). Currently only No. 1 and No. 2 are being exploited.",
      "Site No. 1 is designed for an annual production of ~80,000 tonnes; Site No. 2 for ~60,000 tonnes. Together, the Gallois mine will become the most productive flake graphite mine in the world.",
      "The strategic location makes logistics highly convenient — Site No. 1 is situated only 45 km from the international port of Tamatave.",
      "After renovation and upgrading, the mine is now entirely computer-managed. Samples are taken and data tracked throughout the production process to guarantee uniform and stable quality in every bag of final product. Whatever the quantity ordered, customised products can be supplied to meet specific customer requirements.",
      "Loaded in containers, graphite can be exported to any destination with a transit time ranging from 10 to 60 days.",
    ],
  },
  {
    title: "Global Reach",
    image: "/images/legacy/map_b.png",
    imageAlt: "Global customer distribution map",
    paragraphs: [
      "Gallois graphite is sold to Europe, USA, UK, China, Russia, Japan, South Korea, India, Turkey, Brazil, Mexico and other countries and regions — covering all areas of carbon applications.",
      "We market two brands, MADA1 and MADA2, named according to their origin. Since the mine went into operation, Gallois graphite has been broadly used in refractories, metallurgy, crucibles, sealing materials, brakes, pencils, and many more applications.",
      "MADA1 graphite has natural specialties and high quality beyond comparison: it has a perfect crystalline structure, high density and in ash a very low content of substances unfavourable for purification. It is especially well-suited for manufacturing spherical graphite for lithium batteries, expandable graphite, advanced refractories, man-made diamond and high-purity graphite for military and aerospace industry.",
      "With \"every flake real, the quality first\" at heart, the Gallois mine will carry on another 120 years of glory. Over the next five years, we will focus on upgrading our products by further involving science and technology — producing high-tech products alongside raw materials.",
    ],
  },
];

export default function AboutPage() {
  return (
    <div className="bg-background text-foreground">
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 py-20 text-center space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--gold)]">
          Established 1901 · Madagascar
        </p>
        <h1 className="text-4xl sm:text-5xl font-semibold leading-tight">
          About Mada Graphite
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto text-base sm:text-lg">
          Graphite Energy Inc. is the exclusive sales agent of{" "}
          <span className="text-foreground">Etablissements Gallois S.A.</span>{" "}
          — operator of the world&apos;s most productive natural flake graphite mine,
          in continuous production for over 120 years.
        </p>
      </section>

      {/* Key stats */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-5xl px-6 py-10 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {STATS.map((s) => (
            <div key={s.label} className="space-y-1">
              <p className="text-3xl font-bold text-[color:var(--gold)]">
                {s.value}
              </p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Content sections */}
      {SECTIONS.map((sec, idx) => (
        <section
          key={sec.title}
          className={`mx-auto max-w-5xl px-6 py-16 grid gap-10 md:grid-cols-2 items-start ${
            idx % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""
          }`}
        >
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-[color:var(--gold)]">
              {sec.title}
            </h2>
            <div className="space-y-3">
              {sec.paragraphs.map((p, i) => (
                <p
                  key={i}
                  className="text-foreground/85 text-sm leading-relaxed"
                >
                  {p}
                </p>
              ))}
            </div>
          </div>
          <div className="rounded-xl overflow-hidden border border-border">
            <Image
              src={sec.image}
              alt={sec.imageAlt}
              width={600}
              height={400}
              className="w-full object-contain bg-white p-4"
              unoptimized
            />
          </div>
        </section>
      ))}

      {/* Mining photos teaser */}
      <section className="bg-card border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-16 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold">Photos of Mining Sites</h2>
            <p className="text-muted-foreground text-sm">
              A look inside the Gallois mine operations in Madagascar.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              {
                src: "/images/legacy/mining/header/1.jpg",
                label: "General View of the Mine",
              },
              {
                src: "/images/legacy/mining/header/2.jpg",
                label: "Processing Plant",
              },
              {
                src: "/images/legacy/mining/header/3.jpg",
                label: "Final Products Warehouse + Lab",
              },
              {
                src: "/images/legacy/mining/header/4.jpg",
                label: "Our Team + Cultural Activities",
              },
              {
                src: "/images/legacy/mining/header/5.jpg",
                label: "Social Responsibilities",
              },
              {
                src: "/images/legacy/mining/header/6.jpg",
                label: "Local Customs and Practices",
              },
            ].map((photo) => (
              <div
                key={photo.src}
                className="group relative overflow-hidden rounded-lg border border-border aspect-[4/3]"
              >
                <Image
                  src={photo.src}
                  alt={photo.label}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  unoptimized
                />
                {/* Caption gradient: always darken bottom regardless of theme */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <p className="absolute bottom-2 left-2 right-2 text-xs text-white leading-tight">
                  {photo.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
