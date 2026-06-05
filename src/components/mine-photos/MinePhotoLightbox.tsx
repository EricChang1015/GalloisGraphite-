"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type LightboxPhoto = {
  id: string;
  thumb_url: string;
  full_url: string;
  alt: string;
};

export type LightboxLabels = {
  close: string;
  previous: string;
  next: string;
  zoomIn: string;
  zoomOut: string;
  zoomReset: string;
  zoomHint: string;
};

type Props = {
  photos: LightboxPhoto[];
  activeIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIndexChange: (index: number) => void;
  labels: LightboxLabels;
};

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const ZOOM_STEP = 0.35;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function touchDistance(
  a: { clientX: number; clientY: number },
  b: { clientX: number; clientY: number }
) {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

export function MinePhotoLightbox({
  photos,
  activeIndex,
  open,
  onOpenChange,
  onIndexChange,
  labels,
}: Props) {
  const photo = photos[activeIndex];
  const hasPrev = activeIndex > 0;
  const hasNext = activeIndex < photos.length - 1;

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const stageRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);

  const resetView = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const close = useCallback(() => {
    resetView();
    onOpenChange(false);
  }, [onOpenChange, resetView]);

  const goPrev = useCallback(() => {
    if (hasPrev) onIndexChange(activeIndex - 1);
  }, [activeIndex, hasPrev, onIndexChange]);

  const goNext = useCallback(() => {
    if (hasNext) onIndexChange(activeIndex + 1);
  }, [activeIndex, hasNext, onIndexChange]);

  const zoomBy = useCallback((delta: number) => {
    setScale((s) => {
      const next = clamp(Number((s + delta).toFixed(2)), MIN_SCALE, MAX_SCALE);
      if (next <= 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    resetView();
  }, [activeIndex, open, resetView]);

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const meta = document.querySelector('meta[name="viewport"]');
    const prevViewport = meta?.getAttribute("content") ?? null;
    if (meta) {
      meta.setAttribute(
        "content",
        "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
      );
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "+" || e.key === "=") zoomBy(ZOOM_STEP);
      if (e.key === "-") zoomBy(-ZOOM_STEP);
      if (e.key === "0") resetView();
    };
    window.addEventListener("keydown", onKey);

    const stage = stageRef.current;
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinchRef.current) return;
      e.preventDefault();
      const dist = touchDistance(e.touches[0]!, e.touches[1]!);
      const ratio = dist / pinchRef.current.dist;
      setScale(
        clamp(Number((pinchRef.current.scale * ratio).toFixed(2)), MIN_SCALE, MAX_SCALE)
      );
    };
    const onTouchEnd = () => {
      pinchRef.current = null;
    };
    stage?.addEventListener("touchmove", onTouchMove, { passive: false });
    stage?.addEventListener("touchend", onTouchEnd);
    stage?.addEventListener("touchcancel", onTouchEnd);

    return () => {
      document.body.style.overflow = prevOverflow;
      if (meta && prevViewport) meta.setAttribute("content", prevViewport);
      window.removeEventListener("keydown", onKey);
      stage?.removeEventListener("touchmove", onTouchMove);
      stage?.removeEventListener("touchend", onTouchEnd);
      stage?.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [open, close, goPrev, goNext, zoomBy, resetView]);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      zoomBy(delta);
    },
    [zoomBy]
  );

  const onDoubleClick = useCallback(() => {
    if (scale > 1) {
      resetView();
      return;
    }
    setScale(2);
  }, [scale, resetView]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (scale <= 1 || e.button !== 0) return;
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        baseX: offset.x,
        baseY: offset.y,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [offset.x, offset.y, scale]
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    setOffset({
      x: drag.baseX + (e.clientX - drag.startX),
      y: drag.baseY + (e.clientY - drag.startY),
    });
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (e.touches.length === 2) {
        pinchRef.current = {
          dist: touchDistance(e.touches[0]!, e.touches[1]!),
          scale,
        };
      }
    },
    [scale]
  );

  if (!open || !photo) return null;

  const zoomed = scale > 1;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black touch-none"
      role="dialog"
      aria-modal="true"
      aria-label={photo.alt || "Mining site photo"}
    >
      <div className="relative z-20 flex shrink-0 items-center justify-between gap-2 px-3 py-2 sm:px-4">
        <p className="min-w-0 truncate text-xs text-white/70 sm:text-sm">
          {photo.alt}
          {photos.length > 1 && (
            <span className="ml-2 text-white/50">
              {activeIndex + 1} / {photos.length}
            </span>
          )}
        </p>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-white hover:bg-white/10"
            onClick={() => zoomBy(-ZOOM_STEP)}
            aria-label={labels.zoomOut}
            disabled={scale <= MIN_SCALE}
          >
            <ZoomOut className="size-4" />
          </Button>
          <span className="w-10 text-center text-xs tabular-nums text-white/80">
            {Math.round(scale * 100)}%
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-white hover:bg-white/10"
            onClick={() => zoomBy(ZOOM_STEP)}
            aria-label={labels.zoomIn}
            disabled={scale >= MAX_SCALE}
          >
            <ZoomIn className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-white hover:bg-white/10"
            onClick={resetView}
            aria-label={labels.zoomReset}
            disabled={!zoomed}
          >
            <RotateCcw className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-white hover:bg-white/10"
            onClick={close}
            aria-label={labels.close}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div
        ref={stageRef}
        className={cn(
          "relative z-10 min-h-0 flex-1 w-full overflow-hidden",
          zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
        )}
        onWheel={onWheel}
        onDoubleClick={onDoubleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onTouchStart={onTouchStart}
      >
        {hasPrev && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute left-1 top-1/2 z-20 size-10 -translate-y-1/2 text-white hover:bg-white/10 sm:left-3 sm:size-12"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            aria-label={labels.previous}
          >
            <ChevronLeft className="size-7 sm:size-8" />
          </Button>
        )}

        <div
          className="flex h-full w-full items-center justify-center px-10 sm:px-14"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px)`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.full_url}
            alt={photo.alt}
            draggable={false}
            className="max-h-full max-w-full select-none object-contain"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "center center",
            }}
          />
        </div>

        {hasNext && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 z-20 size-10 -translate-y-1/2 text-white hover:bg-white/10 sm:right-3 sm:size-12"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            aria-label={labels.next}
          >
            <ChevronRight className="size-7 sm:size-8" />
          </Button>
        )}
      </div>

      <p className="relative z-20 shrink-0 px-4 pb-3 text-center text-[10px] text-white/50 sm:text-xs">
        {labels.zoomHint}
      </p>
    </div>
  );
}
