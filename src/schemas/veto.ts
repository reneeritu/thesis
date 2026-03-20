import { z } from 'zod';
import { VETO_TYPES } from '../models/Veto';

export const createVetoSchema = z.object({
  projectId: z.string().min(1),
  vetoType: z.enum(VETO_TYPES),
  reason: z.string().min(1).max(5000),
  targetTraceIds: z.array(z.string()).optional(),
});

export const signVetoSchema = z.object({
  approved: z.boolean(),
});

export type CreateVetoInput = z.infer<typeof createVetoSchema>;
export type SignVetoInput = z.infer<typeof signVetoSchema>;
