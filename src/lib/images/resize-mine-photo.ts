import "server-only";

import sharp from "sharp";

import {
  MINE_PHOTO_MAX_HEIGHT,
  MINE_PHOTO_MAX_WIDTH,
  MINE_PHOTO_THUMB_MAX_EDGE,
} from "@/lib/mine-photos/images";

export interface MinePhotoResizeResult {
  fullBuffer: Buffer;
  thumbBuffer: Buffer;
  fullWidth: number;
  fullHeight: number;
  thumbWidth: number;
  thumbHeight: number;
}

/**
 * Resize a mine photo for Supabase storage.
 *
 * Full image: fit inside 1920×1080, JPEG. When downscaling, apply a mild
 * Gaussian blur first (low-pass) to reduce moiré from high-frequency detail.
 *
 * Thumb: WebP, longest edge 480 px (derived from the full output).
 */
export async function resizeMinePhoto(
  input: Buffer
): Promise<MinePhotoResizeResult> {
  const meta = await sharp(input).metadata();
  const srcW = meta.width ?? 1;
  const srcH = meta.height ?? 1;

  const scaleW = MINE_PHOTO_MAX_WIDTH / srcW;
  const scaleH = MINE_PHOTO_MAX_HEIGHT / srcH;
  const scale = Math.min(scaleW, scaleH, 1);

  let fullPipe = sharp(input);
  if (scale < 1) {
    const sigma = Math.min(2, Math.max(0.4, (1 - scale) * 2.5));
    fullPipe = fullPipe.blur(sigma);
  }

  const fullSharp = fullPipe.resize(MINE_PHOTO_MAX_WIDTH, MINE_PHOTO_MAX_HEIGHT, {
    fit: "inside",
    withoutEnlargement: true,
  });

  const fullBuffer = await fullSharp
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();

  const fullMeta = await sharp(fullBuffer).metadata();
  const fullWidth = fullMeta.width ?? srcW;
  const fullHeight = fullMeta.height ?? srcH;

  const thumbSharp = sharp(fullBuffer).resize(
    MINE_PHOTO_THUMB_MAX_EDGE,
    MINE_PHOTO_THUMB_MAX_EDGE,
    { fit: "inside", withoutEnlargement: true }
  );
  const thumbBuffer = await thumbSharp.webp({ quality: 80 }).toBuffer();
  const thumbMeta = await sharp(thumbBuffer).metadata();

  return {
    fullBuffer,
    thumbBuffer,
    fullWidth,
    fullHeight,
    thumbWidth: thumbMeta.width ?? fullWidth,
    thumbHeight: thumbMeta.height ?? fullHeight,
  };
}

/** Category cover/header — same cap as full photos. */
export async function resizeMinePhotoCover(input: Buffer): Promise<Buffer> {
  const meta = await sharp(input).metadata();
  const srcW = meta.width ?? 1;
  const srcH = meta.height ?? 1;
  const scaleW = MINE_PHOTO_MAX_WIDTH / srcW;
  const scaleH = MINE_PHOTO_MAX_HEIGHT / srcH;
  const scale = Math.min(scaleW, scaleH, 1);

  let pipe = sharp(input);
  if (scale < 1) {
    const sigma = Math.min(2, Math.max(0.4, (1 - scale) * 2.5));
    pipe = pipe.blur(sigma);
  }

  return pipe
    .resize(MINE_PHOTO_MAX_WIDTH, MINE_PHOTO_MAX_HEIGHT, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}
