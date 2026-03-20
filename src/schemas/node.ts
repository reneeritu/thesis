import { z } from 'zod';

export const updateProfileSchema = z.object({
  interests: z.array(z.string().max(100)).max(50).optional(),
  portfolioUrl: z.string().url().or(z.literal('')).optional(),
  keywords: z.array(z.string().max(60)).max(30).optional(),
});

export const updateTrusteesSchema = z.object({
  trustees: z
    .array(z.string().min(1))
    .min(3)
    .max(5),
});

export const blockNodeSchema = z.object({
  targetAlias: z.string().min(1),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateTrusteesInput = z.infer<typeof updateTrusteesSchema>;
export type BlockNodeInput = z.infer<typeof blockNodeSchema>;
