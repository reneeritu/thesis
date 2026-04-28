import { useEffect, useState } from 'react'
import { simEntityApi, type SimProjectSummary } from '../../../lib/simApi'

function statusPill(status: string) {
  const s = status.toLowerCase()
  const cls =
    s === 'active'
      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
      : s === 'completed'
        ? 'border-sky-500/40 bg-sky-500/15 text-sky-200'
        : s === 'disputed' || s === 'halted'
          ? 'border-rose-500/40 bg-rose-500/15 text-rose-200'
          : 'border-white/20 bg-white/5 text-white/70'
  return (
    <span className={`rounded-full border px-2 py-0.5 text-small font-medium ${cls}`}>
      {status}
    </span>
  )
}

function acceptedLabel(accepted: boolean | null | undefined) {
  if (accepted === true) return 'accepted'
  if (accepted === false) return 'declined'
  return 'pending'
}

export function ProjectDetail({
  id,
  onNavigateSpace,
}: {
  id: string
  onNavigateSpace?: (spaceId: string) => void
}) {
  const [data, setData] = useState<SimProjectSummary | null>(null)
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
      .getProject(id)
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load project')
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
  if (error) {
    return <p className="text-small text-red-300">{error}</p>
  }
  if (!data) return null

  const sid = String(data.spaceId)
  const parent = data.parentProjectId ? String(data.parentProjectId) : null

  return (
    <div className="space-y-3 text-small text-white/85">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-mono text-sm font-semibold text-white">{data.title}</h4>
        <a
          href={`/projects/${data._id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded border border-teal-500/40 bg-teal-500/10 px-2 py-0.5 font-mono text-small uppercase tracking-wider text-teal-200/90 hover:bg-teal-500/20"
          title="Open full project page in a new tab"
        >
          open project ↗
        </a>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {statusPill(data.status)}
        <span className="text-small text-white/50">visibility: {data.visibility}</span>
      </div>
      {parent ? (
        <div className="font-mono text-small text-violet-300/80">Fork of {parent}</div>
      ) : null}
      <div>
        <span className="text-white/45">space: </span>
        {onNavigateSpace ? (
          <button
            type="button"
            className="font-mono text-small text-teal-400/90 hover:text-teal-300"
            onClick={() => onNavigateSpace(sid)}
          >
            {sid}
          </button>
        ) : (
          <span className="font-mono text-small text-white/70">{sid}</span>
        )}
      </div>
      <div>
        <div className="mb-1 font-mono text-small uppercase text-white/40">contributors</div>
        <ul className="space-y-1.5">
          {data.contributors.map((c, i) => {
            const row = c as typeof c & { accepted?: boolean | null }
            return (
              <li
                key={`${c.alias}-${i}`}
                className="rounded border border-white/10 bg-black/30 px-2 py-1 font-mono text-small"
              >
                <span className="text-white/90">{c.alias}</span>
                <span className="mx-1 text-white/35">·</span>
                <span className="text-white/55">{c.role}</span>
                {c.isPrimary ? (
                  <span className="ml-1 text-amber-400/80">primary</span>
                ) : null}
                <span className="ml-2 text-white/40">{acceptedLabel(row.accepted)}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
