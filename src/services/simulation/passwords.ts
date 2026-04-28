import crypto from 'crypto';

const SIM_PASSWORD_SALT = 'sim_v1_salt';

/** Deterministic password for a sim alias (used internally only). */
export function simPassword(alias: string, simRunId: string): string {
  return crypto
    .createHash('sha256')
    .update(`${SIM_PASSWORD_SALT}:${simRunId}:${alias}`)
    .digest('hex')
    .slice(0, 32);
}
