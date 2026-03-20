import { z } from 'zod';

export const forkProjectSchema = z.object({
  parentProjectId: z.string().min(1),
  title: z.string().min(1).max(200).trim(),
  forkReason: z.string().min(1).max(5000),
  inheritedContributors: z.array(z.string()).optional(),
  targetSpaceId: z.string().min(1).optional(),
});

export type ForkProjectInput = z.infer<typeof forkProjectSchema>;
