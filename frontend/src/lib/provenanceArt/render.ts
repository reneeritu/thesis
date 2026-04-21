/**
 * Pure generative renderer for Etch provenance certificates.
 *
 * Renders a 1024×1024 square SVG from `{ input, options }`. The same inputs
 * always produce the same SVG — all randomness flows through a seeded RNG.
 *
 * Motifs:
 *   - facet   — wireframe polyhedra; sparse projects get fewer, larger shards.
 *   - scatter — hollow hatched anchor + confetti; arcs use variable line weight.
 *   - sigil   — symmetric frame / crown / base / pillar pairs; asymmetric
 *               interior chords + etched weak connectors; variable stroke weight.
 *   - nebula  — radial clouds + rim stipple + film grain (light palettes);
 *               strands vary from solid to dashed by strength.
 *
 * All closed paths apply ±0.5% canvas vertex jitter before the hand wobble.
 */

import { PALETTE_BY_ID } from './palettes'
import { composeSeed, rngFromString, type Rng } from './rng'
import type { GenInput, GenOptions, GenParams, LineWeight, Density } from './types'
import { RENDERER_VERSION } from './types'

const SIZE = 1024

/** ±0.5% of canvas — every outline vertex gets this before the hand wobble. */
const VERTEX_JITTER = SIZE * 0.005

const LINE_PX: Record<LineWeight, number> = {
  hairline: 0.75,
  regular: 1.5,
  bold: 3,
}

const DENSITY_MULT: Record<Density, number> = {
  sparse: 0.55,
  balanced: 1,
  dense: 1.8,
}

