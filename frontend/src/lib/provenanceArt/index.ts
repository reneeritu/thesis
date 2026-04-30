/**
 * Public entrypoint for the Etch provenance-certificate generative engine.
 *
 * The engine renders a 3D IFS point cloud through Three.js. Consumers
 * typically mount a scene via `createIFSScene` and call `.capture()` to
 * save the result as a PNG.
 *
 * ```ts
 * import {
 *   createIFSScene,
 *   DEFAULT_OPTIONS,
 *   type GenInput,
 * } from '@/lib/provenanceArt'
 *
 * const scene = createIFSScene(container, input, DEFAULT_OPTIONS)
 * // ...orbit, customise, etc.
 * const dataUrl = scene.capture()
 * scene.dispose()
 * ```
 *
 * Everything in this module is deterministic per
 * `(projectId, blockHash, rerollIndex, options)` — same inputs always
 * produce the same point cloud bytes.
 */

export {
  buildParams,
  createIFSScene,
  generatePointCloud,
  renderSvg,
  type IFSPointCloud,
  type IFSSceneHandle,
} from './render'
export {
  DEFAULT_OPTIONS,
  MAX_REROLLS,
  RENDERER_VERSION,
} from './types'
export type { GenInput, GenOptions, GenParams } from './types'
