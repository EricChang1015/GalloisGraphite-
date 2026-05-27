"use client";

/**
 * Two-tab image manager used inside `<ListingForm />`:
 *
 *   ┌ Upload new  ─────────────────────────┐ ┌ From your library ─────────────┐
 *   │ drag-drop / click; compresses each   │ │ thumbnails of every previously │
 *   │ file to ≤ 720 px WebP before upload  │ │ uploaded listing image; click  │
 *   │ via uploadListingImage server action │ │ to toggle into the selection   │
 *   └──────────────────────────────────────┘ └────────────────────────────────┘
 *
 * Selected URLs are surfaced upward through `onChange(urls)`. Reorder +
 * remove handles live below the tabs.
 *
 * Images are optional — there's no validation for an empty selection.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  ImageIcon,
  Loader2Icon,
  TrashIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  UploadIcon,
  LibraryIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import {
  deleteListingImage,
  listMyListingImages,
  uploadListingImage,
} from "@/actions/listing-images";
import {
  compressTo720pWebp,
  formatBytes,
  type CompressResult,
} from "@/lib/images/compress";
import {
  LISTING_IMAGES_PER_LISTING,
  LISTING_IMAGE_CLIENT_ACCEPT,
  LISTING_IMAGE_RAW_MAX_BYTES,
} from "@/lib/listings/images";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ListingImageUploaderProps {
  value: string[];
  onChange: (urls: string[]) => void;
  maxImages?: number;
  /** Optional label override, e.g. "Profile photos" — used by other surfaces in future.
   *  When omitted, falls back to the translated default copy from listings.imageUploader. */
  emptyHint?: string;
}

type LibraryImage = {
  path: string;
  url: string;
  size: number;
  uploaded_at: string;
};

type UploadingItem = {
  id: string;
  name: string;
  status: "compressing" | "uploading" | "done" | "error";
  message?: string;
  before?: number;
  after?: number;
};

