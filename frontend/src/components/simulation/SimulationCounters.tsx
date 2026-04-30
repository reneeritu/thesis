import type { SimCounters as SimCountersType } from '../../lib/simApi'

const ZERO: SimCountersType = {
  blocksWritten: 0,
  tracesLogged: 0,
  flagsFiled: 0,
  mediationsResolved: 0,
  nftsMinted: 0,
  governancePassed: 0,
}

const ITEMS: { key: keyof SimCountersType; label: string }[] = [
  { key: 'blocksWritten', label: 'Blocks' },
  { key: 'tracesLogged', label: 'Traces' },
  { key: 'flagsFiled', label: 'Flags' },
  { key: 'mediationsResolved', label: 'Mediations' },
  { key: 'nftsMinted', label: 'NFTs' },
  { key: 'governancePassed', label: 'Governance' },
]

type Props = {
  counters?: SimCountersType | null
  /** Ghost mode: hide values, show greyed placeholder dashes */
  ghostMode?: boolean
}

export function SimulationCounters({ counters, ghostMode = false }: Props) {
  const c = counters ?? ZERO

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" style={{ opacity: ghostMode ? 0.35 : 1 }}>
      {ITEMS.map(({ key, label }) => (
        <div
          key={key}
          className="rounded border bg-black/40 px-2 py-2 text-center"
          style={{ borderColor: ghostMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.10)' }}
        >
          <div className="font-mono text-2xl font-semibold tabular-nums" style={{ color: ghostMode ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.90)' }}>
            {ghostMode ? '—' : c[key].toLocaleString()}
          </div>
          <div className="mt-0.5 font-mono text-small uppercase tracking-[0.14em]" style={{ color: ghostMode ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.45)' }}>
            {label}
          </div>
        </div>
      ))}
    </div>
  )
}
