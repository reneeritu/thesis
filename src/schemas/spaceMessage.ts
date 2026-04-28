import { z } from 'zod';

export const sendSpaceMessageSchema = z.object({
  body: z.string().min(1).max(4000),
});
