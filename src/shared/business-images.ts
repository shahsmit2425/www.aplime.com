import { z } from "zod";
import { IMAGE_TYPES, MAX_UPLOAD_BYTES } from "./uploads.js";
export const businessImageSlots = [
  "logo",
  "cover",
  "work-1",
  "work-2",
  "work-3",
  "work-4",
  "work-5",
  "work-6",
  "work-7",
  "work-8",
  "work-9",
  "work-10",
  "work-11",
  "work-12",
  "work-13",
  "work-14",
  "work-15",
  "work-16",
  "work-17",
  "work-18",
  "work-19",
  "work-20",
] as const;
export const MAX_BUSINESS_PORTFOLIO_IMAGES = 20;
export function hasBusinessBranding(readySlots: readonly string[]) {
  return readySlots.includes("logo") && readySlots.includes("cover");
}
export const businessImageSchema = z
  .object({
    slot: z.enum(businessImageSlots),
    name: z.string().trim().min(1).max(160),
    contentType: z.enum(IMAGE_TYPES),
    size: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
  })
  .strict();
export type BusinessImage = {
  id: string;
  slot: (typeof businessImageSlots)[number];
  url: string;
};
export function portfolioImages(images: readonly BusinessImage[] = []) {
  return images
    .filter((image) => /^work-(?:[1-9]|1\d|20)$/.test(image.slot))
    .sort((a, b) => Number(a.slot.slice(5)) - Number(b.slot.slice(5)))
    .slice(0, MAX_BUSINESS_PORTFOLIO_IMAGES);
}
export function matchesImageSignature(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg")
    return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === "image/png")
    return [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b);
  if (type === "image/webp")
    return (
      new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
    );
  return false;
}
