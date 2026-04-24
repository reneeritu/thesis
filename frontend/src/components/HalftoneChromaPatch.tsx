import { forwardRef, useEffect, useMemo } from 'react'
import { HalftoneChromaPatchEffect } from './HalftoneChromaPatchEffect'

export type HalftoneChromaPatchProps = {
  dotGrid?: number
  halftoneIntensity?: number
  patchRadius?: number
  /** 0..1 — drives dot density & overlap (high reputation = dense CMYK). */
  reputationNorm?: number
  /** Full-frame CMYK plate strength (AM dots; no film grain / bloom). */
  globalIridescence?: number
}

export const HalftoneChromaPatch = forwardRef<HalftoneChromaPatchEffect, HalftoneChromaPatchProps>(
  (
    {
      dotGrid = 100,
      halftoneIntensity = 0.78,
      patchRadius = 0.12,
      reputationNorm = 0.35,
      globalIridescence = 0.22,
    },
    ref,
  ) => {
    const effect = useMemo(
      () =>
        new HalftoneChromaPatchEffect({
          dotGrid,
          halftoneIntensity,
          patchRadius,
          reputationNorm,
          globalIridescence,
        }),
      [dotGrid, halftoneIntensity, patchRadius],
    )

    useEffect(() => {
      effect.setReputationNorm(reputationNorm)
    }, [effect, reputationNorm])

    useEffect(() => {
      effect.setGlobalIridescence(globalIridescence)
    }, [effect, globalIridescence])

    return <primitive ref={ref} object={effect} />
  },
)

HalftoneChromaPatch.displayName = 'HalftoneChromaPatch'
