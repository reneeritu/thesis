import { useMemo } from 'react'
import type { SimEvent } from '../../lib/simApi'

type Props = {
  currentTick: number
  events: SimEvent[]
  onSeek: (tick: number) => void
}

export function SimulationTimeline({ currentTick, events, onSeek }: Props) {
  const markerTicks = useMemo(() => {
    const set = new Set<number>()
    for (const e of events) set.add(e.tick)
    return [...set].sort((a, b) => a - b)
  }, [events])

  const maxTick = useMemo(() => {
    const fromEvents = markerTicks.length ? markerTicks[markerTicks.length - 1]! : 0
    return Math.max(1, currentTick, fromEvents)
  }, [currentTick, markerTicks])

  const playheadPct = Math.min(100, Math.max(0, (currentTick / maxTick) * 100))

  return (
    <div className="rounded border border-white/10 bg-black/30 px-3 py-2">
      <div className="mb-1.5 font-mono text-small uppercase tracking-[0.18em] text-white/45">
        Timeline · tick {currentTick}
      </div>
      <div className="relative h-8 select-none">
        <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-white/20" />
        <div
          className="absolute top-1/2 h-0 w-0 -translate-y-1/2 border-y-[5px] border-y-transparent border-l-[7px] border-l-amber-400/90"
          style={{ left: `calc(${playheadPct}% - 3px)` }}
          title={`Current tick ${currentTick}`}
          aria-hidden
        />
        {markerTicks.map((t) => {
          const pct = (t / maxTick) * 100
          return (
            <button
              key={t}
              type="button"
              className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/70 bg-cyan-500/40 hover:bg-cyan-400/60"
              style={{ left: `${pct}%` }}
              title={`Tick ${t}`}
              aria-label={`Seek to tick ${t}`}
              onClick={() => onSeek(t)}
            />
          )
        })}
      </div>
    </div>
  )
}
