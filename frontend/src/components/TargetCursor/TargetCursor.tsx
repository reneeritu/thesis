/**
 * Custom cursor: idle = 18px circle (difference); glossary-linked spans — same
 * size + small “?”; hovered snap target = springs to element center + brackets.
 */
import {
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useSyncExternalStore,
  useState,
} from 'react'
import gsap from 'gsap'
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useMotionValueEvent,
} from 'framer-motion'
import { useLocation } from 'react-router-dom'

import { useTheme } from '../../context/ThemeContext'
import { getGlobalLoading, subscribeGlobalLoading } from '../../lib/cursor'

import './TargetCursor.css'

export type TargetCursorProps = {
  targetSelector?: string
  excludeSelector?: string | false
  /** One full rotation duration while global loading (seconds). */
  spinDuration?: number
  hideDefaultCursor?: boolean
  /**
   * After this many ms without pointer movement, glide the cursor toward screen center.
   * Skipped while over any `targetSelector` match (buttons, links, etc.). `false` disables.
   */
  idleSnapToCenterMs?: number | false
}

export const ETCH_CURSOR_TARGET_SELECTOR =
  'button:not(:disabled,[data-no-target-cursor]), a[href]:not([data-no-target-cursor]), input[type="submit"]:not(:disabled,[data-no-target-cursor]), input[type="button"]:not(:disabled,[data-no-target-cursor]), summary:not([data-no-target-cursor]), [role="button"]:not(:disabled,[data-no-target-cursor]), .cursor-target'

const IDLE = 18
/** Same footprint as idle — “?” fits inside the 18px circle */
const IDLE_DEF_TERM = 18
/** Fixed hit box while global API loading (decoupled from snapped element size). */
const LOADING_CURSOR_PX = 32
/** Extra padding around snapped controls (lighter than thick chrome). */
const PAD = 6
/** Don't snap to interactives larger than this — avoids the cursor becoming a giant box/circle. */
const MAX_SNAP_W = 280
const MAX_SNAP_H = 140

const springPhysics = Object.freeze({
  mass: 0.72,
  stiffness: 360,
  damping: 21,
})

function copyDomRect(r: DOMRectReadOnly): DOMRect {
  return new DOMRect(r.x, r.y, r.width, r.height)
}

const DEFAULT_IDLE_SNAP_MS = 3200

