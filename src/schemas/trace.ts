import { z } from 'zod';
import { ACTIVITY_TYPES, LOG_MODES } from '../models/Trace';

export const createTraceSchema = z
  .object({
    projectId: z.string().min(1),
    activityType: z.enum(ACTIVITY_TYPES),
    otherDescription: z.string().max(500).optional(),
    timestamp: z.string().datetime().optional(),
    description: z.string().max(5000).optional(),
    duration: z.number().min(0).optional(),
    toolSoftware: z.string().max(200).optional(),
    mode: z.enum(LOG_MODES).optional(),
    proxyForAlias: z.string().optional(),
  })
  .refine(
    (d) => d.activityType !== 'other' || (d.otherDescription && d.otherDescription.length > 0),
    { message: 'otherDescription is required when activityType is "other"', path: ['otherDescription'] },
  )
  .refine(
    (d) => d.mode !== 'proxy' || (d.proxyForAlias && d.proxyForAlias.length > 0),
    { message: 'proxyForAlias is required for proxy mode', path: ['proxyForAlias'] },
  );

export const confirmProxySchema = z.object({
  confirmed: z.boolean(),
});

export type CreateTraceInput = z.infer<typeof createTraceSchema>;
export type ConfirmProxyInput = z.infer<typeof confirmProxySchema>;
