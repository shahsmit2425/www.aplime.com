import { z } from "zod";
export const reviewInput = z
  .object({
    rating: z.number().int().min(1).max(5),
    body: z.string().trim().min(10).max(2000),
  })
  .strict();
export type PublicReview = {
  id: string;
  rating: number;
  body: string;
  reply: string | null;
  createdAt: string;
  category: string;
  completedProject: boolean;
};
export type ReviewPage = {
  reviews: PublicReview[];
  total: number;
  average: number;
  distribution: number[];
  nextOffset: number | null;
};
