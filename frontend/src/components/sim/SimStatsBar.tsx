type Props = {
  documentationOn: boolean
  tracesTotal: number
  gini: number
}

export function SimStatsBar({ documentationOn, tracesTotal, gini }: Props) {
  const gStr = Number.isFinite(gini) ? gini.toFixed(3) : '—'

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border border-white/10 bg-black/30 px-3 py-2 font-mono text-[length:var(--text-xs)] uppercase tracking-[0.14em]">
      {documentationOn ? (
        <>
          <span className="text-[var(--text-secondary)]">
            TRACES: <span className="text-[var(--text-primary)]">{tracesTotal}</span>
          </span>
          <span className="text-[var(--text-secondary)]">
            CREDIT: <span className="text-[#67e8f9]">VERIFIED</span>
          </span>
          <span className="text-[var(--text-secondary)]">
            GINI: <span className="text-[var(--text-primary)]">{gStr}</span>
          </span>
        </>
      ) : (
        <>
          <span className="text-[var(--text-ghost)]">
            TRACES: <span className="text-[var(--text-muted)]">—</span>
          </span>
          <span className="text-[var(--text-ghost)]">
            CREDIT: <span className="text-[var(--text-muted)]">UNVERIFIED</span>
          </span>
          <span className="text-[var(--text-ghost)]">
            GINI: <span className="text-[var(--text-primary)]">{gStr}</span>
          </span>
        </>
      )}
    </div>
  )
}
