import { useMemo } from 'react'

const REDACTED_POOL = [
  '[ redacted ]',
  '[ work occurred ]',
  '[ contribution unrecorded ]',
  '[ event — no trace ]',
]

type Props = {
  documentationOn: boolean
  /** Recent documented-side messages (newest first). */
  events: string[]
  tick: number
}

export function SimEventFeed({ documentationOn, events, tick }: Props) {
  const lines = useMemo(() => {
    if (documentationOn) return events.slice(0, 8)
    return Array.from({ length: 8 }, (_, i) => REDACTED_POOL[(tick + i) % REDACTED_POOL.length])
  }, [documentationOn, events, tick])

  return (
    <div className="flex max-h-[140px] min-h-[120px] flex-col gap-1 overflow-y-auto border border-white/10 bg-black/25 px-2 py-2 font-mono text-[length:var(--text-xs)] uppercase tracking-[0.12em]">
      {lines.map((line, i) => (
        <div
          key={`${documentationOn}:${tick}:${i}`}
          className={
            documentationOn ? 'text-[var(--text-secondary)]' : 'text-[var(--text-ghost)] opacity-80'
          }
        >
          {line}
        </div>
      ))}
    </div>
  )
}
