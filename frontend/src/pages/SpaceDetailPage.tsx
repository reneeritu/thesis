import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { api } from '../lib/api'

type Space = {
  _id: string
  name: string
  description?: string
  members: string[]
  admins: string[]
}

type Project = {
  _id: string
  title: string
  status: string
}

export default function SpaceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [space, setSpace] = useState<Space | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) return
      try {
        const s = await api<Space>('/spaces/' + encodeURIComponent(id))
        let p: Project[] = []
        try {
          p = await api<Project[]>('/projects/space/' + encodeURIComponent(id))
        } catch (e) {
          // surface later in UI as part of error message
          console.error(e)
        }
        if (!cancelled) {
          setSpace(s)
          setProjects(p)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load space')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  const memberCount = space?.members?.length ?? 0

  return (
    <AppShell title={space?.name || 'Space'}>
      <div className="space-y-6">
        {error ? (
          <p className="border border-black bg-grey-100 px-3 py-2 text-small font-mono text-black" role="alert">
            {error}
          </p>
        ) : null}

        {space ? (
          <section className="space-y-3">
            <p className="text-small text-grey-400">
              ID:{' '}
              <span className="font-mono text-xs break-all">
                {space._id}
              </span>
            </p>
            {space.description ? (
              <p className="text-body text-grey-700">{space.description}</p>
            ) : (
              <p className="text-small text-grey-400">No description.</p>
            )}
            <div className="flex flex-wrap gap-2 text-small font-mono uppercase tracking-[0.18em]">
              <Link
                to={`/projects/new?space=${encodeURIComponent(space._id)}`}
                className="border border-black bg-yellow-400 px-3 py-1 text-black hover:bg-black hover:text-yellow-400 transition"
              >
                New project in space
              </Link>
              <Link
                to={`/spaces/${encodeURIComponent(space._id)}/settings`}
                className="border border-black bg-white px-3 py-1 hover:bg-black hover:text-yellow-400 transition"
              >
                Settings
              </Link>
            </div>
          </section>
        ) : (
          <p className="text-small font-mono text-grey-400">Loading…</p>
        )}

        <section className="space-y-3">
          <h2 className="text-h3">Projects</h2>
          {projects.length === 0 ? (
            <p className="text-small text-grey-400">No projects in this space yet.</p>
          ) : (
            <div className="space-y-2">
              {projects.map((p) => (
                <div
                  key={p._id}
                  className="flex items-center justify-between border border-black bg-white px-3 py-2 text-small"
                >
                  <div className="min-w-0">
                    <p className="font-mono truncate">{p.title}</p>
                    <p className="text-[11px] font-mono uppercase tracking-[0.18em]">
                      STATUS — {p.status.toUpperCase()}
                    </p>
                  </div>
                  <Link
                    to={`/projects/${encodeURIComponent(p._id)}`}
                    className="border border-black bg-white px-3 py-1 hover:bg-black hover:text-yellow-400 transition"
                  >
                    View →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-h3">Members ({memberCount})</h2>
          {memberCount === 0 ? (
            <p className="text-small text-grey-400">—</p>
          ) : (
            <ul className="space-y-1 text-small font-mono">
              {space!.members.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  )
}

