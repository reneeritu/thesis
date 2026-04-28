import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { DefTerm } from '../components/DefTerm'
import { CrystalRadar3DLazy } from '../components/CrystalRadar3DLazy'
import { RadarModeDecoyStrip } from '../components/RadarModeDecoyStrip'
import { useDefinitions } from '../context/DefinitionsContext'
import { useTheme } from '../context/ThemeContext'
import { api } from '../lib/api'
import { getAlias } from '../lib/session'
import { useLayoutNester } from '../lib/layoutDebug'
import {
  CATEGORY_COLOURS,
  CATEGORY_LABELS,
  type ReputationCategory,
} from '../lib/reputationColours'

type SpaceWithName = {
  id: string
  name: string
}

type NodeProfile = {
  _id?: string
  alias: string
  reputationScore?: number
  reputationCategories?: {
    craft?: number
    research?: number
    collaboration?: number
    pedagogy?: number
    consistency?: number
    community?: number
  }
  badges?: string[]
  spacesWithNames?: SpaceWithName[]
}

type Project = {
  _id: string
  title: string
  status: string
}

type ProjectRow = {
  project?: Project
  spaceName?: string
  spaceId?: string
  error?: string
}

type RecentReputation = {
  days: number
  since: string
  traceCount: number
  categories: {
    craft: number
    research: number
    collaboration: number
    pedagogy: number
    consistency: number
    community: number
  }
}

type DashboardState = {
  me: NodeProfile | null
  rows: ProjectRow[]
  recent: RecentReputation | null
}

const initialState: DashboardState = {
  me: null,
  rows: [],
  recent: null,
}

const DASHBOARD_CATEGORIES: ReputationCategory[] = [
  'craft',
  'research',
  'collaboration',
  'pedagogy',
  'consistency',
  'community',
]