// ---------------------------------------------------------------------------
// Helpers

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Stable short id for SVG defs (clipPath, pattern, filter). */
function fnv32(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

/** Produce a wobbly ("hand-drawn") version of a straight line's endpoint. */
function wobble(x: number, y: number, rng: Rng, amount = 2.5) {
  return { x: x + rng.gauss() * amount, y: y + rng.gauss() * amount }
}

/** Uniform ±0.5% canvas jitter on a vertex (deterministic per rng stream). */
function jitterVertex(x: number, y: number, rng: Rng): { x: number; y: number } {
  return {
    x: x + rng.range(-VERTEX_JITTER, VERTEX_JITTER),
    y: y + rng.range(-VERTEX_JITTER, VERTEX_JITTER),
  }
}

/** Path for a hand-wobbled polygon outline. */
function wobblePolygon(
  points: Array<{ x: number; y: number }>,
  rng: Rng,
  jitter: number,
): string {
  const pts = points.map((p) => {
    const j = jitterVertex(p.x, p.y, rng)
    return wobble(j.x, j.y, rng, jitter)
  })
  return pts.reduce(
    (acc, p, i) => acc + (i === 0 ? `M${p.x.toFixed(2)},${p.y.toFixed(2)}` : `L${p.x.toFixed(2)},${p.y.toFixed(2)}`),
    '',
  ) + 'Z'
}

/**
 * How "heavy" the project is for layout (0…1). Sparse projects lower this so we
 * reduce complexity (fewer shards / lines) instead of only shrinking shapes.
 */
function projectComplexity(input: GenInput): number {
  const t = Math.min(1, Math.log1p(Math.max(0, input.traceCount)) / Math.log1p(220))
  const c = Math.min(1, input.contributors.length / 8)
  const p = Math.min(1, input.pivotCount / 6 + input.referenceCount / 28)
  const d = Math.min(1, (input.durationDays ?? 0) / 140)
  return 0.42 * t + 0.22 * c + 0.24 * p + 0.12 * d
}

type StrokeStyle = { w: number; op: number; dash: string }

/** Strong = solid thicker charcoal; weak = faint etched (dotted / dashed). */
function strokeStyleForStrength(strength: number, baseStroke: number): StrokeStyle {
  if (strength >= 0.7) return { w: baseStroke * 1.38, op: 1, dash: '' }
  if (strength >= 0.45) return { w: baseStroke * 1.05, op: 0.8, dash: '' }
  if (strength >= 0.28) return { w: baseStroke * 0.9, op: 0.5, dash: '2 6' }
  return { w: baseStroke * 0.78, op: 0.34, dash: '1 5' }
}

function svgLineSeg(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  outline: string,
  st: StrokeStyle,
): string {
  const dash = st.dash ? ` stroke-dasharray="${st.dash}"` : ''
  return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${outline}" stroke-width="${st.w.toFixed(2)}" stroke-opacity="${st.op.toFixed(3)}" stroke-linecap="round"${dash} />`
}

// ---------------------------------------------------------------------------
// Motif: Facet

type Facet = {
  cx: number
  cy: number
  radius: number
  vertices: number
  rotate: number
  fillIdx: number
}

function planFacets(input: GenInput, opts: GenOptions, rng: Rng): Facet[] {
  const densityMult = DENSITY_MULT[opts.density]
  const comp = projectComplexity(input)
  const contributorCount = Math.max(1, input.contributors.length)
  let siblingCount = Math.round(Math.min(16, Math.max(3, contributorCount * 2 + rng.int(1, 3))) * densityMult)
  if (comp < 0.28) siblingCount = Math.min(siblingCount, 4)
  else if (comp < 0.45) siblingCount = Math.min(siblingCount, 7)
  else if (comp < 0.62) siblingCount = Math.min(siblingCount, 11)

  let centralFaces = Math.max(5, Math.min(12, 5 + input.pivotCount))
  if (comp < 0.28) centralFaces = Math.max(4, Math.min(centralFaces, 6))
  else if (comp < 0.48) centralFaces = Math.max(4, Math.min(centralFaces, 8))

  const radiusScale = comp < 0.28 ? 1.22 : comp < 0.48 ? 1.1 : 1
  const sibRadScale = comp < 0.28 ? 1.32 : comp < 0.48 ? 1.14 : 1
  const distScale = comp < 0.28 ? 0.92 : comp < 0.48 ? 0.97 : 1

  const central: Facet = {
    cx: SIZE / 2,
    cy: SIZE / 2,
    radius: SIZE * 0.22 * radiusScale,
    vertices: centralFaces,
    rotate: rng.range(0, Math.PI),
    fillIdx: 0,
  }

  const siblings: Facet[] = []
  for (let i = 0; i < siblingCount; i++) {
    const ang = rng.range(0, Math.PI * 2)
    const dist = rng.range(SIZE * 0.26, SIZE * 0.42) * distScale
    const radius = rng.range(SIZE * 0.04, SIZE * 0.13) * sibRadScale
    let vMin = 4
    let vMax = 9
    if (comp < 0.28) {
      vMin = 4
      vMax = 6
    } else if (comp < 0.48) {
      vMin = 4
      vMax = 7
    }
    siblings.push({
      cx: SIZE / 2 + Math.cos(ang) * dist,
      cy: SIZE / 2 + Math.sin(ang) * dist,
      radius,
      vertices: rng.int(vMin, vMax),
      rotate: rng.range(0, Math.PI),
      fillIdx: rng.int(1, 3),
    })
  }

  return [central, ...siblings]
}

function drawFacet(facet: Facet, rng: Rng, opts: GenOptions, palette = PALETTE_BY_ID[opts.palette]): string {
  const pts: Array<{ x: number; y: number }> = []
  for (let i = 0; i < facet.vertices; i++) {
    const a = facet.rotate + (i * 2 * Math.PI) / facet.vertices
    pts.push({
      x: facet.cx + Math.cos(a) * facet.radius,
      y: facet.cy + Math.sin(a) * facet.radius,
    })
  }

  const jitter = opts.lineWeight === 'hairline' ? 1.5 : 3
  const stroke = LINE_PX[opts.lineWeight]
  const fill = palette.fills[facet.fillIdx % palette.fills.length]
  const fillDeep = palette.fillsDeep[facet.fillIdx % palette.fillsDeep.length]
  const outline = palette.outline

  // Outer silhouette — wobbly fill
  const outer = wobblePolygon(pts, rng, jitter)

  // Internal triangulation (fan from centre)
  const triangles: string[] = []
  for (let i = 0; i < facet.vertices; i++) {
    const p0 = { x: facet.cx, y: facet.cy }
    const p1 = pts[i]
    const p2 = pts[(i + 1) % facet.vertices]
    const t = wobblePolygon([p0, p1, p2], rng, jitter * 0.6)
    const triFill = i % 2 === 0 ? fill : fillDeep
    triangles.push(
      `<path d="${t}" fill="${triFill}" fill-opacity="0.65" stroke="${outline}" stroke-width="${stroke * 0.6}" stroke-linejoin="round" />`,
    )
  }

  return [
    `<path d="${outer}" fill="${fill}" fill-opacity="0.18" stroke="${outline}" stroke-width="${stroke}" stroke-linejoin="round" />`,
    ...triangles,
  ].join('')
}

function renderFacet(input: GenInput, opts: GenOptions, rng: Rng): string {
  const palette = PALETTE_BY_ID[opts.palette]
  const facets = planFacets(input, opts, rng)
  return facets.map((f) => drawFacet(f, rng, opts, palette)).join('')
}

// ---------------------------------------------------------------------------
// Motif: Scatter

function scatterAnchorClipId(input: GenInput, opts: GenOptions): string {
  return `scatter-clip-${fnv32(`${input.projectId}|${opts.rerollIndex}|anchor`)}`
}

function scatterHatchPatternId(input: GenInput, opts: GenOptions): string {
  return `scatter-hatch-${fnv32(`${input.projectId}|${opts.rerollIndex}|hatch`)}`
}

function renderScatter(input: GenInput, opts: GenOptions, rng: Rng): string {
  const palette = PALETTE_BY_ID[opts.palette]
  const density = DENSITY_MULT[opts.density]
  const stroke = LINE_PX[opts.lineWeight]

  const cx0 = SIZE / 2 + rng.gauss() * 60
  const cy0 = SIZE * 0.58 + rng.gauss() * 40
  const w = SIZE * rng.range(0.38, 0.5)
  const h = SIZE * rng.range(0.16, 0.24)
  const angle = rng.range(-0.4, 0.4)
  const rx = w / 2
  const ry = h / 2
  const seg = 24
  const pts: Array<{ x: number; y: number }> = []
  for (let i = 0; i < seg; i++) {
    const t = (i / seg) * Math.PI * 2
    const x = cx0 + Math.cos(t) * rx * Math.cos(angle) - Math.sin(t) * ry * Math.sin(angle)
    const y = cy0 + Math.cos(t) * rx * Math.sin(angle) + Math.sin(t) * ry * Math.cos(angle)
    pts.push({ x, y })
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  const pad = 24
  minX -= pad
  minY -= pad
  maxX += pad
  maxY += pad
  const bw = maxX - minX
  const bh = maxY - minY

  const anchorPath = wobblePolygon(pts, rng, 4)
  const clipId = scatterAnchorClipId(input, opts)
  const hatchId = scatterHatchPatternId(input, opts)

  // Hollow anchor: diagonal hatch fill clipped to the ellipse + outline on top
  // so dots read as orbiting a void, not a solid black mass.
  const defs = `<defs>
    <clipPath id="${clipId}"><path d="${anchorPath}" /></clipPath>
    <pattern id="${hatchId}" patternUnits="userSpaceOnUse" width="14" height="14" patternTransform="rotate(-42)">
      <line x1="0" y1="0" x2="0" y2="14" stroke="${palette.outline}" stroke-width="1.1" stroke-opacity="0.22" />
    </pattern>
  </defs>`
  const hatchFill = `<g clip-path="url(#${clipId})"><rect x="${minX.toFixed(1)}" y="${minY.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="url(#${hatchId})" /></g>`
  const anchorOutline = `<path d="${anchorPath}" fill="none" stroke="${palette.outline}" stroke-width="${(stroke * 1.15).toFixed(2)}" stroke-linejoin="round" stroke-opacity="0.92" />`
  const anchorSvg = defs + hatchFill + anchorOutline

  const dotCount = Math.round(Math.min(300, 40 + input.traceCount * 2) * density)
  const dots: string[] = []
  for (let i = 0; i < dotCount; i++) {
    const cx = rng.range(SIZE * 0.08, SIZE * 0.92)
    const cy = rng.range(SIZE * 0.08, SIZE * 0.92)
    const r = rng.range(2, 12)
    const fill = rng.pick(palette.fills)
    const op = rng.range(0.5, 1)
    dots.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}" fill-opacity="${op.toFixed(2)}" />`)
  }

  const arcCount = Math.max(3, Math.min(12, input.referenceCount))
  const arcs: string[] = []
  for (let i = 0; i < arcCount; i++) {
    const x1 = rng.range(SIZE * 0.05, SIZE * 0.35)
    const y1 = rng.range(SIZE * 0.15, SIZE * 0.85)
    const x2 = rng.range(SIZE * 0.65, SIZE * 0.95)
    const y2 = rng.range(SIZE * 0.15, SIZE * 0.85)
    const cpx = (x1 + x2) / 2 + rng.gauss() * 200
    const cpy = (y1 + y2) / 2 + rng.gauss() * 200
    const refSignal = Math.min(1, (input.referenceCount + 1) / 14) * 0.35 + rng.next() * 0.55 - i * 0.04
    const st = strokeStyleForStrength(Math.max(0.08, Math.min(1, refSignal)), stroke * 0.72)
    const dash = st.dash ? ` stroke-dasharray="${st.dash}"` : ''
    arcs.push(
      `<path d="M${x1.toFixed(1)},${y1.toFixed(1)} Q${cpx.toFixed(1)},${cpy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}" fill="none" stroke="${palette.outline}" stroke-width="${st.w.toFixed(2)}" stroke-opacity="${st.op.toFixed(3)}" stroke-linecap="round"${dash} />`,
    )
  }

  return arcs.join('') + dots.join('') + anchorSvg
}

// ---------------------------------------------------------------------------
// Motif: Sigil
//
// Grid-locked architectural glyph. The **outer frame + crown + base + paired
// pillars** are strictly symmetric (axis-aligned frame, mirrored verticals).
// **Interior bars and connectors** are data-driven and intentionally asymmetric
// — "perfectly imperfect" tension. Line weight encodes strength: strong
// structure = solid thicker charcoal; weak ties = faint dashed / dotted etched
// strokes. Sparse projects get fewer, thicker lines (see `projectComplexity`).

const GRID_SIZE: Record<Density, number> = {
  sparse: 5,
  balanced: 7,
  dense: 9,
}

/** Higher → stronger stroke (solid / thick). Long spans + low activity read weaker. */
function sigilConnectorStrength(
  dc: number,
  dr: number,
  gridN: number,
  input: GenInput,
  i: number,
  rng: Rng,
): number {
  const span = Math.hypot(dc, dr) / (gridN * 1.15)
  const traces = Math.min(1, input.traceCount / 100)
  const refs = Math.min(1, input.referenceCount / 22)
  const people = Math.min(1, input.contributors.length / 8)
  const roll = rng.next() * 0.26
  let s = 0.14 + traces * 0.34 + refs * 0.26 + people * 0.16 + roll - span * 0.48 - i * 0.02
  return Math.min(1, Math.max(0.06, s))
}

function renderSigil(input: GenInput, opts: GenOptions, rng: Rng): string {
  const palette = PALETTE_BY_ID[opts.palette]
  const baseStroke = LINE_PX[opts.lineWeight]
  const comp = projectComplexity(input)
  let gridN = GRID_SIZE[opts.density]
  if (comp < 0.32) gridN = Math.min(5, gridN)

  const margin = SIZE * 0.16
  const innerSize = SIZE - margin * 2
  const cell = innerSize / (gridN - 1)
  const cx = SIZE / 2

  const nodeXY = (col: number, row: number) => ({
    x: margin + col * cell,
    y: margin + row * cell,
  })

  const crownRow = 1
  const baseRow = gridN - 2
  const halfCols = Math.floor(gridN / 2)

  const back: string[] = []
  const fore: string[] = []

  // --- Strict symmetric shell: perfect rect + crown + base (no vertex jitter) ---
  const shell = strokeStyleForStrength(0.95, baseStroke * 1.05)
  fore.push(
    `<rect x="${margin}" y="${margin}" width="${innerSize}" height="${innerSize}" fill="none" stroke="${palette.outline}" stroke-width="${shell.w.toFixed(2)}" stroke-opacity="${shell.op.toFixed(3)}" />`,
  )

  const beam = strokeStyleForStrength(0.9, baseStroke * 1.08)
  const crownL = nodeXY(1, crownRow)
  const crownR = nodeXY(gridN - 2, crownRow)
  fore.push(svgLineSeg(crownL.x, crownL.y, crownR.x, crownR.y, palette.outline, beam))

  const baseL = nodeXY(1, baseRow)
  const baseR = nodeXY(gridN - 2, baseRow)
  fore.push(svgLineSeg(baseL.x, baseL.y, baseR.x, baseR.y, palette.outline, beam))

  // --- Symmetric pillar pairs (structural, strong, slightly thicker when sparse) ---
  const pillarStrokeMul = comp < 0.32 ? 1.32 : comp < 0.5 ? 1.12 : 1
  const pillarSt = strokeStyleForStrength(0.84, baseStroke * pillarStrokeMul)
  const pillarCols: number[] = []
  const pillarTarget = comp < 0.3 ? 1 : 1 + rng.int(0, 1)
  for (let p = 0; p < pillarTarget; p++) {
    const hi = Math.max(1, halfCols - 1)
    let col = rng.int(1, hi)
    let guard = 0
    while (pillarCols.includes(col) && guard < 10) {
      col = rng.int(1, hi)
      guard++
    }
    pillarCols.push(col)
  }
  for (const col of pillarCols) {
    const top = nodeXY(col, crownRow)
    const bot = nodeXY(col, baseRow)
    fore.push(svgLineSeg(top.x, top.y, bot.x, bot.y, palette.outline, pillarSt))
    const colR = gridN - 1 - col
    if (colR !== col) {
      const topR = nodeXY(colR, crownRow)
      const botR = nodeXY(colR, baseRow)
      fore.push(svgLineSeg(topR.x, topR.y, botR.x, botR.y, palette.outline, pillarSt))
    }
  }

  // --- Asymmetric interior: horizontal chords (etched / medium) ---
  let barCount = 1 + rng.int(0, 2)
  if (comp < 0.28) barCount = 1
  else if (comp < 0.48) barCount = Math.min(barCount, 2)
  for (let i = 0; i < barCount; i++) {
    const r = rng.int(crownRow + 1, baseRow - 1)
    const c1 = rng.int(1, gridN - 2)
    const c2 = rng.int(1, gridN - 2)
    if (c1 === c2) continue
    const lo = Math.min(c1, c2)
    const hi = Math.max(c1, c2)
    const a = nodeXY(lo, r)
    const b = nodeXY(hi, r)
    const ja = jitterVertex(a.x, a.y, rng)
    const jb = jitterVertex(b.x, b.y, rng)
    const wa = wobble(ja.x, ja.y, rng, 1.8)
    const wb = wobble(jb.x, jb.y, rng, 1.8)
    const st = strokeStyleForStrength(0.32 + rng.next() * 0.26, baseStroke)
    back.push(svgLineSeg(wa.x, wa.y, wb.x, wb.y, palette.outline, st))
  }

  // --- Asymmetric connectors: weak / etched, jittered "off-beat" endpoints ---
  let connectorCount = Math.min(9, Math.max(1, Math.floor(input.traceCount / 5) + rng.int(-1, 2)))
  if (comp < 0.28) connectorCount = Math.min(connectorCount, 2)
  else if (comp < 0.45) connectorCount = Math.min(connectorCount, 4)
  for (let i = 0; i < connectorCount; i++) {
    const c1 = rng.int(1, gridN - 2)
    const r1 = rng.int(crownRow + 1, baseRow - 1)
    const c2 = rng.int(1, gridN - 2)
    const r2 = rng.int(crownRow + 1, baseRow - 1)
    if (c1 === c2 && r1 === r2) continue
    const a = nodeXY(c1, r1)
    const b = nodeXY(c2, r2)
    const str = sigilConnectorStrength(Math.abs(c2 - c1), Math.abs(r2 - r1), gridN, input, i, rng)
    const st = strokeStyleForStrength(str, baseStroke)
    const ja = jitterVertex(a.x, a.y, rng)
    const jb = jitterVertex(b.x, b.y, rng)
    const wobbleAmt = str < 0.45 ? 2.4 : 0.9
    const wa = wobble(ja.x, ja.y, rng, wobbleAmt)
    const wb = wobble(jb.x, jb.y, rng, wobbleAmt)
    back.push(svgLineSeg(wa.x, wa.y, wb.x, wb.y, palette.outline, st))
  }

  // --- Joints at structural grid crossings only ---
  const jointKeys = new Set<string>()
  for (let c = 0; c < gridN; c++) {
    jointKeys.add(`${c},0`)
    jointKeys.add(`${c},${gridN - 1}`)
  }
  for (let r = 0; r < gridN; r++) {
    jointKeys.add(`0,${r}`)
    jointKeys.add(`${gridN - 1},${r}`)
  }
  for (let c = 1; c < gridN - 1; c++) {
    jointKeys.add(`${c},${crownRow}`)
    jointKeys.add(`${c},${baseRow}`)
  }
  for (const col of pillarCols) {
    for (let r = crownRow; r <= baseRow; r++) {
      jointKeys.add(`${col},${r}`)
      jointKeys.add(`${gridN - 1 - col},${r}`)
    }
  }

  const joints: string[] = []
  let jIdx = 0
  for (const key of jointKeys) {
    const [c, r] = key.split(',').map(Number)
    const p = nodeXY(c, r)
    const fill = palette.fills[jIdx % palette.fills.length]
    const rad = rng.range(2.4, 4.2)
    joints.push(
      `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${rad.toFixed(1)}" fill="${fill}" stroke="${palette.outline}" stroke-width="0.75" />`,
    )
    jIdx++
  }

  // --- Halo (accent, medium weight, geometric — keeps symmetry read) ---
  const haloR = innerSize * 0.52
  const startA = rng.range(-Math.PI * 0.45, Math.PI * 0.45) - Math.PI / 2
  const sweep = rng.range(Math.PI * 0.75, Math.PI * 1.35)
  const endA = startA + sweep
  const x1 = cx + Math.cos(startA) * haloR
  const y1 = SIZE / 2 + Math.sin(startA) * haloR
  const x2 = cx + Math.cos(endA) * haloR
  const y2 = SIZE / 2 + Math.sin(endA) * haloR
  const largeArc = sweep > Math.PI ? 1 : 0
  const haloSt = strokeStyleForStrength(0.55, baseStroke * 0.88)
  joints.push(
    `<path d="M${x1.toFixed(1)},${y1.toFixed(1)} A${haloR.toFixed(1)},${haloR.toFixed(1)} 0 ${largeArc} 1 ${x2.toFixed(1)},${y2.toFixed(1)}" fill="none" stroke="${palette.accent}" stroke-width="${haloSt.w.toFixed(2)}" stroke-opacity="${haloSt.op.toFixed(3)}" stroke-linecap="round" />`,
  )

  return back.join('') + fore.join('') + joints.join('')
}

// ---------------------------------------------------------------------------
// Motif: Nebula
//
// Soft radial-gradient colour clouds layered behind a constellation of dots
// connected by faint ink strands. A single nucleus gives the composition a
// centre of mass. Saturation scales with density, stars with traces, strands
// with reference count.

function gradientId(seed: string, i: number): string {
  return `neb-${fnv32(seed)}-${i}`
}

function buildCloud(
  id: string,
  fill: string,
  satHigh: number,
  satLow: number,
): string {
  return (
    `<radialGradient id="${id}" cx="50%" cy="50%" r="50%">` +
    `<stop offset="0%" stop-color="${fill}" stop-opacity="${satHigh.toFixed(2)}"/>` +
    `<stop offset="48%" stop-color="${fill}" stop-opacity="${satLow.toFixed(2)}"/>` +
    `<stop offset="78%" stop-color="${fill}" stop-opacity="${(satLow * 0.45).toFixed(2)}"/>` +
    `<stop offset="100%" stop-color="${fill}" stop-opacity="0"/>` +
    `</radialGradient>`
  )
}

/** Stipple + micro-dots hugging the cloud rim — reads as grain / atmosphere on light palettes. */
function nebulaEdgeStipple(
  cx: number,
  cy: number,
  r: number,
  rng: Rng,
  fill: string,
  outline: string,
  lightBg: boolean,
): string {
  const n = Math.round((lightBg ? 62 : 44) * (r / 300))
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2)
    const rad = r * rng.range(0.78, 0.998)
    const x = cx + Math.cos(a) * rad
    const y = cy + Math.sin(a) * rad
    const dotR = rng.range(0.3, 1.25)
    const op = lightBg ? rng.range(0.12, 0.36) : rng.range(0.08, 0.24)
    out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${dotR.toFixed(2)}" fill="${fill}" fill-opacity="${op.toFixed(3)}" />`)
  }
  if (lightBg) {
    const m = Math.round(28 * (r / 300))
    for (let i = 0; i < m; i++) {
      const a = rng.range(0, Math.PI * 2)
      const rad = r * rng.range(0.88, 1.002)
      const x = cx + Math.cos(a) * rad
      const y = cy + Math.sin(a) * rad
      out.push(
        `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rng.range(0.25, 0.7).toFixed(2)}" fill="${outline}" fill-opacity="${rng.range(0.04, 0.11).toFixed(3)}" />`,
      )
    }
  }
  return out.join('')
}

