import { getProject, val } from '@theatre/core'
import type { ISheet } from '@theatre/core'

import etchTheatreBundledState from './etchTheatre.state.json'

/**
 * Theatre project id — must match the project name in Studio and the argument to
 * `studio.createContentOfSaveFile(...)`. Do not rename without updating Studio + devtools.
 */
export const ETCH_THEATRE_PROJECT_ID = 'ETCH' as const

/** Sequence length in seconds — used when the sheet has no length yet. */
export const ETCH_MAIN_SEQUENCE_DURATION = 10

/**
 * Intro segment on sheet `Main`: seconds [0, {@link ETCH_INTRO_END_SECONDS}).
 * Played once on `/welcome` mount via {@link playWelcomeIntro}; keyframe the “E” drop here in Studio.
 */
export const ETCH_INTRO_END_SECONDS = 2

/**
 * Object key for the GLB “E” logo on sheet `Main`.
 * Must match `<EditableMesh theatreKey="…">` in `HeroR3FScene` so Studio shows one editable (keyframe position / rotation / scale for the drop).
 */
export const E_LOGO_THEATRE_OBJECT_KEY = 'e logo' as const

function isNonEmptyBundledTheatreState(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && Object.keys(value as object).length > 0
}

const etchProject = getProject(
  ETCH_THEATRE_PROJECT_ID,
  isNonEmptyBundledTheatreState(etchTheatreBundledState)
    ? { state: etchTheatreBundledState }
    : undefined,
)

/** Sheet for manual keyframing (Studio). Objects `e logo` / `Card 1`…`Card 5` are created by `@theatre/r3f` editables. */
export const mainSheet: ISheet = etchProject.sheet('Main')

/**
 * Plays the intro segment [0, {@link ETCH_INTRO_END_SECONDS}] once (e.g. “E” drop). Resolves when playback finishes.
 * Call before wiring Lenis scroll to the sequence.
 */
export async function playWelcomeIntro(): Promise<void> {
  await etchProject.ready
  const seq = mainSheet.sequence
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    const duration = val(seq.pointer.length)
    const len =
      Number.isFinite(duration) && duration > 0 ? duration : ETCH_MAIN_SEQUENCE_DURATION
    seq.position = Math.min(ETCH_INTRO_END_SECONDS, len)
    seq.pause()
    return
  }
  seq.position = 0
  await seq.play({ range: [0, ETCH_INTRO_END_SECONDS] })
  seq.pause()
}

/**
 * Maps normalized scroll [0, 1] to the Theatre sequence playhead from {@link ETCH_INTRO_END_SECONDS} to the end of the sequence.
 * Use only after the intro has finished (Lenis bridge).
 */
export function applyScrollProgressToTheatreSequence(progress01: number): void {
  if (!etchProject.isReady) return
  const t = Math.min(1, Math.max(0, progress01))
  const seq = mainSheet.sequence
  const duration = val(seq.pointer.length)
  const len = Number.isFinite(duration) && duration > 0 ? duration : ETCH_MAIN_SEQUENCE_DURATION
  const start = Math.min(ETCH_INTRO_END_SECONDS, len)
  const span = Math.max(0, len - start)
  seq.position = start + t * span
}

export { etchProject }
