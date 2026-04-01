import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { api } from '../lib/api'
import { getAlias } from '../lib/session'

type SpaceWithName = {
  id: string
  name: string
}

type NodeProfile = {
  alias: string
  reputationScore?: number
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

type DashboardState = {
  me: NodeProfile | null
  rows: ProjectRow[]
}

const initialState: DashboardState = {
  me: null,
  rows: [],
}

function isActiveStatus(status: string | undefined) {
  if (!status) return false
  return status === 'active' || status === 'halted' || status === 'disputed'
}

export default function DashboardPage() {
  const [state, setState] = useState<DashboardState>(initialState)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const alias = getAlias()
        const me = await api<NodeProfile>('/nodes/' + encodeURIComponent(alias))
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
          setState({ me, rows })
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

  const { me, rows } = state
  const spaces = me?.spacesWithNames ?? []
  const badges = me?.badges ?? []
  const activeRows = rows.filter((r) => isActiveStatus(r.project?.status)).slice(0, 4)
  const errorRows = rows.filter((r) => r.error)

  return (
    <AppShell title="Dashboard">
      <div className="space-y-6">
        {error ? (
          <p className="border border-black bg-grey-100 px-3 py-2 text-small font-mono text-black" role="alert">
            {error}
          </p>
        ) : null}

        {me ? (
          <section className="space-y-2">
            <p className="text-small font-mono uppercase tracking-[0.18em] text-grey-400">
              Node
            </p>
            <p className="text-h3 font-mono">{me.alias}</p>
            {me.reputationScore != null ? (
              <p className="text-small font-mono">
                CURRENT SCORE — <span className="font-mono">{me.reputationScore}</span>
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

        {spaces.length ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-h3">Spaces</h2>
              <div className="flex gap-2 text-small font-mono uppercase tracking-[0.18em]">
                <Link
                  to="/spaces/new"
                  className="border border-black bg-white px-3 py-1 hover:bg-black hover:text-yellow-400 transition"
                >
                  + Create
                </Link>
                <Link
                  to="/spaces/join"
                  className="border border-black bg-white px-3 py-1 hover:bg-black hover:text-yellow-400 transition"
                >
                  + Join
                </Link>
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
            <h2 className="text-h3">Active projects</h2>
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
                      STATUS — {row.project.status.toUpperCase()}
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

