import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { GenerativeAvatar } from '../components/GenerativeAvatar'
import { api } from '../lib/api'
import { activityLabel } from '../lib/activityLabels'
import { formatTimeAgo } from '../lib/timeAgo'

type TraceSnippet = { activityType: string; at: string }

type DiscoverSpace = {
  _id: string
  name: string
  description: string
  creatorAlias: string
  memberCount: number
  projectAccess: string
  isMember: boolean
  createdAt: string
  logoSeed?: string
  lastTrace?: TraceSnippet | null
  chainActivityAt: string
}

type DiscoverProject = {
  _id: string
  title: string
  status: string
  spaceId: string
  spaceName?: string
  spaceScoped?: boolean
  creatorAlias: string
  visibility: string
  isContributor: boolean
  createdAt: string
  logoSeed?: string
  lastTrace?: TraceSnippet | null
  chainActivityAt: string
}

type DiscoverNode = {
  alias: string
  interests: string[]
  keywords: string[]
  portfolioUrl: string
  reputationScore: number
  badges: string[]
  joinedAt: string
  lastActiveAt?: string
  chainActivityAt: string
}

type Envelope<T> = { items: T[]; total: number; limit: number; offset: number }

/** Browse scope: ALL merges three feeds; otherwise single feed. */
type DiscoverEntityFilter = 'all' | 'spaces' | 'projects' | 'nodes'

const PAGE_SIZE = 50

const ACTIVITY_OPTIONS = [
  'brainstorm',
  'research',
  'fabrication',
  'skillwork',
  'pedagogy',
  'review',
  'iterate',
] as const

const PROJECT_STATUS_OPTIONS = ['active', 'completed', 'disputed'] as const

const SPACE_TYPE_OPTIONS = ['open', 'invite_only', 'application'] as const

type FeedState<T> = {
  items: T[]
  total: number
  offset: number
  loading: boolean
  error: string | null
}

function emptyFeed<T>(): FeedState<T> {
  return { items: [], total: 0, offset: 0, loading: false, error: null }
}

function formatSpaceTypeLabel(v: string): string {
  return v.replace(/_/g, ' ')
}

function activityPhrase(activityType: string): string {
  return activityLabel(activityType).toLowerCase()
}

const DISCOVER_CARD_GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 16,
  width: '100%',
}

const CARD_ACCENTS: Record<'space' | 'project' | 'node', string> = {
  space: 'border-l-[3px] border-l-[#b30059] group-hover:border-l-[#f472b8]',
  project:
    'border-l-[3px] border-l-[#0e7490] group-hover:border-l-[#22d3ee]',
  node: 'border-l-[3px] border-l-[#15803d] group-hover:border-l-[#4ade80]',
}

function DiscoverBrowseCard({
  to,
  seed,
  title,
  kindLabel,
  footer,
  accent,
}: {
  to: string
  seed: string
  title: string
  kindLabel: 'SPACE' | 'PROJECT' | 'NODE'
  footer: ReactNode
  accent: 'space' | 'project' | 'node'
}) {
  return (
    <Link
      to={to}
      className={`group flex flex-col overflow-hidden rounded-sm border border-white/12 bg-black/35 shadow-sm transition-[transform,box-shadow,border-left-color] duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/40 ${CARD_ACCENTS[accent]}`}
    >
      <div className="relative h-[120px] w-full shrink-0 overflow-hidden bg-neutral-950/60">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <GenerativeAvatar
            seed={seed}
            size={280}
            monochrome={false}
            luminescent
            className="opacity-95"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1 bg-black/82 px-3 py-2 font-mono">
        <div>
          <h3 className="m-0 line-clamp-2 font-mono text-sm font-bold uppercase tracking-[0.1em] leading-snug text-white/92">
            {title}
          </h3>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">{kindLabel}</p>
        </div>
        <div className="border-t border-white/10 pt-1.5 font-mono text-base leading-snug text-[var(--text-subtle)]">{footer}</div>
      </div>
    </Link>
  )
}

