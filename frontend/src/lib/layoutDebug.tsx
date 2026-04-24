import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { clearLayoutTweakStyles, LayoutDebugTweakLayer } from './LayoutDebugTweakLayer'
import { LayoutDebugClickChips } from './LayoutDebugClickChips'
import {
  LAYOUT_DEBUG_GRID_KEY,
  LAYOUT_DEBUG_GRID_STEP_KEY,
  LAYOUT_DEBUG_QUERY_ON,
  LAYOUT_DEBUG_QUERY_STEP,
  LayoutDebugGridOverlay,
  layoutDebugGridSync,
  readLayoutDebugGrid,
} from './LayoutDebugGridOverlay'

const STORAGE_KEY = 'etchLayoutDebug'
const STORAGE_DETAIL_KEY = 'etchLayoutDebugDetail'
const STORAGE_UI_MIN = 'etchLayoutDebugUiMinimized'
const QUERY = 'layoutDebug'
const QUERY_DETAIL = 'layoutDetail'

function readUiMinimized(): boolean {
  try {
    return localStorage.getItem(STORAGE_UI_MIN) === '1'
  } catch {
    return false
  }
}

function persistUiMinimized(min: boolean) {
  try {
    if (min) {
      localStorage.setItem(STORAGE_UI_MIN, '1')
    } else {
      localStorage.removeItem(STORAGE_UI_MIN)
    }
  } catch {
    /* ignore */
  }
}

type NestProps = {
  className: string
  'data-layout-code'?: string
  'data-layout-name'?: string
  /** Pre-built label (code, name, optional spacing / Tailwind hints). */
  'data-layout-caption'?: string
}

function nestColorId(code: string): number {
  let h = 0
  for (let i = 0; i < code.length; i += 1) h = (h * 31 + code.charCodeAt(i)) >>> 0
  return (h % 8) + 1
}

function nestEntry(code: string, name: string, note?: string): NestProps {
  const c = nestColorId(code)
  const caption = note
    ? `${code} — ${name}  ·  ${note}`
    : `${code} — ${name}`
  return {
    className: `layout-debug-nest layout-debug--${c}`,
    'data-layout-code': code,
    'data-layout-name': name,
    'data-layout-caption': caption,
  }
}

/** `true` when `?layoutDebug=1` or `localStorage.etchLayoutDebug=1` (dev only). */
export function useLayoutDebug(): boolean {
  const [sp] = useSearchParams()
  return useMemo(() => {
    if (!import.meta.env.DEV) return false
    if (sp.get(QUERY) === '1') return true
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  }, [sp])
}

/**
 * Second level: nested boxes inside the page. Only when `useLayoutDebug()` is also on.
 * `?layoutDetail=1` or `localStorage.etchLayoutDebugDetail=1`
 */
export function useLayoutDebugDetail(): boolean {
  const [sp] = useSearchParams()
  return useMemo(() => {
    if (!import.meta.env.DEV) return false
    const mainOn =
      sp.get(QUERY) === '1' ||
      (() => {
        try {
          return localStorage.getItem(STORAGE_KEY) === '1'
        } catch {
          return false
        }
      })()
    if (!mainOn) return false
    if (sp.get(QUERY_DETAIL) === '1') return true
    try {
      return localStorage.getItem(STORAGE_DETAIL_KEY) === '1'
    } catch {
      return false
    }
  }, [sp])
}

/** Returns props to spread on a node (empty object when off). Optional `note` (Tailwind / gap) shown on the label. */
export function useLayoutNester() {
  const on = useLayoutDebug()
  const detail = useLayoutDebugDetail()
  return useCallback(
    (code: string, name: string, note?: string) => {
      if (!on || !detail) return {} as Record<string, never>
      return nestEntry(code, name, note) as NestProps
    },
    [on, detail]
  )
}

/** Merge into an existing `className` (App shell, page root, etc.). */
export function useLayoutPageMark(
  n: number,
  name: string
): { className: string; 'data-layout-n'?: string; 'data-layout-name'?: string } {
  const debug = useLayoutDebug()
  return useMemo(
    () => layoutPageMark(n, name, debug),
    [n, name, debug]
  )
}

