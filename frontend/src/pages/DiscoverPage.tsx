import { useEffect, useState } from 'react'
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

type Tab = 'spaces' | 'projects' | 'nodes'

export default function DiscoverPage() {
  const [tab, setTab] = useState<Tab>('spaces')
  const [spaces, setSpaces] = useState<DiscoverSpace[]>([])
  const [projects, setProjects] = useState<DiscoverProject[]>([])
  const [nodes, setNodes] = useState<DiscoverNode[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [sp, pr, nd] = await Promise.all([
          api<DiscoverSpace[]>('/discover/spaces'),
          api<DiscoverProject[]>('/discover/projects'),
          api<DiscoverNode[]>('/discover/nodes'),
        ])
        if (cancelled) return
        setSpaces(sp)
        setProjects(pr)
        setNodes(nd)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const tabBtn = (t: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(t)}
      className={`px-3 py-1 border border-black font-mono text-[11px] uppercase tracking-[0.18em] transition ${
        tab === t ? 'bg-black text-yellow-400' : 'bg-white hover:bg-black hover:text-yellow-400'
      }`}
    >
      {label}
    </button>
  )

  return (
    <AppShell title="Discover">
      <div className="space-y-4">
        {error && (
          <p className="border border-black bg-grey-100 px-3 py-2 text-small font-mono" role="alert">{error}</p>
        )}

        <div className="flex gap-2 flex-wrap">
          {tabBtn('spaces', `Spaces (${spaces.length})`)}
          {tabBtn('projects', `Projects (${projects.length})`)}
          {tabBtn('nodes', `Nodes (${nodes.length})`)}
        </div>

        {loading && <p className="font-mono text-[11px] text-grey-400">Loading…</p>}

        {/* ── Spaces ── */}
        {tab === 'spaces' && !loading && (
          <div className="space-y-2">
            {spaces.length === 0 ? (
              <p className="text-small text-grey-400">No spaces yet.</p>
            ) : (
              <ul className="divide-y divide-grey-100 border border-grey-200">
                {spaces.map((s) => (
                  <li key={s._id} className="px-4 py-3 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          to={`/spaces/${encodeURIComponent(s._id)}`}
                          className="font-mono text-[12px] uppercase tracking-[0.16em] hover:underline"
                        >
                          {s.name}
                        </Link>
                        {s.description && (
                          <p className="text-small text-grey-600 mt-0.5">{s.description}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="font-mono text-[10px] text-grey-400">
                          {s.memberCount} member{s.memberCount !== 1 ? 's' : ''}
                        </span>
                        <span className="font-mono text-[10px] border border-grey-200 px-1 py-0.5 uppercase">
                          {s.projectAccess}
                        </span>
                      </div>
                    </div>
                    <p className="font-mono text-[10px] text-grey-400">
                      by {s.creatorAlias}
                      {s.isMember ? ' · member' : ''}
                    </p>
                    {!s.isMember && s.projectAccess === 'open' && (
                      <Link
                        to={`/spaces/join?space=${encodeURIComponent(s._id)}`}
                        className="inline-block border border-black bg-white px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] hover:bg-black hover:text-yellow-400 transition"
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

        {/* ── Projects ── */}
        {tab === 'projects' && !loading && (
          <div className="space-y-2">
            {projects.length === 0 ? (
              <p className="text-small text-grey-400">No public projects yet.</p>
            ) : (
              <ul className="divide-y divide-grey-100 border border-grey-200">
                {projects.map((p) => (
                  <li key={p._id} className="px-4 py-3 flex items-start justify-between gap-2">
                    <div>
                      <Link
                        to={`/projects/${encodeURIComponent(p._id)}`}
                        className="font-mono text-[12px] uppercase tracking-[0.16em] hover:underline"
                      >
                        {p.title}
                      </Link>
                      <p className="font-mono text-[10px] text-grey-400 mt-0.5">
                        by {p.creatorAlias}
                        {p.isContributor ? ' · contributor' : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="font-mono text-[10px] border border-grey-200 px-1 py-0.5 uppercase">{p.status}</span>
                      <span className="font-mono text-[10px] text-grey-400">{p.visibility}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── Nodes ── */}
        {tab === 'nodes' && !loading && (
          <div className="space-y-2">
            {nodes.length === 0 ? (
              <p className="text-small text-grey-400">No nodes yet.</p>
            ) : (
              <ul className="divide-y divide-grey-100 border border-grey-200">
                {nodes.map((n) => (
                  <li key={n.alias} className="px-4 py-3 flex items-start justify-between gap-2">
                    <div>
                      <Link
                        to={`/nodes/${encodeURIComponent(n.alias)}`}
                        className="font-mono text-[12px] uppercase tracking-[0.16em] hover:underline"
                      >
                        {n.alias}
                      </Link>
                      {(n.interests.length > 0 || n.keywords.length > 0) && (
                        <p className="font-mono text-[10px] text-grey-400 mt-0.5 break-words">
                          {[...n.interests, ...n.keywords].slice(0, 6).join(' · ')}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="font-mono text-[10px] text-grey-400">
                        rep {n.reputationScore}
                      </span>
                      {n.badges.length > 0 && (
                        <span className="font-mono text-[10px] text-grey-400">
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
      </div>
    </AppShell>
  )
}
