import { useEffect, useMemo, useRef } from 'react'
import type { SimEvent } from '../../lib/simApi'

type Props = {
  events: SimEvent[]
}

export function SimulationEventFeed({ events }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const newestSigRef = useRef<string>('')

  const ordered = useMemo(() => {
    return [...events].sort((a, b) => b.tick - a.tick)
  }, [events])

  const newestSig =
    ordered.length === 0 ? '' : `${ordered[0]!.tick}:${ordered[0]!.type}:${ordered[0]!.human}`

  useEffect(() => {
    if (newestSig === newestSigRef.current) return
    newestSigRef.current = newestSig
    const el = scrollRef.current
    if (el) el.scrollTop = 0
  }, [newestSig, ordered.length])

  if (ordered.length === 0) {
    return (
      <div
        ref={scrollRef}
        className="mt-1 flex min-h-[120px] flex-1 flex-col overflow-y-auto rounded border border-white/10 bg-black/30 p-2"
      >
        <p className="font-mono text-small text-white/35">No events yet.</p>
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      className="mt-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto rounded border border-white/10 bg-black/30 p-2"
    >
      {ordered.map((ev, i) => (
        <div
          key={`${ev.tick}-${ev.type}-${i}`}
          className="border-b border-white/5 pb-1.5 font-mono text-small leading-snug text-white/75 last:border-b-0 last:pb-0"
        >
          <span className="text-cyan-400/90">t{ev.tick}</span>
          <span className="text-white/35"> · </span>
          <span className="text-amber-200/80">{ev.type}</span>
          <div className="mt-0.5 text-white/60">{ev.human}</div>
        </div>
      ))}
    </div>
  )
}
