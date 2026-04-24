import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'

const GRID_CHANGED = 'etch-layout-grid-changed'

export const LAYOUT_DEBUG_GRID_KEY = 'etchLayoutDebugGrid'
const LAYOUT_DEBUG_KEY = 'etchLayoutDebug'
export const LAYOUT_DEBUG_GRID_STEP_KEY = 'etchLayoutDebugGridStep'

const QUERY_ON = 'layoutGrid'
const QUERY_STEP = 'gridCell'

function parseCell(s: string | null): 8 | 16 | 24 {
  if (s === '8' || s === '16' || s === '24') return parseInt(s, 10) as 8 | 16 | 24
  return 16
}

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Read grid visibility + step from URL, then localStorage (dev / layout on only). */
export function readLayoutDebugGrid(sp: URLSearchParams): { show: boolean; cell: 8 | 16 | 24 } {
  if (!import.meta.env.DEV) {
    return { show: false, cell: 16 }
  }
  const mainOn = sp.get('layoutDebug') === '1' || lsGet(LAYOUT_DEBUG_KEY) === '1'
  if (!mainOn) {
    return { show: false, cell: 16 }
  }
  const show = sp.get(QUERY_ON) === '1' || lsGet(LAYOUT_DEBUG_GRID_KEY) === '1'
  let cell: 8 | 16 | 24 = 16
  const u = sp.get(QUERY_STEP)
  if (u) cell = parseCell(u)
  else cell = parseCell(lsGet(LAYOUT_DEBUG_GRID_STEP_KEY))
  return { show, cell }
}

/**
 * Subtle full-viewport line grid (dev). `pointer-events: none` — for explaining nudges by eye.
 * Sits under layout-debug chips / panel, above the app.
 */
export function LayoutDebugGridOverlay() {
  const [sp] = useSearchParams()
  const [rev, setRev] = useState(0)

  useEffect(() => {
    const h = () => setRev((x) => x + 1)
    window.addEventListener(GRID_CHANGED, h)
    return () => window.removeEventListener(GRID_CHANGED, h)
  }, [])

  const { show, cell } = useMemo(() => readLayoutDebugGrid(sp), [sp, rev])

  if (!import.meta.env.DEV || !show) {
    return null
  }

  const major = cell * 4
  const line = 'rgba(255, 255, 255, 0.04)'
  const lineMajH = 'rgba(255, 255, 255, 0.08)'
  const lineMajV = 'rgba(255, 255, 255, 0.07)'

  return createPortal(
    <div
      className="layout-debug-alignment-grid"
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483000,
        pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(${lineMajH} 1px, transparent 1px),
          linear-gradient(90deg, ${lineMajV} 1px, transparent 1px),
          linear-gradient(${line} 1px, transparent 1px),
          linear-gradient(90deg, ${line} 1px, transparent 1px)
        `,
        backgroundSize: `${major}px ${major}px, ${major}px ${major}px, ${cell}px ${cell}px, ${cell}px ${cell}px`,
        backgroundPosition: '0 0, 0 0, 0 0, 0 0',
      }}
    />,
    document.body
  )
}

export function layoutDebugGridSync(): void {
  window.dispatchEvent(new Event(GRID_CHANGED))
}

export { QUERY_ON as LAYOUT_DEBUG_QUERY_ON, QUERY_STEP as LAYOUT_DEBUG_QUERY_STEP }
