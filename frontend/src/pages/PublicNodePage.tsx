import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { api } from '../lib/api'
import { getToken } from '../lib/session'

type NodePublic = {
  alias: string
  reputationScore?: number
  keywords?: string[]
  interests?: string[]
  portfolioUrl?: string
  badges?: string[]
}

type NodeProject = {
  _id: string
  title: string
  status: string
  visibility: string
  spaceId: string
  spaceName: string
  role: string
}

export default function PublicNodePage() {
  const { alias: aliasParam } = useParams<{ alias: string }>()
  const [node, setNode] = useState<NodePublic | null>(null)
  const [projects, setProjects] = useState<NodeProject[]>([])
  const [error, setError] = useState<string | null>(null)
  const authed = !!getToken()

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!aliasParam) return
      try {
        const [n, ps] = await Promise.all([
          api<NodePublic>('/nodes/' + encodeURIComponent(aliasParam)),
          api<NodeProject[]>('/projects/by-node/' + encodeURIComponent(aliasParam)).catch(
            () => [] as NodeProject[],
          ),
        ])
        if (!cancelled) {
          setNode(n)
          setProjects(ps)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load node')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [aliasParam])

  return (
    <AppShell title={node?.alias || 'Node'}>
      <div className="space-y-6">
        {error ? (
          <p className="border border-black bg-grey-100 px-3 py-2 text-small font-mono text-white" role="alert">
            {error}
          </p>
        ) : null}

        {!authed ? (
          <p className="text-body text-white">
            Have an account?{' '}
            <Link to="/login" className="underline underline-offset-4">
              Log in
            </Link>
            . New?{' '}
            <Link to="/register" className="underline underline-offset-4">
              Register
            </Link>
            .
          </p>
        ) : null}

        {node ? (
          <div className="space-y-4">
            <p className="text-h3 font-bricolage">{node.alias}</p>
            {node.reputationScore != null && authed ? (
              <p className="text-small font-mono text-white">
                Score — not shown publicly; open your own profile for details.
              </p>
            ) : (
              <p className="text-small text-white">Score — not public</p>
            )}
            {node.badges?.length ? (
              <div className="flex flex-wrap gap-2">
                {node.badges.map((b) => (
                  <span
                    key={b}
                    className="border border-black bg-black px-2 py-1 text-[11px] font-mono uppercase tracking-[0.16em] text-yellow-400"
                  >
                    {String(b).toUpperCase()}
                  </span>
                ))}
              </div>
            ) : null}
            <div>
              <h2 className="text-small font-bricolage uppercase tracking-[0.18em] text-white mb-1">
                Keywords
              </h2>
              <p className="text-body">{node.keywords?.length ? node.keywords.join(', ') : '—'}</p>
            </div>
            <div>
              <h2 className="text-small font-bricolage uppercase tracking-[0.18em] text-white mb-1">
                Interests
              </h2>
              {node.interests?.length ? (
                <ul className="list-disc pl-5 text-body">
                  {node.interests.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-body text-white">—</p>
              )}
            </div>
            {node.portfolioUrl ? (
              <p>
                <a
                  href={node.portfolioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-small underline underline-offset-4"
                >
                  Portfolio
                </a>
              </p>
            ) : null}
            <div>
              <h2 className="text-small font-bricolage uppercase tracking-[0.18em] text-white mb-1">
                Projects
              </h2>
              {projects.length === 0 ? (
                <p className="text-body text-white">No visible projects.</p>
              ) : (
                <ul className="space-y-2">
                  {projects.map((p) => (
                    <li key={p._id}>
                      <Link
                        to={`/projects/${encodeURIComponent(p._id)}`}
                        className="flex flex-wrap items-center gap-2 border border-white/25 bg-zinc-900/55 px-3 py-2 font-mono text-small transition hover:bg-black hover:text-yellow-400"
                      >
                        <span className="truncate">{p.title}</span>
                        <span className="text-[10px] uppercase tracking-[0.16em] text-white">
                          {p.spaceName}
                        </span>
                        <span className="ml-auto text-[10px] uppercase tracking-[0.16em]">
                          {p.role} · {p.status}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-small text-white">
              This profile is public. No personal data is stored beyond what you see.
            </p>
          </div>
        ) : !error ? (
          <p className="text-small font-mono text-white">Loading…</p>
        ) : null}
      </div>
    </AppShell>
  )
}
