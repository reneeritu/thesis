/**
 * Pure generative renderer for Etch provenance certificates.
 *
 * Renders a 1024×1024 square SVG from `{ input, options }`. The same inputs
 * always produce the same SVG — all randomness flows through a seeded RNG.
 *
 * Motifs in v1:
 *   - facet   (default) — wireframe polyhedra; one large central + scattered siblings.
 *   - scatter (calm)    — one anchor shape + confetti dots + sweeping arcs.
 *
 * Motifs in v2 (stubs):
 *   - sigil  — wobbly architectural glyph on dark ground.
 *   - nebula — sprayed colour clouds with fine ink overlay.
 */

import { PALETTE_BY_ID } from './palettes'
import { composeSeed, rngFromString, type Rng } from './rng'
import type { GenInput, GenOptions, GenParams, LineWeight, Density } from './types'
import { RENDERER_VERSION } from './types'

const SIZE = 1024

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

/** Produce a wobbly ("hand-drawn") version of a straight line's endpoint. */
function wobble(x: number, y: number, rng: Rng, amount = 2.5) {
  return { x: x + rng.gauss() * amount, y: y + rng.gauss() * amount }
}

/** Path for a hand-wobbled polygon outline. */
function wobblePolygon(
  points: Array<{ x: number; y: number }>,
  rng: Rng,
  jitter: number,
): string {
  const pts = points.map((p) => wobble(p.x, p.y, rng, jitter))
  return pts.reduce(
    (acc, p, i) => acc + (i === 0 ? `M${p.x.toFixed(2)},${p.y.toFixed(2)}` : `L${p.x.toFixed(2)},${p.y.toFixed(2)}`),
    '',
  ) + 'Z'
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
  const contributorCount = Math.max(1, input.contributors.length)
  const siblingCount = Math.round(Math.min(16, Math.max(3, contributorCount * 2 + rng.int(1, 3))) * densityMult)
  const centralFaces = Math.max(5, Math.min(12, 5 + input.pivotCount))

  const central: Facet = {
    cx: SIZE / 2,
    cy: SIZE / 2,
    radius: SIZE * 0.22,
    vertices: centralFaces,
    rotate: rng.range(0, Math.PI),
    fillIdx: 0,
  }

  const siblings: Facet[] = []
  for (let i = 0; i < siblingCount; i++) {
    const ang = rng.range(0, Math.PI * 2)
    const dist = rng.range(SIZE * 0.26, SIZE * 0.42)
    const radius = rng.range(SIZE * 0.04, SIZE * 0.13)
    siblings.push({
      cx: SIZE / 2 + Math.cos(ang) * dist,
      cy: SIZE / 2 + Math.sin(ang) * dist,
      radius,
      vertices: rng.int(4, 9),
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

function renderScatter(input: GenInput, opts: GenOptions, rng: Rng): string {
  const palette = PALETTE_BY_ID[opts.palette]
  const density = DENSITY_MULT[opts.density]
  const stroke = LINE_PX[opts.lineWeight]

  const anchor = (() => {
    const cx = SIZE / 2 + rng.gauss() * 60
    const cy = SIZE * 0.58 + rng.gauss() * 40
    const w = SIZE * rng.range(0.38, 0.5)
    const h = SIZE * rng.range(0.16, 0.24)
    const angle = rng.range(-0.4, 0.4)
    const rx = w / 2
    const ry = h / 2
    const seg = 24
    const pts: Array<{ x: number; y: number }> = []
    for (let i = 0; i < seg; i++) {
      const t = (i / seg) * Math.PI * 2
      const x = cx + Math.cos(t) * rx * Math.cos(angle) - Math.sin(t) * ry * Math.sin(angle)
      const y = cy + Math.cos(t) * rx * Math.sin(angle) + Math.sin(t) * ry * Math.cos(angle)
      pts.push({ x, y })
    }
    return wobblePolygon(pts, rng, 4)
  })()

  const anchorSvg = `<path d="${anchor}" fill="${palette.outline}" fill-opacity="0.92" stroke="${palette.outline}" stroke-width="${stroke}" stroke-linejoin="round" />`

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
    const cx = (x1 + x2) / 2 + rng.gauss() * 200
    const cy = (y1 + y2) / 2 + rng.gauss() * 200
    arcs.push(
      `<path d="M${x1.toFixed(1)},${y1.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}" fill="none" stroke="${palette.outline}" stroke-width="${(stroke * 0.7).toFixed(2)}" stroke-opacity="0.7" />`,
    )
  }

  return arcs.join('') + dots.join('') + anchorSvg
}

// ---------------------------------------------------------------------------
// v2 motif stubs — fall back to facet in v1

function renderSigil(input: GenInput, opts: GenOptions, rng: Rng): string {
  // v2: dark-mode hand-drawn glyph. For v1 we fall through to facet so the UI can
  // still expose the knob without breaking.
  return renderFacet(input, opts, rng)
}

function renderNebula(input: GenInput, opts: GenOptions, rng: Rng): string {
  return renderScatter(input, opts, rng)
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
      return `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${palette.outline}" stroke-width="${LINE_PX[opts.lineWeight].toFixed(2)}" stroke-linecap="round" />`
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
