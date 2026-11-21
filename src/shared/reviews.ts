import { z } from "zod";
export const reviewInput = z
  .object({
    rating: z.number().int().min(1).max(5),
    body: z.string().trim().min(1).max(2000),
    // Absent (older app versions) means the review is published without a name.
    showName: z.boolean().optional(),
  })
  .strict();
export const reviewSorts = ["newest", "highest", "lowest"] as const;
export type ReviewSort = (typeof reviewSorts)[number];
export type PublicReview = {
  photos?: { slot: number; url: string }[];
  id: string;
  rating: number;
  body: string;
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
  category: string;
  completedProject: boolean;
  // Shown only when the customer chose to publish their name with the review.
  reviewer: string | null;
  town: string | null;
};
export type ReviewPage = {
  reviews: PublicReview[];
  total: number;
  average: number;
  distribution: number[];
  nextOffset: number | null;
};
// "Maria Lopez Sanchez" is published as "Maria S."; anything that does not read
// as a personal name (an email address, digits) is never published.
export function reviewerDisplayName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const word = /^\p{L}[\p{L}'’.-]*$/u;
  if (!parts.length || !word.test(parts[0])) return null;
  const first = parts[0][0].toUpperCase() + parts[0].slice(1, 24);
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  return word.test(last) ? `${first} ${last[0].toUpperCase()}.` : first;
}
