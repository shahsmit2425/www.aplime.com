import { z } from "zod";
export const MAX_PROJECT_IMAGES = 5;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const uploadSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    contentType: z.enum([...IMAGE_TYPES, "application/pdf"]),
    size: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
  })
  .strict();
export function imageError(file: {
  name: string;
  type: string;
  size: number;
}): string | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type))
    return "Choose JPG, PNG, or WebP images.";
  if (!file.size || file.size > MAX_UPLOAD_BYTES)
    return "Each image must be between 1 byte and 10 MB.";
  if (file.name.length > 160)
    return "Shorten the image filename to 160 characters or fewer.";
  return null;
}
