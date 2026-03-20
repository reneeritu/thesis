import { z } from 'zod';

export const createPivotSchema = z.object({
  projectId: z.string().min(1),
  reason: z.string().min(1).max(5000),
});

export type CreatePivotInput = z.infer<typeof createPivotSchema>;