function nebulaFilmGrainFilterDef(seedMark: string): { id: string; xml: string } {
  const id = `neb-grain-${fnv32(seedMark)}`
  const seedNum = (fnv32(seedMark + 'noise').charCodeAt(0) + fnv32(seedMark + 'noise').charCodeAt(1)) % 900 + 1
  return {
    id,
    xml:
      `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">` +
      `<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${seedNum}" result="t"/>` +
      `<feColorMatrix in="t" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.22 0" result="a"/>` +
      `<feBlend in="SourceGraphic" in2="a" mode="multiply" />` +
      `</filter>`,
  }
}

function renderNebula(input: GenInput, opts: GenOptions, rng: Rng): string {
  const palette = PALETTE_BY_ID[opts.palette]
  const density = DENSITY_MULT[opts.density]
  const stroke = LINE_PX[opts.lineWeight]

  const lightBg = isLightHex(palette.background)
  // Light palettes: lift centre opacity + richer falloff; still add grain below.
  const satHigh = (lightBg ? 0.66 : 0.78) * (0.72 + density * 0.32)
  const satLow = satHigh * (lightBg ? 0.34 : 0.28)

  const seedMark = `${input.projectId}-${opts.rerollIndex}-${opts.palette}`
  const cloudCount = 3 + rng.int(0, 2)
  const defs: string[] = []
  const grain = lightBg ? nebulaFilmGrainFilterDef(seedMark) : null
  if (grain) defs.push(grain.xml)

  const cloudBodies: string[] = []
  for (let i = 0; i < cloudCount; i++) {
    const id = gradientId(seedMark, i)
    const fill = palette.fills[i % palette.fills.length]
    defs.push(buildCloud(id, fill, satHigh, satLow))
    const cx = rng.range(SIZE * 0.12, SIZE * 0.88)
    const cy = rng.range(SIZE * 0.12, SIZE * 0.88)
    const r = SIZE * rng.range(0.28, 0.46)
    const circ = `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="url(#${id})" />`
    const stip = nebulaEdgeStipple(cx, cy, r, rng, fill, palette.outline, lightBg)
    cloudBodies.push(circ + stip)
  }

  const nucleusId = gradientId(seedMark, 99)
  defs.push(
    `<radialGradient id="${nucleusId}" cx="50%" cy="50%" r="50%">` +
      `<stop offset="0%" stop-color="${palette.accent}" stop-opacity="${(satHigh * 0.95).toFixed(2)}"/>` +
      `<stop offset="55%" stop-color="${palette.accent}" stop-opacity="${lightBg ? '0.14' : '0.1'}"/>` +
      `<stop offset="100%" stop-color="${palette.accent}" stop-opacity="0"/>` +
      `</radialGradient>`,
  )
  const nucleusCx = SIZE / 2 + rng.gauss() * 60
  const nucleusCy = SIZE / 2 + rng.gauss() * 60
  const nucleusR = SIZE * rng.range(0.16, 0.24)
  const nucCirc = `<circle cx="${nucleusCx.toFixed(1)}" cy="${nucleusCy.toFixed(1)}" r="${nucleusR.toFixed(1)}" fill="url(#${nucleusId})" />`
  const nucStip = nebulaEdgeStipple(nucleusCx, nucleusCy, nucleusR, rng, palette.accent, palette.outline, lightBg)
  cloudBodies.push(nucCirc + nucStip)

  const cloudSvg =
    grain ? `<g filter="url(#${grain.id})">${cloudBodies.join('')}</g>` : cloudBodies.join('')

  // Star dust — lots of tiny dots, palette-coloured, uneven opacity.
  const dustCount = Math.round((80 + input.traceCount * 2) * density)
  const dust: string[] = []
  for (let i = 0; i < dustCount; i++) {
    const cx = rng.range(SIZE * 0.04, SIZE * 0.96)
    const cy = rng.range(SIZE * 0.04, SIZE * 0.96)
    const bx = nucleusCx + (cx - nucleusCx) * (0.6 + Math.abs(rng.gauss()) * 0.8)
    const by = nucleusCy + (cy - nucleusCy) * (0.6 + Math.abs(rng.gauss()) * 0.8)
    const r = rng.range(0.4, 1.8)
    const fill = rng.chance(0.6) ? palette.outline : rng.pick(palette.fills)
    const op = rng.range(0.3, 0.9)
    dust.push(
      `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${r.toFixed(2)}" fill="${fill}" fill-opacity="${op.toFixed(2)}" />`,
    )
  }

  const starCount = Math.min(30, 8 + Math.max(0, input.pivotCount) * 2 + rng.int(0, 4))
  const stars: string[] = []
  for (let i = 0; i < starCount; i++) {
    const cx = rng.range(SIZE * 0.08, SIZE * 0.92)
    const cy = rng.range(SIZE * 0.08, SIZE * 0.92)
    const r = rng.range(2.5, 4.5)
    const fill = rng.pick(palette.fills)
    stars.push(
      `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(2)}" fill="${fill}" stroke="${palette.outline}" stroke-width="0.6" />`,
    )
  }

  const strandCount = Math.min(14, Math.max(3, input.referenceCount + 3))
  const strands: string[] = []
  for (let i = 0; i < strandCount; i++) {
    const x1 = rng.range(SIZE * 0.05, SIZE * 0.95)
    const y1 = rng.range(SIZE * 0.05, SIZE * 0.95)
    const x2 = rng.range(SIZE * 0.05, SIZE * 0.95)
    const y2 = rng.range(SIZE * 0.05, SIZE * 0.95)
    const cpx = (x1 + x2) / 2 + rng.gauss() * 180
    const cpy = (y1 + y2) / 2 + rng.gauss() * 180
    const str = 0.2 + rng.next() * 0.55 + Math.min(1, input.referenceCount / 18) * 0.22 - i * 0.025
    const st = strokeStyleForStrength(Math.max(0.08, Math.min(1, str)), stroke * 0.58)
    const dash = st.dash ? ` stroke-dasharray="${st.dash}"` : ''
    strands.push(
      `<path d="M${x1.toFixed(1)},${y1.toFixed(1)} Q${cpx.toFixed(1)},${cpy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}" fill="none" stroke="${palette.outline}" stroke-width="${st.w.toFixed(2)}" stroke-opacity="${st.op.toFixed(3)}" stroke-linecap="round"${dash} />`,
    )
  }

  return (
    `<defs>${defs.join('')}</defs>` +
    cloudSvg +
    strands.join('') +
    dust.join('') +
    stars.join('')
  )
}

