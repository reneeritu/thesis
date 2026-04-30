import { useEffect, useRef } from 'react'
import './PixelBlast.css'

/**
 * Pixel pattern canvas with optional ripple effects.
 */
export default function PixelBlast({
  variant = 'circle',
  pixelSize = 4,
  color = '#1a1a2e',
  patternScale = 2.5,
  patternDensity = 0.8,
  enableRipples = true,
  rippleSpeed = 0.25,
  rippleThickness = 0.08,
  liquid = false,
  speed = 0.2,
  edgeFade = 0.35,
  transparent = true,
}) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const ripplesRef = useRef([])
  const mountRef = useRef(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    mountRef.current = true

    // Hex → rgb
    const hexToRgb = (hex) => {
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      return [r, g, b]
    }
    const [cr, cg, cb] = hexToRgb(color)

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    // Add automatic ripple origins
    const addRipple = () => {
      if (!mountRef.current) return
      ripplesRef.current.push({
        x: Math.random(),
        y: Math.random(),
        r: 0,
        born: performance.now(),
      })
      // Keep at most 5 ripples
      if (ripplesRef.current.length > 5) ripplesRef.current.shift()
    }

    let rippleTimer = null
    if (enableRipples) {
      addRipple()
      const scheduleRipple = () => {
        if (!mountRef.current) return
        addRipple()
        rippleTimer = window.setTimeout(scheduleRipple, 2000 + Math.random() * 2000)
      }
      rippleTimer = window.setTimeout(scheduleRipple, 1500)
    }

    let startTime = performance.now()

    const frame = () => {
      if (!mountRef.current) return
      const t = ((performance.now() - startTime) / 1000) * speed
      const w = canvas.width
      const h = canvas.height
      if (w === 0 || h === 0) {
        rafRef.current = requestAnimationFrame(frame)
        return
      }

      if (!transparent) {
        ctx.clearRect(0, 0, w, h)
      } else {
        ctx.clearRect(0, 0, w, h)
      }

      const ps = pixelSize * patternScale
      const cols = Math.ceil(w / ps)
      const rows = Math.ceil(h / ps)

      for (let col = 0; col < cols; col++) {
        for (let row = 0; row < rows; row++) {
          const nx = col / cols
          const ny = row / rows

          // Edge fade
          const ex = Math.min(nx, 1 - nx) / edgeFade
          const ey = Math.min(ny, 1 - ny) / edgeFade
          const edge = Math.min(1, ex) * Math.min(1, ey)

          // Pattern
          let fill = 0
          if (variant === 'circle') {
            // Dot grid
            const cx = ((col % 4) - 1.5) / 1.5
            const cy = ((row % 4) - 1.5) / 1.5
            fill = cx * cx + cy * cy < 0.5 ? 1 : 0
          } else if (variant === 'grid') {
            fill = col % 3 === 0 || row % 3 === 0 ? 1 : 0
          } else {
            fill = 1
          }

          if (fill === 0) continue

          // Liquid wave
          let baseAlpha = patternDensity * edge
          if (liquid) {
            baseAlpha *= 0.5 + 0.5 * Math.sin(nx * 8 + t * 3 + Math.sin(ny * 6 + t))
          }

          // Ripple effect
          let rippleBoost = 0
          for (const rip of ripplesRef.current) {
            const dx = nx - rip.x
            const dy = ny - rip.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            const age = (performance.now() - rip.born) / 1000
            const radius = age * rippleSpeed
            const diff = Math.abs(dist - radius)
            if (diff < rippleThickness) {
              rippleBoost = Math.max(rippleBoost, (1 - diff / rippleThickness) * 0.6)
            }
          }

          const alpha = Math.min(1, (baseAlpha + rippleBoost) * 0.4)
          if (alpha < 0.01) continue

          ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`
          ctx.fillRect(col * ps, row * ps, ps - 1, ps - 1)
        }
      }

      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)

    return () => {
      mountRef.current = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (rippleTimer) clearTimeout(rippleTimer)
      ro.disconnect()
    }
  }, [variant, pixelSize, color, patternScale, patternDensity, enableRipples,
      rippleSpeed, rippleThickness, liquid, speed, edgeFade, transparent])

  return (
    <canvas
      ref={canvasRef}
      className="pixel-blast"
      style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
    />
  )
}
