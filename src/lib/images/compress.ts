/**
 * Client-side image compression for listing photos.
 *
 * Resizes the longest edge of an image to `maxEdge` (default 720 px),
 * preserves aspect ratio, and re-encodes as WebP at the requested
 * quality. Returns a new `File` (so it can be sent straight into a
 * FormData) along with the size before/after for UX hints.
 *
 * Falls back to the original file if the browser doesn't support
 * `createImageBitmap` + canvas → WebP encoding (very old browsers).
 */

export interface CompressOptions {
  /** Longest edge in pixels. Default 720. */
  maxEdge?: number;
  /** WebP quality 0..1. Default 0.82. */
  quality?: number;
  /** Skip encoding when input is already smaller than this (bytes). */
  skipUnder?: number;
}

export interface CompressResult {
  file: File;
  bytesBefore: number;
  bytesAfter: number;
  width: number;
  height: number;
  /** True when we returned the input unchanged. */
  passthrough: boolean;
}

const DEFAULT_OPTS: Required<CompressOptions> = {
  maxEdge: 720,
  quality: 0.82,
  skipUnder: 100 * 1024, // 100 KB — too small to bother re-encoding.
};

export async function compressTo720pWebp(
  file: File,
  opts: CompressOptions = {}
): Promise<CompressResult> {
  const { maxEdge, quality, skipUnder } = { ...DEFAULT_OPTS, ...opts };
  const bytesBefore = file.size;

  // Feature-detect once. If anything's missing, just hand the file back.
  const canDecode =
    typeof createImageBitmap === "function" &&
    typeof document !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined";
  if (!canDecode || bytesBefore < skipUnder) {
    return passthrough(file, bytesBefore);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return passthrough(file, bytesBefore);
  }

  const longest = Math.max(bitmap.width, bitmap.height);
  // Never upscale.
  const scale = longest > maxEdge ? maxEdge / longest : 1;
  const targetW = Math.max(1, Math.round(bitmap.width * scale));
  const targetH = Math.max(1, Math.round(bitmap.height * scale));

  // Prefer OffscreenCanvas where available (worker-friendly, slightly faster),
  // but it's optional — a plain canvas works the same.
  let blob: Blob;
  try {
    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(targetW, targetH);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("2d context unavailable");
      ctx.drawImage(bitmap, 0, 0, targetW, targetH);
      blob = await canvas.convertToBlob({
        type: "image/webp",
        quality,
      });
    } else {
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("2d context unavailable");
      ctx.drawImage(bitmap, 0, 0, targetW, targetH);
      blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
          "image/webp",
          quality
        );
      });
    }
  } catch {
    bitmap.close?.();
    return passthrough(file, bytesBefore);
  }

  bitmap.close?.();

  // If the "compressed" version somehow turned out larger (small inputs
  // sometimes do this), fall back to the original to avoid bloating
  // storage for no reason.
  if (blob.size >= bytesBefore && file.type !== "image/heic" && file.type !== "image/heif") {
    return passthrough(file, bytesBefore, targetW, targetH);
  }

  const newName = renameTo(file.name, "webp");
  const compressed = new File([blob], newName, {
    type: "image/webp",
    lastModified: Date.now(),
  });
  return {
    file: compressed,
    bytesBefore,
    bytesAfter: compressed.size,
    width: targetW,
    height: targetH,
    passthrough: false,
  };
}

function passthrough(
  file: File,
  bytes: number,
  width?: number,
  height?: number
): CompressResult {
  return {
    file,
    bytesBefore: bytes,
    bytesAfter: bytes,
    width: width ?? 0,
    height: height ?? 0,
    passthrough: true,
  };
}

function renameTo(name: string, ext: string): string {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name || "image";
  return `${stem || "image"}.${ext}`;
}

/** Pretty-print a byte count for inline UX (e.g. "1.8 MB"). */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