/** Rough perceptual lightness check for "#rrggbb" — good enough to decide saturation. */
function isLightHex(hex: string): boolean {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex)
  if (!m) return true
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  // Perceived luminance (ITU BT.601)
  const l = 0.299 * r + 0.587 * g + 0.114 * b
  return l > 150
}


// ---------------------------------------------------------------------------
// Shared layers

/** Title glyphs: one small tick per title character, ringed around the edge. */
function renderTitleGlyphs(input: GenInput, opts: GenOptions, rng: Rng): string {
  const palette = PALETTE_BY_ID[opts.palette]
  const chars = Array.from(input.title.slice(0, 48))
  if (chars.length === 0) return ''
  const cx = SIZE / 2
  const cy = SIZE / 2
  const r = SIZE * 0.46
  return chars
    .map((_, i) => {
      const a = (i / chars.length) * Math.PI * 2 + rng.range(-0.02, 0.02)
      const x = cx + Math.cos(a) * r
      const y = cy + Math.sin(a) * r
      const len = rng.range(8, 16)
      const x2 = cx + Math.cos(a) * (r - len)
      const y2 = cy + Math.sin(a) * (r - len)
      const p1 = jitterVertex(x, y, rng)
      const p2 = jitterVertex(x2, y2, rng)
      return `<line x1="${p1.x.toFixed(2)}" y1="${p1.y.toFixed(2)}" x2="${p2.x.toFixed(2)}" y2="${p2.y.toFixed(2)}" stroke="${palette.outline}" stroke-width="${LINE_PX[opts.lineWeight].toFixed(2)}" stroke-linecap="round" />`
    })
    .join('')
}

