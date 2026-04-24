import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  el: HTMLElement | null
  enabled: boolean
}

function parseTranslate(el: HTMLElement): { x: number; y: number } {
  const t = getComputedStyle(el).transform
  if (!t || t === 'none') return { x: 0, y: 0 }
  if (t.startsWith('matrix3d(')) {
    const p = t.slice(9, -1).split(/,\s*/).map(Number)
    return { x: p[12] ?? 0, y: p[13] ?? 0 }
  }
  if (t.startsWith('matrix(')) {
    const p = t.slice(7, -1).split(/,\s*/).map(Number)
    return { x: p[4] ?? 0, y: p[5] ?? 0 }
  }
  return { x: 0, y: 0 }
}

const TWEAK_MARK = 'data-etch-tweak'

export function clearLayoutTweakStyles(el: HTMLElement | null) {
  if (!el) return
  if (el.getAttribute(TWEAK_MARK) !== '1') return
  el.removeAttribute(TWEAK_MARK)
  el.style.removeProperty('transform')
  el.style.removeProperty('width')
  el.style.removeProperty('height')
  el.style.removeProperty('box-sizing')
}

export function LayoutDebugTweakLayer({ el, enabled }: Props) {
  const [box, setBox] = useState<DOMRect | null>(null)
  const elRef = useRef<HTMLElement | null>(el)
  const dragging = useRef<'move' | 'resize' | null>(null)

  useEffect(() => {
    elRef.current = el
  }, [el])

  const sync = useCallback(() => {
    const t = elRef.current
    if (t) setBox(t.getBoundingClientRect())
  }, [])

  useEffect(() => {
    if (!el || !enabled) {
      setBox(null)
      return
    }
    sync()
    const ro = new ResizeObserver(() => {
      if (dragging.current) return
      sync()
    })
    ro.observe(el)
    const onScroll = () => {
      if (dragging.current) return
      sync()
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [el, enabled, sync])

  const onMoveDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!elRef.current) return
      e.preventDefault()
      e.stopPropagation()
      const node = elRef.current
      const cap = e.currentTarget
      node.setAttribute(TWEAK_MARK, '1')
      const base = parseTranslate(node)
      const startX = e.clientX
      const startY = e.clientY
      dragging.current = 'move'
      cap.setPointerCapture(e.pointerId)

      const onMove = (ev: PointerEvent) => {
        const x = base.x + ev.clientX - startX
        const y = base.y + ev.clientY - startY
        node.style.setProperty('transform', `translate3d(${x}px,${y}px,0)`)
        requestAnimationFrame(sync)
      }
      const onUp = (ev: PointerEvent) => {
        dragging.current = null
        try {
          cap.releasePointerCapture(ev.pointerId)
        } catch {
          /* ignore */
        }
        cap.removeEventListener('pointermove', onMove)
        cap.removeEventListener('pointerup', onUp)
        cap.removeEventListener('pointercancel', onUp)
        sync()
      }
      cap.addEventListener('pointermove', onMove)
      cap.addEventListener('pointerup', onUp)
      cap.addEventListener('pointercancel', onUp)
    },
    [sync]
  )

  const onResizeDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!elRef.current) return
      e.preventDefault()
      e.stopPropagation()
      const node = elRef.current
      const cap = e.currentTarget
      node.setAttribute(TWEAK_MARK, '1')
      const w0 = node.offsetWidth
      const h0 = node.offsetHeight
      const startX = e.clientX
      const startY = e.clientY
      dragging.current = 'resize'
      node.style.setProperty('box-sizing', 'border-box')
      cap.setPointerCapture(e.pointerId)

      const onMove = (ev: PointerEvent) => {
        const dw = ev.clientX - startX
        const dh = ev.clientY - startY
        const w = Math.max(32, w0 + dw)
        const h = Math.max(32, h0 + dh)
        const vw = document.documentElement.clientWidth
        const vh = document.documentElement.clientHeight
        node.style.setProperty('width', `${Math.min(w, vw)}px`)
        node.style.setProperty('height', `${Math.min(h, vh)}px`)
        requestAnimationFrame(sync)
      }
      const onUp = (ev: PointerEvent) => {
        dragging.current = null
        try {
          cap.releasePointerCapture(ev.pointerId)
        } catch {
          /* ignore */
        }
        cap.removeEventListener('pointermove', onMove)
        cap.removeEventListener('pointerup', onUp)
        cap.removeEventListener('pointercancel', onUp)
        sync()
      }
      cap.addEventListener('pointermove', onMove)
      cap.addEventListener('pointerup', onUp)
      cap.addEventListener('pointercancel', onUp)
    },
    [sync]
  )

  if (typeof document === 'undefined' || !el || !enabled || !box) {
    return null
  }

  return createPortal(
    <div
      className="layout-debug-tweak-frames"
      style={{
        position: 'fixed',
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        zIndex: 2147483640,
        pointerEvents: 'none',
      }}
    >
      <button
        type="button"
        onPointerDown={onMoveDown}
        title="Drag to nudge (transform). Dev-only."
        className="absolute left-0 right-0 top-0 h-2.5 cursor-grab border-0 active:cursor-grabbing"
        style={{
          pointerEvents: 'auto',
          background: 'linear-gradient(180deg, rgba(255, 220, 80, 0.35) 0%, rgba(255, 220, 80, 0) 100%)',
        }}
      />
      <button
        type="button"
        onPointerDown={onResizeDown}
        title="Drag corner to resize (inline width/height). Dev-only."
        className="absolute bottom-0 right-0 h-3.5 w-3.5 cursor-se-resize border-0 p-0"
        style={{
          pointerEvents: 'auto',
          background: 'linear-gradient(225deg, rgba(255, 220, 80, 0.75) 0%, rgba(255, 220, 80, 0) 55%)',
        }}
      />
    </div>,
    document.body
  )
}
