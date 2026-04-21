/**
 * Public entrypoint for the Etch provenance-certificate generative engine.
 *
 * Usage (from a page or component):
 *
 * ```ts
 * import { renderSvg, DEFAULT_OPTIONS, type GenInput } from '@/lib/provenanceArt'
 *
 * const input: GenInput = {
 *   projectId, title, contributors,
 *   traceCount, pivotCount, referenceCount,
 *   blockHash,
 * }
 * const svg = renderSvg(input, DEFAULT_OPTIONS)
 * ```
 *
 * Nothing in this module touches the DOM, the API, or randomness outside the
 * seeded RNG — the same inputs always produce the same bytes.
 */

export { renderSvg, buildParams } from './render'
export {
  DEFAULT_OPTIONS,
  MAX_REROLLS,
  RENDERER_VERSION,
  MOTIFS,
  PALETTES,
  LINE_WEIGHTS,
  DENSITIES,
} from './types'
export type {
  Motif,
  PaletteId,
  LineWeight,
  Density,
  LayerFlags,
  GenInput,
  GenOptions,
  GenParams,
} from './types'
export { PALETTE_LIST, PALETTE_BY_ID } from './palettes'