/** One signature mark per contributor — small alias-hashed dot near centre. */
function renderContributorTicks(input: GenInput, opts: GenOptions, rng: Rng): string {
  const palette = PALETTE_BY_ID[opts.palette]
  return input.contributors
    .slice(0, 16)
    .map((c, i) => {
      const a = (i / Math.max(1, input.contributors.length)) * Math.PI * 2 + rng.range(-0.04, 0.04)
      const dist = SIZE * 0.08
      const x = SIZE / 2 + Math.cos(a) * dist
      const y = SIZE / 2 + Math.sin(a) * dist
      const fill = palette.fills[i % palette.fills.length]
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rng.range(3, 6).toFixed(1)}" fill="${fill}" stroke="${palette.outline}" stroke-width="0.75"><title>${esc(c.alias)}</title></circle>`
    })
    .join('')
}

/** Binary ring around the edge made from the block hash. */
function renderProvenanceBand(input: GenInput, opts: GenOptions): string {
  if (!input.blockHash) return ''
  const palette = PALETTE_BY_ID[opts.palette]
  const hex = input.blockHash.replace(/[^0-9a-fA-F]/g, '').slice(-32)
  if (hex.length === 0) return ''
  const bits: number[] = []
  for (let i = 0; i < hex.length; i++) {
    const n = parseInt(hex[i], 16)
    for (let b = 3; b >= 0; b--) bits.push((n >> b) & 1)
  }
  const cx = SIZE / 2
  const cy = SIZE / 2
  const r = SIZE * 0.492
  const step = (Math.PI * 2) / bits.length
  return bits
    .map((bit, i) => {
      if (!bit) return ''
      const a = i * step
      const x1 = cx + Math.cos(a) * r
      const y1 = cy + Math.sin(a) * r
      const x2 = cx + Math.cos(a) * (r + 10)
      const y2 = cy + Math.sin(a) * (r + 10)
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${palette.outline}" stroke-width="1" />`
    })
    .join('')
}

