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
}

export function SimulationCounters({ counters }: Props) {
  const c = counters ?? ZERO

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {ITEMS.map(({ key, label }) => (
        <div
          key={key}
          className="rounded border border-white/10 bg-black/40 px-2 py-2 text-center"
        >
          <div className="font-mono text-2xl font-semibold tabular-nums text-white/90">
            {c[key].toLocaleString()}
          </div>
          <div className="mt-0.5 font-mono text-small uppercase tracking-[0.14em] text-white/45">
            {label}
          </div>
        </div>
      ))}
    </div>
  )
}