function traceFooterSnippet(trace?: TraceSnippet | null): ReactNode {
  if (!trace) {
    return <span className="text-[var(--text-subtle)]">↳ no work documented yet</span>
  }
  return (
    <>
      ↳ {activityPhrase(trace.activityType)} · {formatTimeAgo(trace.at)}
    </>
  )
}

function DiscoverEmptyState() {
  return (
    <div className="flex min-h-[min(420px,50vh)] flex-col items-center justify-center px-6 py-16 text-center">
      <p className="font-mono text-small uppercase tracking-[0.18em] text-[var(--text-muted)]">
        Nothing matching these filters
      </p>
      <p className="mt-3 max-w-md font-mono text-base leading-relaxed text-[var(--text-muted)]">
        try broadening your search, or check back as more work gets documented
      </p>
    </div>
  )
}

type UnifiedRow =
  | { kind: 'space'; ts: string; space: DiscoverSpace }
  | { kind: 'project'; ts: string; project: DiscoverProject }
  | { kind: 'node'; ts: string; node: DiscoverNode }

export default function DiscoverPage() {
  const [entityFilter, setEntityFilter] = useState<DiscoverEntityFilter>('all')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  const [activitySel, setActivitySel] = useState<Set<string>>(new Set())
  const [projectStatusSel, setProjectStatusSel] = useState<Set<string>>(new Set())
  const [spaceTypeSel, setSpaceTypeSel] = useState<Set<string>>(new Set())

  const [spaces, setSpaces] = useState<FeedState<DiscoverSpace>>(emptyFeed)
  const [projects, setProjects] = useState<FeedState<DiscoverProject>>(emptyFeed)
  const [nodes, setNodes] = useState<FeedState<DiscoverNode>>(emptyFeed)

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 200)
    return () => clearTimeout(id)
  }, [query])

  const reqIdRef = useRef(0)

  const buildQs = useCallback(
    (
      baseOffset: number,
      kind: 'spaces' | 'projects' | 'nodes',
    ): URLSearchParams => {
      const qs = new URLSearchParams()
      if (debouncedQuery) qs.set('q', debouncedQuery)
      qs.set('limit', String(PAGE_SIZE))
      qs.set('offset', String(baseOffset))
      if (kind === 'spaces' && spaceTypeSel.size > 0) {
        qs.set('access', [...spaceTypeSel].join(','))
      }
      if (kind === 'projects') {
        if (projectStatusSel.size > 0) qs.set('status', [...projectStatusSel].join(','))
        if (activitySel.size > 0) qs.set('activity', [...activitySel].join(','))
      }
      return qs
    },
    [debouncedQuery, spaceTypeSel, projectStatusSel, activitySel],
  )

  const fetchPage = useCallback(
    async <T,>(
      path: '/discover/spaces' | '/discover/projects' | '/discover/nodes',
      kind: 'spaces' | 'projects' | 'nodes',
      setter: (updater: (prev: FeedState<T>) => FeedState<T>) => void,
      offset: number,
      append: boolean,
    ) => {
      const myReq = ++reqIdRef.current
      setter((p) => ({ ...p, loading: true, error: null }))
      try {
        const qs = buildQs(offset, kind)
        const env = await api<Envelope<T>>(`${path}?${qs.toString()}`)
        if (myReq !== reqIdRef.current) return
        setter((p) => ({
          items: append ? [...p.items, ...env.items] : env.items,
          total: env.total,
          offset: env.offset + env.items.length,
          loading: false,
          error: null,
        }))
      } catch (e) {
        if (myReq !== reqIdRef.current) return
        setter((p) => ({
          ...p,
          loading: false,
          error: e instanceof Error ? e.message : 'Failed to load',
        }))
      }
    },
    [buildQs],
  )

  useEffect(() => {
    const runSpaces =
      entityFilter === 'all' || entityFilter === 'spaces'
        ? fetchPage<DiscoverSpace>('/discover/spaces', 'spaces', setSpaces, 0, false)
        : Promise.resolve()
    const runProjects =
      entityFilter === 'all' || entityFilter === 'projects'
        ? fetchPage<DiscoverProject>('/discover/projects', 'projects', setProjects, 0, false)
        : Promise.resolve()
    const runNodes =
      entityFilter === 'all' || entityFilter === 'nodes'
        ? fetchPage<DiscoverNode>('/discover/nodes', 'nodes', setNodes, 0, false)
        : Promise.resolve()
    void Promise.all([runSpaces, runProjects, runNodes])
  }, [entityFilter, debouncedQuery, fetchPage, spaceTypeSel, projectStatusSel, activitySel])

  const merged = useMemo((): UnifiedRow[] => {
    if (entityFilter !== 'all') return []
    const rows: UnifiedRow[] = []
    for (const s of spaces.items) {
      rows.push({ kind: 'space', ts: s.chainActivityAt, space: s })
    }
    for (const p of projects.items) {
      rows.push({ kind: 'project', ts: p.chainActivityAt, project: p })
    }
    for (const n of nodes.items) {
      rows.push({ kind: 'node', ts: n.chainActivityAt, node: n })
    }
    rows.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0))
    return rows
  }, [entityFilter, spaces.items, projects.items, nodes.items])

  const currentSingleFeed =
    entityFilter === 'spaces' ? spaces : entityFilter === 'projects' ? projects : nodes

  const loadedCount =
    entityFilter === 'all' ? merged.length : currentSingleFeed.items.length
  const totalCount =
    entityFilter === 'all'
      ? spaces.total + projects.total + nodes.total
      : currentSingleFeed.total

  const hasMore =
    entityFilter === 'all'
      ? spaces.items.length < spaces.total ||
        projects.items.length < projects.total ||
        nodes.items.length < nodes.total
      : currentSingleFeed.items.length < currentSingleFeed.total

  const onLoadMore = () => {
    if (entityFilter === 'all') {
      if (spaces.items.length < spaces.total) {
        void fetchPage<DiscoverSpace>('/discover/spaces', 'spaces', setSpaces, spaces.offset, true)
      }
      if (projects.items.length < projects.total) {
        void fetchPage<DiscoverProject>(
          '/discover/projects',
          'projects',
          setProjects,
          projects.offset,
          true,
        )
      }
      if (nodes.items.length < nodes.total) {
        void fetchPage<DiscoverNode>('/discover/nodes', 'nodes', setNodes, nodes.offset, true)
      }
      return
    }
    if (entityFilter === 'spaces') {
      void fetchPage<DiscoverSpace>('/discover/spaces', 'spaces', setSpaces, spaces.offset, true)
    }
    if (entityFilter === 'projects') {
      void fetchPage<DiscoverProject>(
        '/discover/projects',
        'projects',
        setProjects,
        projects.offset,
        true,
      )
    }
    if (entityFilter === 'nodes') {
      void fetchPage<DiscoverNode>('/discover/nodes', 'nodes', setNodes, nodes.offset, true)
    }
  }

  const anyError = spaces.error || projects.error || nodes.error
  const showError =
    entityFilter === 'all'
      ? anyError
      : entityFilter === 'spaces'
        ? spaces.error
        : entityFilter === 'projects'
          ? projects.error
          : nodes.error

  const loadingInitial =
    entityFilter === 'all'
      ? (spaces.loading || projects.loading || nodes.loading) && merged.length === 0
      : currentSingleFeed.loading && currentSingleFeed.items.length === 0

  const resultsEmpty =
    !loadingInitial &&
    !showError &&
    (entityFilter === 'all'
      ? merged.length === 0
      : currentSingleFeed.items.length === 0)

  const sectionLabel = 'mb-2 font-mono text-xs uppercase tracking-[0.22em] text-[var(--text-secondary)]'
  const toggleBtn = (active: boolean) =>
    `discover-type-toggle rounded-sm px-2 py-1 font-mono text-small uppercase tracking-[0.16em] transition ${
      active ? 'bg-black text-yellow-400' : 'bg-white/5 text-white/80 hover:bg-white/10 hover:text-yellow-200'
    }`
  const filterChip = (checked: boolean) =>
    `flex cursor-pointer items-center gap-2 rounded-sm px-0 py-0.5 font-mono text-small capitalize tracking-normal ${
      checked ? 'text-yellow-300/95' : 'text-white/65 hover:text-white/90'
    }`

  function toggleSelection(setState: (fn: (prev: Set<string>) => Set<string>) => void, key: string) {
    setState((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <AppShell title="Discover">
      <div className="flex w-full min-w-0 flex-col gap-8 lg:flex-row lg:gap-10">
        <aside data-discover-sidebar className="w-full shrink-0 space-y-8 lg:w-[280px]">
          <div>
            <label htmlFor="discover-search" className={sectionLabel}>
              Search
            </label>
            <input
              id="discover-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search aliases / interests / keywords..."
              className="mt-1 w-full border border-white/20 bg-zinc-900/55 px-3 py-2 font-mono text-small text-white placeholder:text-white/35 focus:border-white/40 focus:outline-none"
              autoComplete="off"
            />
          </div>

          <div>
            <p className={sectionLabel}>Filter by type</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(['all', 'spaces', 'projects', 'nodes'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setEntityFilter(k)}
                  className={toggleBtn(entityFilter === k)}
                >
                  {k === 'all' ? 'All' : k === 'spaces' ? 'Spaces' : k === 'projects' ? 'Projects' : 'Nodes'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className={sectionLabel}>Activity type</p>
            <p className="mb-2 font-mono text-base leading-snug text-[var(--text-muted)]">
              Narrows projects that have traces with these activity types.
            </p>
            <div className="flex flex-col gap-1">
              {ACTIVITY_OPTIONS.map((a) => (
                <label key={a} className={filterChip(activitySel.has(a))}>
                  <input
                    type="checkbox"
                    checked={activitySel.has(a)}
                    onChange={() => toggleSelection(setActivitySel, a)}
                    className="h-3.5 w-3.5 shrink-0 rounded border-white/30 bg-zinc-900 accent-yellow-400"
                  />
                  <span>{a.replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className={sectionLabel}>Project status</p>
            <div className="mt-2 flex flex-col gap-1">
              {PROJECT_STATUS_OPTIONS.map((s) => (
                <label key={s} className={filterChip(projectStatusSel.has(s))}>
                  <input
                    type="checkbox"
                    checked={projectStatusSel.has(s)}
                    onChange={() => toggleSelection(setProjectStatusSel, s)}
                    className="h-3.5 w-3.5 shrink-0 rounded border-white/30 bg-zinc-900 accent-yellow-400"
                  />
                  <span>{s}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className={sectionLabel}>Space type</p>
            <div className="mt-2 flex flex-col gap-1">
              {SPACE_TYPE_OPTIONS.map((s) => (
                <label key={s} className={filterChip(spaceTypeSel.has(s))}>
                  <input
                    type="checkbox"
                    checked={spaceTypeSel.has(s)}
                    onChange={() => toggleSelection(setSpaceTypeSel, s)}
                    className="h-3.5 w-3.5 shrink-0 rounded border-white/30 bg-zinc-900 accent-yellow-400"
                  />
                  <span>{formatSpaceTypeLabel(s)}</span>
                </label>
              ))}
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-4">
          {showError && (
            <p className="bg-zinc-900/80 px-3 py-2 font-mono text-small text-yellow-200" role="alert">
              {showError}
            </p>
          )}

          {!loadingInitial && !showError && (
            <header>
              <p className="font-mono text-small uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Showing {loadedCount} of {totalCount} — sorted by recent chain activity
              </p>
              <p className="mt-1 max-w-2xl font-mono text-base leading-relaxed text-[var(--text-muted)]">
                no algorithmic ranking · sorted by when work was last documented
              </p>
            </header>
          )}

          {loadingInitial && <p className="font-mono text-small text-white/70">Loading…</p>}

          {resultsEmpty && <DiscoverEmptyState />}

          {entityFilter === 'all' && merged.length > 0 && (
            <ul className="list-none p-0 m-0" style={DISCOVER_CARD_GRID_STYLE}>
              {merged.map((row) => {
                if (row.kind === 'space') {
                  const s = row.space
                  return (
                    <li key={`space-${s._id}`}>
                      <DiscoverBrowseCard
                        to={`/spaces/${encodeURIComponent(s._id)}`}
                        seed={s.logoSeed ?? s._id}
                        title={s.name}
                        kindLabel="SPACE"
                        accent="space"
                        footer={traceFooterSnippet(s.lastTrace)}
                      />
                    </li>
                  )
                }
                if (row.kind === 'project') {
                  const p = row.project
                  return (
                    <li key={`project-${p._id}`}>
                      <DiscoverBrowseCard
                        to={`/projects/${encodeURIComponent(p._id)}`}
                        seed={p.logoSeed ?? p._id}
                        title={p.title}
                        kindLabel="PROJECT"
                        accent="project"
                        footer={traceFooterSnippet(p.lastTrace)}
                      />
                    </li>
                  )
                }
                const n = row.node
                const activeIso = n.lastActiveAt ?? n.joinedAt
                return (
                  <li key={`node-${n.alias}`}>
                    <DiscoverBrowseCard
                      to={`/nodes/${encodeURIComponent(n.alias)}`}
                      seed={n.alias}
                      title={n.alias}
                      kindLabel="NODE"
                      accent="node"
                      footer={<>↳ last active · {formatTimeAgo(activeIso)}</>}
                    />
                  </li>
                )
              })}
            </ul>
          )}

          {entityFilter === 'spaces' && spaces.items.length > 0 && (
            <ul className="list-none p-0 m-0" style={DISCOVER_CARD_GRID_STYLE}>
              {spaces.items.map((s) => (
                <li key={s._id}>
                  <DiscoverBrowseCard
                    to={`/spaces/${encodeURIComponent(s._id)}`}
                    seed={s.logoSeed ?? s._id}
                    title={s.name}
                    kindLabel="SPACE"
                    accent="space"
                    footer={traceFooterSnippet(s.lastTrace)}
                  />
                </li>
              ))}
            </ul>
          )}

          {entityFilter === 'projects' && projects.items.length > 0 && (
            <ul className="list-none p-0 m-0" style={DISCOVER_CARD_GRID_STYLE}>
              {projects.items.map((p) => (
                <li key={p._id}>
                  <DiscoverBrowseCard
                    to={`/projects/${encodeURIComponent(p._id)}`}
                    seed={p.logoSeed ?? p._id}
                    title={p.title}
                    kindLabel="PROJECT"
                    accent="project"
                    footer={traceFooterSnippet(p.lastTrace)}
                  />
                </li>
              ))}
            </ul>
          )}

          {entityFilter === 'nodes' && nodes.items.length > 0 && (
            <ul className="list-none p-0 m-0" style={DISCOVER_CARD_GRID_STYLE}>
              {nodes.items.map((n) => (
                <li key={n.alias}>
                  <DiscoverBrowseCard
                    to={`/nodes/${encodeURIComponent(n.alias)}`}
                    seed={n.alias}
                    title={n.alias}
                    kindLabel="NODE"
                    accent="node"
                    footer={<>↳ last active · {formatTimeAgo(n.lastActiveAt ?? n.joinedAt)}</>}
                  />
                </li>
              ))}
            </ul>
          )}

          {hasMore && !resultsEmpty && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                disabled={
                  entityFilter === 'all'
                    ? spaces.loading || projects.loading || nodes.loading
                    : currentSingleFeed.loading
                }
                onClick={onLoadMore}
                className="border border-white/25 bg-zinc-900/55 px-4 py-2 font-mono text-small uppercase tracking-[0.18em] transition hover:bg-black hover:text-yellow-400 disabled:opacity-50"
              >
                {entityFilter === 'all'
                  ? spaces.loading || projects.loading || nodes.loading
                    ? 'Loading…'
                    : 'Load more'
                  : currentSingleFeed.loading
                    ? 'Loading…'
                    : `Load more (${currentSingleFeed.total - currentSingleFeed.items.length} left)`}
              </button>
            </div>
          )}
        </main>
      </div>
    </AppShell>
  )
}
