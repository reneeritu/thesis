import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { api } from '../lib/api'

type Contributor = {
  alias: string
  role?: string
  isPrimary?: boolean
}

type Project = {
  _id: string
  title: string
  status: string
  spaceId: string
  contributors?: Contributor[]
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) return
      try {
        const p = await api<Project>('/projects/' + encodeURIComponent(id))
        if (!cancelled) setProject(p)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load project')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  return (
    <AppShell title={project?.title || 'Project'}>
      <div className="space-y-4">
        {error ? (
          <p className="border border-black bg-grey-100 px-3 py-2 text-small font-mono text-black" role="alert">
            {error}
          </p>
        ) : null}

        {project ? (
          <>
            <section className="space-y-2">
              <p className="text-small font-mono uppercase tracking-[0.18em] text-grey-400">
                Status
              </p>
              <p className="text-small font-mono">
                {project.status.toUpperCase()}
              </p>
              <p className="text-small text-grey-400">
                ID:{' '}
                <span className="font-mono text-xs break-all">
                  {project._id}
                </span>
              </p>
              <p className="pt-2">
                <Link
                  to={`/archive/new?space=${encodeURIComponent(project.spaceId)}`}
                  className="font-mono text-small underline underline-offset-4"
                >
                  Archive past work in this space (evidence + hashes)
                </Link>
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-small font-mono uppercase tracking-[0.18em] text-grey-400">
                Contributors
              </h2>
              {project.contributors && project.contributors.length ? (
                <ul className="space-y-1 text-small font-mono">
                  {project.contributors.map((c) => (
                    <li key={c.alias}>
                      {c.alias}{' '}
                      {c.role ? <span className="text-grey-400">({c.role})</span> : null}{' '}
                      {c.isPrimary ? (
                        <span className="inline-block border border-black bg-black px-1 py-0.5 text-[10px] uppercase tracking-[0.16em] text-yellow-400">
                          Primary
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-small text-grey-400">—</p>
              )}
            </section>
          </>
        ) : (
          <p className="text-small font-mono text-grey-400">Loading…</p>
        )}
      </div>
    </AppShell>
  )
}

