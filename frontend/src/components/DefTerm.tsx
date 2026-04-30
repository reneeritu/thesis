import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { useDefinitions } from '../context/DefinitionsContext'
import { GLOSSARY } from '../lib/glossary'

const GAP_PX = 8
const FADE_MS = 150

type Props = {
  /** Key in {@link GLOSSARY} */
  term: string
  children: ReactNode
  className?: string
}

function hintTermLabel(term: string, children: ReactNode): string {
  if (typeof children === 'string') return children.trim().toUpperCase()
  return term.replace(/_/g, ' ').toUpperCase()
}

export function DefTerm({ term, children, className = '' }: Props) {
  const { definitionsOn } = useDefinitions()
  const def = GLOSSARY[term]
  const wordRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const hideTimerRef = useRef<number | null>(null)

  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const tooltipId = useId()

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }, [])

  const positionTooltip = useCallback(() => {
    const el = wordRef.current
    const tip = tooltipRef.current
    if (!el || !tip) return

    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const tipRect = tip.getBoundingClientRect()

    const placeBelow = rect.top < vh * 0.25

    let top: number
    if (placeBelow) {
      top = rect.bottom + GAP_PX
      const maxTop = vh - tipRect.height - GAP_PX
      if (top > maxTop) top = Math.max(GAP_PX, maxTop)
    } else {
      top = rect.top - GAP_PX - tipRect.height
      if (top < GAP_PX) top = GAP_PX
    }

    let left = rect.left + rect.width / 2 - tipRect.width / 2
    left = Math.max(GAP_PX, Math.min(left, vw - tipRect.width - GAP_PX))

    setCoords({ top, left })
  }, [])

  useLayoutEffect(() => {
    if (!mounted) return
    positionTooltip()
    const id = window.requestAnimationFrame(() => setVisible(true))
    return () => window.cancelAnimationFrame(id)
  }, [mounted, positionTooltip])

  useEffect(() => {
    if (!mounted || !visible) return
    const onReflow = () => positionTooltip()
    window.addEventListener('scroll', onReflow, true)
    window.addEventListener('resize', onReflow)
    return () => {
      window.removeEventListener('scroll', onReflow, true)
      window.removeEventListener('resize', onReflow)
    }
  }, [mounted, visible, positionTooltip])

  const show = () => {
    clearHideTimer()
    setVisible(false)
    setMounted(true)
  }

  const hide = () => {
    setVisible(false)
    clearHideTimer()
    hideTimerRef.current = window.setTimeout(() => {
      setMounted(false)
      hideTimerRef.current = null
    }, FADE_MS)
  }

  if (!definitionsOn || !def) {
    return <span className={className}>{children}</span>
  }

  const termLabel = hintTermLabel(term, children)

  return (
    <>
      <span
        ref={wordRef}
        className={`hint-word ${className}`.trim()}
        data-etch-def-term=""
        aria-describedby={mounted ? tooltipId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        {children}
      </span>
      {mounted
        ? createPortal(
            <div
              ref={tooltipRef}
              id={tooltipId}
              role="tooltip"
              className={`hint-tooltip${visible ? ' visible' : ''}`}
              style={{ top: coords.top, left: coords.left }}
            >
              <span className="hint-term">{termLabel}</span>
              <span className="hint-definition">{def}</span>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
