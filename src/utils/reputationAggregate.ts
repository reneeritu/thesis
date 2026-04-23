import { chainDefaults } from '../config/defaults';
import type { IReputationCategories } from '../models/Node';

export const REPUTATION_CATEGORY_KEYS: (keyof IReputationCategories)[] = [
  'craft',
  'research',
  'collaboration',
  'pedagogy',
  'consistency',
  'community',
];

/**
 * Total headline reputation from the six category buckets.
 *
 * Each category is treated as 0..reputationCap when summing (so bad data still behaves).
 * The headline score is the sum, clamped to reputationFloor..reputationCap.
 *
 * So with per-category cap 1000, the sum can exceed 1000; the headline still caps at 1000.
 */
export function reputationScoreFromCategories(
  c: Partial<IReputationCategories> | null | undefined,
): number {
  if (!c || typeof c !== 'object') return chainDefaults.reputationFloor;
  let sum = 0;
  for (const k of REPUTATION_CATEGORY_KEYS) {
    const raw = Number(c[k]);
    const v = Number.isFinite(raw) ? raw : 0;
    sum += Math.min(chainDefaults.reputationCap, Math.max(0, v));
  }
  return Math.min(
    chainDefaults.reputationCap,
    Math.max(chainDefaults.reputationFloor, sum),
  );
}
