/**
 * Code-splits the heavy 3D bundle (~three + r3f + postprocessing) and defers
 * mounting until the browser is idle (with a cap) so first paint and scroll
 * stay responsive. Parent pages import this instead of CrystalRadar3D.
 */
import { lazy, Suspense, useEffect, useState } from 'react'
import type { CrystalRadarProps } from './CrystalRadar3D'

const CrystalRadar3D = lazy(() =>
  import('./CrystalRadar3D').then((m) => ({ default: m.CrystalRadar3D })),
)

export type { CrystalRadarProps } from './CrystalRadar3D'

function Placeholder() {
  return (
    <div
      className="mx-auto aspect-square w-full max-w-[min(100%,42rem)] bg-grey-100/60 sm:max-w-[44rem] motion-safe:animate-pulse"
      aria-hidden
    />
  )
}

export function CrystalRadar3DLazy(props: CrystalRadarProps) {
  const [deferred, setDeferred] = useState(false)

  useEffect(() => {
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(
        () => {
          setDeferred(true)
        },
        { timeout: 450 },
      )
      return () => cancelIdleCallback(id)
    }
    const t = window.setTimeout(() => setDeferred(true), 32)
    return () => clearTimeout(t)
  }, [])

  if (!deferred) {
    return <Placeholder />
  }

  return (
    <Suspense fallback={<Placeholder />}>
      <CrystalRadar3D {...props} />
    </Suspense>
  )
}