export default function DashboardPage() {
  const [state, setState] = useState<DashboardState>(initialState)
  const [error, setError] = useState<string | null>(null)
  const { definitionsOn, setDefinitionsOn } = useDefinitions()
  const { theme, toggleTheme } = useTheme()
  const mark = useLayoutNester()
  const nx = useCallback(
    (base: string, code: string, name: string, note?: string) => {
      const p = mark(code, name, note) as { className?: string } & Record<
        string,
        string | undefined
      >
      if (!p.className) return { className: base }
      return { ...p, className: [base, p.className].filter(Boolean).join(' ') }
    },
    [mark]
  )

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const alias = getAlias()
        const [me, recent] = await Promise.all([
          api<NodeProfile>('/nodes/' + encodeURIComponent(alias)),
          api<RecentReputation>('/nodes/' + encodeURIComponent(alias) + '/reputation/recent?days=90').catch(
            () => null,
          ),
        ])
        const spaces = me.spacesWithNames ?? []
        const rows: ProjectRow[] = []

        for (const space of spaces) {
          try {
            const list = await api<Project[]>('/projects/space/' + encodeURIComponent(space.id))
            for (const p of list) {
              rows.push({
                project: p,
                spaceName: space.name,
                spaceId: space.id,
              })
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to load projects'
            rows.push({
              error: msg,
              spaceName: space.name,
              spaceId: space.id,
            })
          }
        }

        if (!cancelled) {
          setState({ me, rows, recent })
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load dashboard')
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const { me, rows, recent } = state
  const spaces = me?.spacesWithNames ?? []
  const badges = me?.badges ?? []
  const errorRows = rows.filter((r) => r.error)

  const catVals = Object.values(me?.reputationCategories ?? {})
  const emptyChain = me != null
    && catVals.length > 0
    && catVals.every((v) => !v || v === 0)
    && (me.reputationScore == null || me.reputationScore === 0)
    && spaces.length > 0

  return (
    <AppShell title="Dashboard">
      <div
        {...nx(
          'flex h-full min-h-0 flex-col space-y-3',
          'db-01',
          'Page root (fills main; 100vh includes header via App shell)',
          'h-full · space-y-2',
        )}
      >
        {error ? (
          <p
            {...nx(
              'glassmorphic-light contour-border-accent px-3 py-2 text-small font-mono text-white',
              'db-02',
              'Error banner',
              'px-3 py-2',
            )}
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {me ? (
          <div
            {...nx(
              'flex min-h-0 flex-1 flex-col gap-3 overflow-visible',
              'db-03',
              'Main column (rep + list)',
              'overflow-visible so crystal halftone + rings are not clipped',
            )}
          >
            <section
              {...nx(
                'flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-visible',
                'db-04',
                'Top block (node + 3D + rails)',
                'overflow-visible for 3D + glow past grid cells',
              )}
            >
              <div
                {...nx(
                  'flex shrink-0 flex-col gap-0.5',
                  'db-05',
                  'Alias + node row (tight stack)',
                  'gap-0.5',
                )}
              >
                <p
                  {...nx(
                    'm-0 shrink-0 text-h3 font-heading leading-tight text-white',
                    'db-05a',
                    'Node alias',
                  )}
                >
                  <DefTerm term="node_label">{me.alias}</DefTerm>
                </p>
                <div
                  {...nx(
                    'relative z-20 flex min-h-0 shrink-0 flex-wrap items-center gap-2',
                    'db-06',
                    'node:id · copy icon · Theme · Hints',
                    'flex-wrap · gap-2 · z-20',
                  )}
                >
                {me._id ? (
                  <span
                    className="min-w-0 max-w-full truncate font-mono text-small text-white/50 tracking-widest"
                    title={String(me._id)}
                  >
                    node:{String(me._id)}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin.replace(/\/$/, '')}/nodes/${encodeURIComponent(me.alias)}`
                    void navigator.clipboard.writeText(url).catch(() => {})
                  }}
                  title="Copy a link to your public node profile"
                  aria-label="Copy profile link"
                  className="inline-flex shrink-0 items-center justify-center rounded p-0.5 text-white/55 transition [touch-action:manipulation] hover:text-white"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <rect x="5.25" y="5.25" width="7.5" height="7.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
                    <rect x="3.25" y="3.25" width="7.5" height="7.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                </button>
                <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0">
                  <button
                    type="button"
                    onClick={() => toggleTheme()}
                    className="border border-white/30 glassmorphic-light contour-border-neutral px-2 py-0.5 text-small font-mono uppercase tracking-[0.16em] text-white transition-etch [touch-action:manipulation]"
                    aria-label={`Switch theme (currently ${theme})`}
                    title="Switch between dark and light appearance"
                  >
                    Theme: {theme}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDefinitionsOn(!definitionsOn)}
                    className="border border-white/30 glassmorphic-light contour-border-neutral px-2 py-0.5 text-small font-mono uppercase tracking-[0.16em] text-white transition-etch [touch-action:manipulation]"
                    aria-pressed={definitionsOn}
                    title="Show or hide inline definitions under form fields"
                  >
                    Hints: {definitionsOn ? 'on' : 'off'}
                  </button>
                </div>
              </div>
              </div>

              <div
                {...nx(
                  'min-h-0 flex-1 overflow-visible',
                  'db-07',
                  'Chart area wrapper',
                  'overflow-visible — do not clip crystal / rings / halftone',
                )}
              >
                <div
                  {...nx(
                    'dashboard-crystal-row h-full min-h-0',
                    'db-08',
                    'Named grid: legend · crystal · rail (see app-atmosphere.css)',
                    'lg: 9.5rem + 1fr + 7.5rem',
                  )}
                >
                  <aside
                    {...nx(
                      'dashboard-crystal-row__legend flex min-h-0 flex-col justify-center gap-1.5 pr-0 pt-0 lg:pt-0',
                      'db-09',
                      'Left: category list',
                      'grid-area legend · flex-col · gap-1.5',
                    )}
                  >
                    {DASHBOARD_CATEGORIES.map((key) => {
                      const n = Math.round(Number(me.reputationCategories?.[key] ?? 0))
                      return (
                        <div
                          key={key}
                          className="grid grid-cols-[auto_1fr_auto] items-center gap-x-1.5 text-small font-mono uppercase tracking-[0.12em]"
                        >
                          <span
                            className="inline-block h-2.5 w-2.5 shrink-0 translate-y-px rounded-[1px]"
                            style={{ background: CATEGORY_COLOURS[key] }}
                            aria-hidden
                          />
                          <span className="min-w-0 truncate text-white/90">{CATEGORY_LABELS[key]}</span>
                          <span className="tabular-nums text-white">{n}</span>
                        </div>
                      )
                    })}
                  </aside>

                  <div
                    {...nx(
                      'dashboard-crystal-row__crystal flex min-h-0 min-w-0 flex-col items-center justify-center gap-0.5 overflow-visible',
                      'db-10',
                      'Center column (crystal + trace note)',
                      'grid-area crystal · overflow-visible',
                    )}
                  >
                    <div
                      {...nx(
                        'relative z-0 flex min-h-0 w-full min-w-0 max-w-[min(100%,82rem)] flex-1 flex-col items-center justify-center overflow-visible',
                        'db-11',
                        'Crystal 3D container',
                        'overflow-visible',
                      )}
                    >
                      <CrystalRadar3DLazy
                        categories={me.reputationCategories}
                        recentCategories={recent?.categories}
                        aggregateReputationScore={me.reputationScore}
                        className="w-full min-w-0 max-w-full"
                        showDefinitions={definitionsOn}
                        theme={theme}
                      />
                    </div>
                    {recent ? (
                      <p
                        {...nx(
                          'shrink-0 text-center font-mono text-small uppercase tracking-[0.16em] text-white/90',
                          'db-12',
                          'Ghost / trace line',
                          'text-small · uppercase',
                        )}
                      >
                        Ghost layer = last {recent.days} d · {recent.traceCount} trace
                        {recent.traceCount === 1 ? '' : 's'}
                      </p>
                    ) : null}
                  </div>

                  <aside
                    {...nx(
                      'dashboard-crystal-row__rail flex min-h-0 flex-col content-start items-end justify-center gap-5 pb-1 pt-0 text-right sm:pt-0 lg:pt-0',
                      'db-13',
                      'Right rail: Spaces + Active projects',
                      'grid-area rail · items-end · gap-4',
                    )}
                  >
                    <div
                      {...nx('space-y-1.5', 'db-14', 'Spaces block', 'space-y-1.5')}
                    >
                      <p className="font-mono text-small uppercase tracking-[0.2em] text-white/70">Spaces</p>
                      <div className="flex flex-col items-end gap-1.5 text-small font-mono uppercase tracking-[0.16em]">
                        <Link
                          to="/spaces"
                          className="glassmorphic-light contour-border-cool px-2.5 py-0.5 transition-etch sm:px-3 sm:py-1"
                        >
                          View all
                        </Link>
                        <Link
                          to="/spaces/new"
                          className="glassmorphic-light contour-wireframe px-2.5 py-0.5 text-yellow-600 transition-etch sm:px-3 sm:py-1"
                        >
                          + New
                        </Link>
                      </div>
                    </div>
                    <div
                      {...nx('space-y-1.5', 'db-15', 'Active projects block', 'space-y-1.5')}
                    >
                      <p className="font-mono text-small uppercase tracking-[0.2em] text-white/70">
                        <DefTerm term="active_projects">Active projects</DefTerm>
                      </p>
                      <div className="flex flex-col items-end gap-1.5 text-small font-mono uppercase tracking-[0.16em]">
                        <Link
                          to="/projects"
                          className="glassmorphic-light contour-border-cool px-2.5 py-0.5 transition-etch sm:px-3 sm:py-1"
                        >
                          View all
                        </Link>
                        <Link
                          to="/projects/new"
                          className="glassmorphic-light contour-wireframe px-2.5 py-0.5 text-yellow-600 transition-etch sm:px-3 sm:py-1"
                        >
                          + New
                        </Link>
                      </div>
                    </div>
                  </aside>
                </div>
                <RadarModeDecoyStrip className="mt-1 w-fit" />
              </div>

              {badges.length ? (
                <div
                  {...nx(
                    'shrink-0 space-y-1.5 border-t border-white/10 pt-3',
                    'db-16',
                    'Badges row',
                    'border-t · pt-2 · flex-wrap · gap-2 children',
                  )}
                >
                  <div className="flex flex-wrap gap-2">
                    {badges.map((b) => (
                      <span
                        key={b}
                        className="glassmorphic-light contour-border-accent glow-subtle px-2 py-0.5 text-small font-mono uppercase tracking-[0.16em] text-yellow-400"
                      >
                        {String(b).toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            {emptyChain || errorRows.length > 0 ? (
              <div className="min-h-0 w-full min-w-0 max-h-[min(50dvh,22rem)] shrink-0 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]">
                {emptyChain ? (
                  <section
                    {...nx(
                      'glassmorphic-light contour-border-accent contour-pattern space-y-2 p-3 sm:p-4',
                      'db-18',
                      '“Your chain is empty” card',
                      'p-3 sm:p-4 · glass panel',
                    )}
                  >
                    <p className="font-mono text-small uppercase tracking-[0.18em] text-white">Your chain is empty</p>
                    <p className="text-body text-small">
                      Your chain starts here — log your first <DefTerm term="trace">trace</DefTerm> to see it appear.
                    </p>
                    <div className="flex flex-wrap gap-2 text-small font-mono uppercase tracking-[0.18em]">
                      <Link
                        to="/projects"
                        className="glassmorphic-light contour-wireframe px-3 py-1 text-white transition-etch hover:text-yellow-400"
                      >
                        Log work on a project
                      </Link>
                      <Link
                        to="/projects/new"
                        className="glassmorphic-light contour-border-warm px-3 py-1 hover:bg-yellow-400/5 transition-etch"
                      >
                        + New project
                      </Link>
                    </div>
                  </section>
                ) : null}

                {errorRows.length ? (
                  <section
                    {...nx('mt-3 space-y-1.5', 'db-19', 'Per-space project load errors', 'mt-3 · space-y-1.5')}
                  >
                    {errorRows.map((r, idx) => (
                      <p
                        key={`${r.spaceId || 'space'}-${idx}`}
                        className="glassmorphic-light contour-border-accent px-3 py-1.5 text-small font-mono text-white"
                      >
                        {r.spaceName}: {r.error}
                      </p>
                    ))}
                  </section>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <p
            {...nx('text-small font-mono text-white', 'db-00', 'Loading / no node', 'placeholder')}
          >
            Loading node…
          </p>
        )}
      </div>
    </AppShell>
  )
}
