"use client";

import { useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type LightboxPhoto = {
  id: string;
  thumb_url: string;
  full_url: string;
  alt: string;
};

type Props = {
  photos: LightboxPhoto[];
  activeIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIndexChange: (index: number) => void;
};

export function MinePhotoLightbox({
  photos,
  activeIndex,
  open,
  onOpenChange,
  onIndexChange,
}: Props) {
  const photo = photos[activeIndex];
  const hasPrev = activeIndex > 0;
  const hasNext = activeIndex < photos.length - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) onIndexChange(activeIndex - 1);
  }, [activeIndex, hasPrev, onIndexChange]);

  const goNext = useCallback(() => {
    if (hasNext) onIndexChange(activeIndex + 1);
  }, [activeIndex, hasNext, onIndexChange]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, goPrev, goNext]);

  if (!photo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl border-none bg-black/90 p-2 shadow-none ring-0 sm:p-4"
        showCloseButton
      >
        <DialogTitle className="sr-only">{photo.alt || "Mining site photo"}</DialogTitle>
        <div className="relative flex min-h-[min(70vh,600px)] items-center justify-center">
          {hasPrev && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute left-0 z-10 text-white hover:bg-white/10"
              onClick={goPrev}
              aria-label="Previous photo"
            >
              <ChevronLeft className="size-6" />
            </Button>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.full_url}
            alt={photo.alt}
            className="mx-auto max-h-[min(75vh,720px)] w-auto max-w-full object-contain"
          />
          {hasNext && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 z-10 text-white hover:bg-white/10"
              onClick={goNext}
              aria-label="Next photo"
            >
              <ChevronRight className="size-6" />
            </Button>
          )}
        </div>
        <p
          className={cn(
            "text-center text-xs text-white/70",
            photos.length > 1 ? "block" : "hidden"
          )}
        >
          {activeIndex + 1} / {photos.length}
        </p>
      </DialogContent>
    </Dialog>
  );
}
