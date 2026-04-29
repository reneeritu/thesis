import { useEffect, useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'

type Props = {
  open: boolean
  onClose?: () => void
  align?: 'left' | 'right'
  className?: string
  children: React.ReactNode
  id?: string
  /** Referenced element id for dialog labelling (label lives inside `children`). */
  ariaLabelledBy?: string
  /** Used when `ariaLabelledBy` is omitted (e.g. notifications title is plain text). */
  ariaLabel?: string
}

/** Shared GSAP motion with `StaggeredMenu` `dropdownEntrance="fromTriggerBelow"` — panel drops under the anchor only. */
export function AnchoredGlassDropdownPanel({
  open,
  onClose,
  align = 'right',
  className = '',
  children,
  id,
  ariaLabelledBy,
  ariaLabel,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const wasOpenRef = useRef(false)

  useLayoutEffect(() => {
    const el = panelRef.current
    if (!el) return
    gsap.set(el, { autoAlpha: 0, yPercent: -100, xPercent: 0 })
  }, [])

  useEffect(() => {
    const el = panelRef.current
    if (!el) return

    if (open) {
      wasOpenRef.current = true
      gsap.killTweensOf(el)
      gsap.set(el, { visibility: 'visible', autoAlpha: 1 })
      gsap.fromTo(
        el,
        { yPercent: -100, xPercent: 0 },
        { yPercent: 0, xPercent: 0, duration: 0.4, ease: 'power3.out' },
      )
      return
    }

    if (!wasOpenRef.current) return

    gsap.killTweensOf(el)
    gsap.to(el, {
      yPercent: -100,
      xPercent: 0,
      duration: 0.22,
      ease: 'power3.in',
      overwrite: 'auto',
      onComplete: () => {
        gsap.set(el, { autoAlpha: 0 })
      },
    })
  }, [open])

  useEffect(() => {
    if (!open || !onClose) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const alignClass = align === 'left' ? 'left-0' : 'right-0'

  return (
    <div
      ref={panelRef}
      id={id}
      role="dialog"
      aria-modal="false"
      aria-labelledby={ariaLabelledBy}
      aria-label={ariaLabelledBy ? undefined : ariaLabel}
      aria-hidden={!open}
      className={`absolute top-full z-[200] mt-1 origin-top ${alignClass} ${open ? 'pointer-events-auto' : 'pointer-events-none'} ${className}`.trim()}
    >
      {children}
    </div>
  )
}
