import { z } from 'zod';

const chainDefaultsKeys = [
  'moderatorCountByLevel',
  'moderatorInviteMultiplier',
  'moderatorAcceptDeadlineHours',
  'mediationTimeLockHours',
  'mediationMaxProposals',
  'falseEmergencyFlagPenalty',
  'moderatorBadFaithPenalty',
  'appealWindowDays',
  'maxAppeals',
] as const;

export type ChainDefaultsUpdateKey = (typeof chainDefaultsKeys)[number];

const positiveInt = z.number().int().min(0);

const moderatorCountByLevelSchema = z.object({
  1: positiveInt,
  2: positiveInt,
  3: positiveInt,
  4: positiveInt,
});

const mediationTimeLockHoursSchema = z.object({
  1: positiveInt,
  2: positiveInt,
  3: positiveInt,
  4: positiveInt,
});

const chainDefaultsUpdateSchema = z
  .object({
    moderatorCountByLevel: moderatorCountByLevelSchema.optional(),
    moderatorInviteMultiplier: z.number().min(0).optional(),
    moderatorAcceptDeadlineHours: positiveInt.optional(),
    mediationTimeLockHours: mediationTimeLockHoursSchema.optional(),
    mediationMaxProposals: z.number().int().min(1).optional(),
    falseEmergencyFlagPenalty: positiveInt.optional(),
    moderatorBadFaithPenalty: positiveInt.optional(),
    appealWindowDays: z.number().int().min(1).optional(),
    maxAppeals: z.number().int().min(1).optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one change is required',
  });

export const createProposalSchema = z
  .object({
    scope: z.enum(['parameter', 'base_contract']),
    changes: chainDefaultsUpdateSchema,
  })
  .strict();

export const voteSchema = z
  .object({
    approve: z.boolean(),
  })
  .strict();

export type CreateProposalInput = z.infer<typeof createProposalSchema>;
export type VoteInput = z.infer<typeof voteSchema>;

