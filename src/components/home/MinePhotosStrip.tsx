import Image from "next/image";
import { getTranslations } from "next-intl/server";
import {
  getPublishedMinePhotoGallery,
  resolveCategoryCoverUrl,
} from "@/lib/mine-photos/queries";
import { cn } from "@/lib/utils";

/**
 * Edge-to-edge mine photo strip. Cover images from mine-photos CMS only.
 */
export async function MinePhotosStrip({ className }: { className?: string }) {
  const t = await getTranslations("home");
  const gallery = await getPublishedMinePhotoGallery();
  const altItems = t.raw("photos") as Array<{ alt: string }>;

  const photos = altItems.flatMap((photo, index) => {
    const category = gallery[index];
    const src = category
      ? resolveCategoryCoverUrl(category, category.photos)
      : null;
    if (!src) return [];
    return [{ ...photo, src, key: category.id }];
  });

  if (!photos.length) return null;

  return (
    <section
      className={cn(
        "relative overflow-hidden border-y border-border bg-background",
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-background to-transparent z-10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background to-transparent z-10"
      />

      <div className="flex">
        {photos.map((p, i) => (
          <div
            key={p.key}
            className="group relative aspect-[3/2] flex-1 min-w-0 overflow-hidden"
          >
            <Image
              src={p.src}
              alt={p.alt}
              fill
              className="object-cover saturate-[0.55] transition-all duration-700 group-hover:saturate-100 group-hover:scale-105"
              unoptimized
              sizes="(max-width: 640px) 50vw, 17vw"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-background/30 transition-opacity duration-500 group-hover:opacity-0"
            />
            <p
              className={cn(
                "pointer-events-none absolute bottom-3 left-3 z-10 font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/80",
                "translate-y-2 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100"
              )}
            >
              {String(i + 1).padStart(2, "0")} · {p.alt}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
