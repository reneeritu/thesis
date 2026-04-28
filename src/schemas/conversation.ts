import { z } from 'zod';

export const createConversationSchema = z.object({
  recipientAlias: z.string().trim().min(1).max(64),
  intro: z.string().trim().min(1).max(2000),
});

export const respondConversationSchema = z.object({
  decision: z.enum(['accept', 'decline']),
});

export const sendMessageSchema = z.object({
  body: z.string().min(1).max(4000),
});

export const blockConversationSchema = z.object({
  block: z.boolean(),
});
