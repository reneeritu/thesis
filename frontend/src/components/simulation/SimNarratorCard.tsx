import { useEffect, useState } from 'react'
import {
  type GamePhase,
  NARRATOR_FADE_OUT_MS,
} from '../../lib/simGameplay'

type Props = {
  text: string | null
  phase: GamePhase
  /** Called when user advances (click on card or via parent's spacebar listener). */
  onAdvance?: () => void
  /** Optional: queued count, shown subtly at the bottom of the card. */
  queueCount?: number
}

/**
 * Manual-advance narrator card. Slides in from the right when `text` changes.
 * Stays visible until parent calls `onAdvance` (via card click, spacebar, etc.).
 */
export function SimNarratorCard({ text, phase, onAdvance, queueCount = 0 }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!text) {
      setVisible(false)
      return
    }
    const id = window.requestAnimationFrame(() => setVisible(true))
    return () => window.cancelAnimationFrame(id)
  }, [text])

  if (!text) return null

  const isGhost = phase === 'act1' || phase === 'transition'

  return (
    <div
      className="absolute bottom-6 right-4 z-30 max-w-[320px] transition-all"
      style={{
        transform: visible ? 'translateX(0)' : 'translateX(110%)',
        opacity: visible ? 1 : 0,
        transitionDuration: `${NARRATOR_FADE_OUT_MS}ms`,
      }}
    >
      <button
        type="button"
        onClick={() => onAdvance?.()}
        className="cursor-target flex w-full flex-col items-stretch gap-3 border bg-black/85 px-4 py-3 text-left font-mono uppercase tracking-[0.18em] transition hover:bg-black/95"
        style={{
          borderColor: isGhost ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.32)',
          color: isGhost ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.85)',
        }}
        data-target-cursor-exclude
      >
        <span className="text-[12px] leading-relaxed">{text}</span>
        <span className="flex items-center justify-between text-[9px] tracking-[0.28em] text-white/35">
          <span>[Space] continue</span>
          <span className="flex items-center gap-2">
            {queueCount > 1 ? <span>+{queueCount - 1} more</span> : null}
            <span aria-hidden className="narrator-card-arrow">→</span>
          </span>
        </span>
      </button>
    </div>
  )
}
