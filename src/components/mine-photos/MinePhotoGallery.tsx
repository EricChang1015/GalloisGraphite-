"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useLocale } from "next-intl";

import {
  MinePhotoLightbox,
  type LightboxLabels,
  type LightboxPhoto,
} from "@/components/mine-photos/MinePhotoLightbox";
import { cn } from "@/lib/utils";
import {
  resolveCategoryCoverUrl,
  type MinePhotoCategoryWithPhotos,
} from "@/lib/mine-photos/types";

type Props = {
  categories: MinePhotoCategoryWithPhotos[];
  initialSlug?: string;
  labels: {
    noPhotos: string;
    lightbox: LightboxLabels;
  };
};

function categoryTitle(
  cat: MinePhotoCategoryWithPhotos,
  locale: string
): string {
  return locale === "zh-CN" && cat.title_zh_cn ? cat.title_zh_cn : cat.title_en;
}

function photoAlt(
  photo: MinePhotoCategoryWithPhotos["photos"][number],
  locale: string,
  fallback: string
): string {
  if (locale === "zh-CN" && photo.alt_zh_cn) return photo.alt_zh_cn;
  if (photo.alt_en) return photo.alt_en;
  return fallback;
}

export function MinePhotoGallery({ categories, initialSlug, labels }: Props) {
  const locale = useLocale();
  const defaultSlug = initialSlug ?? categories[0]?.slug ?? "";
  const [activeSlug, setActiveSlug] = useState(defaultSlug);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const activeCategory = useMemo(
    () => categories.find((c) => c.slug === activeSlug) ?? categories[0],
    [categories, activeSlug]
  );

  const lightboxPhotos: LightboxPhoto[] = useMemo(() => {
    if (!activeCategory) return [];
    const title = categoryTitle(activeCategory, locale);
    return activeCategory.photos.map((p) => ({
      id: p.id,
      thumb_url: p.thumb_url,
      full_url: p.full_url,
      alt: photoAlt(p, locale, title),
    }));
  }, [activeCategory, locale]);

  if (!categories.length) {
    return (
      <p className="text-center text-sm text-muted-foreground py-16">
        {labels.noPhotos}
      </p>
    );
  }

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {categories.map((cat) => {
          const title = categoryTitle(cat, locale);
          const cover = resolveCategoryCoverUrl(cat, cat.photos);
          if (!cover) return null;
          const isActive = cat.slug === activeCategory?.slug;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveSlug(cat.slug)}
              className={cn(
                "group relative overflow-hidden rounded-lg border aspect-[4/3] text-left transition-all",
                isActive
                  ? "border-[color:var(--gold)] ring-2 ring-[color:var(--gold)]/40"
                  : "border-border hover:border-[color:var(--gold)]/50"
              )}
            >
              <Image
                src={cover}
                alt={title}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
              <p className="absolute bottom-2 left-2 right-2 text-xs text-white leading-tight">
                {title}
              </p>
              {cat.photos.length > 0 && (
                <span className="absolute top-2 right-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                  {cat.photos.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeCategory && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-[color:var(--gold)]">
            {categoryTitle(activeCategory, locale)}
          </h2>
          {activeCategory.photos.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.noPhotos}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {activeCategory.photos.map((photo, idx) => {
                const alt = photoAlt(
                  photo,
                  locale,
                  categoryTitle(activeCategory, locale)
                );
                return (
                  <button
                    key={photo.id}
                    type="button"
                    className="group relative aspect-[4/3] overflow-hidden rounded-md border border-border hover:border-[color:var(--gold)]/50"
                    onClick={() => {
                      setLightboxIndex(idx);
                      setLightboxOpen(true);
                    }}
                  >
                    <Image
                      src={photo.thumb_url}
                      alt={alt}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      unoptimized
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <MinePhotoLightbox
        photos={lightboxPhotos}
        activeIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        onIndexChange={setLightboxIndex}
        labels={labels.lightbox}
      />
    </div>
  );
}
