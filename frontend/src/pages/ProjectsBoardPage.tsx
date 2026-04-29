import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { GenerativeAvatar } from '../components/GenerativeAvatar'
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

  const shellBtn =
    'border border-solid px-3 py-1 font-mono text-small uppercase tracking-[0.18em] transition hover:bg-white/[0.06]'
  const shellBtnStyle = {
    backgroundColor: 'transparent',
    borderColor: '#e8e8e8',
    color: '#e8e8e8',
  } as const

  const columnHeaderStyle = {
    letterSpacing: '3px',
    borderBottom: '1px solid #1e2030',
    paddingBottom: 8,
  } as const

  function Column({
    title,
    items,
    archiveColumn,
  }: {
    title: string
    items: ProjectRow[]
    archiveColumn?: boolean
  }) {
    return (
      <div className="space-y-2">
        <h2
          className="text-small font-heading uppercase text-white"
          style={columnHeaderStyle}
        >
          {title}
        </h2>
        {items.length === 0 ? (
          archiveColumn ? (
            <div
              className="min-h-[8rem] font-mono text-small"
              style={{
                border: '1px dashed #1e2030',
                padding: 20,
                color: '#333',
              }}
            >
              No archived projects yet.
            </div>
          ) : (
            <p className="min-h-[8rem] border border-dashed border-white/20 px-3 py-3 text-small text-white">
              None.
            </p>
          )
        ) : (
          <div className="min-h-[8rem] space-y-2">
            {items.map((item) =>
              item.project ? (
                <Link
                  key={item.project._id}
                  to={`/projects/${encodeURIComponent(item.project._id)}`}
                  className="group flex flex-col overflow-hidden rounded-sm border border-white/25 bg-zinc-900/55 text-small transition hover:bg-black hover:border-white/35"
                >
                  <div className="relative h-[140px] w-full shrink-0 overflow-hidden bg-neutral-950/60">
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
                      <GenerativeAvatar
                        seed={item.project._id}
                        size={280}
                        monochrome={false}
                        luminescent
                        className="opacity-95"
                        style={{ height: 140, width: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 px-3 py-2">
                    <span className="font-mono truncate text-white/92">{item.project.title}</span>
                    <span className="text-white/80">
                      {item.spaceName ? `In ${item.spaceName}` : null}
                    </span>
                    <span className="text-small font-mono uppercase tracking-[0.18em] text-white/55">
                      STATUS — {item.project.status.toUpperCase()}
                    </span>
                  </div>
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

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 text-small text-white">Your projects across all spaces.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/projects/search"
              className={shellBtn}
              style={shellBtnStyle}
            >
              Search
            </Link>
            <Link to="/projects/new" className={shellBtn} style={shellBtnStyle}>
              + New project
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Column title="Ongoing / Active" items={ongoing} />
          <Column title="Finished / Credited" items={finished} />
          <Column title="Archive" items={archive} archiveColumn />
        </div>
      </div>
    </AppShell>
  )
}

