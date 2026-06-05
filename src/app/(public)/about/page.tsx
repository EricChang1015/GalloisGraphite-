import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { getLocale } from "@/i18n/get-locale";
import { getPublishedMinePhotoGallery } from "@/lib/mine-photos/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

const SECTION_IMAGES = [
  "/images/legacy/map_a.png",
  "/images/legacy/map_c.png",
  "/images/legacy/map_b.png",
];

const LEGACY_PHOTO_ITEMS = [
  { src: "/images/legacy/mining/header/1.jpg", slug: "general-view" },
  { src: "/images/legacy/mining/header/2.jpg", slug: "processing-plant" },
  { src: "/images/legacy/mining/header/3.jpg", slug: "warehouse-lab" },
  { src: "/images/legacy/mining/header/4.jpg", slug: "team-culture" },
  { src: "/images/legacy/mining/header/5.jpg", slug: "social-responsibility" },
  { src: "/images/legacy/mining/header/6.jpg", slug: "local-customs" },
];

export default async function AboutPage() {
  const t = await getTranslations("about");
  const locale = await getLocale();
  const stats = t.raw("stats") as Array<{ value: string; label: string }>;
  const sections = (t.raw("sections") as Array<{
    title: string;
    imageAlt: string;
    paragraphs: string[];
  }>).map((section, index) => ({
    ...section,
    image: SECTION_IMAGES[index] ?? SECTION_IMAGES[0],
  }));

  const gallery = await getPublishedMinePhotoGallery();
  const fallbackLabels = t.raw("photos.items") as Array<{
    src: string;
    label: string;
  }>;

  const photoCards =
    gallery.length > 0
      ? gallery.map((cat) => ({
          key: cat.id,
          href: `/mining-photos?category=${cat.slug}`,
          src:
            cat.cover_url ??
            cat.photos[0]?.thumb_url ??
            LEGACY_PHOTO_ITEMS.find((l) => l.slug === cat.slug)?.src ??
            LEGACY_PHOTO_ITEMS[0].src,
          label:
            locale === "zh-CN" && cat.title_zh_cn
              ? cat.title_zh_cn
              : cat.title_en,
        }))
      : fallbackLabels.map((photo, index) => ({
          key: photo.src,
          href: `/mining-photos?category=${LEGACY_PHOTO_ITEMS[index]?.slug ?? "general-view"}`,
          src: photo.src,
          label: photo.label,
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
          {t("hero.bodyBefore")}{" "}
          <span className="text-foreground">{t("hero.company")}</span>{" "}
          {t("hero.bodyAfter")}
        </p>
      </section>

      {/* Key stats */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-5xl px-6 py-10 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {stats.map((s) => (
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
      {sections.map((sec, idx) => (
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
              loading={idx === 0 ? "eager" : "lazy"}
              unoptimized
            />
          </div>
        </section>
      ))}

      {/* Mining photos teaser */}
      <section className="bg-card border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-16 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold">{t("photos.title")}</h2>
            <p className="text-muted-foreground text-sm">
              {t("photos.subtitle")}
            </p>
            <Link
              href="/mining-photos"
              className="inline-block text-sm text-[color:var(--gold)] hover:underline"
            >
              {t("photos.viewAll")}
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {photoCards.map((photo) => (
              <Link
                key={photo.key}
                href={photo.href}
                className="group relative overflow-hidden rounded-lg border border-border aspect-[4/3]"
              >
                <Image
                  src={photo.src}
                  alt={photo.label}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <p className="absolute bottom-2 left-2 right-2 text-xs text-white leading-tight">
                  {photo.label}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
