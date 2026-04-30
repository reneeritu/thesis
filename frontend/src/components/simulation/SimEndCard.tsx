import { Link } from 'react-router-dom'
import { GHOST_WORLD_STATS, type EtchWorldStats } from '../../lib/simGameplay'

type Props = {
  etchStats: EtchWorldStats
  onExplore: () => void
  onWatchAgain: () => void
}

const STAT_LABELS: { key: keyof typeof GHOST_WORLD_STATS; label: string }[] = [
  { key: 'tracesDocumented', label: 'Traces documented' },
  { key: 'pivotsOnRecord', label: 'Pivots on record' },
  { key: 'disputesResolved', label: 'Disputes resolved' },
  { key: 'makersWithProvenance', label: 'Makers with provenance' },
  { key: 'nftsWithFairCredit', label: 'NFTs with fair credit' },
]

export function SimEndCard({ etchStats, onExplore, onWatchAgain }: Props) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/95 px-6">
      <div className="w-full max-w-2xl space-y-10">

        {/* Comparison table */}
        <div className="grid grid-cols-3 gap-0 border border-white/10">
          {/* Headers */}
          <div className="border-b border-r border-white/10 px-4 py-3" />
          <div className="border-b border-r border-white/10 px-4 py-3 text-center font-mono text-xs uppercase tracking-[0.22em] text-white/30">
            Without documentation
          </div>
          <div className="border-b border-white/10 px-4 py-3 text-center font-mono text-xs uppercase tracking-[0.22em] text-white/70">
            Etch
          </div>

          {/* Rows */}
          {STAT_LABELS.map(({ key, label }) => {
            const ghostVal = GHOST_WORLD_STATS[key]
            const etchVal = etchStats[key]
            return (
              <>
                <div
                  key={`label-${key}`}
                  className="border-b border-r border-white/10 px-4 py-3 font-mono text-base uppercase tracking-[0.16em] text-white/45 last-of-type:border-b-0"
                >
                  {label}
                </div>
                <div
                  key={`ghost-${key}`}
                  className="border-b border-r border-white/10 px-4 py-3 text-center font-mono text-sm tabular-nums text-white/20"
                >
                  {ghostVal}
                </div>
                <div
                  key={`etch-${key}`}
                  className="border-b border-white/10 px-4 py-3 text-center font-mono text-sm tabular-nums text-white/80"
                >
                  {etchVal}
                </div>
              </>
            )
          })}
        </div>

        {/* Closing line */}
        <div className="space-y-2 text-center">
          <p className="font-mono text-base uppercase tracking-[0.28em] text-white/50">
            Same world. Same people.
          </p>
          <p className="font-mono text-base uppercase tracking-[0.28em] text-white/50">
            The only difference: documentation.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/discover"
            className="border border-white/30 px-5 py-2 font-mono text-small uppercase tracking-[0.22em] text-white/70 transition hover:border-white/60 hover:text-white"
          >
            Explore etch →
          </Link>
          <button
            type="button"
            onClick={onExplore}
            className="border border-white/15 px-5 py-2 font-mono text-small uppercase tracking-[0.18em] text-white/35 transition hover:border-white/30 hover:text-white/60"
          >
            See the network
          </button>
          <button
            type="button"
            onClick={onWatchAgain}
            className="font-mono text-small uppercase tracking-[0.18em] text-white/25 underline decoration-white/15 underline-offset-4 transition hover:text-white/45"
          >
            Watch again
          </button>
        </div>

      </div>
    </div>
  )
}
