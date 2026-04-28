import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { api } from '../lib/api'

type DiscoverSpace = {
  _id: string
  name: string
  description: string
  creatorAlias: string
  memberCount: number
  projectAccess: string
  isMember: boolean
  createdAt: string
}

type DiscoverProject = {
  _id: string
  title: string
  status: string
  spaceId: string
  /** Space title when returned by discover/projects */
  spaceName?: string
  /** True when visibility is space_only (member-visible; show seal in UI) */
  spaceScoped?: boolean
  creatorAlias: string
  visibility: string
  isContributor: boolean
  createdAt: string
}

type DiscoverNode = {
  alias: string
  interests: string[]
  keywords: string[]
  portfolioUrl: string
  reputationScore: number
  badges: string[]
  joinedAt: string
}

type Envelope<T> = { items: T[]; total: number; limit: number; offset: number }

type Tab = 'spaces' | 'projects' | 'nodes'

const PAGE_SIZE = 50

/**
 * Keeps items + total per tab in one place so the state for list fetching,
 * appending pages, and search resets stays symmetrical across the three feeds.
 */
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

export default function DiscoverPage() {
  const [tab, setTab] = useState<Tab>('spaces')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  const [spaces, setSpaces] = useState<FeedState<DiscoverSpace>>(emptyFeed)
  const [projects, setProjects] = useState<FeedState<DiscoverProject>>(emptyFeed)
  const [nodes, setNodes] = useState<FeedState<DiscoverNode>>(emptyFeed)

  // Debounce the search input so every keystroke doesn't thrash the backend.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 200)
    return () => clearTimeout(id)
  }, [query])

  const reqIdRef = useRef(0)

  const fetchPage = useCallback(
    async <T,>(
      url: string,
      setter: (updater: (prev: FeedState<T>) => FeedState<T>) => void,
      offset: number,
      append: boolean,
    ) => {
      const myReq = ++reqIdRef.current
      setter((p) => ({ ...p, loading: true, error: null }))
      try {
        const qs = new URLSearchParams()
        if (debouncedQuery) qs.set('q', debouncedQuery)
        qs.set('limit', String(PAGE_SIZE))
        qs.set('offset', String(offset))
        const env = await api<Envelope<T>>(`${url}?${qs.toString()}`)
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
        setter((p) => ({ ...p, loading: false, error: e instanceof Error ? e.message : 'Failed to load' }))
      }
    },
    [debouncedQuery],
  )

  // Re-fetch from scratch whenever the active tab or the search term changes.
  useEffect(() => {
    if (tab === 'spaces') void fetchPage<DiscoverSpace>('/discover/spaces', setSpaces, 0, false)
    if (tab === 'projects') void fetchPage<DiscoverProject>('/discover/projects', setProjects, 0, false)
    if (tab === 'nodes') void fetchPage<DiscoverNode>('/discover/nodes', setNodes, 0, false)
  }, [tab, debouncedQuery, fetchPage])

  const current =
    tab === 'spaces' ? spaces :
    tab === 'projects' ? projects :
    nodes

  const onLoadMore = () => {
    if (tab === 'spaces') void fetchPage<DiscoverSpace>('/discover/spaces', setSpaces, current.offset, true)
    if (tab === 'projects') void fetchPage<DiscoverProject>('/discover/projects', setProjects, current.offset, true)
    if (tab === 'nodes') void fetchPage<DiscoverNode>('/discover/nodes', setNodes, current.offset, true)
  }

  const hasMore = current.items.length < current.total

  const tabBtn = (t: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(t)}
      className={`px-3 py-1 border border-black font-mono text-small uppercase tracking-[0.18em] transition ${
        tab === t ? 'bg-black text-yellow-400' : 'bg-zinc-800/60 hover:bg-black hover:text-yellow-400'
      }`}
    >
      {label}
    </button>
  )

  return (
    <AppShell title="Discover">
      <div className="max-w-4xl space-y-4">
        {current.error && (
          <p className="border border-black bg-grey-100 px-3 py-2 text-small font-mono" role="alert">{current.error}</p>
        )}

        <div className="sticky top-0 z-10 flex flex-wrap gap-2 border border-white/20 bg-zinc-950/90 p-2 backdrop-blur-sm">
          {tabBtn('spaces', `Spaces (${spaces.total || spaces.items.length})`)}
          {tabBtn('projects', `Projects (${projects.total || projects.items.length})`)}
          {tabBtn('nodes', `Nodes (${nodes.total || nodes.items.length})`)}
        </div>

        <div className="sticky top-12 z-10 flex items-center gap-2 border border-white/20 bg-zinc-950/90 p-2 backdrop-blur-sm">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              tab === 'spaces' ? 'Search spaces…' :
              tab === 'projects' ? 'Search projects…' :
              'Search aliases / interests / keywords…'
            }
            className="flex-1 border border-white/25 bg-zinc-900/55 px-3 py-2 font-mono text-small"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="border border-white/25 bg-zinc-900/55 px-2 py-2 font-mono text-small uppercase tracking-[0.14em] hover:bg-white/10"
            >
              Clear
            </button>
          )}
        </div>

        <p className="font-mono text-small uppercase tracking-[0.18em] text-white">
          Showing {current.items.length} of {current.total}
          {debouncedQuery ? ` — filtered by "${debouncedQuery}"` : ''}
        </p>

        {current.loading && current.items.length === 0 && (
          <p className="font-mono text-small text-white">Loading…</p>
        )}

        {tab === 'spaces' && (
          <div className="space-y-2">
            {!current.loading && spaces.items.length === 0 ? (
              <p className="text-small text-white">No spaces match.</p>
            ) : (
              <ul className="divide-y divide-grey-100 border border-grey-200">
                {spaces.items.map((s) => (
                  <li key={s._id} className="px-4 py-3 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          to={`/spaces/${encodeURIComponent(s._id)}`}
                          className="font-mono text-small uppercase tracking-[0.16em] hover:underline"
                        >
                          {s.name}
                        </Link>
                        {s.description && (
                          <p className="text-small text-white mt-0.5">{s.description}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="font-mono text-small text-white">
                          {s.memberCount} member{s.memberCount !== 1 ? 's' : ''}
                        </span>
                        <span className="font-mono text-small border border-grey-200 px-1 py-0.5 uppercase">
                          {s.projectAccess}
                        </span>
                      </div>
                    </div>
                    <p className="font-mono text-small text-white">
                      by {s.creatorAlias}
                      {s.isMember ? ' · member' : ''}
                    </p>
                    {!s.isMember && s.projectAccess === 'open' && (
                      <Link
                        to={`/spaces/join?space=${encodeURIComponent(s._id)}`}
                        className="inline-block border border-white/25 bg-zinc-900/55 px-2 py-0.5 font-mono text-small uppercase tracking-[0.14em] hover:bg-black hover:text-yellow-400 transition"
                      >
                        Join
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'projects' && (
          <div className="space-y-2">
            {!current.loading && projects.items.length === 0 ? (
              <p className="text-small text-white">No projects match.</p>
            ) : (
              <ul className="divide-y divide-grey-100 border border-grey-200">
                {projects.items.map((p) => (
                  <li key={p._id} className="px-4 py-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/projects/${encodeURIComponent(p._id)}`}
                          className="font-mono text-small uppercase tracking-[0.16em] hover:underline"
                        >
                          {p.title}
                        </Link>
                        {(p.spaceScoped ?? p.visibility === 'space_only') ? (
                          <Link
                            to={`/spaces/${encodeURIComponent(p.spaceId)}`}
                            className="inline-flex items-center gap-1 rounded border border-cyan/50 bg-cyan/10 px-1.5 py-0.5 font-mono text-small uppercase tracking-[0.2em] text-cyan shrink-0"
                            title="Space-only: visible to members of this space"
                          >
                            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-cyan" />
                            {p.spaceName ? p.spaceName : 'Space'}
                          </Link>
                        ) : null}
                      </div>
                      <p className="font-mono text-small text-white mt-0.5">
                        by {p.creatorAlias}
                        {p.isContributor ? ' · contributor' : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="font-mono text-small border border-grey-200 px-1 py-0.5 uppercase">{p.status}</span>
                      <span className="font-mono text-small text-white">{p.visibility.replace(/_/g, ' ')}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'nodes' && (
          <div className="space-y-2">
            {!current.loading && nodes.items.length === 0 ? (
              <p className="text-small text-white">No nodes match.</p>
            ) : (
              <ul className="divide-y divide-grey-100 border border-grey-200">
                {nodes.items.map((n) => (
                  <li key={n.alias} className="px-4 py-3 flex items-start justify-between gap-2">
                    <div>
                      <Link
                        to={`/nodes/${encodeURIComponent(n.alias)}`}
                        className="font-mono text-small uppercase tracking-[0.16em] hover:underline"
                      >
                        {n.alias}
                      </Link>
                      {(n.interests.length > 0 || n.keywords.length > 0) && (
                        <p className="font-mono text-small text-white mt-0.5 break-words">
                          {[...n.interests, ...n.keywords].slice(0, 6).join(' · ')}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="inline-flex items-center gap-1 font-mono text-small text-white">
                        <span aria-hidden className="inline-block h-2 w-2 rounded-full border border-white/40" />
                        rep {n.reputationScore}
                      </span>
                      {n.badges.length > 0 && (
                        <span className="font-mono text-small text-white">
                          {n.badges.slice(0, 2).join(' · ')}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {hasMore && (
          <div className="flex justify-center">
            <button
              type="button"
              disabled={current.loading}
              onClick={onLoadMore}
              className="border border-white/25 bg-zinc-900/55 px-4 py-2 font-mono text-small uppercase tracking-[0.18em] hover:bg-black hover:text-yellow-400 transition disabled:opacity-50"
            >
              {current.loading ? 'Loading…' : `Load more (${current.total - current.items.length} left)`}
            </button>
          </div>
        )}
      </div>
    </AppShell>
  )
}
