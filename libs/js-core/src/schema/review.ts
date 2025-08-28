import { z } from 'zod';
export const ReviewSchema = z.object({
  author: z.string().min(1),
  rating: z.number().min(0).max(5),
  text: z.string().default(''),
  time: z.string().optional(),
  likes: z.number().int().nonnegative().optional(),
  url: z.string().url().optional(),
  placeId: z.string().optional(),
  lang: z.string().optional()
});
export type Review = z.infer<typeof ReviewSchema>;
