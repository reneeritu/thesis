import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { DefTerm } from '../components/DefTerm'
import { CrystalRadar3DLazy } from '../components/CrystalRadar3DLazy'
import { useDefinitions } from '../context/DefinitionsContext'
import { api } from '../lib/api'
import { getAlias } from '../lib/session'

type SpaceWithName = {
  id: string
  name: string
}

type NodeProfile = {
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

function isActiveStatus(status: string | undefined) {
  if (!status) return false
  return status === 'active' || status === 'halted' || status === 'disputed'
}

export default function DashboardPage() {
  const [state, setState] = useState<DashboardState>(initialState)
  const [error, setError] = useState<string | null>(null)
  const { definitionsOn, setDefinitionsOn } = useDefinitions()

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
  const activeRows = rows.filter((r) => isActiveStatus(r.project?.status)).slice(0, 4)
  const errorRows = rows.filter((r) => r.error)

  const catVals = Object.values(me?.reputationCategories ?? {})
  const emptyChain = me != null
    && catVals.length > 0
    && catVals.every((v) => !v || v === 0)
    && (me.reputationScore == null || me.reputationScore === 0)
    && spaces.length > 0

  return (
    <AppShell title="Dashboard">
      <div className="space-y-4 min-h-0">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setDefinitionsOn(!definitionsOn)}
            className="glassmorphic-light contour-border-neutral px-2 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-white transition-etch [touch-action:manipulation]"
            aria-pressed={definitionsOn}
            title="Show or hide inline definitions under form fields"
          >
            Hints: {definitionsOn ? 'on' : 'off'}
          </button>
        </div>

        {error ? (
          <p className="glassmorphic-light contour-border-accent px-3 py-2 text-small font-mono text-white" role="alert">
            {error}
          </p>
        ) : null}

        {me ? (
          <section className="space-y-2">
            <div className="flex flex-wrap gap-2 text-small font-mono uppercase tracking-[0.18em]">
              <Link
                to="/archive/new"
                className="glassmorphic-light contour-border-warm px-3 py-1 hover:bg-yellow-400/10 transition-etch"
              >
                <DefTerm term="archive_work">Archive work</DefTerm>
              </Link>
              <Link
                to="/discover"
                className="glassmorphic-light contour-border-warm px-3 py-1 hover:bg-yellow-400/10 transition-etch"
              >
                <DefTerm term="discover">Discover</DefTerm>
              </Link>
            </div>
            <p className="text-small font-mono uppercase tracking-[0.18em] text-white">
              <DefTerm term="node_label">Node</DefTerm>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-h3 font-bricolage">{me.alias}</p>
              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin.replace(/\/$/, '')}/nodes/${encodeURIComponent(me.alias)}`
                  void navigator.clipboard.writeText(url).catch(() => {})
                }}
                title="Copy a link to your public node profile"
                className="border border-white/30 bg-zinc-900/50 px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.16em] text-white transition hover:border-white/50"
              >
                Copy profile link
              </button>
            </div>
            <div className="w-full max-w-3xl space-y-1 overflow-visible">
              <CrystalRadar3DLazy
                categories={me.reputationCategories}
                recentCategories={recent?.categories}
                aggregateReputationScore={me.reputationScore}
                className="w-full"
                showDefinitions={definitionsOn}
                theme="light"
              />
              {recent ? (
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white">
                  Ghost layer = last {recent.days} d · {recent.traceCount} trace{recent.traceCount === 1 ? '' : 's'}
                </p>
              ) : null}
            </div>
            {me.reputationScore != null ? (
              <p className="text-small font-mono">
                <DefTerm term="reputation_score">CURRENT SCORE</DefTerm> —{' '}
                <span className="font-mono">{me.reputationScore}</span>
              </p>
            ) : null}
            {badges.length ? (
              <div className="flex flex-wrap gap-2 pt-2">
                {badges.map((b) => (
                  <span
                    key={b}
                    className="glassmorphic-light contour-border-accent px-2 py-1 text-[11px] font-mono uppercase tracking-[0.16em] text-yellow-400 glow-subtle"
                  >
                    {String(b).toUpperCase()}
                  </span>
                ))}
              </div>
            ) : null}
          </section>
        ) : (
          <p className="text-small font-mono text-white">Loading node…</p>
        )}

        {emptyChain ? (
          <section className="glassmorphic-light contour-border-accent contour-pattern p-5 space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white">
              Your chain is empty
            </p>
            <p className="text-body">
              Your chain starts here — log your first <DefTerm term="trace">trace</DefTerm> to see it appear.
            </p>
            <div className="flex flex-wrap gap-2 text-small font-mono uppercase tracking-[0.18em]">
              <Link
                to="/projects"
                className="glassmorphic-light contour-wireframe px-4 py-1.5 text-white hover:text-yellow-400 transition-etch"
              >
                Log work on a project
              </Link>
              <Link
                to="/projects/new"
                className="glassmorphic-light contour-border-warm px-4 py-1.5 hover:bg-yellow-400/5 transition-etch"
              >
                + New project
              </Link>
            </div>
          </section>
        ) : null}

        {spaces.length > 0 ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-h3">
                <DefTerm term="spaces_section">Spaces</DefTerm>
              </h2>
              <div className="flex gap-2 text-small font-mono uppercase tracking-[0.18em]">
                <Link to="/spaces/new" className="glassmorphic-light contour-border-warm px-3 py-1 transition-etch">+ Create</Link>
                <Link to="/spaces/join" className="glassmorphic-light contour-border-cool px-3 py-1 transition-etch">+ Join</Link>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {spaces.map((s) => (
                <Link
                  key={s.id}
                  to={`/spaces/${encodeURIComponent(s.id)}`}
                  className="glassmorphic-light contour-border-cool contour-pattern flex items-center justify-between px-3 py-2 font-mono text-small transition-etch hover:shadow-sm"
                >
                  <span className="truncate">{s.name}</span>
                  <span className="text-[11px] uppercase tracking-[0.18em]">OPEN →</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-h3">
              <DefTerm term="active_projects">Active projects</DefTerm>
            </h2>
            <div className="flex gap-2 text-small font-mono uppercase tracking-[0.18em]">
              <Link
                to="/projects"
                className="glassmorphic-light contour-border-cool px-3 py-1 transition-etch"
              >
                View all
              </Link>
              <Link
                to="/projects/new"
                className="glassmorphic-light contour-wireframe px-3 py-1 text-yellow-600 transition-etch"
              >
                + New
              </Link>
            </div>
          </div>

          {activeRows.length === 0 ? (
            <p className="text-small text-white">No active projects.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeRows.map((row) =>
                row.project ? (
                  <Link
                    key={row.project._id}
                    to={`/projects/${encodeURIComponent(row.project._id)}`}
                    className="glassmorphic-light contour-border-cool contour-pattern flex flex-col gap-1 px-3 py-2 transition-etch hover:shadow-sm"
                  >
                    <span className="font-mono text-small truncate">{row.project.title}</span>
                    <span className="text-small text-white">
                      {row.spaceName ? `In ${row.spaceName}` : null}
                    </span>
                    <span className="text-[11px] font-mono uppercase tracking-[0.18em]">
                      STATUS —{' '}
                      <DefTerm term={row.project.status}>{row.project.status.toUpperCase()}</DefTerm>
                    </span>
                  </Link>
                ) : null,
              )}
            </div>
          )}
        </section>

        {errorRows.length ? (
          <section className="space-y-2">
            {errorRows.map((r, idx) => (
              <p
                key={`${r.spaceId || 'space'}-${idx}`}
                className="glassmorphic-light contour-border-accent px-3 py-2 text-small font-mono text-white"
              >
                {r.spaceName}: {r.error}
              </p>
            ))}
          </section>
        ) : null}
      </div>
    </AppShell>
  )
}

