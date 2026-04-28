import { useEffect, useState } from 'react'
import { simEntityApi, type SimSpaceSummary } from '../../../lib/simApi'

function AliasList({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div>
      <div className="mb-1 font-mono text-small uppercase text-white/40">{label}</div>
      <ul className="font-mono text-small text-white/70">
        {items.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
    </div>
  )
}

export function SpaceDetail({ id }: { id: string }) {
  const [data, setData] = useState<SimSpaceSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandContract, setExpandContract] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true)
        setError(null)
      }
    })
    simEntityApi
      .getSpace(id)
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load space')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-teal-400" />
      </div>
    )
  }
  if (error) return <p className="text-small text-red-300">{error}</p>
  if (!data) return null

  const st = data.settings
  const reqs = st?.minDocRequirements ?? []
  const contracts = st?.customContracts ?? []

  return (
    <div className="space-y-3 text-small text-white/85">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-mono text-sm font-semibold text-white">{data.name}</h4>
        <a
          href={`/spaces/${data._id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded border border-teal-500/40 bg-teal-500/10 px-2 py-0.5 font-mono text-small uppercase tracking-wider text-teal-200/90 hover:bg-teal-500/20"
          title="Open full space page in a new tab"
        >
          open space ↗
        </a>
      </div>
      {data.description ? (
        <p className="text-small leading-relaxed text-white/55">{data.description}</p>
      ) : null}
      <div className="flex flex-wrap gap-2 text-small text-white/55">
        <span>project access: {st?.projectAccess ?? '—'}</span>
        <span className="text-white/25">·</span>
        <span>privacy: {st?.privacyDefault ?? '—'}</span>
      </div>
      <div className="text-white/55">members: {(data.members ?? []).length}</div>
      <AliasList label="admins" items={data.admins ?? []} />
      {st?.enforceStrictMinDoc ? (
        <span className="inline-block rounded border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-small text-rose-200/90">
          strict min-doc
        </span>
      ) : null}
      {reqs.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {reqs.map((r) => (
            <span
              key={r}
              className="rounded border border-white/15 bg-white/5 px-2 py-0.5 text-small"
            >
              {r}
            </span>
          ))}
        </div>
      ) : null}
      <AliasList label="veto authority" items={st?.vetoAuthority ?? []} />
      {contracts.length > 0 ? (
        <div className="space-y-2 border-t border-white/10 pt-2">
          <div className="font-mono text-small uppercase text-white/40">custom contracts</div>
          {contracts.map((c, i) => (
            <div key={i} className="rounded border border-white/10 bg-black/30 p-2">
              <div className="font-medium text-white/90">{c.title}</div>
              <p className="mt-1 whitespace-pre-wrap text-small text-white/50">
                {expandContract === i ? c.body : `${(c.body ?? '').slice(0, 80)}`}
                {(c.body ?? '').length > 80 && expandContract !== i ? '…' : ''}
              </p>
              {(c.body ?? '').length > 80 ? (
                <button
                  type="button"
                  className="mt-1 text-small text-teal-400/90 hover:text-teal-300"
                  onClick={() => setExpandContract(expandContract === i ? null : i)}
                >
                  {expandContract === i ? 'show less' : 'view full'}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
