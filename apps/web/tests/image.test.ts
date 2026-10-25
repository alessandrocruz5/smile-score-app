import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { normalizeImage } from "@/lib/image";

const background = { r: 200, g: 50, b: 50 };
const blank = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background } });

describe("normalizeImage", () => {
  it("downsizes a 3000x2000 PNG to a 1600x1067 JPEG", async () => {
    const input = await blank(3000, 2000).png().toBuffer();
    const out = await normalizeImage(input);
    expect(out.width).toBe(1600);
    expect(out.height).toBe(1067);
    expect((await sharp(out.data).metadata()).format).toBe("jpeg");
  });

  it("does not enlarge a small image", async () => {
    const input = await blank(800, 600).jpeg().toBuffer();
    const out = await normalizeImage(input);
    expect([out.width, out.height]).toEqual([800, 600]);
  });

  it("applies EXIF orientation and strips EXIF", async () => {
    const input = await blank(400, 200).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const out = await normalizeImage(input);
    expect([out.width, out.height]).toEqual([200, 400]);
    expect((await sharp(out.data).metadata()).exif).toBeUndefined();
  });

  it("accepts WebP", async () => {
    const input = await blank(100, 100).webp().toBuffer();
    const out = await normalizeImage(input);
    expect([out.width, out.height]).toEqual([100, 100]);
  });

  it("rejects non-image bytes", async () => {
    await expect(normalizeImage(Buffer.from("hello"))).rejects.toThrow();
  });

  it("rejects a GIF", async () => {
    const input = await blank(50, 50).gif().toBuffer();
    await expect(normalizeImage(input)).rejects.toThrow(/unsupported format/);
  });

  it("rejects a TIFF", async () => {
    const input = await blank(50, 50).tiff().toBuffer();
    await expect(normalizeImage(input)).rejects.toThrow(/unsupported format/);
  });
});
