import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { api } from '../lib/api'
import { getAlias } from '../lib/session'

type SpaceWithName = {
  id: string
  name: string
  status?: string
}

type NodeProfile = {
  spacesWithNames?: SpaceWithName[]
}

export default function SpacesPage() {
  const [spaces, setSpaces] = useState<SpaceWithName[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const alias = getAlias()
        const me = await api<NodeProfile>('/nodes/' + encodeURIComponent(alias))
        if (!cancelled) setSpaces(me.spacesWithNames ?? [])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load spaces')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <AppShell title="Spaces">
      <div className="space-y-4">
        {error ? (
          <p className="border border-black bg-grey-100 px-3 py-2 text-small font-mono text-white" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-small text-white">
            Spaces you’re a member of.
          </p>
          <div className="flex gap-2 text-small font-mono uppercase tracking-[0.18em]">
            <Link
              to="/spaces/new"
              className="border border-white/25 bg-zinc-900/55 px-3 py-1 hover:bg-black hover:text-yellow-400 transition"
            >
              + Create
            </Link>
            <Link
              to="/spaces/join"
              className="border border-white/25 bg-zinc-900/55 px-3 py-1 hover:bg-black hover:text-yellow-400 transition"
            >
              + Join
            </Link>
            <Link
              to="/spaces/search"
              className="border border-white/25 bg-zinc-900/55 px-3 py-1 hover:bg-black hover:text-yellow-400 transition"
            >
              Search
            </Link>
          </div>
        </div>

        {spaces.length === 0 ? (
          <p className="text-small text-white">You’re not in any spaces yet.</p>
        ) : (
          <div className="space-y-2">
            {spaces.map((s) => {
              const dormant = s.status === 'dormant'
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-2 border border-white/25 bg-zinc-900/55 px-3 py-2 text-small font-mono"
                >
                  <span
                    className={`inline-block border border-black px-1.5 py-0.5 text-[9px] uppercase tracking-[0.16em] ${
                      dormant ? 'bg-grey-100 text-white' : 'bg-black text-yellow-400'
                    }`}
                    title={dormant ? 'No recent activity' : 'Active'}
                  >
                    {dormant ? 'Dormant' : 'Active'}
                  </span>
                  <span className="truncate flex-1 min-w-0">{s.name}</span>
                  <Link
                    to={`/spaces/${encodeURIComponent(s.id)}`}
                    className="border border-white/25 bg-zinc-900/55 px-3 py-1 hover:bg-black hover:text-yellow-400 transition"
                  >
                    Open
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}

