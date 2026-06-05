/**
 * Shared mine-photo resize for import scripts (mirrors resize-mine-photo.ts).
 */

import sharp from "sharp";

export const MINE_PHOTO_MAX_WIDTH = 1920;
export const MINE_PHOTO_MAX_HEIGHT = 1080;
export const MINE_PHOTO_THUMB_MAX_EDGE = 480;

export async function resizeMinePhoto(input) {
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

  const fullBuffer = await fullPipe
    .resize(MINE_PHOTO_MAX_WIDTH, MINE_PHOTO_MAX_HEIGHT, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();

  const fullMeta = await sharp(fullBuffer).metadata();
  const thumbBuffer = await sharp(fullBuffer)
    .resize(MINE_PHOTO_THUMB_MAX_EDGE, MINE_PHOTO_THUMB_MAX_EDGE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 80 })
    .toBuffer();
  const thumbMeta = await sharp(thumbBuffer).metadata();

  return {
    fullBuffer,
    thumbBuffer,
    fullWidth: fullMeta.width ?? srcW,
    fullHeight: fullMeta.height ?? srcH,
    thumbWidth: thumbMeta.width ?? fullMeta.width ?? srcW,
    thumbHeight: thumbMeta.height ?? fullMeta.height ?? srcH,
  };
}

export async function resizeMinePhotoCover(input) {
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
