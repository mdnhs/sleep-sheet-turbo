import { z } from "zod";

export const reviewSchema = z.object({
  productId: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500),
});

export const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500),
});