export function layoutPageMark(
  n: number,
  name: string,
  debug: boolean
): { className: string; 'data-layout-n'?: string; 'data-layout-name'?: string } {
  if (!debug) return { className: '' }
  const c = ((n - 1) % 8) + 1
  return {
    className: `layout-debug-zone layout-debug--${c}`,
    'data-layout-n': String(n),
    'data-layout-name': name,
  }
}

/**
 * Renders: body class for CSS, floating dev controls (bottom-left).
 * Enable: `?layoutDebug=1`, or click, or `localStorage.etchLayoutDebug=1` + refresh.
 * Detail: `?layoutDetail=1` (after main is on) or second button.
 */
export function LayoutDebugRoot() {
  const on = useLayoutDebug()
  const detail = useLayoutDebugDetail()
  const [uiMinimized, setUiMinimized] = useState(readUiMinimized)

  useEffect(() => {
    if (!import.meta.env.DEV) return
    document.body.classList.toggle('layout-debug-active', on)
    document.body.classList.toggle('layout-debug-detail-active', on && detail)
    return () => {
      document.body.classList.remove('layout-debug-active')
      document.body.classList.remove('layout-debug-detail-active')
    }
  }, [on, detail])

  const expandUi = useCallback(() => {
    setUiMinimized(false)
    persistUiMinimized(false)
  }, [])

  const minimizeUi = useCallback(() => {
    setUiMinimized(true)
    persistUiMinimized(true)
  }, [])

  if (!import.meta.env.DEV) {
    return null
  }

  if (uiMinimized) {
    return (
      <button
        type="button"
        onClick={expandUi}
        title="Show layout debug tools (grid, spotlight, regions)"
        className="etch-float-caps pointer-events-auto fixed bottom-3 left-2 z-[2147483647] rounded border border-cyan-400/50 floating-glass-panel px-2.5 py-1.5 text-cyan-100 hover:border-cyan-300/70"
      >
        Layout tools
      </button>
    )
  }

  return (
    <>
      <LayoutDebugGridOverlay />
      <LayoutDebugClickChips layoutOn={on} detailOn={detail} />
      <LayoutDebugPanel onMinimizeUi={minimizeUi} />
    </>
  )
}

type RegionRow = { code: string; label: string }

function collectLayoutRegions(): RegionRow[] {
  const byCode = new Map<string, string>()

  document.querySelectorAll<HTMLElement>('[data-layout-code]').forEach((el) => {
    const code = el.getAttribute('data-layout-code')
    if (!code) return
    const label = el.getAttribute('data-layout-name')?.trim() || code
    if (!byCode.has(code)) byCode.set(code, label)
  })

  document.querySelectorAll<HTMLElement>('.layout-debug-zone[data-layout-n]').forEach((el) => {
    if (el.hasAttribute('data-layout-code')) return
    const n = el.getAttribute('data-layout-n')
    if (n == null) return
    const code = `z${n}`
    const label = el.getAttribute('data-layout-name')?.trim() || `Zone ${n}`
    if (!byCode.has(code)) byCode.set(code, label)
  })

  return [...byCode.entries()]
    .map(([code, label]) => ({ code, label }))
    .sort((a, b) =>
      a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' })
    )
}

type PanelProps = {
  onMinimizeUi: () => void
}

