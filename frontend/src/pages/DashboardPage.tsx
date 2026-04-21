import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { DefTerm } from '../components/DefTerm'
import { CrystalRadar3D } from '../components/CrystalRadar3D'
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
      <div className="space-y-6">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setDefinitionsOn(!definitionsOn)}
            className="border border-grey-300 bg-white px-2 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-grey-600 transition hover:border-black hover:text-black [touch-action:manipulation]"
            aria-pressed={definitionsOn}
            title="Show or hide inline definitions under form fields"
          >
            Hints: {definitionsOn ? 'on' : 'off'}
          </button>
        </div>

        {error ? (
          <p className="border border-black bg-grey-100 px-3 py-2 text-small font-mono text-black" role="alert">
            {error}
          </p>
        ) : null}

        {me ? (
          <section className="space-y-2">
            <div className="flex flex-wrap gap-2 text-small font-mono uppercase tracking-[0.18em]">
              <Link
                to="/archive/new"
                className="border border-black bg-white px-3 py-1 hover:bg-black hover:text-yellow-400 transition"
              >
                <DefTerm term="archive_work">Archive work</DefTerm>
              </Link>
              <Link
                to="/discover"
                className="border border-black bg-white px-3 py-1 hover:bg-black hover:text-yellow-400 transition"
              >
                <DefTerm term="discover">Discover</DefTerm>
              </Link>
            </div>
            <p className="text-small font-mono uppercase tracking-[0.18em] text-grey-400">
              <DefTerm term="node_label">Node</DefTerm>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-h3 font-mono">{me.alias}</p>
              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin.replace(/\/$/, '')}/nodes/${encodeURIComponent(me.alias)}`
                  void navigator.clipboard.writeText(url).catch(() => {})
                }}
                title="Copy a link to your public node profile"
                className="border border-grey-300 bg-white px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.16em] text-grey-600 transition hover:border-black hover:text-black"
              >
                Copy profile link
              </button>
            </div>
            <div className="max-w-[380px] border border-black bg-white p-3 text-black">
              <CrystalRadar3D
                categories={me.reputationCategories}
                recentCategories={recent?.categories}
                className="w-full"
                showDefinitions={definitionsOn}
              />
              {recent ? (
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-grey-400">
                  Inner ghost crystal = last {recent.days} d · {recent.traceCount} trace{recent.traceCount === 1 ? '' : 's'}
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
                    className="border border-black bg-black px-2 py-1 text-[11px] font-mono uppercase tracking-[0.16em] text-yellow-400"
                  >
                    {String(b).toUpperCase()}
                  </span>
                ))}
              </div>
            ) : null}
          </section>
        ) : (
          <p className="text-small font-mono text-grey-400">Loading node…</p>
        )}

        {emptyChain ? (
          <section className="border-l-4 border-yellow-400 bg-white p-5 space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-grey-400">
              Your chain is empty
            </p>
            <p className="text-body">
              Your chain starts here — log your first <DefTerm term="trace">trace</DefTerm> to see it appear.
            </p>
            <div className="flex flex-wrap gap-2 text-small font-mono uppercase tracking-[0.18em]">
              <Link
                to="/projects"
                className="border border-black bg-yellow-400 px-4 py-1.5 text-black hover:bg-black hover:text-yellow-400 transition"
              >
                Log work on a project
              </Link>
              <Link
                to="/projects/new"
                className="border border-black bg-white px-4 py-1.5 hover:bg-black hover:text-yellow-400 transition"
              >
                + New project
              </Link>
            </div>
          </section>
        ) : null}

        {spaces.length === 0 && me ? (
          /* ── First-time user guide ── */
          <section className="border border-black p-5 space-y-4 bg-white">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-grey-400">
              Getting started
            </p>
            <p className="text-body">
              <DefTerm term="chain">The chain</DefTerm> lets you document creative work so it's permanently traceable —
              who made what, when, with what evidence. Here's how it works in three steps:
            </p>
            <ol className="space-y-4">
              <li className="flex gap-3">
                <span className="font-mono text-[13px] font-bold shrink-0 w-5">1.</span>
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em]">Create or join a Space</p>
                  <p className="text-small text-grey-600 mt-0.5">
                    A space is a shared context — a studio, class, or project group. You can invite co-founders and set who has veto authority.
                  </p>
                  <div className="flex gap-2 mt-2 text-small font-mono uppercase tracking-[0.18em]">
                    <Link to="/spaces/new" className="border border-black bg-yellow-400 px-3 py-1 text-black hover:bg-black hover:text-yellow-400 transition">+ Create space</Link>
                    <Link to="/spaces/join" className="border border-black bg-white px-3 py-1 hover:bg-black hover:text-yellow-400 transition">Join with invite code</Link>
                    <Link to="/discover" className="border border-black bg-white px-3 py-1 hover:bg-black hover:text-yellow-400 transition">Browse public spaces</Link>
                  </div>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-[13px] font-bold shrink-0 w-5">2.</span>
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em]">Start a Project inside a space</p>
                  <p className="text-small text-grey-600 mt-0.5">
                    A project tracks one body of work. Add collaborators — they'll get a notification to accept or decline.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-[13px] font-bold shrink-0 w-5">3.</span>
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em]">
                    Log Work (<DefTerm term="trace">Traces</DefTerm>) with proof
                  </p>
                  <p className="text-small text-grey-600 mt-0.5">
                    Each <DefTerm term="trace">trace</DefTerm> is a timestamped record of activity. Attach an image,
                    video, or audio file as <DefTerm term="media_proof">proof</DefTerm> — its SHA-256 fingerprint is
                    stored on the chain so anyone can verify the file hasn't changed.
                  </p>
                </div>
              </li>
            </ol>
          </section>
        ) : spaces.length > 0 ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-h3">
                <DefTerm term="spaces_section">Spaces</DefTerm>
              </h2>
              <div className="flex gap-2 text-small font-mono uppercase tracking-[0.18em]">
                <Link to="/spaces/new" className="border border-black bg-white px-3 py-1 hover:bg-black hover:text-yellow-400 transition">+ Create</Link>
                <Link to="/spaces/join" className="border border-black bg-white px-3 py-1 hover:bg-black hover:text-yellow-400 transition">+ Join</Link>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {spaces.map((s) => (
                <Link
                  key={s.id}
                  to={`/spaces/${encodeURIComponent(s.id)}`}
                  className="flex items-center justify-between border border-black bg-white px-3 py-2 font-mono text-small hover:bg-black hover:text-yellow-400 transition"
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
                className="border border-black bg-white px-3 py-1 hover:bg-black hover:text-yellow-400 transition"
              >
                View all
              </Link>
              <Link
                to="/projects/new"
                className="border border-black bg-yellow-400 px-3 py-1 text-black hover:bg-black hover:text-yellow-400 transition"
              >
                + New
              </Link>
            </div>
          </div>

          {activeRows.length === 0 ? (
            <p className="text-small text-grey-400">No active projects.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeRows.map((row) =>
                row.project ? (
                  <Link
                    key={row.project._id}
                    to={`/projects/${encodeURIComponent(row.project._id)}`}
                    className="flex flex-col gap-1 border border-black bg-white px-3 py-2 hover:bg-black hover:text-yellow-400 transition"
                  >
                    <span className="font-mono text-small truncate">{row.project.title}</span>
                    <span className="text-small text-grey-400">
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
                className="border border-black bg-grey-100 px-3 py-2 text-small font-mono text-black"
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

