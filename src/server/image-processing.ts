import sharp from "sharp";
import { fail } from "./errors.js";
import { MAX_UPLOAD_BYTES } from "../shared/uploads.js";

const FORMATS = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export const MAX_IMAGE_EDGE = 2560;
const MAX_INPUT_PIXELS = 50_000_000;

// Re-encoding drops EXIF/GPS, XMP, IPTC and trailing data. Orientation is baked
// into the pixels first so photos still display upright.
export async function sanitizeImage(body: Buffer, contentType: string) {
  const format = FORMATS[contentType as keyof typeof FORMATS];
  if (!format) fail(415, "Choose a JPG, PNG or WebP image.");
  try {
    const source = sharp(body, {
      failOn: "error",
      limitInputPixels: MAX_INPUT_PIXELS,
    });
    if ((await source.metadata()).format !== format)
      fail(400, "This file does not match the selected photo.");
    const pipeline = source.rotate().resize({
      width: MAX_IMAGE_EDGE,
      height: MAX_IMAGE_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    });
    if (format === "jpeg") pipeline.jpeg({ quality: 85, mozjpeg: true });
    else if (format === "png") pipeline.png({ compressionLevel: 9 });
    else pipeline.webp({ quality: 85 });
    const clean = await pipeline.toBuffer();
    if (clean.length > MAX_UPLOAD_BYTES)
      fail(413, "This image is too large. Choose a smaller photo.");
    return clean;
  } catch (error) {
    if ((error as { status?: number }).status) throw error;
    fail(400, "This image could not be read. Choose a different photo.");
  }
}
