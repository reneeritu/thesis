import { z } from 'zod';

export const createSpaceSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  description: z.string().max(2000).optional(),
  settings: z
    .object({
      projectAccess: z.enum(['open', 'invite_only', 'application']).optional(),
      vetoAuthority: z.array(z.string()).optional(),
      votingThreshold: z.number().min(0).max(1).optional(),
      privacyDefault: z.enum(['public', 'space_specific', 'private']).optional(),
      customContractsAllowed: z.boolean().optional(),
      contentRestrictions: z.array(z.string()).optional(),
      minDocRequirements: z.array(z.string()).optional(),
    })
    .optional(),
});

export const joinSpaceSchema = z.object({
  inviteCode: z.string().optional(),
});

export const updateSpaceSettingsSchema = z.object({
  projectAccess: z.enum(['open', 'invite_only', 'application']).optional(),
  vetoAuthority: z.array(z.string()).optional(),
  votingThreshold: z.number().min(0).max(1).optional(),
  privacyDefault: z.enum(['public', 'space_specific', 'private']).optional(),
  customContractsAllowed: z.boolean().optional(),
  contentRestrictions: z.array(z.string()).optional(),
  minDocRequirements: z.array(z.string()).optional(),
});

export type CreateSpaceInput = z.infer<typeof createSpaceSchema>;
export type JoinSpaceInput = z.infer<typeof joinSpaceSchema>;
export type UpdateSpaceSettingsInput = z.infer<typeof updateSpaceSettingsSchema>;
