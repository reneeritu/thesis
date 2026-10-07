import { z } from 'zod';
import { chainDefaults } from '../config/defaults';

const RESERVED_ALIASES = new Set([
  'admin',
  'system',
  'support',
  'etch',
  'null',
  'undefined',
  'root',
  'moderator',
]);

const aliasCharset = z
  .string()
  .trim()
  .toLowerCase()
  .min(chainDefaults.aliasMinLength)
  .max(chainDefaults.aliasMaxLength)
  .regex(
    /^[a-z0-9_-]+$/,
    'Alias may only contain lowercase letters, numbers, hyphens, and underscores',
  )
  .refine((alias) => !RESERVED_ALIASES.has(alias), 'This alias is reserved');

const aliasLogin = z.string().trim().toLowerCase().min(1);

export const registerSchema = z.object({
  alias: aliasCharset,
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  alias: aliasLogin,
  password: z.string().min(1),
});

export const recoverSchema = z.object({
  alias: aliasLogin,
  seedPhrase: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RecoverInput = z.infer<typeof recoverSchema>;
