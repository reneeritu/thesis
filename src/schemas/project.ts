import { z } from 'zod';

export const startProjectSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  spaceId: z.string().min(1),
  contributors: z
    .array(
      z.object({
        alias: z.string().min(1),
        role: z.string().max(100).optional(),
        isPrimary: z.boolean().optional(),
      }),
    )
    .optional(),
  context: z.string().max(5000).optional(),
  pedagogicalId: z.string().optional(),
  mentorAlias: z.string().optional(),
  visibility: z.enum(['space_only', 'process_visible', 'fully_public']).optional(),
});

export const addContributorSchema = z.object({
  alias: z.string().min(1),
  role: z.string().max(100).optional(),
  isPrimary: z.boolean().optional(),
});

export type StartProjectInput = z.infer<typeof startProjectSchema>;
export type AddContributorInput = z.infer<typeof addContributorSchema>;
