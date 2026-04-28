import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { api } from '../lib/api'

type SpaceResult = {
  _id: string
  name: string
  description: string
  status: string
  projectAccess: string
  memberCount: number
  isMember: boolean
}

export default function SpaceSearchPage() {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<SpaceResult[]>([])
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const out = await api<SpaceResult[]>('/spaces/search?q=' + encodeURIComponent(q.trim()))
      setRows(out)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    }
  }

  return (
    <AppShell title="Search Spaces">
      <div className="max-w-3xl space-y-4">
        <form onSubmit={onSubmit} className="flex flex-wrap gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="name, description, restrictions…"
            className="min-w-[280px] flex-1 border border-white/25 bg-zinc-900/55 px-3 py-2 font-mono text-small"
          />
          <button type="submit" className="border border-black bg-yellow-400 px-4 py-2 font-mono text-small uppercase tracking-[0.18em] hover:bg-black hover:text-yellow-400 transition">
            Search
          </button>
        </form>
        {error ? <p className="border border-black bg-grey-100 px-3 py-2 font-mono text-small">{error}</p> : null}
        {rows.length > 0 ? (
          <div className="space-y-2">
            {rows.map((s) => (
              <div key={s._id} className="border border-white/25 bg-zinc-900/55 px-3 py-2 text-small">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono">{s.name}</p>
                  <Link
                    to={`/spaces/${encodeURIComponent(s._id)}`}
                    className="border border-white/25 bg-zinc-900/55 px-2 py-0.5 font-mono text-small uppercase tracking-[0.16em] transition hover:bg-black hover:text-yellow-400"
                  >
                    Open
                  </Link>
                </div>
                <p className="text-white">{s.description || 'No description.'}</p>
                <p className="font-mono text-small text-white">
                  {s.status} · access {s.projectAccess} · members {s.memberCount} · {s.isMember ? 'you are a member' : 'not a member'}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}

