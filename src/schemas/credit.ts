import { z } from 'zod';

export const creditProjectSchema = z.object({
  projectId: z.string().min(1),
  medium: z.string().max(200).optional(),
  contributors: z
    .array(
      z.object({
        alias: z.string().min(1),
        role: z.string().max(100).optional(),
        weight: z.number().min(0).max(1).optional(),
      }),
    )
    .optional(),
  offChainContributors: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        portfolio: z.string().max(500).optional(),
        role: z.string().max(100).optional(),
      }),
    )
    .optional(),
  disputeFlag: z.boolean().optional(),
});

export const signCreditSchema = z.object({
  accepted: z.boolean(),
});

export type CreditProjectInput = z.infer<typeof creditProjectSchema>;
export type SignCreditInput = z.infer<typeof signCreditSchema>;