export default function TargetCursor({
  targetSelector = ETCH_CURSOR_TARGET_SELECTOR,
  excludeSelector = '[data-target-cursor-exclude]',
  spinDuration: _spinDuration = 2,
  hideDefaultCursor = true,
  idleSnapToCenterMs = DEFAULT_IDLE_SNAP_MS,
}: TargetCursorProps) {
  const { theme } = useTheme()
  const iw = typeof window !== 'undefined' ? window.innerWidth / 2 : 0
  const ih = typeof window !== 'undefined' ? window.innerHeight / 2 : 0

  const pulseRef = useRef<HTMLDivElement | null>(null)

  const snapTargetRef = useRef<HTMLElement | null>(null)
  const snappingRef = useRef(false)
  const idleSnapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Always updated so mouseleave can snap back to real pointer position. */
  const lastMouseRef = useRef({ x: iw, y: ih })

  /** Latest rect for the snapped interactive (for scroll sync + React state per spec). */
  const [hoveredElement, setHoveredElement] = useState<DOMRect | null>(null)

  const globalLoading = useSyncExternalStore(
    subscribeGlobalLoading,
    getGlobalLoading,
    () => false,
  )

  const location = useLocation()
  /** Sim page polls often; global API loading would spin the cursor non-stop. */
  const suppressLoadingVisual =
    location.pathname === '/simulation' || location.pathname.startsWith('/simulation/')
  const loadingVisualActive = globalLoading && !suppressLoadingVisual
  const loadingVisualRef = useRef(false)
  loadingVisualRef.current = loadingVisualActive

  /** Hovering inline glossary spans (`data-etch-def-term`) — same 18px dot + “?” */
  const [defTermHover, setDefTermHover] = useState(false)

  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false
    const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    const isSmallScreen = window.innerWidth <= 768
    const userAgent = navigator.userAgent || (navigator as { vendor?: string }).vendor || ''
    const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i
    const isMobileUserAgent = mobileRegex.test(String(userAgent).toLowerCase())
    return (hasTouchScreen && isSmallScreen) || isMobileUserAgent
  }, [])

  const targetCx = useMotionValue(iw)
  const targetCy = useMotionValue(ih)
  const targetW = useMotionValue(IDLE)
  const targetH = useMotionValue(IDLE)
  /** Display size: mirrors targetW/H except fixed while loading (avoids huge “circle” after snap). */
  const boxW = useMotionValue(IDLE)
  const boxH = useMotionValue(IDLE)

  const springX = useSpring(targetCx, springPhysics)
  const springY = useSpring(targetCy, springPhysics)
  /** Size is not spring-smoothed — avoids overshoot so idle stays a true 18px hit area */
  const tx = useTransform([springX, boxW], ([x, w]) => (x as number) - (w as number) / 2)
  const ty = useTransform([springY, boxH], ([y, h]) => (y as number) - (h as number) / 2)

  useEffect(() => {
    if (loadingVisualActive) {
      /** Drop snap while loading so dimensions cannot stay huge and “idle circle” won’t inherit a large box. */
      snappingRef.current = false
      snapTargetRef.current = null
      setHoveredElement(null)
      setDefTermHover(false)
      const { x, y } = lastMouseRef.current
      targetCx.set(x)
      targetCy.set(y)
      targetW.set(IDLE)
      targetH.set(IDLE)
      boxW.set(LOADING_CURSOR_PX)
      boxH.set(LOADING_CURSOR_PX)
      if (pulseRef.current) {
        gsap.killTweensOf(pulseRef.current)
        gsap.set(pulseRef.current, { scale: 1 })
      }
    } else {
      boxW.set(targetW.get())
      boxH.set(targetH.get())
    }
  }, [loadingVisualActive, boxW, boxH, targetW, targetH, targetCx, targetCy])

  useMotionValueEvent(targetW, 'change', (w) => {
    if (!loadingVisualRef.current) boxW.set(w)
  })
  useMotionValueEvent(targetH, 'change', (h) => {
    if (!loadingVisualRef.current) boxH.set(h)
  })

  const applyRect = useCallback(
    (r: DOMRectReadOnly) => {
      const rc = copyDomRect(r)
      setHoveredElement(rc)
      targetCx.set(rc.left + rc.width / 2)
      targetCy.set(rc.top + rc.height / 2)
      targetW.set(rc.width + PAD)
      targetH.set(rc.height + PAD)
    },
    [targetCx, targetCy, targetW, targetH],
  )

  const clearSnap = useCallback(() => {
    snappingRef.current = false
    snapTargetRef.current = null
    setHoveredElement(null)
  }, [])

  /** Click pulse: 1 → 1.35 → 1 (GSAP on inner layer only). */
  const playClickPulse = useCallback(() => {
    if (!pulseRef.current || loadingVisualActive) return
    const el = pulseRef.current
    gsap.killTweensOf(el)
    gsap
      .timeline()
      .to(el, { scale: 1.35, duration: 0.08, ease: 'power2.out' })
      .to(el, { scale: 1, duration: 0.16, ease: 'power2.inOut' })
  }, [loadingVisualActive])

  useEffect(() => {
    if (isMobile || typeof window === 'undefined') return

    const originalCursor = document.body.style.cursor
    if (hideDefaultCursor) {
      document.body.style.cursor = 'none'
    }

    let activeTarget: HTMLElement | null = null
    let currentLeaveHandler: (() => void) | null = null

    function clearIdleSnapTimer() {
      if (idleSnapTimerRef.current != null) {
        clearTimeout(idleSnapTimerRef.current)
        idleSnapTimerRef.current = null
      }
    }

    function scheduleIdleSnapToCenter() {
      clearIdleSnapTimer()
      if (idleSnapToCenterMs === false) return
      idleSnapTimerRef.current = setTimeout(() => {
        idleSnapTimerRef.current = null
        if (snappingRef.current || getGlobalLoading()) return
        const { x, y } = lastMouseRef.current
        const hit = document.elementFromPoint(x, y)
        if (!(hit instanceof Element)) return
        if (excludeSelector && hit.closest(excludeSelector)) return
        if (hit.closest(targetSelector)) return
        const cx = window.innerWidth / 2
        const cy = window.innerHeight / 2
        let idleSz = IDLE
        let overDef = false
        if (!(excludeSelector && hit.closest(excludeSelector)) && hit.closest('[data-etch-def-term]')) {
          idleSz = IDLE_DEF_TERM
          overDef = true
        }
        targetCx.set(cx)
        targetCy.set(cy)
        targetW.set(idleSz)
        targetH.set(idleSz)
        setDefTermHover(overDef)
      }, idleSnapToCenterMs)
    }

    function cleanupTarget(target: Element) {
      if (currentLeaveHandler) {
        target.removeEventListener('mouseleave', currentLeaveHandler)
      }
      currentLeaveHandler = null
    }

    const moveHandler = (e: MouseEvent) => {
      lastMouseRef.current = { x: e.clientX, y: e.clientY }
      clearIdleSnapTimer()
      if (snappingRef.current) return
      const hit = document.elementFromPoint(e.clientX, e.clientY)
      let idleSz = IDLE
      let overDef = false
      if (hit instanceof Element && !(excludeSelector && hit.closest(excludeSelector))) {
        if (hit.closest('[data-etch-def-term]')) {
          idleSz = IDLE_DEF_TERM
          overDef = true
        }
      }
      setDefTermHover(overDef)
      targetCx.set(e.clientX)
      targetCy.set(e.clientY)
      targetW.set(idleSz)
      targetH.set(idleSz)
      scheduleIdleSnapToCenter()
    }

    const scrollHandler = () => {
      if (!activeTarget || snappingRef.current) return

      const { x: mouseX, y: mouseY } = lastMouseRef.current
      const elementUnderMouse = document.elementFromPoint(mouseX, mouseY)
      const stillOver =
        elementUnderMouse &&
        (elementUnderMouse === activeTarget ||
          (elementUnderMouse as Element).closest(targetSelector) === activeTarget)
      if (!stillOver && currentLeaveHandler) {
        currentLeaveHandler()
      }
    }
    window.addEventListener('scroll', scrollHandler, { passive: true })

    /** Keep hovered rect synced while snapped (scroll/layout). */
    const scrollSyncSnap = () => {
      const el = snapTargetRef.current
      if (!el || !snappingRef.current) return
      applyRect(el.getBoundingClientRect())
    }
    window.addEventListener('scroll', scrollSyncSnap, true)
    window.addEventListener('resize', scrollSyncSnap)

    const pointerDownHandler = () => playClickPulse()
    window.addEventListener('pointerdown', pointerDownHandler)

    const enterHandler = (e: MouseEvent) => {
      if (getGlobalLoading()) return
      clearIdleSnapTimer()
      const raw = e.target
      if (!(raw instanceof Element)) return
      if (excludeSelector && raw.closest(excludeSelector)) return

      const allTargets: HTMLElement[] = []
      let current: Element | null = raw
      while (current && current !== document.body) {
        try {
          if (current.matches(targetSelector)) {
            allTargets.push(current as HTMLElement)
          }
        } catch {
          break
        }
        current = current.parentElement
      }
      const target = allTargets[0] ?? null

      if (!target) return
      if (activeTarget === target) return
      if (activeTarget) cleanupTarget(activeTarget)

      const initialRect = target.getBoundingClientRect()
      if (
        initialRect.width <= 0 ||
        initialRect.height <= 0 ||
        initialRect.width > MAX_SNAP_W ||
        initialRect.height > MAX_SNAP_H
      ) {
        // Skip snapping to oversized interactives so the cursor stays a small dot.
        return
      }

      activeTarget = target
      snappingRef.current = true
      snapTargetRef.current = target
      setDefTermHover(false)
      applyRect(initialRect)

      const leaveHandler = () => {
        clearSnap()
        activeTarget = null
        cleanupTarget(target)
        const last = lastMouseRef.current
        targetCx.set(last.x)
        targetCy.set(last.y)
        targetW.set(IDLE)
        targetH.set(IDLE)
      }

      currentLeaveHandler = leaveHandler
      target.addEventListener('mouseleave', leaveHandler)
    }

    window.addEventListener('mousemove', moveHandler, { passive: true })
    window.addEventListener('mouseover', enterHandler, { passive: true })

    return () => {
      clearIdleSnapTimer()
      window.removeEventListener('mousemove', moveHandler)
      window.removeEventListener('mouseover', enterHandler)
      window.removeEventListener('scroll', scrollHandler)
      window.removeEventListener('scroll', scrollSyncSnap, true)
      window.removeEventListener('resize', scrollSyncSnap)
      window.removeEventListener('pointerdown', pointerDownHandler)

      if (activeTarget) {
        cleanupTarget(activeTarget)
      }
      clearSnap()
      targetCx.set(window.innerWidth / 2)
      targetCy.set(window.innerHeight / 2)
      targetW.set(IDLE)
      targetH.set(IDLE)
      document.body.style.cursor = originalCursor
    }
  }, [
    targetSelector,
    excludeSelector,
    hideDefaultCursor,
    idleSnapToCenterMs,
    isMobile,
    playClickPulse,
    applyRect,
    clearSnap,
    targetCx,
    targetCy,
    targetW,
    targetH,
  ])

  if (isMobile) {
    return null
  }

  const isSnapped = hoveredElement != null
  const showIdle = !loadingVisualActive && !isSnapped
  const showSnappedTarget = !loadingVisualActive && isSnapped
  const showLoading = loadingVisualActive

  const lightCursor = theme === 'light'

  return (
    <motion.div
      className={`target-cursor-wrapper${lightCursor ? ' target-cursor-wrapper--light' : ''}`}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: boxW,
        height: boxH,
        x: tx,
        y: ty,
        /* difference reads as a dark fringe/shadow on light UI — use normal blend + ink strokes */
        mixBlendMode: lightCursor ? 'normal' : 'difference',
      }}
    >
      <div className="target-cursor-visual">
        <div ref={pulseRef} className="target-cursor-pulse">
          {showIdle ? (
            defTermHover ? (
              <svg className="target-cursor-idle-svg" viewBox="0 0 18 18" aria-hidden>
                {lightCursor ? (
                  <>
                    <circle cx="9" cy="9" r="8" className="target-cursor-idle-disk--light" />
                    <text
                      x="9"
                      y="12.25"
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="8.5"
                      fontWeight="700"
                      fontFamily="ui-sans-serif, system-ui, sans-serif"
                    >
                      ?
                    </text>
                  </>
                ) : (
                  <>
                    <circle cx="9" cy="9" r="9" fill="#ffffff" />
                    <text
                      x="9"
                      y="12.25"
                      textAnchor="middle"
                      fill="#0a0a0a"
                      fontSize="8.5"
                      fontWeight="700"
                      fontFamily="ui-sans-serif, system-ui, sans-serif"
                    >
                      ?
                    </text>
                  </>
                )}
              </svg>
            ) : (
              <svg className="target-cursor-idle-svg" viewBox="0 0 18 18" aria-hidden>
                {lightCursor ? (
                  <circle cx="9" cy="9" r="8" className="target-cursor-idle-disk--light" />
                ) : (
                  <circle cx="9" cy="9" r="9" fill="#ffffff" />
                )}
              </svg>
            )
          ) : null}

          {showSnappedTarget ? (
            <div className="target-cursor-snapped-brackets" aria-hidden>
              <div className="target-cursor-corner-snap corner-tl" />
              <div className="target-cursor-corner-snap corner-tr" />
              <div className="target-cursor-corner-snap corner-br" />
              <div className="target-cursor-corner-snap corner-bl" />
            </div>
          ) : null}

          {showLoading ? (
            <div className="target-cursor-loading-dots" aria-hidden>
              <span className="dot dot-1" />
              <span className="dot dot-2" />
              <span className="dot dot-3" />
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  )
}
