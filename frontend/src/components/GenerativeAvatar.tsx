import { type CSSProperties, useEffect, useRef } from 'react'
import { CATEGORY_COLOURS, type ReputationCategory } from '../lib/reputationColours'

interface Props {
  seed: string
  size?: number
  className?: string
  /** Merged onto the canvas (e.g. `width`, `height`, `objectFit: 'cover'`) */
  style?: CSSProperties
  /** When true (default), greyscale post-pass desaturates art so hover can reveal colour */
  monochrome?: boolean
  /**
   * Jewel-tone pastel + brighter strokes; skips halftone multiply darkening.
   * Pairs with radar CATEGORY_COLOURS — best with `monochrome={false}`.
   */
  luminescent?: boolean
}

const RADAR_CATEGORIES = Object.keys(CATEGORY_COLOURS) as ReputationCategory[]

/** Reference tile size from the p5 sketch — scales Voronoi block + line counts */
const REF_PX = 140

/** Classic 8×8 Bayer matrix (values 0…63), row-major */
const BAYER_8 = Uint8Array.from([
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 52, 14, 46, 6, 54, 60, 28, 52, 36,
  62, 30, 58, 38, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 55, 13, 45, 5, 53,
  63, 31, 55, 23, 61, 29, 57, 21,
])

function djb2(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
    hash = hash >>> 0
  }
  return hash
}

/** Half the seeds: p5/dashboard plain black squares; half keeps inner + / grid / X motifs */
type HalftoneVariant = 'p5Plain' | 'motifGrid'

function halftoneVariantFromSeed(seed: string): HalftoneVariant {
  return djb2(`${seed}:halftone`) % 2 === 0 ? 'p5Plain' : 'motifGrid'
}

/**
 * Same recurrence as your p5 `makeRng` (differs from classic mulberry32 — matches editor output).
 */
function makeRng(seedStr: string) {
  let s = djb2(seedStr) >>> 0
  return function () {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 25), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 57), 67 | t)) >>> 0
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildTables(rng: () => number) {
  const gradients: [number, number][] = []
  for (let i = 0; i < 256; i++) {
    const angle = rng() * Math.PI * 2
    gradients.push([Math.cos(angle), Math.sin(angle)])
  }

  const perm: number[] = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[perm[i], perm[j]] = [perm[j], perm[i]]
  }
  const p = new Uint8Array(512)
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255]

  return { gradients, p }
}

