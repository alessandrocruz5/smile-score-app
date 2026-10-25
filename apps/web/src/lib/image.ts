import sharp from "sharp";

// The real decoded format, not the client's Content-Type. This is the web half of the "type allowlist
// enforced on both web and scorer" check (the scorer checks Pillow's img.format).
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);
const LIMIT_INPUT_PIXELS = 50_000_000;

/**
 * Validates the real image format, applies EXIF orientation, downsizes to at most 1600px on the longest
 * side and re-encodes as JPEG (which strips EXIF/GPS). Throws on an unsupported or undecodable input;
 * callers treat any throw as `unsupported_image`.
 */
export async function normalizeImage(
  input: Buffer,
): Promise<{ data: Buffer; width: number; height: number }> {
  const { format } = await sharp(input, { limitInputPixels: LIMIT_INPUT_PIXELS }).metadata();
  if (!format || !ALLOWED_FORMATS.has(format)) throw new Error(`unsupported format: ${format}`);
  const { data, info } = await sharp(input, { limitInputPixels: LIMIT_INPUT_PIXELS })
    .rotate()
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}
