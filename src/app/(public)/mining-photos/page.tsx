import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { MinePhotoGallery } from "@/components/mine-photos/MinePhotoGallery";
import { getPublishedMinePhotoGallery } from "@/lib/mine-photos/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("miningPhotos");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function MiningPhotosPage({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string }>;
}) {
  const t = await getTranslations("miningPhotos");
  const params = (await searchParams) ?? {};
  const categories = await getPublishedMinePhotoGallery();

  return (
    <div className="bg-background text-foreground">
      <section className="mx-auto max-w-5xl px-6 py-16 space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--gold)]">
          {t("hero.eyebrow")}
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold">{t("hero.title")}</h1>
        <p className="text-muted-foreground text-sm max-w-2xl">{t("hero.body")}</p>
        <Link
          href="/about"
          className="inline-block text-sm text-[color:var(--gold)] hover:underline"
        >
          {t("backToAbout")}
        </Link>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <MinePhotoGallery
          categories={categories}
          initialSlug={params.category}
          labels={{
            noPhotos: t("noPhotos"),
            lightbox: {
              close: t("lightbox.close"),
              previous: t("lightbox.previous"),
              next: t("lightbox.next"),
              zoomIn: t("lightbox.zoomIn"),
              zoomOut: t("lightbox.zoomOut"),
              zoomReset: t("lightbox.zoomReset"),
              zoomHint: t("lightbox.zoomHint"),
            },
          }}
        />
      </section>
    </div>
  );
}
