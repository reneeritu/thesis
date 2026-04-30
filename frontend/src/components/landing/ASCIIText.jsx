import { useEffect, useRef } from 'react'

/**
 * Renders text as large ASCII-art using canvas 2D.
 * enableWaves = gentle wave distortion per character column.
 */
export default function ASCIIText({
  text = 'ETCH',
  enableWaves = true,
  asciiFontSize = 6,
  textFontSize = 180,
  textColor = '#a78bfa',
  planeBaseHeight = 6,
}) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
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
    const [cr, cg, cb] = hexToRgb(textColor)

    // Density ramp — darker areas get denser chars
    const DENSITY = ' .\'`^",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$'

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    // Off-screen canvas to rasterise the big text
    const offCanvas = document.createElement('canvas')
    const offCtx = offCanvas.getContext('2d')

    let startTime = performance.now()

    const frame = () => {
      if (!mountRef.current) return
      const t = (performance.now() - startTime) / 1000
      const w = canvas.width
      const h = canvas.height
      if (w === 0 || h === 0) {
        rafRef.current = requestAnimationFrame(frame)
        return
      }

      // Rasterise text to off-screen at same size
      offCanvas.width = w
      offCanvas.height = h
      offCtx.clearRect(0, 0, w, h)
      offCtx.fillStyle = '#fff'
      offCtx.font = `bold ${textFontSize}px monospace`
      offCtx.textAlign = 'center'
      offCtx.textBaseline = 'middle'
      offCtx.fillText(text, w / 2, h / 2)

      const imageData = offCtx.getImageData(0, 0, w, h)
      const pixels = imageData.data

      ctx.clearRect(0, 0, w, h)
      ctx.font = `${asciiFontSize}px monospace`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'

      const step = asciiFontSize * planeBaseHeight / 6
      const cols = Math.floor(w / step)
      const rows = Math.floor(h / (step * 1.4))

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const px = Math.floor((col / cols) * w)
          const py = Math.floor((row / rows) * h)
          const idx = (py * w + px) * 4
          const alpha = pixels[idx + 3] ?? 0

          if (alpha < 20) continue

          const brightness = (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3
          const densityIdx = Math.floor((brightness / 255) * (DENSITY.length - 1))
          const char = DENSITY[densityIdx] ?? '.'

          if (char === ' ') continue

          // Wave offset
          let yOff = 0
          if (enableWaves) {
            yOff = Math.sin(col * 0.25 + t * 1.8) * 2.5
          }

          const a = (alpha / 255) * 0.9
          ctx.fillStyle = `rgba(${cr},${cg},${cb},${a})`
          ctx.fillText(char, col * step, row * step * 1.4 + yOff)
        }
      }

      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)

    return () => {
      mountRef.current = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [text, enableWaves, asciiFontSize, textFontSize, textColor, planeBaseHeight])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
    />
  )
}
