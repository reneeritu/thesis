import { forwardRef, useMemo } from 'react'
import { PartialPixelationEffect } from './PartialPixelationEffect'

export type PartialPixelationProps = {
  /** Screen-space grid resolution (higher = finer blocks inside a patch). */
  cellCount?: number
  /** Strength of the blocky layer inside a patch, 0–1. */
  pixelIntensity?: number
  /** Patch radius in UV space; smaller = tinier roving “windows”. */
  patchRadius?: number
}

/**
 * Roving patch pixelation: most of the frame stays sharp; a few small areas
 * are blocky and wander over time.
 */
export const PartialPixelation = forwardRef<PartialPixelationEffect, PartialPixelationProps>(
  ({ cellCount = 64, pixelIntensity = 0.88, patchRadius = 0.14 }, ref) => {
    const effect = useMemo(
      () =>
        new PartialPixelationEffect({
          cellCount,
          pixelIntensity,
          patchRadius,
        }),
      [cellCount, pixelIntensity, patchRadius],
    )

    return <primitive ref={ref} object={effect} />
  },
)

PartialPixelation.displayName = 'PartialPixelation'
