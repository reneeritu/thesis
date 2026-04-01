import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { api } from '../lib/api'

type ProjectResult = {
  _id: string
  title: string
  status: string
  spaceId: string
  spaceName: string
  context: string
  creatorAlias: string
  mentorAlias: string
  tools: string[]
}

export default function ProjectSearchPage() {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<ProjectResult[]>([])
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const out = await api<ProjectResult[]>('/projects/search?q=' + encodeURIComponent(q.trim()))
      setRows(out)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    }
  }

  return (
    <AppShell title="Search Projects">
      <div className="space-y-4">
        <form onSubmit={onSubmit} className="flex flex-wrap gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="title, context, creator, software/tool…"
            className="min-w-[280px] flex-1 border border-black bg-white px-3 py-2 font-mono text-small"
          />
          <button type="submit" className="border border-black bg-yellow-400 px-4 py-2 font-mono text-small uppercase tracking-[0.18em] hover:bg-black hover:text-yellow-400 transition">
            Search
          </button>
        </form>
        {error ? <p className="border border-black bg-grey-100 px-3 py-2 font-mono text-small">{error}</p> : null}
        {rows.length > 0 ? (
          <div className="space-y-2">
            {rows.map((p) => (
              <div key={p._id} className="border border-black bg-white px-3 py-2 text-small space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono">{p.title}</p>
                  <Link to={`/projects/${encodeURIComponent(p._id)}`} className="underline underline-offset-4 font-mono text-[11px]">
                    Open
                  </Link>
                </div>
                <p className="text-grey-400">{p.context || 'No context.'}</p>
                <p className="font-mono text-[11px] text-grey-400">
                  {p.status} · in {p.spaceName} · creator {p.creatorAlias}{p.mentorAlias ? ` · mentor ${p.mentorAlias}` : ''}
                </p>
                {p.tools.length > 0 ? (
                  <p className="font-mono text-[11px]">Tools: {p.tools.join(', ')}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}

