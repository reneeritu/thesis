import { z } from 'zod';

export const createFlagSchema = z.object({
  flagCategory: z.enum(['emergency', 'content', 'attribution', 'governance', 'dispute']),
  flagType: z.enum([
    'csam',
    'non_consensual_imagery',
    'hate_speech',
    'harassment',
    'impersonation',
    'doxxing',
    'illegal_content',
    'misinformation',
    'spam',
    'nudity',
    'plagiarism',
    'false_credit',
    'undeclared_ai',
    'missing_lineage',
    'space_misconduct',
    'moderator_bad_faith',
    'contract_violation',
    'false_flagging',
    'credit_dispute',
    'veto_dispute',
    'space_ban_dispute',
    'classification_appeal',
  ]),
  targetType: z.enum(['node', 'trace', 'project', 'space', 'nft', 'contract', 'media']),
  targetId: z.string().min(1),
  spaceId: z.string().min(1).optional(),
  reason: z.string().min(1).max(2000),
});

export const exclusionRequestSchema = z.object({
  targetAlias: z.string().min(1),
  reason: z.string().min(1).max(1000),
});

export const exclusionVoteSchema = z.object({
  approved: z.boolean(),
});

export const rulingSchema = z.object({
  decision: z.enum(['uphold', 'dismiss', 'partial']),
  statement: z.string().min(1).max(5000),
  actions: z.array(z.string().min(1)).default([]),
});

export const appealSchema = z.object({
  reason: z.string().min(1).max(2000),
  newEvidence: z.string().max(5000).optional(),
});

export type CreateFlagInput = z.infer<typeof createFlagSchema>;
export type ExclusionRequestInput = z.infer<typeof exclusionRequestSchema>;
export type ExclusionVoteInput = z.infer<typeof exclusionVoteSchema>;
export type RulingInput = z.infer<typeof rulingSchema>;
export type AppealInput = z.infer<typeof appealSchema>;
