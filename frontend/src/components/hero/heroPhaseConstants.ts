/** Shared with HeroSection (DOM) and HeroR3FScene (WebGL). */

export const HERO_SCROLL_VH = 1000
export const SCROLL_END_VH = `+=${HERO_SCROLL_VH}vh`

export const PHASE_P1_END = 0.2
export const PHASE_P2_END = 0.4
export const PHASE_P3_END = 0.9

export const PHASE_ORBITAL_START = PHASE_P2_END
export const PHASE_P3_ORBIT_END = PHASE_P3_END
export const ORBIT_SCROLL_SPAN = PHASE_P3_ORBIT_END - PHASE_ORBITAL_START

export const ORBIT_SNAP_STOPS: readonly number[] = [0.4, 0.525, 0.65, 0.775, 0.9]

export const MODEL_FADE_START_PROGRESS = 0.2
export const MODEL_FULL_OPACITY_PROGRESS = 0.28

export const ORBIT_SCRUB = 3.15
export const WORK_ORBIT_SEMI_A = 4
export const WORK_ORBIT_SEMI_B = 5
export const ORBIT_PLANE_TILT_DEG = 20
export const ORBIT_LINE_COLOR = 0x3b82f6

export function snapHeroProgress(raw: number): number {
  if (raw < PHASE_ORBITAL_START || raw > PHASE_P3_ORBIT_END) return raw
  let best = ORBIT_SNAP_STOPS[0]!
  let bestD = Math.abs(raw - best)
  for (const s of ORBIT_SNAP_STOPS) {
    const d = Math.abs(raw - s)
    if (d < bestD) {
      bestD = d
      best = s
    }
  }
  return best
}
