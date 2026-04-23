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

type Partition = {
  ongoing: ProjectRow[]
  finished: ProjectRow[]
  archive: ProjectRow[]
}

function partitionProjectRows(rows: ProjectRow[]): Partition {
  const ongoing: ProjectRow[] = []
  const finished: ProjectRow[] = []
  const archive: ProjectRow[] = []
  rows.forEach((item) => {
    if (item.error || !item.project) return
    const s = item.project.status
    if (s === 'archived') archive.push(item)
    else if (s === 'completed') finished.push(item)
    else ongoing.push(item)
  })
  return { ongoing, finished, archive }
}

export default function ProjectsBoardPage() {
  const [rows, setRows] = useState<ProjectRow[]>([])
  const [errorRows, setErrorRows] = useState<ProjectRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const alias = getAlias()
        const me = await api<NodeProfile>('/nodes/' + encodeURIComponent(alias))
        const spaces = me.spacesWithNames ?? []
        const allRows: ProjectRow[] = []
        const errs: ProjectRow[] = []
        for (const space of spaces) {
          try {
            const plist = await api<Project[]>('/projects/space/' + encodeURIComponent(space.id))
            for (const p of plist) {
              allRows.push({
                project: p,
                spaceName: space.name,
                spaceId: space.id,
              })
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to load projects'
            errs.push({
              error: msg,
              spaceName: space.name,
              spaceId: space.id,
            })
          }
        }
        if (!cancelled) {
          setRows(allRows)
          setErrorRows(errs)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load projects')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const { ongoing, finished, archive } = partitionProjectRows(rows)

  function Column({ title, items }: { title: string; items: ProjectRow[] }) {
    return (
      <div className="space-y-2">
        <h2 className="text-small font-bricolage uppercase tracking-[0.18em] text-white">{title}</h2>
        {items.length === 0 ? (
          <p className="text-small text-white">None.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) =>
              item.project ? (
                <Link
                  key={item.project._id}
                  to={`/projects/${encodeURIComponent(item.project._id)}`}
                  className="flex flex-col gap-1 border border-white/25 bg-zinc-900/55 px-3 py-2 text-small hover:bg-black hover:text-yellow-400 transition"
                >
                  <span className="font-mono truncate">{item.project.title}</span>
                  <span className="text-white">
                    {item.spaceName ? `In ${item.spaceName}` : null}
                  </span>
                  <span className="text-[11px] font-mono uppercase tracking-[0.18em]">
                    STATUS — {item.project.status.toUpperCase()}
                  </span>
                </Link>
              ) : null,
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <AppShell title="Projects">
      <div className="space-y-4">
        {error ? (
          <p className="border border-black bg-grey-100 px-3 py-2 text-small font-mono text-white" role="alert">
            {error}
          </p>
        ) : null}

        {errorRows.length ? (
          <div className="space-y-1">
            {errorRows.map((r, idx) => (
              <p
                key={`${r.spaceId || 'space'}-${idx}`}
                className="border border-black bg-grey-100 px-3 py-2 text-small font-mono text-white"
              >
                {r.spaceName}: {r.error}
              </p>
            ))}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <p className="text-small text-white">Your projects across all spaces.</p>
          <div className="flex items-center gap-2">
            <Link
              to="/projects/search"
              className="border border-white/25 bg-zinc-900/55 px-3 py-1 font-mono text-small uppercase tracking-[0.18em] hover:bg-black hover:text-yellow-400 transition"
            >
              Search
            </Link>
            <Link
              to="/projects/new"
              className="border border-black bg-yellow-400 px-3 py-1 font-mono text-small uppercase tracking-[0.18em] text-white hover:bg-black hover:text-yellow-400 transition"
            >
              + New project
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Column title="Ongoing / Active" items={ongoing} />
          <Column title="Finished / Credited" items={finished} />
          <Column title="Archive" items={archive} />
        </div>
      </div>
    </AppShell>
  )
}