function LayoutDebugPanel({ onMinimizeUi }: PanelProps) {
  const on = useLayoutDebug()
  const detail = useLayoutDebugDetail()
  const [sp, setSp] = useSearchParams()
  const { pathname, search } = useLocation()
  const [rows, setRows] = useState<RegionRow[]>([])
  const [spotlight, setSpotlight] = useState<string | null>(null)
  const [spotlightEl, setSpotlightEl] = useState<HTMLElement | null>(null)
  const [stackingInfo, setStackingInfo] = useState('')
  const [tweakOn, setTweakOn] = useState(false)

  const setLayout = useCallback(
    (next: boolean) => {
      try {
        if (next) {
          localStorage.setItem(STORAGE_KEY, '1')
        } else {
          localStorage.removeItem(STORAGE_KEY)
          localStorage.removeItem(STORAGE_DETAIL_KEY)
          localStorage.removeItem(LAYOUT_DEBUG_GRID_KEY)
          localStorage.removeItem(LAYOUT_DEBUG_GRID_STEP_KEY)
        }
      } catch {
        /* ignore */
      }
      setSp(
        (prev) => {
          const p = new URLSearchParams(prev)
          if (next) p.set(QUERY, '1')
          else {
            p.delete(QUERY)
            p.delete(QUERY_DETAIL)
            p.delete(LAYOUT_DEBUG_QUERY_ON)
            p.delete(LAYOUT_DEBUG_QUERY_STEP)
          }
          return p
        },
        { replace: true }
      )
      if (!next) {
        layoutDebugGridSync()
      }
    },
    [setSp]
  )

  const setDetail = useCallback(
    (next: boolean) => {
      if (!on) return
      try {
        if (next) {
          localStorage.setItem(STORAGE_DETAIL_KEY, '1')
        } else {
          localStorage.removeItem(STORAGE_DETAIL_KEY)
        }
      } catch {
        /* ignore */
      }
      setSp(
        (prev) => {
          const p = new URLSearchParams(prev)
          if (next) p.set(QUERY_DETAIL, '1')
          else p.delete(QUERY_DETAIL)
          return p
        },
        { replace: true }
      )
    },
    [on, setSp]
  )

  const grid = useMemo(() => readLayoutDebugGrid(sp), [sp])

  const setGrid = useCallback(
    (next: boolean) => {
      if (!on) return
      const { cell: c } = readLayoutDebugGrid(sp)
      try {
        if (next) {
          localStorage.setItem(LAYOUT_DEBUG_GRID_KEY, '1')
          localStorage.setItem(LAYOUT_DEBUG_GRID_STEP_KEY, String(c))
        } else {
          localStorage.removeItem(LAYOUT_DEBUG_GRID_KEY)
        }
      } catch {
        /* ignore */
      }
      setSp(
        (prev) => {
          const p = new URLSearchParams(prev)
          if (next) {
            p.set(LAYOUT_DEBUG_QUERY_ON, '1')
            p.set(LAYOUT_DEBUG_QUERY_STEP, String(c))
          } else {
            p.delete(LAYOUT_DEBUG_QUERY_ON)
            p.delete(LAYOUT_DEBUG_QUERY_STEP)
          }
          return p
        },
        { replace: true }
      )
      layoutDebugGridSync()
    },
    [on, setSp, sp]
  )

  const setGridCell = useCallback(
    (c: 8 | 16 | 24) => {
      try {
        localStorage.setItem(LAYOUT_DEBUG_GRID_STEP_KEY, String(c))
      } catch {
        /* ignore */
      }
      setSp(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.set(LAYOUT_DEBUG_QUERY_STEP, String(c))
          return p
        },
        { replace: true }
      )
      layoutDebugGridSync()
    },
    [setSp]
  )

  /* Only clear on real navigation. Clearing on layout/detail toggles was wiping selection
     and (with the old dimming CSS) made the page feel broken. */
  useLayoutEffect(() => {
    setSpotlight(null)
  }, [pathname, search])

  useEffect(() => {
    if (!spotlight) setTweakOn(false)
  }, [spotlight])

  useEffect(() => {
    if (!on) {
      setTweakOn(false)
    }
  }, [on])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const h = (e: Event) => {
      const d = (e as CustomEvent<{ code: string }>).detail
      if (d?.code) setSpotlight((prev) => (prev === d.code ? null : d.code))
    }
    window.addEventListener('etch-layout-pick', h)
    return () => window.removeEventListener('etch-layout-pick', h)
  }, [])

  useEffect(() => {
    if (!spotlightEl) {
      setStackingInfo('')
      return
    }
    const cs = getComputedStyle(spotlightEl)
    setStackingInfo(
      `z-index: ${cs.zIndex}  ·  position: ${cs.position}  ·  isolation: ${cs.isolation}  ·  display: ${cs.display}`
    )
  }, [spotlightEl, spotlight])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    if (!on) {
      setSpotlight(null)
      setRows([])
      setSpotlightEl(null)
      setTweakOn(false)
      document.body.classList.remove('layout-debug-spotlight-on')
      document
        .querySelectorAll<HTMLElement>('.layout-debug-spotlight-active')
        .forEach((el) => el.classList.remove('layout-debug-spotlight-active'))
      return
    }

    const id = requestAnimationFrame(() => {
      setRows(collectLayoutRegions())
      document
        .querySelectorAll<HTMLElement>('.layout-debug-nest, .layout-debug-zone')
        .forEach((e) => e.classList.remove('layout-debug-spotlight-active'))

      if (!spotlight) {
        document.body.classList.remove('layout-debug-spotlight-on')
        setSpotlightEl(null)
        window.dispatchEvent(new Event('etch-layout-spotlight-refresh'))
        return
      }

      let target: HTMLElement | null = null
      if (spotlight.startsWith('z')) {
        const n = spotlight.slice(1)
        target = document.querySelector<HTMLElement>(
          `.layout-debug-zone[data-layout-n="${n}"]`
        )
      } else {
        const esc = typeof CSS !== 'undefined' && 'escape' in CSS ? CSS.escape(spotlight) : spotlight
        target = document.querySelector<HTMLElement>(`[data-layout-code="${esc}"]`)
      }
      if (target) {
        document.body.classList.add('layout-debug-spotlight-on')
        target.classList.add('layout-debug-spotlight-active')
        setSpotlightEl(target)
        requestAnimationFrame(() => {
          target?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
          window.dispatchEvent(new Event('etch-layout-spotlight-refresh'))
        })
      } else {
        document.body.classList.remove('layout-debug-spotlight-on')
        setSpotlightEl(null)
        window.dispatchEvent(new Event('etch-layout-spotlight-refresh'))
      }
    })
    return () => cancelAnimationFrame(id)
  }, [on, detail, spotlight, pathname, search])

  useEffect(() => {
    if (!on) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSpotlight(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [on])

  return (
    <div className="pointer-events-none fixed bottom-2 left-2 z-[2147483647] flex max-w-[min(100vw-1rem,17rem)] flex-col gap-1 text-white/90">
      <button
        type="button"
        onClick={onMinimizeUi}
        title="Hide all layout debug controls except a small “Layout tools” button"
        className="etch-float-prose pointer-events-auto mb-0.5 w-full rounded border border-white/15 bg-white/5 px-2 py-1 text-white/55 hover:border-white/25 hover:text-white/80"
      >
        Hide layout controls
      </button>
      <button
        type="button"
        onClick={() => setLayout(!on)}
        title="Toggle app shell + page region outlines. ?layoutDebug=1"
        className="etch-float-caps pointer-events-auto rounded border border-white/30 floating-glass-panel px-2 py-1.5 text-left hover:border-white/50"
      >
        Layout: <span className="text-yellow-300/95">{on ? 'on' : 'off'}</span>
      </button>
      {on ? (
        <button
          type="button"
          onClick={() => setDetail(!detail)}
          title="Show nested blocks on pages that opt in (e.g. Dashboard), plus layout notes. ?layoutDetail=1"
          className="etch-float-caps pointer-events-auto rounded border border-white/30 floating-glass-panel px-2 py-1.5 text-left hover:border-white/50"
        >
          + Detail: <span className="text-cyan-300/95">{detail ? 'on' : 'off'}</span>
        </button>
      ) : null}
      {on ? (
        <div className="pointer-events-auto flex max-w-full flex-col gap-1 rounded border border-white/20 floating-glass-panel px-2 py-1.5 text-white/75">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className="etch-float-prose min-w-0 leading-snug text-white/50">
              Soft grid (reference only) — <span className="text-white/65">?{LAYOUT_DEBUG_QUERY_ON}=1</span> · major
              every 4 cells
            </span>
            <button
              type="button"
              onClick={() => setGrid(!grid.show)}
              title="Toggle a faint line grid to describe shifts (e.g. “move 2 lines left”). Clicks pass through."
              className="etch-float-caps shrink-0 rounded border border-white/30 bg-black/60 px-2 py-0.5 text-white/90 hover:border-white/50"
            >
              Grid: <span className="text-amber-200/95">{grid.show ? 'on' : 'off'}</span>
            </button>
          </div>
          {grid.show ? (
            <div className="flex flex-wrap items-center gap-0.5">
              <span className="etch-float-prose w-full text-white/40">
                Cell size (finer / major lines scale together)
              </span>
              {([8, 16, 24] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setGridCell(n)}
                  className={
                    grid.cell === n
                      ? 'etch-float-prose rounded border border-amber-400/60 bg-amber-500/20 px-1.5 py-0.5 font-mono tabular-nums text-amber-100'
                      : 'etch-float-prose rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono tabular-nums text-white/80 hover:border-white/30'
                  }
                >
                  {n}px
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {on && (detail || rows.length > 0) ? (
        <div
          className="pointer-events-auto max-h-[min(18rem,45vh)] overflow-y-auto overflow-x-hidden rounded border border-white/20 floating-glass-panel py-1.5 pl-1.5 pr-1"
          role="listbox"
          aria-label="Layout regions — click to spotlight, Esc to clear"
        >
          <div className="mb-1 border-b border-white/15 px-0.5 pb-1 pr-0.5 text-white/70">
            <span className="etch-float-prose">
              Spotlight <span className="text-white/50">(Esc = clear)</span>
            </span>
            {spotlight ? (
              <button
                type="button"
                onClick={() => setSpotlight(null)}
                className="etch-float-caps ml-1 rounded border border-white/25 bg-white/5 px-1 py-0.5 text-yellow-200/90 hover:border-white/40"
              >
                clear
              </button>
            ) : null}
            <p className="etch-float-prose mt-0.5 leading-snug text-white/50">
              Click the <span className="font-mono text-cyan-200/90">code tag</span> (top-left of each box) to pick a
              region, or use the list below.
            </p>
            {spotlight ? (
              <div className="mt-0.5 rounded border border-white/10 bg-black/40 px-1 py-0.5 text-white/85">
                <p className="etch-float-prose text-white/90">
                  {rows.find((r) => r.code === spotlight)?.label ?? spotlight}
                </p>
                {stackingInfo ? (
                  <p className="etch-float-prose mt-0.5 break-words font-mono text-cyan-200/90">{stackingInfo}</p>
                ) : null}
              </div>
            ) : null}
          </div>
          {rows.length === 0 ? (
            <p className="etch-float-prose px-1.5 text-white/45">No regions on this view yet.</p>
          ) : (
            rows.map((r) => {
              const active = spotlight === r.code
              return (
                <button
                  key={r.code}
                  type="button"
                  className={
                    active
                      ? 'etch-float-prose mb-0.5 w-full rounded border border-cyan-400/50 bg-cyan-900/30 px-1.5 py-0.5 text-left last:mb-0'
                      : 'etch-float-prose mb-0.5 w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 text-left font-normal last:mb-0 hover:border-white/20 hover:bg-white/5'
                  }
                  onClick={() => setSpotlight((prev) => (prev === r.code ? null : r.code))}
                  title={r.label}
                >
                  <span className="font-mono text-cyan-200/90">{r.code}</span>
                  <span className="block truncate text-white/80" title={r.label}>
                    {r.label}
                  </span>
                </button>
              )
            })
          )}
        </div>
      ) : null}
      {on && spotlight && spotlightEl ? (
        <div className="pointer-events-auto flex max-w-full flex-col gap-0.5 rounded border border-white/20 floating-glass-panel px-2 py-1.5 text-white/70">
          <div className="flex flex-wrap items-center justify-between gap-1 leading-tight text-white/50">
            <span className="etch-float-prose">Live adjust (inline only)</span>
            <button
              type="button"
              onClick={() => setTweakOn((v) => !v)}
              className="etch-float-caps rounded border border-amber-400/40 bg-amber-500/10 px-1.5 py-0.5 text-amber-200/95 hover:border-amber-300/60"
            >
              {tweakOn ? 'adjust: on' : 'adjust: off'}
            </button>
          </div>
          {tweakOn ? (
            <p className="etch-float-prose leading-tight text-white/45">
              Yellow top strip: drag to move. Bottom-right: drag to resize. Dev-only; can fight flex/grid—Reset or
              refresh.
            </p>
          ) : null}
          {tweakOn ? (
            <button
              type="button"
              onClick={() => clearLayoutTweakStyles(spotlightEl)}
              className="etch-float-caps self-start rounded border border-white/20 px-1.5 py-0.5 text-white/80 hover:border-white/40"
            >
              reset styles
            </button>
          ) : null}
        </div>
      ) : null}
      <LayoutDebugTweakLayer el={spotlightEl} enabled={tweakOn && on && Boolean(spotlight && spotlightEl)} />
    </div>
  )
}

export function layoutDebugZoneClass(
  id: 1 | 2 | 3 | 4 | 5 | 6,
  enabled: boolean
): string {
  if (!enabled) return ''
  return `layout-debug-zone layout-debug--${id}`
}