function fade(t: number) {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function lerp(a: number, b: number, t: number) {
  return a + t * (b - a)
}

function perlin2(
  x: number,
  y: number,
  gradients: [number, number][],
  perm: Uint8Array,
): number {
  const X = Math.floor(x) & 255
  const Y = Math.floor(y) & 255
  const xf = x - Math.floor(x)
  const yf = y - Math.floor(y)
  const u = fade(xf)
  const v = fade(yf)

  const grad = (hash: number, dx: number, dy: number) => {
    const g = gradients[hash & 255]
    return g[0] * dx + g[1] * dy
  }

  const aa = perm[perm[X] + Y]
  const ab = perm[perm[X] + Y + 1]
  const ba = perm[perm[X + 1] + Y]
  const bb = perm[perm[X + 1] + Y + 1]

  return lerp(
    lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
    lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
    v,
  )
}

function fbm(x: number, y: number, gradients: [number, number][], perm: Uint8Array): number {
  let value = 0
  let amplitude = 0.5
  let frequency = 2.5
  for (let o = 0; o < 4; o++) {
    value += perlin2(x * frequency, y * frequency, gradients, perm) * amplitude
    frequency *= 2
    amplitude *= 0.5
  }
  return value
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r: number
  let g: number
  let b: number

  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (q: number, qq: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return q + (qq - q) * 6 * t
      if (t < 1 / 2) return qq
      if (t < 2 / 3) return q + (qq - q) * (2 / 3 - t) * 6
      return q
    }
    const qq = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - qq
    r = hue2rgb(p, qq, h + 1 / 3)
    g = hue2rgb(p, qq, h)
    b = hue2rgb(p, qq, h - 1 / 3)
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

/** Matches sketch palette structure (H degrees in [0,360) → hslToRgb expects hue 0–1) */
function paletteFromHash(hashVal: number): [
  [number, number, number],
  [number, number, number],
  [number, number, number],
  [number, number, number],
  [number, number, number],
] {
  const h = (hashVal * 137.508) % 360
  const H = (deg: number) => (((deg % 360) + 360) % 360) / 360
  return [
    hslToRgb(H(h), 0.82, 0.6),
    hslToRgb(H(h + 100), 0.76, 0.58),
    hslToRgb(H(h + 240), 0.7, 0.62),
    hslToRgb(H(h + 6), 0.65, 0.45),
    hslToRgb(H(h), 0.3, 0.08),
  ]
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '').slice(0, 6)
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function mixRgb(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [
    Math.round(a[0] * (1 - t) + b[0] * t),
    Math.round(a[1] * (1 - t) + b[1] * t),
    Math.round(a[2] * (1 - t) + b[2] * t),
  ]
}

function mixTowardWhite(rgb: [number, number, number], t: number): [number, number, number] {
  return mixRgb(rgb, [255, 255, 255], t)
}

/**
 * Pastel jewel facets + radar hue anchoring (same language as CrystalRadar3D arms).
 * Heavy white-mix = airy, inner-lit colour (not edge glow — that's CSS-free).
 * Slot 4 is Voronoi trough — soft deep tint, not harsh black.
 */
function paletteLuminescent(hashVal: number): [
  [number, number, number],
  [number, number, number],
  [number, number, number],
  [number, number, number],
  [number, number, number],
] {
  const anchor = hexToRgb(CATEGORY_COLOURS[RADAR_CATEGORIES[Math.abs(hashVal) % RADAR_CATEGORIES.length]!]!)
  const base = paletteFromHash(hashVal)

  const facet = (stop: [number, number, number], radarMix: number, whiteMix: number): [number, number, number] =>
    mixTowardWhite(mixRgb(stop, anchor, radarMix), whiteMix)

  const darkTrough: [number, number, number] = mixTowardWhite(mixRgb([18, 14, 32], anchor, 0.35), 0.08)

  return [
    facet(base[0], 0.34, 0.38),
    facet(base[1], 0.3, 0.4),
    facet(base[2], 0.26, 0.42),
    facet(base[3], 0.22, 0.34),
    darkTrough,
  ]
}

function rgbStyle(rgb: [number, number, number]): string {
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
}

/** Sketch uses tighter edge weighting: * 9.5 */
function edgeFactor(x: number, y: number, pw: number, ph: number): number {
  const ux = x / pw
  const uy = y / ph
  return Math.min(Math.min(ux, 1 - ux, uy, 1 - uy) * 9.5, 1)
}

function warpXY(
  x: number,
  y: number,
  T: number,
  gradients: [number, number][],
  perm: Uint8Array,
): [number, number] {
  const ef = edgeFactor(x, y, T, T)
  const amp = T * 0.052 * ef
  const wob = fbm(x / 48, y / 48, gradients, perm) * amp * 1.15
  const wx = x + Math.sin(y * 0.055 + fbm(x / T, 0.28, gradients, perm) * 3) * amp + wob
  const wy = y + Math.cos(x * 0.052 + fbm(0.28, y / T, gradients, perm) * 3) * amp + wob * 0.75
  return [wx, wy]
}

/** Aligns with sketch `waveFlowAngle` (phase uses 0.055 — not `y * 5`, which was a typo) */
function waveFlowAngle(
  x: number,
  y: number,
  T: number,
  gradients: [number, number][],
  perm: Uint8Array,
): number {
  const ef = edgeFactor(x, y, T, T)
  const amp = T * 0.052 * ef
  const phaseY = y * 0.055 + fbm(x / T, 0.28, gradients, perm) * 3
  const phaseX = x * 0.052 + fbm(0.28, y / T, gradients, perm) * 3
  const dy =
    Math.cos(phaseY) * amp * 0.055 + fbm(x / 5, y / 52, gradients, perm) * 0.42 * ef
  const dx =
    Math.cos(phaseX) * amp * 0.052 + fbm(x / 52 + 31, y / 52 + 7, gradients, perm) * 0.42 * ef
  return Math.atan2(dy, dx + 0.08)
}

/** Pixel Voronoi — `PIX` scaled from reference 140px tile */
function renderPixelWarpVoronoi(
  px: number,
  gradients: [number, number][],
  perm: Uint8Array,
  rng: () => number,
  palRgb: [number, number, number][],
  ctx: CanvasRenderingContext2D,
) {
  const PIX = Math.max(2, Math.round((6 * px) / REF_PX))
  const N = 11 + Math.floor(rng() * 5)
  const pts: [number, number, number][] = []
  for (let i = 0; i < N; i++) {
    pts.push([rng() * px, rng() * px, Math.floor(rng() * 4)])
  }

  const gapThresh = 2.1 + PIX * 0.35

  ctx.fillStyle = rgbStyle(palRgb[4])
  ctx.fillRect(0, 0, px, px)

  for (let gy = 0; gy < Math.ceil(px / PIX); gy++) {
    for (let gx = 0; gx < Math.ceil(px / PIX); gx++) {
      const cx = Math.min(gx * PIX + PIX * 0.5, px - 0.001)
      const cy = Math.min(gy * PIX + PIX * 0.5, px - 0.001)
      const [wx, wy] = warpXY(cx, cy, px, gradients, perm)

      let best1 = Infinity
      let best2 = Infinity
      let ci = 0
      for (const [pdx, pdy, c] of pts) {
        const d = (wx - pdx) ** 2 + (wy - pdy) ** 2
        if (d < best1) {
          best2 = best1
          best1 = d
          ci = c
        } else if (d < best2) best2 = d
      }

      const gap = Math.sqrt(best2) - Math.sqrt(best1)
      const dark = gap < gapThresh
      const rgb = dark ? palRgb[4] : palRgb[ci % 4]
      ctx.fillStyle = rgbStyle(rgb)
      ctx.fillRect(gx * PIX, gy * PIX, PIX, PIX)
    }
  }
}

/**
 * Bayer-masked black squares (`multiply` over Voronoi).
 * - **p5Plain**: solid squares only (matches sparse dashboard / p5 column look).
 * - **motifGrid**: inner rgb(28) + / grid / X motifs (richer “halftone geo”).
 */
function renderHalftoneMultiplyOverlay(
  px: number,
  gradients: [number, number][],
  perm: Uint8Array,
  ctx: CanvasRenderingContext2D,
  variant: HalftoneVariant,
) {
  const cols = 6
  const step = px / cols
  const pad = step * 0.1

  for (let iy = 0; iy < cols; iy++) {
    for (let ix = 0; ix < cols; ix++) {
      const cx = ix * step + step / 2
      const cy = iy * step + step / 2
      const raw = fbm(cx / px, cy / px, gradients, perm)
      const n = (raw + 0.5) / 1.35
      const th = (BAYER_8[(iy & 7) * 8 + (ix & 7)] + 0.5) / 64
      if (n < th + 0.07) continue

      const x0 = ix * step + pad
      const y0 = iy * step + pad
      const sz = step - pad * 2

      ctx.fillStyle = 'rgb(0,0,0)'
      ctx.fillRect(x0, y0, sz, sz)

      if (variant === 'motifGrid') {
        ctx.strokeStyle = 'rgb(28,28,28)'
        ctx.lineWidth = Math.max(1, sz / 14)
        ctx.lineCap = 'square'

        const r = sz * 0.31
        const motif = (ix + iy * 13 + Math.floor((n + 1) * 111)) % 34

        ctx.beginPath()
        if (motif === 0) {
          ctx.moveTo(cx - r, cy)
          ctx.lineTo(cx + r, cy)
          ctx.moveTo(cx, cy - r)
          ctx.lineTo(cx, cy + r)
        } else if (motif === 1) {
          const ggap = r * 0.48
          ctx.moveTo(cx - r, cy - ggap)
          ctx.lineTo(cx + r, cy - ggap)
          ctx.moveTo(cx - r, cy + ggap)
          ctx.lineTo(cx + r, cy + ggap)
          ctx.moveTo(cx - ggap, cy - r)
          ctx.lineTo(cx - ggap, cy + r)
          ctx.moveTo(cx + ggap, cy - r)
          ctx.lineTo(cx + ggap, cy + r)
        } else {
          ctx.moveTo(cx - r, cy - r)
          ctx.lineTo(cx + r, cy + r)
          ctx.moveTo(cx - r, cy + r)
          ctx.lineTo(cx + r, cy - r)
        }
        ctx.stroke()
      }
    }
  }
}

/** Sparse palette-colored streamlines — sketch: N=3, STEPS=9, STEP=T/4 */
function renderWaveFlowLines(
  px: number,
  gradients: [number, number][],
  perm: Uint8Array,
  rng: () => number,
  palRgb: [number, number, number][],
  ctx: CanvasRenderingContext2D,
  lineAlpha = 105 / 255,
  opts?: { lineMult?: number; baseN?: number; steps?: number; stepDiv?: number },
) {
  const baseN = opts?.baseN ?? 3
  const lineMult = opts?.lineMult ?? 1
  const STEPS = opts?.steps ?? 9
  const stepDiv = opts?.stepDiv ?? 4
  const N = Math.max(2, Math.round(((baseN * px) / REF_PX) * lineMult))
  const STEP = px / stepDiv

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(0.65, px / 170)

  for (let i = 0; i < N; i++) {
    let x = rng() * px
    let y = rng() * px
    const ci = i % 4
    const [cr, cg, cb] = palRgb[ci]

    ctx.strokeStyle = `rgba(${cr},${cg},${cb},${lineAlpha})`
    ctx.beginPath()
    ctx.moveTo(x, y)

    for (let s = 0; s < STEPS; s++) {
      const ang = waveFlowAngle(x, y, px, gradients, perm)
      x += Math.cos(ang) * STEP
      y += Math.sin(ang) * STEP
      ctx.lineTo(x, y)
      if (x < -4 || x > px + 4 || y < -4 || y > px + 4) break
    }
    ctx.stroke()
  }
}

/** White / near-white linework — reads as inner light, not an outer halo */
function renderWhiteInkLines(
  px: number,
  gradients: [number, number][],
  perm: Uint8Array,
  rng: () => number,
  ctx: CanvasRenderingContext2D,
  opts: {
    lines: number
    alpha: number
    widthMul: number
    steps: number
    stepDiv: number
    frost?: boolean
  },
) {
  const { lines, alpha, widthMul, steps, stepDiv, frost } = opts
  const STEP = px / stepDiv

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(0.35, (px / 200) * widthMul)

  for (let i = 0; i < lines; i++) {
    let x = rng() * px
    let y = rng() * px
    const a = frost ? alpha * (0.85 + rng() * 0.15) : alpha
    ctx.strokeStyle = frost ? `rgba(245,248,255,${a})` : `rgba(255,255,255,${a})`
    ctx.beginPath()
    ctx.moveTo(x, y)

    for (let s = 0; s < steps; s++) {
      const ang = waveFlowAngle(x, y, px, gradients, perm)
      x += Math.cos(ang) * STEP
      y += Math.sin(ang) * STEP
      ctx.lineTo(x, y)
      if (x < -4 || x > px + 4 || y < -4 || y > px + 4) break
    }
    ctx.stroke()
  }
}

function renderStackedAvatar(
  seed: string,
  px: number,
  ctx: CanvasRenderingContext2D,
  opts?: { luminescent?: boolean },
) {
  const lum = opts?.luminescent ?? false
  const hashVal = djb2(seed)
  const halftoneKind = halftoneVariantFromSeed(seed)

  const rngNoise = makeRng(seed + '_perlin')
  const rngGeom = makeRng(seed + '_voronoi')

  const { gradients, p } = buildTables(() => rngNoise())

  const palRgb = lum ? paletteLuminescent(hashVal) : paletteFromHash(hashVal)

  ctx.save()
  ctx.imageSmoothingEnabled = false

  renderPixelWarpVoronoi(px, gradients, p, rngGeom, palRgb, ctx)

  if (!lum) {
    ctx.globalCompositeOperation = 'multiply'
    renderHalftoneMultiplyOverlay(px, gradients, p, ctx, halftoneKind)
    ctx.globalCompositeOperation = 'source-over'
  }

  if (lum) {
    const rngInk = makeRng(seed + '_lumInk')
    const rngWhiteA = makeRng(seed + '_whiteA')
    const rngWhiteB = makeRng(seed + '_whiteB')
    const rngWhiteC = makeRng(seed + '_whiteC')

    // Softer coloured strokes — colour sits behind white ink
    renderWaveFlowLines(px, gradients, p, rngInk, palRgb, ctx, 0.34, {
      baseN: 5,
      lineMult: 1.15,
      steps: 10,
      stepDiv: 4,
    })

    const nLines = (mult: number) => Math.max(4, Math.round((mult * px) / REF_PX))

    renderWhiteInkLines(px, gradients, p, rngWhiteA, ctx, {
      lines: nLines(10),
      alpha: 0.38,
      widthMul: 0.95,
      steps: 12,
      stepDiv: 4.5,
    })
    renderWhiteInkLines(px, gradients, p, rngWhiteB, ctx, {
      lines: nLines(7),
      alpha: 0.22,
      widthMul: 0.55,
      steps: 14,
      stepDiv: 5,
      frost: true,
    })
    renderWhiteInkLines(px, gradients, p, rngWhiteC, ctx, {
      lines: nLines(5),
      alpha: 0.14,
      widthMul: 0.38,
      steps: 8,
      stepDiv: 6,
      frost: true,
    })
  } else {
    renderWaveFlowLines(px, gradients, p, rngGeom, palRgb, ctx, 105 / 255)
  }

  ctx.restore()
}

function applyGreyscale(ctx: CanvasRenderingContext2D, px: number) {
  const imageData = ctx.getImageData(0, 0, px, px)
  const d = imageData.data
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]!
    const g = d[i + 1]!
    const b = d[i + 2]!
    const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
    d[i] = y
    d[i + 1] = y
    d[i + 2] = y
  }
  ctx.putImageData(imageData, 0, 0)
}

export function GenerativeAvatar({
  seed,
  size = 72,
  className,
  style,
  monochrome = true,
  luminescent = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    const px = Math.round(size * dpr)
    canvas.width = px
    canvas.height = px

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    renderStackedAvatar(seed, px, ctx, { luminescent })
    if (monochrome) applyGreyscale(ctx, px)
  }, [seed, size, monochrome, luminescent])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, imageRendering: 'pixelated', ...style }}
      className={className}
      aria-hidden
    />
  )
}
