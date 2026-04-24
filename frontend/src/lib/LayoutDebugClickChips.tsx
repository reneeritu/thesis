import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

const PICK = 'etch-layout-pick'

type LayoutPickChip = {
  code: string
  /** Viewport position (px) for fixed chip (top-left of badge) */
  left: number
  top: number
  isActive: boolean
}

function collectChips(): LayoutPickChip[] {
  const activeNest = document.querySelector<HTMLElement>(
    '[data-layout-code].layout-debug-spotlight-active'
  )
  const activeZone = document.querySelector<HTMLElement>(
    '.layout-debug-zone.layout-debug-spotlight-active[data-layout-n]'
  )
  const activeCode =
    activeNest?.getAttribute('data-layout-code') ??
    (activeZone ? `z${activeZone.getAttribute('data-layout-n')}` : null)

  const out: LayoutPickChip[] = []

  document.querySelectorAll<HTMLElement>('[data-layout-code]').forEach((el) => {
    const code = el.getAttribute('data-layout-code')
    if (!code) return
    const r = el.getBoundingClientRect()
    if (r.width < 2 && r.height < 2) return
    out.push({
      code,
      left: r.left + 4,
      top: r.top + 4,
      isActive: activeCode === code,
    })
  })

  document.querySelectorAll<HTMLElement>('.layout-debug-zone[data-layout-n]').forEach((el) => {
    if (el.hasAttribute('data-layout-code')) return
    const n = el.getAttribute('data-layout-n')
    if (n == null) return
    const code = `z${n}`
    const r = el.getBoundingClientRect()
    if (r.width < 2 && r.height < 2) return
    out.push({
      code,
      left: r.left + 4,
      top: r.top + 4,
      isActive: activeCode === code,
    })
  })

  return out
}

type Props = {
  layoutOn: boolean
  detailOn: boolean
}

/**
 * Real clickable buttons over each layout-debug region (CSS ::after cannot receive clicks).
 * Top-left chip shows the same code as the dashed label (e.g. db-14) and picks that region.
 */
export function LayoutDebugClickChips({ layoutOn, detailOn }: Props) {
  const { pathname, search, key: routeKey } = useLocation()
  const [chips, setChips] = useState<LayoutPickChip[]>([])

  const refresh = useCallback(() => {
    if (!layoutOn) {
      setChips([])
      return
    }
    if (!detailOn) {
      if (!import.meta.env.DEV) return
      setChips(collectChips().filter((c) => c.code.startsWith('z')))
      return
    }
    setChips(collectChips())
  }, [layoutOn, detailOn])

  useEffect(() => {
    refresh()
  }, [refresh, pathname, search, routeKey])

  useEffect(() => {
    if (!layoutOn) return
    const t = window.setInterval(refresh, 400)
    const onVis = () => refresh()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('scroll', refresh, true)
    window.addEventListener('resize', refresh)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('scroll', refresh, true)
      window.removeEventListener('resize', refresh)
    }
  }, [layoutOn, refresh])

  useEffect(() => {
    const onSpotlight = () => refresh()
    window.addEventListener('etch-layout-spotlight-refresh', onSpotlight)
    return () => window.removeEventListener('etch-layout-spotlight-refresh', onSpotlight)
  }, [refresh])

  if (!import.meta.env.DEV || !layoutOn) {
    return null
  }
  if (chips.length === 0) {
    return null
  }

  return (
    <div
      className="layout-debug-pick-chips"
      style={{ zIndex: 2147483646, position: 'static', pointerEvents: 'none' }}
      aria-hidden
    >
      {chips.map((c) => (
        <button
          key={c.code}
          type="button"
          title="Click: spotlight this region and show its computed stacking (see dev panel)"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            window.dispatchEvent(
              new CustomEvent(PICK, { detail: { code: c.code }, bubbles: true })
            )
          }}
          className="pointer-events-auto floating-glass-panel"
          style={{
            position: 'fixed',
            left: c.left,
            top: c.top,
            zIndex: 2147483646,
            padding: '2px 6px',
            fontSize: 11,
            lineHeight: 1.25,
            fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
            borderRadius: 2,
            border: c.isActive
              ? '1px solid rgba(34, 211, 238, 0.9)'
              : '1px solid rgba(255, 255, 255, 0.35)',
            color: c.isActive ? 'rgb(200, 250, 255)' : 'rgb(200, 230, 255)',
            cursor: 'pointer',
            maxWidth: '7rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textAlign: 'left',
            textTransform: 'none',
            letterSpacing: '0.14em',
            touchAction: 'manipulation',
          }}
        >
          {c.code}
        </button>
      ))}
    </div>
  )
}
