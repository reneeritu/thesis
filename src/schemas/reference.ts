import { z } from 'zod';
import { RELATIONSHIP_TYPES } from '../models/Reference';

export const createReferenceSchema = z
  .object({
    projectId: z.string().min(1),
    sourceProjectId: z.string().optional(),
    externalUrl: z.string().url().optional(),
    citation: z.string().max(2000).optional(),
    relationshipType: z.enum(RELATIONSHIP_TYPES),
    otherExplanation: z.string().max(2000).optional(),
  })
  .refine(
    (d) => d.sourceProjectId || d.externalUrl || d.citation,
    { message: 'At least one of sourceProjectId, externalUrl, or citation is required' },
  )
  .refine(
    (d) => d.relationshipType !== 'other' || (d.otherExplanation && d.otherExplanation.length > 0),
    { message: 'otherExplanation is required when relationshipType is "other"', path: ['otherExplanation'] },
  );

export type CreateReferenceInput = z.infer<typeof createReferenceSchema>;
