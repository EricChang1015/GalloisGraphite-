"use client";

/**
 * Minimal client gallery for the listing detail page. Hero image +
 * thumbnail strip; clicking a thumbnail swaps the hero. No lightbox /
 * keyboard navigation in this iteration — sellers typically attach
 * 1-3 photos and the page is already short.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

interface Props {
  images: string[];
  alt: string;
}

export function ListingGallery({ images, alt }: Props) {
  const t = useTranslations("listings.gallery");
  const [activeIdx, setActiveIdx] = useState(0);
  if (!images.length) return null;
  const active = images[Math.min(activeIdx, images.length - 1)];
  return (
    <div className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={active}
        alt={alt}
        className="w-full rounded-lg object-cover max-h-80 bg-muted"
      />
      {images.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {images.map((url, idx) => (
            <button
              key={url}
              type="button"
              onClick={() => setActiveIdx(idx)}
              className={cn(
                "size-16 rounded-md overflow-hidden border transition-all",
                idx === activeIdx
                  ? "border-primary ring-2 ring-primary"
                  : "border-border hover:border-primary/60"
              )}
              aria-label={t("showImage", { idx: idx + 1, total: images.length })}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
