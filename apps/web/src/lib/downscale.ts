export const MAX_EDGE = 1600;

/** Fits w×h inside max×max, keeping the aspect ratio. Never enlarges; rounds to whole pixels. */
export function fitWithin(
  w: number,
  h: number,
  max = MAX_EDGE,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(w, h));
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

/** The browser couldn't decode the file as an image (e.g. HEIC in Chrome, or a renamed .txt). */
export class DecodeError extends Error {}

/** Browser only: decodes the file, scales it to at most MAX_EDGE and re-encodes it as a JPEG. */
export async function downscaleToJpeg(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new DecodeError("Could not decode image");
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Canvas is not available");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode image"))),
      "image/jpeg",
      0.9,
    );
  });
}
