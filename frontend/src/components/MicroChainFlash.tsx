import { useEffect, useState } from 'react'

type FlashPayload = {
  /** Short hex or id fragment for typing line */
  hashHint?: string
}

/**
 * Listens for `etch:chain-flash` — brief chain-link + “lock” affordance (chain metaphor).
 */
export function MicroChainFlash() {
  const [visible, setVisible] = useState(false)
  const [hashLine, setHashLine] = useState('')
  const [typing, setTyping] = useState(false)

  useEffect(() => {
    function onFlash(e: Event) {
      const d = (e as CustomEvent<FlashPayload>).detail
      setVisible(true)
      const hint = d?.hashHint?.replace(/\s/g, '') ?? ''
      setHashLine('')
      setTyping(!!hint)
      if (hint) {
        let i = 0
        const step = () => {
          i += 1
          setHashLine(hint.slice(0, Math.min(i, hint.length)))
          if (i < hint.length) window.requestAnimationFrame(() => window.setTimeout(step, 18))
          else setTyping(false)
        }
        window.setTimeout(step, 40)
      } else {
        setTyping(false)
      }
      window.setTimeout(() => {
        setVisible(false)
        setHashLine('')
        setTyping(false)
      }, 1600)
    }
    window.addEventListener('etch:chain-flash', onFlash as EventListener)
    return () => window.removeEventListener('etch:chain-flash', onFlash as EventListener)
  }, [])

  if (!visible) return null

  return (
    <div
      className="pointer-events-none fixed left-1/2 top-[min(28vh,200px)] z-[2147481999] flex -translate-x-1/2 flex-col items-center gap-1"
      aria-hidden
    >
      <div className="etch-chain-flash-icon flex items-center justify-center text-white/90">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-current">
          <path
            d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="etch-chain-stroke-open"
          />
        </svg>
      </div>
      {hashLine ? (
        <p className="etch-chain-flash-hash max-w-[min(90vw,18rem)] truncate font-mono text-[11px] uppercase tracking-[0.12em]">
          {hashLine}
          {typing ? <span className="etch-hash-caret">▍</span> : null}
        </p>
      ) : null}
    </div>
  )
}
