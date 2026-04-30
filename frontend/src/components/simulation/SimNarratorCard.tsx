import { useEffect, useState } from 'react'
import type { GamePhase } from '../../lib/simGameplay'

const ENTRANCE_MS = 300

type Props = {
  text: string | null
  phase: GamePhase
  /** Called when user advances (click on card or via parent's spacebar listener). */
  onAdvance?: () => void
  /** Optional: queued count, shown subtly at the bottom of the card. */
  queueCount?: number
}

/**
 * Manual-advance narrator card. Subtle opacity entrance; stays until `onAdvance`.
 */
export function SimNarratorCard({ text, phase, onAdvance, queueCount = 0 }: Props) {
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    if (!text) {
      setEntered(false)
      return
    }
    setEntered(false)
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setEntered(true))
    })
    return () => window.cancelAnimationFrame(id)
  }, [text])

  if (!text) return null

  const isGhost = phase === 'act1' || phase === 'transition'
  const borderOuter = isGhost ? '#2a2a4a' : '#4a3a6a'
  const borderAccent = isGhost ? '#666664' : '#a78bfa'

  return (
    <div
      className="absolute bottom-6 right-4 z-30 max-w-[320px] ease-out"
      style={{
        opacity: entered ? 1 : 0,
        transition: `opacity ${ENTRANCE_MS}ms ease-out`,
        boxShadow: 'none',
      }}
    >
      <button
        type="button"
        onClick={() => onAdvance?.()}
        className="cursor-target flex w-full flex-col items-stretch gap-3 px-4 py-3 text-left shadow-none transition-colors hover:brightness-[1.06]"
        style={{
          backgroundColor: 'rgba(10, 10, 15, 0.92)',
          border: `1px solid ${borderOuter}`,
          borderLeft: `2px solid ${borderAccent}`,
          boxShadow: 'none',
        }}
        data-target-cursor-exclude
      >
        <span
          className="font-mono text-sm uppercase leading-relaxed tracking-widest"
          style={{ color: isGhost ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.92)' }}
        >
          {text}
        </span>
        <span className="flex items-center justify-between font-mono text-xs uppercase tracking-[0.22em] text-[var(--text-ghost)] opacity-60">
          <span>[SPACE] CONTINUE</span>
          <span className="flex items-center gap-2">
            {queueCount > 1 ? <span>· +{queueCount - 1} MORE</span> : null}
            <span aria-hidden>→</span>
          </span>
        </span>
      </button>
    </div>
  )
}
