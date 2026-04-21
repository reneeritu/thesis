/**
 * Shared types for the generative certificate engine.
 *
 * The engine is intentionally pure: given `GenInput + GenOptions` it produces
 * a string of SVG. No side-effects, no DOM, no fetches.
 */

export const MOTIFS = ['facet', 'scatter', 'sigil', 'nebula'] as const
export type Motif = (typeof MOTIFS)[number]

export const PALETTES = [
  'cream_primaries', // ← default, matches Etch house style
  'cream_jewel',
  'charcoal_neon',
  'navy_spray',
  'monochrome',
  'cmyk',
] as const
export type PaletteId = (typeof PALETTES)[number]

export const LINE_WEIGHTS = ['hairline', 'regular', 'bold'] as const
export type LineWeight = (typeof LINE_WEIGHTS)[number]

export const DENSITIES = ['sparse', 'balanced', 'dense'] as const
export type Density = (typeof DENSITIES)[number]

export type LayerFlags = {
  /** Small marks around the composition, one per title character. */
  titleGlyphs: boolean
  /** Binary ring around the edge made of the last 16 bytes of the block hash. */
  provenanceBand: boolean
  /** One subtle tick mark per contributor inside the composition. */
  contributorTicks: boolean
}

/**
 * Project facts that drive the art. All of these are known at mint time.
 * `blockHash` is the completion block hash — the part that guarantees
 * uniqueness-across-projects.
 */
export type GenInput = {
  projectId: string
  title: string
  contributors: { alias: string; weight?: number }[]
  traceCount: number
  pivotCount: number
  referenceCount: number
  /** dominant activity type (optional) — nudges shape language toward angular / organic / layered. */
  dominantActivity?: string
  /** ISO block hash of completion, hex or base58. Missing → random but replay-stable via projectId. */
  blockHash?: string
  /** Duration of the project in days, used for overall density. */
  durationDays?: number
}

/** User-tunable knobs. */
export type GenOptions = {
  motif: Motif
  palette: PaletteId
  lineWeight: LineWeight
  density: Density
  layers: LayerFlags
  rerollIndex: number
}

/** Everything we'd need to re-render the exact same picture later. */
export type GenParams = {
  version: string // 'etch-gen-0.1'
  input: GenInput
  options: GenOptions
  seed: string
}

export const DEFAULT_OPTIONS: GenOptions = {
  motif: 'facet',
  palette: 'cream_primaries',
  lineWeight: 'regular',
  density: 'balanced',
  layers: {
    titleGlyphs: true,
    provenanceBand: true,
    contributorTicks: true,
  },
  rerollIndex: 0,
}

export const RENDERER_VERSION = 'etch-gen-0.1'

/** Max number of rerolls per session (user preference confirmed). */
export const MAX_REROLLS = 10
