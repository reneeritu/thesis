import { z } from 'zod';

export const createMediationSchema = z.object({
  triggerType: z.enum([
    'credit_dispute',
    'veto_dispute',
    'space_ban_dispute',
    'classification_appeal',
  ]),
  projectId: z.string().min(1),
  relatedEntityId: z.string().min(1),
  relatedEntityType: z.enum(['nft', 'veto', 'space_ban', 'classification']),
  reason: z.string().min(1).max(2000),
});

const weightEntrySchema = z.object({
  alias: z.string().min(1),
  weight: z.number().min(0).max(1),
});

export const proposalSchema = z.object({
  description: z.string().min(1).max(2000),
  weightMap: z.array(weightEntrySchema).optional(),
});

export const respondSchema = z.object({
  proposalIndex: z.number().int().min(0),
  accepted: z.boolean(),
});

export const resolveSchema = z.object({
  proposalIndex: z.number().int().min(0),
});

export const failMediationSchema = z.object({});

export type CreateMediationInput = z.infer<typeof createMediationSchema>;
export type ProposalInput = z.infer<typeof proposalSchema>;
export type RespondInput = z.infer<typeof respondSchema>;
export type ResolveInput = z.infer<typeof resolveSchema>;
