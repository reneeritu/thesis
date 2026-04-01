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

export default function PublicNodePage() {
  const { alias: aliasParam } = useParams<{ alias: string }>()
  const [node, setNode] = useState<NodePublic | null>(null)
  const [error, setError] = useState<string | null>(null)
  const authed = !!getToken()

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!aliasParam) return
      try {
        const n = await api<NodePublic>('/nodes/' + encodeURIComponent(aliasParam))
        if (!cancelled) setNode(n)
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
          <p className="border border-black bg-grey-100 px-3 py-2 text-small font-mono text-black" role="alert">
            {error}
          </p>
        ) : null}

        {!authed ? (
          <p className="text-body text-grey-400">
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
            <p className="text-h3 font-mono">{node.alias}</p>
            {node.reputationScore != null && authed ? (
              <p className="text-small font-mono text-grey-400">
                Score — not shown publicly; open your own profile for details.
              </p>
            ) : (
              <p className="text-small text-grey-400">Score — not public</p>
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
              <h2 className="text-small font-mono uppercase tracking-[0.18em] text-grey-400 mb-1">
                Keywords
              </h2>
              <p className="text-body">{node.keywords?.length ? node.keywords.join(', ') : '—'}</p>
            </div>
            <div>
              <h2 className="text-small font-mono uppercase tracking-[0.18em] text-grey-400 mb-1">
                Interests
              </h2>
              {node.interests?.length ? (
                <ul className="list-disc pl-5 text-body">
                  {node.interests.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-body text-grey-400">—</p>
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
            <p className="text-small text-grey-400">
              This profile is public. No personal data is stored beyond what you see.
            </p>
          </div>
        ) : !error ? (
          <p className="text-small font-mono text-grey-400">Loading…</p>
        ) : null}
      </div>
    </AppShell>
  )
}