// ---------------------------------------------------------------------------
// Public API

export function buildParams(input: GenInput, options: GenOptions): GenParams {
  const seed = composeSeed({
    blockHash: input.blockHash,
    projectId: input.projectId,
    rerollIndex: options.rerollIndex,
    version: RENDERER_VERSION,
  })
  return { version: RENDERER_VERSION, input, options, seed }
}

export function renderSvg(input: GenInput, options: GenOptions): string {
  const params = buildParams(input, options)
  const rng = rngFromString(params.seed)
  const palette = PALETTE_BY_ID[options.palette]

  let motifLayer = ''
  switch (options.motif) {
    case 'facet':
      motifLayer = renderFacet(input, options, rng)
      break
    case 'scatter':
      motifLayer = renderScatter(input, options, rng)
      break
    case 'sigil':
      motifLayer = renderSigil(input, options, rng)
      break
    case 'nebula':
      motifLayer = renderNebula(input, options, rng)
      break
  }

  const glyphLayer = options.layers.titleGlyphs ? renderTitleGlyphs(input, options, rng) : ''
  const ticksLayer = options.layers.contributorTicks ? renderContributorTicks(input, options, rng) : ''
  const bandLayer = options.layers.provenanceBand ? renderProvenanceBand(input, options) : ''

  const title = esc(input.title || 'Provenance certificate')

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" role="img" aria-label="Provenance certificate for ${title}" data-etch-gen="${RENDERER_VERSION}">`,
    `<rect x="0" y="0" width="${SIZE}" height="${SIZE}" fill="${palette.background}" />`,
    motifLayer,
    ticksLayer,
    glyphLayer,
    bandLayer,
    `<metadata><project>${esc(input.projectId)}</project><motif>${options.motif}</motif><palette>${options.palette}</palette><seed>${esc(params.seed)}</seed></metadata>`,
    `</svg>`,
  ].join('')
}