export function ListingImageUploader({
  value,
  onChange,
  maxImages = LISTING_IMAGES_PER_LISTING,
  emptyHint,
}: ListingImageUploaderProps) {
  const t = useTranslations("listings.imageUploader");
  const resolvedEmptyHint = emptyHint ?? t("emptyHint");
  const [tab, setTab] = useState<"upload" | "library">("upload");
  const [library, setLibrary] = useState<LibraryImage[]>([]);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [libraryPending, startLibrary] = useTransition();
  const [uploads, setUploads] = useState<UploadingItem[]>([]);
  const [dragHover, setDragHover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const remaining = Math.max(0, maxImages - value.length);
  const atCap = remaining === 0;

  // Lazy-load the library the first time the seller switches to that tab.
  const ensureLibrary = useCallback(() => {
    if (libraryLoaded) return;
    startLibrary(async () => {
      const result = await listMyListingImages();
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      setLibrary(result.data?.images ?? []);
      setLibraryLoaded(true);
    });
  }, [libraryLoaded]);

  useEffect(() => {
    if (tab === "library") ensureLibrary();
  }, [tab, ensureLibrary]);

  const refreshLibrary = useCallback(() => {
    setLibraryLoaded(false);
    if (tab === "library") ensureLibrary();
  }, [tab, ensureLibrary]);

  const addUrl = useCallback(
    (url: string) => {
      if (value.includes(url)) return; // already selected
      if (value.length >= maxImages) {
        toast.error(t("toast.limit", { max: maxImages }));
        return;
      }
      onChange([...value, url]);
    },
    [value, onChange, maxImages, t]
  );

  const removeAt = useCallback(
    (idx: number) => {
      const next = value.slice();
      next.splice(idx, 1);
      onChange(next);
    },
    [value, onChange]
  );

  const move = useCallback(
    (idx: number, dir: -1 | 1) => {
      const target = idx + dir;
      if (target < 0 || target >= value.length) return;
      const next = value.slice();
      [next[idx], next[target]] = [next[target], next[idx]];
      onChange(next);
    },
    [value, onChange]
  );

  const removeFromLibrary = useCallback(
    (img: LibraryImage) => {
      startLibrary(async () => {
        const result = await deleteListingImage(img.path);
        if (result.error) {
          toast.error(result.error.message);
          return;
        }
        setLibrary((cur) => cur.filter((it) => it.path !== img.path));
        // If it was selected on the current form, drop it.
        if (value.includes(img.url)) {
          onChange(value.filter((u) => u !== img.url));
        }
        toast.success(t("toast.removed"));
      });
    },
    [value, onChange, t]
  );

  const handleFiles = useCallback(
    async (filesIn: FileList | File[]) => {
      const files = Array.from(filesIn);
      if (files.length === 0) return;
      const accepted = files.slice(0, remaining);
      if (files.length > accepted.length) {
        toast.error(
          t(remaining === 1 ? "toast.extrasSingular" : "toast.extras", {
            remaining,
          })
        );
      }
      for (const raw of accepted) {
        // Client-side guard rails (the server re-checks).
        if (
          !LISTING_IMAGE_CLIENT_ACCEPT.some(
            (m) => raw.type.toLowerCase() === m
          )
        ) {
          toast.error(t("toast.unsupported", { name: raw.name, type: raw.type }));
          continue;
        }
        if (raw.size > LISTING_IMAGE_RAW_MAX_BYTES) {
          toast.error(
            t("toast.tooLarge", {
              name: raw.name,
              size: formatBytes(raw.size),
              limit: formatBytes(LISTING_IMAGE_RAW_MAX_BYTES),
            })
          );
          continue;
        }
        const id = `${raw.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setUploads((cur) => [
          ...cur,
          {
            id,
            name: raw.name,
            status: "compressing",
            before: raw.size,
          },
        ]);

        let compressed: CompressResult;
        try {
          compressed = await compressTo720pWebp(raw);
        } catch (err) {
          setUploads((cur) =>
            cur.map((it) =>
              it.id === id
                ? { ...it, status: "error", message: (err as Error).message }
                : it
            )
          );
          continue;
        }
        setUploads((cur) =>
          cur.map((it) =>
            it.id === id
              ? {
                  ...it,
                  status: "uploading",
                  after: compressed.bytesAfter,
                }
              : it
          )
        );

        const fd = new FormData();
        fd.append("file", compressed.file, compressed.file.name);
        const result = await uploadListingImage(fd);
        if (result.error) {
          setUploads((cur) =>
            cur.map((it) =>
              it.id === id
                ? { ...it, status: "error", message: result.error.message }
                : it
            )
          );
          toast.error(`${raw.name}: ${result.error.message}`);
          continue;
        }

        const url = result.data.url;
        addUrl(url);
        setUploads((cur) =>
          cur.map((it) =>
            it.id === id ? { ...it, status: "done", after: result.data.size } : it
          )
        );
        // The newly uploaded item should also appear in the library.
        setLibrary((cur) => [
          {
            path: result.data.path,
            url: result.data.url,
            size: result.data.size,
            uploaded_at: new Date().toISOString(),
          },
          ...cur,
        ]);
      }
    },
    [remaining, addUrl, t]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 text-xs">
        <TabButton
          active={tab === "upload"}
          onClick={() => setTab("upload")}
          icon={<UploadIcon className="size-3.5" />}
          label={t("tabs.upload")}
        />
        <TabButton
          active={tab === "library"}
          onClick={() => setTab("library")}
          icon={<LibraryIcon className="size-3.5" />}
          label={
            libraryLoaded
              ? t("tabs.libraryCount", { count: library.length })
              : t("tabs.library")
          }
        />
        <span className="ml-auto text-muted-foreground">
          {t("selectedCount", { count: value.length, max: maxImages })}
        </span>
      </div>

      {tab === "upload" ? (
        <div
          className={cn(
            "rounded-md border border-dashed p-6 text-center text-sm transition-colors",
            atCap
              ? "border-border bg-muted/30 text-muted-foreground"
              : dragHover
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/20"
          )}
          onDragOver={(e) => {
            if (atCap) return;
            e.preventDefault();
            setDragHover(true);
          }}
          onDragLeave={() => setDragHover(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragHover(false);
            if (atCap) return;
            if (e.dataTransfer.files?.length) {
              void handleFiles(e.dataTransfer.files);
            }
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept={LISTING_IMAGE_CLIENT_ACCEPT.join(",")}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {atCap ? (
            <p>{t("atCap", { max: maxImages })}</p>
          ) : (
            <>
              <p className="text-muted-foreground">{t("dragHint")}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => inputRef.current?.click()}
              >
                {t("chooseFiles")}
              </Button>
              <p className="text-xs text-muted-foreground mt-3">
                {t("compressNote", {
                  limit: formatBytes(LISTING_IMAGE_RAW_MAX_BYTES),
                })}
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-md border p-3 text-sm">
          {libraryPending && !libraryLoaded ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" /> {t("loadingLibrary")}
            </p>
          ) : library.length === 0 ? (
            <p className="text-muted-foreground">{t("emptyLibrary")}</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {library.map((img) => {
                const selected = value.includes(img.url);
                return (
                  <div key={img.path} className="relative group">
                    <button
                      type="button"
                      className={cn(
                        "block w-full aspect-square overflow-hidden rounded-md border transition-all",
                        selected
                          ? "ring-2 ring-primary border-primary"
                          : "border-border hover:border-primary/60"
                      )}
                      onClick={() => {
                        if (selected) {
                          onChange(value.filter((u) => u !== img.url));
                        } else {
                          addUrl(img.url);
                        }
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </button>
                    <button
                      type="button"
                      className="absolute top-1 right-1 rounded bg-background/80 p-1 opacity-0 group-hover:opacity-100 hover:text-destructive"
                      title={t("removeFromLibrary")}
                      onClick={() => removeFromLibrary(img)}
                    >
                      <TrashIcon className="size-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {libraryLoaded && library.length > 0 && (
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("libraryHint")}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={refreshLibrary}
              >
                {t("refresh")}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Active upload status (compressing / uploading per file) */}
      {uploads.some((u) => u.status !== "done") && (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {uploads
            .filter((u) => u.status !== "done")
            .map((u) => (
              <li key={u.id} className="flex items-center gap-2">
                {u.status === "error" ? (
                  <span className="text-destructive">✕</span>
                ) : (
                  <Loader2Icon className="size-3 animate-spin" />
                )}
                <span className="truncate">{u.name}</span>
                <span>
                  {u.status === "compressing" && t("status.compressing")}
                  {u.status === "uploading" &&
                    (u.before && u.after
                      ? t("status.uploadingSize", {
                          before: formatBytes(u.before),
                          after: formatBytes(u.after),
                        })
                      : t("status.uploadingPlain"))}
                  {u.status === "error" && (u.message ?? t("status.failed"))}
                </span>
              </li>
            ))}
        </ul>
      )}

      {/* Selected images (ordered) */}
      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground">{resolvedEmptyHint}</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {t("selectedHeading")}
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {value.map((url, idx) => (
              <div
                key={url}
                className="relative aspect-square overflow-hidden rounded-md border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={t("imageAlt", { idx: idx + 1 })}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-background/70 px-1 py-0.5 text-[10px]">
                  <span className="font-medium">{idx + 1}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="rounded p-0.5 hover:bg-muted disabled:opacity-30"
                      disabled={idx === 0}
                      onClick={() => move(idx, -1)}
                      title={t("moveLeft")}
                    >
                      <ArrowLeftIcon className="size-3" />
                    </button>
                    <button
                      type="button"
                      className="rounded p-0.5 hover:bg-muted disabled:opacity-30"
                      disabled={idx === value.length - 1}
                      onClick={() => move(idx, 1)}
                      title={t("moveRight")}
                    >
                      <ArrowRightIcon className="size-3" />
                    </button>
                    <button
                      type="button"
                      className="rounded p-0.5 hover:bg-destructive/20 text-destructive"
                      onClick={() => removeAt(idx)}
                      title={t("removeFromListing")}
                    >
                      <TrashIcon className="size-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
        <ImageIcon className="size-3" />
        {t("publicNotice")}
      </p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border text-muted-foreground hover:bg-muted/30"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
