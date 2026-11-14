"use client";

export const MAX_PHOTO_EDGE = 1280;
export const PHOTO_QUALITY = 0.8;
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

export class PhotoError extends Error {}

/** Resizes (longest edge <= 1280px) and re-encodes as JPEG ~0.8 in the browser, honoring EXIF orientation. */
export async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new PhotoError("הקובץ שנבחר אינו תמונה.");
  if (file.size > MAX_INPUT_BYTES) throw new PhotoError("התמונה גדולה מדי. בחרו תמונה קטנה מ־25MB.");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PhotoError("לא הצלחנו לקרוא את התמונה. נסו תמונה בפורמט JPG או PNG.");
  }

  const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PhotoError("הדפדפן לא תומך בעיבוד תמונות.");
  ctx.fillStyle = "#ffffff"; // PNG transparency -> white
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", PHOTO_QUALITY));
  if (!blob) throw new PhotoError("לא הצלחנו לעבד את התמונה. נסו תמונה אחרת.");
  return blob;
}
