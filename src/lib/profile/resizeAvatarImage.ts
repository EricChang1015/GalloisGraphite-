/** Max width/height for stored avatar uploads. */
export const AVATAR_MAX_DIMENSION = 500;

/**
 * Resize an image file so both sides are at most {@link AVATAR_MAX_DIMENSION}px.
 * If already within bounds, returns the original file unchanged.
 */
export async function prepareAvatarUpload(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = bitmap;
    if (width <= AVATAR_MAX_DIMENSION && height <= AVATAR_MAX_DIMENSION) {
      return file;
    }

    const scale = Math.min(
      AVATAR_MAX_DIMENSION / width,
      AVATAR_MAX_DIMENSION / height
    );
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not process image.");
    }
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);

    const mime =
      file.type === "image/png" || file.type === "image/webp"
        ? file.type
        : "image/jpeg";
    const quality = mime === "image/jpeg" ? 0.88 : undefined;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Could not encode image."))),
        mime,
        quality
      );
    });

    const ext =
      mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    return new File([blob], `avatar.${ext}`, { type: mime });
  } finally {
    bitmap.close();
  }
}
