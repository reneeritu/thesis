/**
 * Deterministic RNG helpers for the generative certificate art.
 *
 * We want two guarantees:
 *   1. Given the same seed, the same picture is produced (down to sub-pixel).
 *   2. The seed itself is derived from immutable project facts (block hash of
 *      the project's completion + a per-session salt), so two different projects
 *      cannot accidentally collide.
 *
 * All randomness anywhere in the engine must flow through a `Rng` returned by
 * `rngFromString()` — no Math.random() elsewhere in the module.
 */

/** Cheap, stable 32-bit string hash (FNV-1a). */
export function fnv1a(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Mulberry32 — small, fast, deterministic PRNG. */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return function next() {
    t = (t + 0x6d2b79f5) >>> 0
    let r = t
    r = Math.imul(r ^ (r >>> 15), r | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export type Rng = {
  /** Uniform in [0, 1). */
  next(): number
  /** Uniform in [min, max). */
  range(min: number, max: number): number
  /** Uniform integer in [min, max]. */
  int(min: number, max: number): number
  /** Uniform pick from a non-empty array. */
  pick<T>(arr: readonly T[]): T
  /** Fair coin weighted at p (0 = never, 1 = always). */
  chance(p: number): boolean
  /** Gaussian-ish (sum of 3 uniforms, clamped to [-1, 1]). */
  gauss(): number
}

export function rngFromString(seed: string): Rng {
  const base = fnv1a(seed)
  const next = mulberry32(base)
  return {
    next,
    range(min: number, max: number) {
      return min + (max - min) * next()
    },
    int(min: number, max: number) {
      return Math.floor(min + (max - min + 1) * next())
    },
    pick<T>(arr: readonly T[]) {
      return arr[Math.floor(next() * arr.length)]
    },
    chance(p: number) {
      return next() < p
    },
    gauss() {
      const v = (next() + next() + next()) / 3
      return Math.max(-1, Math.min(1, (v - 0.5) * 2))
    },
  }
}

/**
 * Compose a stable seed string from the data that should drive the picture.
 * Order matters: reroll appends a suffix so the "meaning" bytes stay stable and
 * only the styling bytes wiggle.
 */
export function composeSeed(parts: {
  blockHash?: string
  projectId: string
  rerollIndex?: number
  version: string
}): string {
  return [
    parts.version,
    parts.projectId,
    parts.blockHash ?? '',
    parts.rerollIndex != null ? `r${parts.rerollIndex}` : '',
  ].join('|')
}
