import { useEffect, useState } from 'react'

type Props = {
  message: string | null
  /** Unique key per message so timers reset cleanly */
  messageKey?: number
  onDismiss: () => void
}

const ENTRANCE_MS = 280
const AUTO_MS = 4000

export function SimNarratorCard({ message, messageKey = 0, onDismiss }: Props) {
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    if (!message) {
      setEntered(false)
      return
    }
    setEntered(false)
    const r = window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => setEntered(true)),
    )
    const t = window.setTimeout(onDismiss, AUTO_MS)
    return () => {
      window.cancelAnimationFrame(r)
      window.clearTimeout(t)
    }
  }, [message, messageKey, onDismiss])

  if (!message) return null

  return (
    <div
      className="pointer-events-none fixed bottom-8 left-1/2 z-[80] w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 ease-out"
      style={{
        opacity: entered ? 1 : 0,
        transition: `opacity ${ENTRANCE_MS}ms ease-out`,
      }}
    >
      <div
        className="pointer-events-none rounded-sm px-4 py-3 shadow-none"
        style={{
          backgroundColor: 'rgba(10, 10, 15, 0.92)',
          border: '1px solid #4a3a6a',
          borderLeft: '2px solid #a78bfa',
          boxShadow: 'none',
        }}
      >
        <p className="font-mono text-[length:var(--text-sm)] uppercase leading-relaxed tracking-[0.14em] text-[var(--text-primary)]">
          {message}
        </p>
        <p className="mt-2 font-mono text-[length:var(--text-xs)] uppercase tracking-[0.2em] text-[var(--text-ghost)] opacity-60">
          auto-dismiss · same simulation clock
        </p>
      </div>
    </div>
  )
}
