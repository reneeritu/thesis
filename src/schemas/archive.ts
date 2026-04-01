import { z } from 'zod';
import { EVIDENCE_TYPES } from '../models/Archive';

export const createArchiveSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  medium: z.string().min(1).max(200),
  approxDate: z.string().min(1).max(100),
  spaceId: z.string().min(1),
  evidence: z
    .array(
      z
        .object({
          evidenceType: z.enum(EVIDENCE_TYPES),
          evidenceHash: z.string().min(1),
          otherDescription: z.string().max(500).optional(),
          mediaId: z.string().optional(),
        })
        .refine(
          (e) => e.evidenceType !== 'other' || (e.otherDescription && e.otherDescription.length > 0),
          { message: 'otherDescription required for "other" evidence type', path: ['otherDescription'] },
        ),
    )
    .min(1),
  reconstructionFlag: z.boolean(),
  originalWorkDeclaration: z.literal(true, { message: 'Must declare this is original work' }),
  collaborators: z.array(z.string()).optional(),
  contextNote: z.string().max(5000).optional(),
});

export const addAttestationSchema = z.object({
  attestationType: z.enum(['self', 'peer', 'institution']),
  relationship: z.enum(['collaborator', 'witness', 'mentor', 'institutional_contact']),
  statement: z.string().min(1).max(5000),
});

export type CreateArchiveInput = z.infer<typeof createArchiveSchema>;
export type AddAttestationInput = z.infer<typeof addAttestationSchema>;
