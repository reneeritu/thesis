import { z } from 'zod';
import { chainDefaults } from '../config/defaults';

export const registerSchema = z.object({
  alias: z
    .string()
    .min(chainDefaults.aliasMinLength)
    .max(chainDefaults.aliasMaxLength)
    .regex(
      /^[a-z0-9_-]+$/,
      'Alias may only contain lowercase letters, numbers, hyphens, and underscores',
    ),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  alias: z.string().min(1),
  password: z.string().min(1),
});

export const recoverSchema = z.object({
  alias: z.string().min(1),
  seedPhrase: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RecoverInput = z.infer<typeof recoverSchema>;
