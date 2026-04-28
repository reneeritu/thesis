import { z } from 'zod';

export const foundingMemberSchema = z.object({
  alias: z.string().min(1),
  role: z.enum(['admin', 'member']).default('member'),
});

export const createSpaceSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  description: z.string().max(2000).optional(),
  /** Co-founders (other nodes) to add at creation — each picks admin or member. */
  foundingMembers: z.array(foundingMemberSchema).optional(),
  settings: z
    .object({
      projectAccess: z.enum(['open', 'invite_only', 'application']).optional(),
      /**
       * Aliases to request as veto authority.
       * These go into `pendingVeto` and are cleared from `settings.vetoAuthority`
       * until each accepts.
       */
      vetoAuthority: z.array(z.string()).optional(),
      votingThreshold: z.number().min(0).max(1).optional(),
      privacyDefault: z.enum(['public', 'space_specific', 'private']).optional(),
      customContractsAllowed: z.boolean().optional(),
      contentRestrictions: z.array(z.string()).optional(),
      minDocRequirements: z.array(z.string()).optional(),
      customContracts: z
        .array(
          z.object({
            title: z.string().min(1).max(120),
            body: z.string().min(1).max(4000),
            authorAlias: z.string().min(1),
          }),
        )
        .optional(),
      enforceStrictMinDoc: z.boolean().optional(),
      /** Invite code mode for invite_only spaces. */
      inviteMode: z.enum(['single_use', 'multi_use']).optional(),
      /** null = no expiry */
      inviteExpiryDays: z.number().min(1).nullable().optional(),
    })
    .optional(),
});

export const createSpaceWithParentSchema = createSpaceSchema.extend({
  parentSpaceId: z.string().optional(), // 24-char hex; validation done in route
});

export const customContractSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(4000),
});

export const respondApplicationSchema = z.object({
  decision: z.enum(['approve', 'reject']),
});

export const joinSpaceSchema = z.object({
  inviteCode: z.string().optional(),
  message: z.string().max(4000).optional(),
});

export const updateSpaceSettingsSchema = z.object({
  projectAccess: z.enum(['open', 'invite_only', 'application']).optional(),
  vetoAuthority: z.array(z.string()).optional(),
  votingThreshold: z.number().min(0).max(1).optional(),
  privacyDefault: z.enum(['public', 'space_specific', 'private']).optional(),
  customContractsAllowed: z.boolean().optional(),
  contentRestrictions: z.array(z.string()).optional(),
  minDocRequirements: z.array(z.string()).optional(),
  customContracts: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        body: z.string().min(1).max(4000),
        authorAlias: z.string().min(1),
      }),
    )
    .optional(),
  enforceStrictMinDoc: z.boolean().optional(),
  inviteMode: z.enum(['single_use', 'multi_use']).optional(),
  inviteExpiryDays: z.number().min(1).nullable().optional(),
});

export const generateInviteSchema = z.object({
  mode: z.enum(['single_use', 'multi_use']).optional(),
  /** null = no expiry. Defaults to 15 days for single_use. */
  expiryDays: z.number().min(1).nullable().optional(),
});

export const vetoRespondSchema = z.object({
  joinSpace: z.boolean(),
  acceptVeto: z.boolean(),
});

export type CreateSpaceInput = z.infer<typeof createSpaceSchema>;
export type JoinSpaceInput = z.infer<typeof joinSpaceSchema>;
export type UpdateSpaceSettingsInput = z.infer<typeof updateSpaceSettingsSchema>;
export type VetoRespondInput = z.infer<typeof vetoRespondSchema>;
