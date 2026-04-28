import { useEffect, useState } from 'react'
import { simEntityApi, type SimNodeSummary } from '../../../lib/simApi'

const CAT_KEYS = [
  'craft',
  'research',
  'collaboration',
  'pedagogy',
  'consistency',
  'community',
] as const

export function NodeDetail({ alias }: { alias: string }) {
  const [data, setData] = useState<SimNodeSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true)
        setError(null)
      }
    })
    simEntityApi
      .getNodeByAlias(alias)
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load node')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [alias])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-teal-400" />
      </div>
    )
  }
  if (error) {
    return <p className="text-small text-red-300">{error}</p>
  }
  if (!data) return null

  const spaces = (data.spaces ?? []).map(String)
  const rc = data.reputationCategories ?? {}

  return (
    <div className="space-y-3 text-small text-white/85">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-mono text-sm font-semibold text-white">{data.alias}</h4>
        <a
          href={`/nodes/${encodeURIComponent(data.alias)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded border border-teal-500/40 bg-teal-500/10 px-2 py-0.5 font-mono text-small uppercase tracking-wider text-teal-200/90 hover:bg-teal-500/20"
          title="Open full node profile in a new tab"
        >
          open profile ↗
        </a>
      </div>
      <div className="text-white/55">status: {data.status ?? '—'}</div>
      <div>
        <div className="font-mono text-small uppercase tracking-wider text-white/40">
          reputation
        </div>
        <div className="font-mono text-3xl font-semibold tabular-nums text-white/90">
          {data.reputationScore != null ? data.reputationScore.toLocaleString() : '—'}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {CAT_KEYS.map((k) => (
          <div
            key={k}
            className="rounded border border-white/10 bg-black/30 px-2 py-1 font-mono text-small"
          >
            <span className="text-white/45">{k}</span>
            <span className="float-right text-white/80">{rc[k] ?? 0}</span>
          </div>
        ))}
      </div>
      {data.badges?.length ? (
        <div className="flex flex-wrap gap-1">
          {data.badges.map((b) => (
            <span
              key={b}
              className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-small text-amber-100/90"
            >
              {b}
            </span>
          ))}
        </div>
      ) : null}
      <div className="text-white/55">
        spaces: {spaces.length}
        {spaces.length ? (
          <span className="ml-1 font-mono text-small text-white/40">
            ({spaces.slice(0, 3).join(', ')}
            {spaces.length > 3 ? '…' : ''})
          </span>
        ) : null}
      </div>
    </div>
  )
}
