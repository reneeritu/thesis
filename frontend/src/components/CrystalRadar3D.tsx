/**
 * Reputation visualisation — Shard Mandala (kinetic data-art sculpture).
 *
 * Six Fractal Cells arranged with 6-fold hexagonal radial symmetry. Each cell
 * corresponds to one reputation category and elaborates itself recursively as
 * its score grows:
 *
 *   depth 0 (score 0–15)   — one clean base shard
 *   depth 1 (score 16–49)  — shard + two flanking facets (first fracture)
 *   depth 2 (score 50–85)  — + mid-tier grandchildren (layered self-similar)
 *   depth 3 (score 86+)    — + filigree ring of tiny nested shards
 *
 * Shards are crumpled with 3D Perlin (FBM) displacement; the visible form is
 * line-first: batched `WireframeGeometry` + helix filaments on `LineSegments2`
 * with heatmap vertex colours, wide + core additive passes, and a very faint
 * solid shell for depth and hit-testing. Post-processing (bloom, light grain,
 * subtle chroma) plus small stable line wobble read a little more hand-drawn
 * than perfect CAD. Bloom lifts bright
 * overlaps. At low score, many chaos filaments still fill each cell. Sparse
 * connector strokes avoid a hard hub at the origin. Particles only at depth ≥2.
 *
 * The whole mandala rotates slowly and wobbles on an irregular low-frequency
 * path. Clicking any shard (or its legend chip) causes every cell to expand
 * outward ~15% and ease back, like a kinetic glass sculpture unfolding, while
 * opening the side drawer with raw / 90-day scores and a definition.
 *
 * Public API is unchanged: categories / recentCategories / theme / className
 * / showDefinitions. The recent layer renders as a smaller inner "ghost"
 * mandala with clamped depth so it sits legibly inside the main sculpture.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { PartialPixelation } from './PartialPixelation'
import { LineMaterial, LineSegments2, LineSegmentsGeometry } from 'three-stdlib'
import * as THREE from 'three'
import { GLOSSARY } from '../lib/glossary'
import {
  CATEGORY_COLOURS,
  CATEGORY_LABELS,
} from '../lib/reputationColours'

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type ReputationCategories = {
  craft: number
  research: number
  collaboration: number
  pedagogy: number
  consistency: number
  community: number
}

type CategoryKey = keyof ReputationCategories

/** RGB channel split (post) — noticeable but dialed back from the heaviest pass. */
const CRYSTAL_CHROMA_OFFSET = new THREE.Vector2(0.0015, 0.002)

const KEYS: CategoryKey[] = [
  'craft',
  'research',
  'collaboration',
  'pedagogy',
  'consistency',
  'community',
]

const LABELS = CATEGORY_LABELS
const ARM_COLOURS = CATEGORY_COLOURS
const OUTLINE_COLOUR_LIGHT = '#121212'
const OUTLINE_COLOUR_LIGHT_NUM = 0x121212
const LIGHT_DIR_WORLD = new THREE.Vector3(3, 4.5, 3).normalize()
/** When true, light theme uses print-style: visible-edge lines, local halftone/bubble/chroma, no global post chroma. */
const LIGHT_PRINT_LOOK = true

function fract01(n: number): number {
  return (((Math.sin(n) * 43758.5453) % 1) + 1) % 1
}


const LIGHT_MATTE_COLOURS_BASE: Record<CategoryKey, string> = {
  craft: '#facc15', // yellow
  research: '#3b82f6', // blue
  collaboration: '#ef4444', // red
  pedagogy: '#22c55e', // green
  consistency: '#a855f7', // purple
  community: '#06b6d4', // cyan
}

function armColourForTheme(category: CategoryKey, theme: 'dark' | 'light'): string {
  return theme === 'light' ? LIGHT_MATTE_COLOURS_BASE[category] : ARM_COLOURS[category]
}

/**
 * Antiprism cell layout — instead of a flat ring, three cells radiate from an
 * upper latitude and three from a lower latitude offset by 60°, so the mandala
 * occupies real 3D volume and no orbit angle reveals it as a disk.
 */
const CELL_DIRECTIONS: ReadonlyArray<readonly [number, number, number]> = (() => {
  const TILT = Math.PI / 5 // ~36°, balanced between equator and pole
  const cosT = Math.cos(TILT)
  const sinT = Math.sin(TILT)
  const out: Array<[number, number, number]> = []
  for (let i = 0; i < 6; i++) {
    const upper = i % 2 === 0
    const ringIdx = Math.floor(i / 2) // 0..2 per ring
    const baseAng = (ringIdx / 3) * Math.PI * 2
    const ang = baseAng + (upper ? 0 : Math.PI / 3) // lower ring offset 60°
    const y = (upper ? 1 : -1) * sinT
    const x = Math.sin(ang) * cosT
    const z = Math.cos(ang) * cosT
    out.push([x, y, z])
  }
  return out
})()

const ARM_HINT: Record<CategoryKey, string> = {
  craft:         'Grows when you log execution traces — making the thing.',
  research:      'Grows when you log reference / study traces — investigating.',
  collaboration: 'Grows when you log group work and co-authored traces.',
  pedagogy:      'Grows when you mentor, teach, or review others.',
  consistency:   'Grows from steady cadence — showing up across time.',
  community:     'Grows from cross-space work and public-facing projects.',
}

// ---------------------------------------------------------------------------
// Helpers — score → recursion depth, colour, Perlin-ish noise
// ---------------------------------------------------------------------------

/** Map raw score (0–1000 ballpark) to recursion depth 0..3. */
function scoreToDepth(score: number): number {
  if (score >= 86) return 3
  if (score >= 50) return 2
  if (score >= 16) return 1
  return 0
}

/** Map raw score → outward arm length (world units). Minimum so cells exist. */
function scoreToArmLen(score: number): number {
  const n = Math.sqrt(Math.min(1, Math.max(0, score) / 1000))
  return 0.32 + n * 0.78
}

/** Pull a hex colour toward black by `factor` (0..1) — deeper gem body. */
function deepen(hex: string, factor: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const f = Math.max(0, Math.min(1, factor))
  const r0 = (n >> 16) & 255
  const g0 = (n >> 8) & 255
  const b0 = n & 255
  const r = Math.round(r0 * (1 - f))
  const g = Math.round(g0 * (1 - f))
  const b = Math.round(b0 * (1 - f))
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
}

/** Shift a hex colour's hue by `degrees` — two-tone neon emissive cores. */
function shiftHue(hex: string, degrees: number): string {
  const c = new THREE.Color(hex)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  hsl.h = (hsl.h + degrees / 360 + 1) % 1
  c.setHSL(hsl.h, hsl.s, hsl.l)
  return '#' + c.getHexString()
}

/** Smooth 0..1: how much extra geometric / line detail to add from score alone. */
function scoreToDetailT(score: number): number {
  return Math.sqrt(Math.min(1, Math.max(0, score) / 1000))
}

/**
 * Heatmap along fragment length: deep category anchor (t≈0) → mid chroma shift →
 * hot tip (t≈1). Tuned for wire-mesh / contour reads (per-category anchor).
 */
function heatmapAlongT(
  t: number,
  baseHex: string,
  theme: 'dark' | 'light',
  ghost: boolean,
  out: THREE.Color,
): THREE.Color {
  if (theme === 'light') {
    out.set(baseHex)
    if (ghost) out.multiplyScalar(0.72)
    return out
  }
  const a = new THREE.Color(baseHex)
  const mid = new THREE.Color(shiftHue(baseHex, 42))
  mid.lerp(new THREE.Color(ghost ? '#6ec8ff' : '#00c8d4'), 0.35)
  const hot = new THREE.Color(shiftHue(baseHex, -20))
  hot.lerp(new THREE.Color('#e8f0ff'), 0.55)
  const t1 = Math.max(0, Math.min(1, t))
  if (t1 < 0.5) {
    out.copy(a).lerp(mid, t1 * 2)
  } else {
    out.copy(mid).lerp(hot, (t1 - 0.5) * 2)
  }
  if (ghost) out.multiplyScalar(0.75)
  return out
}

/** Deterministic sum-of-sines — for edge jitter and motion. */
function noise3(x: number, y: number, z: number, t: number): number {
  return (
    Math.sin(x * 1.73 + t * 0.73) * 0.5 +
    Math.sin(y * 2.31 + t * 1.17 + 1.3) * 0.3 +
    Math.sin(z * 2.97 + t * 0.89 + 2.7) * 0.2
  )
}

// --- 3D Perlin noise (vertex displacement) ---------------------------------

const PERM256: Uint8Array = (() => {
  const a: number[] = Array.from({ length: 256 }, (_, i) => i)
  let s = 196613
  for (let i = 255; i > 0; i--) {
    s = (s * 1103515245 + 12345) >>> 0
    const j = s % (i + 1)
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return new Uint8Array(a)
})()

const PERM512: Uint8Array = new Uint8Array(512)
for (let i = 0; i < 256; i++) {
  PERM512[i] = PERM256[i]!
  PERM512[i + 256] = PERM256[i]!
}

function perlinFade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}
function perlinLerp(t: number, a: number, b: number): number {
  return a + t * (b - a)
}
/** Classic Perlin gradient (hash in 0..15). */
function perlinGrad(h: number, x: number, y: number, z: number): number {
  const hh = h & 15
  const u = hh < 8 ? x : y
  const v = hh < 4 ? y : hh === 12 || hh === 14 ? x : z
  return (hh & 1 ? -u : u) + (hh & 2 ? -v : v)
}

/** One sample of 3D Perlin noise, approximately in [-1, 1]. */
function perlin3(x: number, y: number, z: number): number {
  const X = Math.floor(x) & 255
  const Y = Math.floor(y) & 255
  const Z = Math.floor(z) & 255
  x -= Math.floor(x)
  y -= Math.floor(y)
  z -= Math.floor(z)
  const u = perlinFade(x)
  const v = perlinFade(y)
  const w = perlinFade(z)
  const A = PERM512[X]! + Y
  const AA = PERM512[A]! + Z
  const AB = PERM512[A + 1]! + Z
  const B = PERM512[X + 1]! + Y
  const BA = PERM512[B]! + Z
  const BB = PERM512[B + 1]! + Z
  return perlinLerp(
    w,
    perlinLerp(
      v,
      perlinLerp(
        u,
        perlinGrad(PERM512[AA]! & 15, x, y, z),
        perlinGrad(PERM512[BA]! & 15, x - 1, y, z),
      ),
      perlinLerp(
        u,
        perlinGrad(PERM512[AB]! & 15, x, y - 1, z),
        perlinGrad(PERM512[BB]! & 15, x - 1, y - 1, z),
      ),
    ),
    perlinLerp(
      v,
      perlinLerp(
        u,
        perlinGrad(PERM512[AA + 1]! & 15, x, y, z - 1),
        perlinGrad(PERM512[BA + 1]! & 15, x - 1, y, z - 1),
      ),
      perlinLerp(
        u,
        perlinGrad(PERM512[AB + 1]! & 15, x, y - 1, z - 1),
        perlinGrad(PERM512[BB + 1]! & 15, x - 1, y - 1, z - 1),
      ),
    ),
  )
}

/** Fractal Perlin (FBM) — organic, eroded surface detail. */
function fbmPerlin3(
  x: number,
  y: number,
  z: number,
  octaves = 4,
): number {
  let v = 0
  let a = 0.5
  let f = 1.0
  for (let o = 0; o < octaves; o++) {
    v += a * perlin3(x * f, y * f, z * f)
    f *= 2.0
    a *= 0.5
  }
  return v
}

// ---------------------------------------------------------------------------
// Shard geometry — stacked rings along +Z (twist-interpolated), then crumpled
// with 3D Perlin (FBM) along vertex normals.
// ---------------------------------------------------------------------------

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function makeShardGeometry(
  length: number,
  baseW: number,
  tipW: number,
  noiseSeed: number,
  theme: 'dark' | 'light',
  segments = 1,
): THREE.BufferGeometry {
  const segs = Math.max(1, Math.floor(segments))
  const bh = baseW / 2
  const th = tipW / 2
  const twistMax = Math.PI / 12
  const positions: number[] = []
  for (let k = 0; k <= segs; k++) {
    const t = k / segs
    const z = t * length
    const half = lerpNum(bh, th, t)
    const ang = twistMax * t
    const cs = Math.cos(ang)
    const sn = Math.sin(ang)
    for (let c = 0; c < 4; c++) {
      const corners: Array<readonly [number, number]> = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]
      const bx = corners[c]![0]! * half
      const by = corners[c]![1]! * half
      const x2 = cs * bx - sn * by
      const y2 = sn * bx + cs * by
      positions.push(x2, y2, z)
    }
  }
  const indices: number[] = []
  indices.push(0, 2, 1, 0, 3, 2)
  const T = segs * 4
  indices.push(T + 0, T + 1, T + 2, T + 0, T + 2, T + 3)
  for (let s = 0; s < segs; s++) {
    for (let i = 0; i < 4; i++) {
      const i2 = (i + 1) % 4
      const a = s * 4 + i
      const b = s * 4 + i2
      const c = (s + 1) * 4 + i2
      const d = (s + 1) * 4 + i
      indices.push(a, b, c, a, c, d)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  g.setIndex(indices)
  g.computeVertexNormals()
  if (theme === 'dark') {
    const pos = g.attributes.position as THREE.BufferAttribute
    const nrm = g.attributes.normal as THREE.BufferAttribute
    // Hash the seed into three independent 0..1 variants so every shard is
    // visibly unique: scale, amplitude, and axial warp all move independently.
    const h1 = ((Math.sin(noiseSeed * 12.9898) * 43758.5453) % 1 + 1) % 1
    const h2 = ((Math.sin(noiseSeed * 78.233) * 43758.5453) % 1 + 1) % 1
    const h3 = ((Math.sin(noiseSeed * 39.3468) * 43758.5453) % 1 + 1) % 1
    const scaleN = (2.0 + h2 * 1.8)
    const sx = 1.6 + Math.sin(noiseSeed * 3.1) * 0.5 + h1 * 0.7
    const sy = 1.8 + Math.cos(noiseSeed * 2.4) * 0.5 + h3 * 0.7
    const sz = 1.6 + Math.sin(noiseSeed * 1.7) * 0.5 + h2 * 0.6
    const offX = noiseSeed * 1.7 + h1 * 3.3
    const offY = Math.sin(noiseSeed) * 1.1 + h2 * 2.7
    const offZ = Math.cos(noiseSeed * 0.8) * 1.1 + h3 * 2.1
    const ampVar = 0.65 + h1 * 1.05
    const ref = Math.max(0.02, Math.min(baseW, length) * 0.14) * ampVar
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = pos.getZ(i)
      const nx = nrm.getX(i)
      const ny = nrm.getY(i)
      const nz = nrm.getZ(i)
      const f =
        fbmPerlin3(x * scaleN * sx + offX, y * scaleN * sy + offY, z * scaleN * sz + offZ, 2) * ref
      pos.setXYZ(i, x + nx * f, y + ny * f, z + nz * f)
    }
    pos.needsUpdate = true
    g.computeVertexNormals()
  }
  return g
}

// ---------------------------------------------------------------------------
// Recursive cell spec — given depth, produce a list of shards for one arm.
// Each shard's tip points roughly along +Z in cell-local space.
// ---------------------------------------------------------------------------

type ShardSpec = {
  pos: [number, number, number]
  euler: [number, number, number]
  length: number
  baseW: number
  tipW: number
  depth: number
}

function buildCellSpecs(
  depth: number,
  armLen: number,
  seed: number,
  score: number,
  theme: 'dark' | 'light',
): ShardSpec[] {
  const out: ShardSpec[] = []
  const detailT = scoreToDetailT(score)
  // Chaos filaments — trimmed for performance; still lively at any score.
  const chaosN = theme === 'light' ? 0 : 14 + Math.floor(detailT * 10)
  for (let i = 0; i < chaosN; i++) {
    const t = (i + seed * 1.3) * 0.37
    const g = fbmPerlin3(t, seed * 0.2 - i, t * 0.8, 2)
    const h = fbmPerlin3(seed, i * 0.11, t, 2)
    const u = fbmPerlin3(i * 0.07, t, h, 2)
    const ang = (i / Math.max(1, chaosN)) * Math.PI * 2 + g * 2.1
    const r = armLen * (0.02 + 0.14 * (0.2 + (Math.abs(h) * 0.5 + 0.5) * 0.8))
    out.push({
      pos: [Math.sin(ang) * r * 0.9, Math.cos(ang) * r * 0.85 + u * r * 0.4, armLen * 0.02 * i + 0.02 * h * armLen],
      euler: [g * 1.1 + 0.3, ang * 0.8 + u, h * 0.9 - g * 0.5 + (i % 6) * 0.15],
      length: armLen * (0.045 + 0.11 * (0.2 + (Math.abs(g) * 0.5 + 0.5) * 0.8) + 0.04 * detailT),
      baseW: armLen * (0.025 + 0.05 * detailT),
      tipW: armLen * (0.006 + 0.012 * detailT),
      depth: 0,
    })
  }

  // --- depth 0 : primary base shard (same origin — chaos above fills around it) -------
  out.push({
    pos: [0, 0, 0],
    euler: [0, 0, 0],
    length: armLen,
    baseW: armLen * 0.22,
    tipW: armLen * 0.04,
    depth: 0,
  })

  // --- depth 1 : two flanking facets (the first fracture) ---------------
  if (depth >= 1) {
    for (const sign of [-1, 1]) {
      out.push({
        pos: [0, 0, armLen * 0.04],
        euler: [0, sign * 0.36, 0],
        length: armLen * 0.72,
        baseW: armLen * 0.14,
        tipW: armLen * 0.03,
        depth: 1,
      })
    }
    // a thin vertical lift — breaks flat symmetry subtly
    out.push({
      pos: [0, armLen * 0.04, armLen * 0.02],
      euler: [0.22, 0, 0],
      length: armLen * 0.6,
      baseW: armLen * 0.09,
      tipW: armLen * 0.02,
      depth: 1,
    })
  }

  // --- depth 2 : mid-tier grandchildren attached along the arm ----------
  if (depth >= 2) {
    const offsets: Array<[number, number]> = [
      [0.38, 1],
      [0.38, -1],
      [0.68, 1],
      [0.68, -1],
    ]
    for (const [off, sign] of offsets) {
      const s = (((seed + off * 31) | 0) % 7) / 7 // 0..1 deterministic
      out.push({
        pos: [sign * armLen * 0.05, 0, armLen * off],
        euler: [0.12 * sign + s * 0.1, sign * (0.85 + s * 0.25), sign * 0.25],
        length: armLen * (0.26 + s * 0.08),
        baseW: armLen * 0.068,
        tipW: armLen * 0.014,
        depth: 2,
      })
    }
    // one child pointing slightly up out of the plane
    out.push({
      pos: [0, armLen * 0.06, armLen * 0.52],
      euler: [0.55, 0, 0],
      length: armLen * 0.22,
      baseW: armLen * 0.055,
      tipW: armLen * 0.012,
      depth: 2,
    })
  }

  // --- depth 3 : nebula / filigree — dense cloud of micro-shards -------
  if (depth >= 3) {
    for (let i = 0; i < 40; i++) {
      const t = (i + seed * 2.1) * 0.137
      const g = fbmPerlin3(t * 1.1, t * 0.7 + seed, t * 1.3 - seed, 3)
      const h = fbmPerlin3(t * 0.9 + 2, t * 1.2, seed * 0.3 - i * 0.01, 3)
      const u = fbmPerlin3(seed * 0.2 + i * 0.11, t, h, 2)
      const ang = (i / 96) * Math.PI * 2 + g * 1.2 + u * 0.9
      const ringR = armLen * (0.04 + 0.18 * (0.2 + (Math.abs(h) * 0.5 + 0.5) * 0.8))
      const zOff = armLen * (0.1 + 0.85 * (i / 96) + 0.25 * h + 0.1 * g)
      const sizeV = 0.04 + 0.22 * (0.3 + (u * 0.5 + 0.5) * 0.7)
      out.push({
        pos: [Math.sin(ang) * ringR, Math.cos(ang) * ringR * (0.15 + 0.85 * (0.2 + h * 0.2)), zOff],
        euler: [g * 1.4 + h * 0.8 + (i % 5) * 0.2, ang * 1.3 + u * 2.1, h * 1.6 - g * 0.9 + (i % 7) * 0.19],
        length: armLen * sizeV,
        baseW: armLen * (0.012 + 0.042 * (0.2 + (Math.abs(g) * 0.5 + 0.5) * 0.8)),
        tipW: armLen * (0.0025 + 0.014 * (0.2 + (Math.abs(h) * 0.5 + 0.5) * 0.8)),
        depth: 3,
      })
    }
  }

  return out
}

// ---------------------------------------------------------------------------
// Helix + merge — extra segments for very high line density (wiremesh read)
// ---------------------------------------------------------------------------

function helixSegmentPositions(
  length: number,
  baseW: number,
  tipW: number,
  seed: number,
  steps: number,
): Float32Array {
  const out: number[] = []
  const turns = 2.5 + (Math.sin(seed * 2.1) * 0.5 + 0.5) * 0.6
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps
    const t1 = (i + 1) / steps
    const z0 = t0 * length
    const z1 = t1 * length
    const r0 = (baseW * 0.5) * (1 - t0) + (tipW * 0.5) * t0
    const r1 = (baseW * 0.5) * (1 - t1) + (tipW * 0.5) * t1
    const a0 = t0 * Math.PI * 2 * turns + seed * 1.7
    const a1 = t1 * Math.PI * 2 * turns + seed * 1.7
    const wobble = fbmPerlin3(seed * 0.3, t0 * 3, t0, 2) * 0.04 * length
    out.push(
      Math.cos(a0) * r0 * 0.88 + wobble,
      Math.sin(a0) * r0 * 0.88,
      z0,
      Math.cos(a1) * r1 * 0.88,
      Math.sin(a1) * r1 * 0.88,
      z1,
    )
  }
  return new Float32Array(out)
}

function mergeFloat32(a: Float32Array, b: Float32Array): Float32Array {
  const o = new Float32Array(a.length + b.length)
  o.set(a, 0)
  o.set(b, a.length)
  return o
}

/**
 * Ring-loop contours from intermediate shard slices.
 * These 1px lines make 3D planes read on bright backgrounds.
 */
function internalContourPositions(geometry: THREE.BufferGeometry): Float32Array {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute | undefined
  if (!pos || pos.count < 12 || pos.count % 4 !== 0) return new Float32Array(0)
  const rings = Math.floor(pos.count / 4)
  if (rings <= 2) return new Float32Array(0)
  const out: number[] = []
  const p = (idx: number): [number, number, number] => [pos.getX(idx), pos.getY(idx), pos.getZ(idx)]
  for (let r = 1; r < rings - 1; r++) {
    const b = r * 4
    const i0 = b + 0
    const i1 = b + 1
    const i2 = b + 2
    const i3 = b + 3
    const edges: Array<[number, number]> = [
      [i0, i1],
      [i1, i2],
      [i2, i3],
      [i3, i0],
    ]
    for (const [a, b2] of edges) {
      const aP = p(a)
      const bP = p(b2)
      out.push(aP[0], aP[1], aP[2], bP[0], bP[1], bP[2])
    }
  }
  return new Float32Array(out)
}

let HALFTONE_PATCH_TEXTURE: THREE.CanvasTexture | null = null
/**
 * Dense regular halftone dot grid (print-style), fully tiling. Per-shard UV rotation/offset
 * gives the illusion of random placement across the surface.
 */
function getHalftonePatchTexture(): THREE.CanvasTexture {
  if (HALFTONE_PATCH_TEXTURE) return HALFTONE_PATCH_TEXTURE
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    const tex = new THREE.CanvasTexture(canvas)
    HALFTONE_PATCH_TEXTURE = tex
    return tex
  }
  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = 'rgba(0,0,0,1)'
  const step = 10
  const baseR = 2.0
  for (let y = 0; y <= size; y += step) {
    const row = Math.round(y / step)
    const oddOffset = row % 2 === 0 ? 0 : step / 2
    for (let x = 0; x <= size; x += step) {
      const px = x + oddOffset
      const r = baseR + (fract01(px * 0.13 + y * 0.11) - 0.5) * 0.5
      ctx.beginPath()
      ctx.arc(px, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1.0, 1.0)
  tex.needsUpdate = true
  HALFTONE_PATCH_TEXTURE = tex
  return tex
}


// ---------------------------------------------------------------------------
// Shared sprite texture for bubbles and stipples
// ---------------------------------------------------------------------------

let CIRCLE_SPRITE_TEXTURE: THREE.CanvasTexture | null = null
function getCircleSpriteTexture(): THREE.CanvasTexture {
  if (CIRCLE_SPRITE_TEXTURE) return CIRCLE_SPRITE_TEXTURE
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    const tex = new THREE.CanvasTexture(canvas)
    CIRCLE_SPRITE_TEXTURE = tex
    return tex
  }
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.55, 'rgba(255,255,255,0.85)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(32, 32, 30, 0, Math.PI * 2)
  ctx.fill()
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  CIRCLE_SPRITE_TEXTURE = tex
  return tex
}

/** Hard-edged disc for fully opaque point sprites (category-coloured, larger than fine chart dust). */
let SOLID_DISK_TEXTURE: THREE.CanvasTexture | null = null
function getSolidDiskTexture(): THREE.CanvasTexture {
  if (SOLID_DISK_TEXTURE) return SOLID_DISK_TEXTURE
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    const tex = new THREE.CanvasTexture(canvas)
    SOLID_DISK_TEXTURE = tex
    return tex
  }
  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(32, 32, 29, 0, Math.PI * 2)
  ctx.fill()
  const tex = new THREE.CanvasTexture(canvas)
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.needsUpdate = true
  SOLID_DISK_TEXTURE = tex
  return tex
}

// ---------------------------------------------------------------------------
// CoreRegionBubbles — opaque category-coloured dots / bubbles at cell root (bigger than fine particles)
// ---------------------------------------------------------------------------

/** Per-layer point sizes (separate draw calls = visible variety). All stay larger than ~0.012 fine specks. */
const CORE_PTS = {
  large: 0.175,
  medium: 0.108,
  small: 0.048,
} as const

type CoreRegionBubblesProps = {
  armLen: number
  /** Category / pyramid arm colour */
  colour: string
  seed: number
  ghost: boolean
  theme: 'dark' | 'light'
}

/** Bias 0..1 to push points toward the outer part of a cell (larger r / z). */
function outwardBias(t: number): number {
  return Math.pow(t, 0.58)
}

function CoreRegionBubbles({ armLen, colour, seed, ghost, theme }: CoreRegionBubblesProps) {
  if (theme !== 'light' || !LIGHT_PRINT_LOOK) return null
  const diskMap = useMemo(() => getSolidDiskTexture(), [])
  const groupRef = useRef<THREE.Group>(null)

  const { bigGeom, medGeom, smGeom } = useMemo(() => {
    // More particles; scatter out along +Z and laterally (cone) from the cell root.
    const nBig = 14 + Math.floor(fract01(seed * 2.7) * 7)
    const nMed = 24 + Math.floor(fract01(seed * 4.1) * 10)
    const nSm = 40 + Math.floor(fract01(seed * 5.3) * 16)

    const place = (i: number, salt: number) => {
      const t = outwardBias(fract01(seed * 1.13 + i * 1.3 + salt * 0.3))
      const z = armLen * (0.04 + 0.78 * t)
      const zN = z / Math.max(armLen, 1e-4)
      // Lateral cap grows with distance along the arm (cone / outward scatter).
      const rCap = armLen * (0.07 + 0.5 * zN)
      const r = rCap * (0.12 + 0.88 * outwardBias(fract01(seed * 0.9 + i * 0.7 + salt * 0.1)))
      const a = fract01(seed * 2.4 + i * 2.1 + salt) * Math.PI * 2
      const zW = armLen * 0.08 * (fract01(seed * 0.3 + i * 0.4 + salt) - 0.5)
      return new Float32Array([r * Math.cos(a), r * Math.sin(a), z + zW])
    }

    const bPos = new Float32Array(nBig * 3)
    for (let i = 0; i < nBig; i++) {
      bPos.set(place(i, 0), i * 3)
    }
    const mPos = new Float32Array(nMed * 3)
    for (let i = 0; i < nMed; i++) {
      mPos.set(place(i, 11), i * 3)
    }
    const sPos = new Float32Array(nSm * 3)
    for (let i = 0; i < nSm; i++) {
      sPos.set(place(i, 23), i * 3)
    }

    const bg = new THREE.BufferGeometry()
    bg.setAttribute('position', new THREE.BufferAttribute(bPos, 3))
    const mg = new THREE.BufferGeometry()
    mg.setAttribute('position', new THREE.BufferAttribute(mPos, 3))
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.BufferAttribute(sPos, 3))
    return { bigGeom: bg, medGeom: mg, smGeom: sg }
  }, [armLen, seed])

  useEffect(
    () => () => {
      bigGeom.dispose()
      medGeom.dispose()
      smGeom.dispose()
    },
    [bigGeom, medGeom, smGeom],
  )

  useFrame(({ clock }) => {
    const g = groupRef.current
    if (!g) return
    const t = clock.getElapsedTime()
    g.rotation.z = t * 0.04 + seed * 0.2
    g.position.set(0, 0, Math.sin(t * 0.3 + seed) * armLen * 0.012)
  })

  const op = ghost ? 0.9 : 1

  return (
    <group ref={groupRef} renderOrder={4}>
      <points geometry={bigGeom}>
        <pointsMaterial
          map={diskMap}
          color={colour}
          size={CORE_PTS.large}
          sizeAttenuation
          transparent
          opacity={op}
          alphaTest={0.35}
          depthWrite
          depthTest
          toneMapped={false}
          blending={THREE.NormalBlending}
        />
      </points>
      <points geometry={medGeom}>
        <pointsMaterial
          map={diskMap}
          color={colour}
          size={CORE_PTS.medium}
          sizeAttenuation
          transparent
          opacity={op}
          alphaTest={0.35}
          depthWrite
          depthTest
          toneMapped={false}
          blending={THREE.NormalBlending}
        />
      </points>
      <points geometry={smGeom}>
        <pointsMaterial
          map={diskMap}
          color={colour}
          size={CORE_PTS.small}
          sizeAttenuation
          transparent
          opacity={op}
          alphaTest={0.35}
          depthWrite
          depthTest
          toneMapped={false}
          blending={THREE.NormalBlending}
        />
      </points>
    </group>
  )
}

// ---------------------------------------------------------------------------
// PyramidSilhouetteOutline — black rim where each shard meets empty space; variable wobbly width.
// Inward-inflated copy + backfaces: inner glass draws on top, leaving only the contour visible.
// ---------------------------------------------------------------------------

function buildWobblyInwardShell(geometry: THREE.BufferGeometry, spec: ShardSpec, seed: number, ghost: boolean): THREE.BufferGeometry {
  const g = geometry.clone()
  const pos = g.attributes.position as THREE.BufferAttribute
  if (!g.attributes.normal) g.computeVertexNormals()
  const nrm = g.attributes.normal as THREE.BufferAttribute
  const v = new THREE.Vector3()
  const n = new THREE.Vector3()
  const base =
    Math.max(0.003, spec.length * 0.008) * (0.7 + 0.15 * (3 - spec.depth)) * (ghost ? 0.55 : 0.9)
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i))
    n.set(nrm.getX(i), nrm.getY(i), nrm.getZ(i)).normalize()
    const w1 = 0.5 + 0.5 * fbmPerlin3(seed, i * 0.17, 0, 2)
    const w2 = 0.72 + 0.28 * Math.sin(i * 0.53 + seed * 1.3)
    const w3 = 0.6 + 0.4 * fbmPerlin3(seed * 0.4, i * 0.9, 1.1, 2)
    const d = base * w1 * w2 * w3
    v.addScaledVector(n, -d)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  pos.needsUpdate = true
  return g
}

type PyramidSilhouetteOutlineProps = {
  geometry: THREE.BufferGeometry
  spec: ShardSpec
  seed: number
  ghost: boolean
}

function PyramidSilhouetteOutline({ geometry, spec, seed, ghost }: PyramidSilhouetteOutlineProps) {
  const shell = useMemo(
    () => buildWobblyInwardShell(geometry, spec, seed, ghost),
    [geometry, spec, seed, ghost],
  )
  useEffect(() => () => shell.dispose(), [shell])

  return (
    <mesh geometry={shell} renderOrder={-2}>
      <meshBasicMaterial
        color="#151515"
        side={THREE.BackSide}
        depthWrite
        depthTest
        toneMapped={false}
        transparent={false}
        polygonOffset
        polygonOffsetFactor={1}
        polygonOffsetUnits={1}
        opacity={1}
      />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// LightEdgeContour — thick category EdgesGeometry + wispy charcoal + chroma burst (light print).
// ---------------------------------------------------------------------------

type LightEdgeContourProps = {
  geometry: THREE.BufferGeometry
  spec: ShardSpec
  /** Category / pyramid arm colour (same as shard fill) */
  baseHex: string
  ghost: boolean
  seed: number
}

function LightEdgeContour({ geometry, spec, baseHex, ghost, seed }: LightEdgeContourProps) {
  const size = useThree((s) => s.size)
  const categoryHex = useMemo(() => new THREE.Color(baseHex).getHex(), [baseHex])

  const matCategory = useMemo(
    () =>
      new LineMaterial({
        color: categoryHex,
        transparent: true,
        opacity: ghost ? 0.42 : 0.95,
        linewidth: ghost ? 1.6 : 2.6,
        blending: THREE.NormalBlending,
        depthWrite: false,
        depthTest: true,
      }),
    [categoryHex, ghost],
  )
  const matWispy = useMemo(
    () =>
      new LineMaterial({
        color: OUTLINE_COLOUR_LIGHT_NUM,
        transparent: true,
        opacity: 0.15,
        linewidth: 0.42,
        blending: THREE.NormalBlending,
        depthWrite: false,
        depthTest: true,
      }),
    [],
  )
  const matChR = useMemo(
    () =>
      new LineMaterial({
        color: 0xff2266,
        transparent: true,
        opacity: 0,
        linewidth: 0.6,
        blending: THREE.NormalBlending,
        depthWrite: false,
        depthTest: true,
      }),
    [],
  )
  const matChC = useMemo(
    () =>
      new LineMaterial({
        color: 0x00ddee,
        transparent: true,
        opacity: 0,
        linewidth: 0.6,
        blending: THREE.NormalBlending,
        depthWrite: false,
        depthTest: true,
      }),
    [],
  )

  const meshes = useMemo(() => {
    const eg = new THREE.EdgesGeometry(geometry, 18)
    const epos = eg.attributes.position.array as Float32Array
    eg.dispose()
    const positions = new Float32Array(epos)
    const nSeg = positions.length / 6
    const jScale = (ghost ? 0.45 : 1) * 0.013
    const px = spec.pos[0]!, py = spec.pos[1]!, pz = spec.pos[2]!
    for (let i = 0; i < nSeg; i++) {
      const b = i * 6
      for (const off of [0, 0.37] as const) {
        const k = b + (off === 0 ? 0 : 3)
        positions[k]! += fbmPerlin3(seed + off, i * 0.19, px * 0.2 + pz * 0.15, 1) * jScale
        positions[k + 1]! += fbmPerlin3(seed + 1.4 + off, i * 0.23, py * 0.2, 1) * jScale
        positions[k + 2]! += fbmPerlin3(seed + 0.3 + off, i * 0.17, pz * 0.15 + seed * 0.02, 1) * jScale
      }
    }
    const chromaOff = 0.005
    const posR = new Float32Array(positions)
    const posC = new Float32Array(positions)
    for (let i = 0; i < positions.length; i += 3) {
      posR[i]! += chromaOff
      posR[i + 1]! += chromaOff * 0.5
      posC[i]! -= chromaOff
      posC[i + 1]! -= chromaOff * 0.5
    }
    const shared = new LineSegmentsGeometry()
    shared.setPositions(positions)
    const lineCategory = new LineSegments2(shared, matCategory)
    lineCategory.renderOrder = 2
    const lineWispy = new LineSegments2(shared, matWispy)
    lineWispy.renderOrder = 3
    const geomR = new LineSegmentsGeometry()
    geomR.setPositions(posR)
    const lineR = new LineSegments2(geomR, matChR)
    lineR.renderOrder = 4
    const geomC = new LineSegmentsGeometry()
    geomC.setPositions(posC)
    const lineC = new LineSegments2(geomC, matChC)
    lineC.renderOrder = 4
    return { shared, lineCategory, lineWispy, geomR, lineR, geomC, lineC }
  }, [geometry, ghost, seed, spec.pos, matCategory, matWispy, matChR, matChC])

  useEffect(
    () => () => {
      meshes.shared.dispose()
      meshes.geomR.dispose()
      meshes.geomC.dispose()
    },
    [meshes],
  )
  useEffect(
    () => () => {
      matCategory.dispose()
      matWispy.dispose()
      matChR.dispose()
      matChC.dispose()
    },
    [matCategory, matWispy, matChR, matChC],
  )
  useLayoutEffect(() => {
    matCategory.resolution.set(size.width, size.height)
    matWispy.resolution.set(size.width, size.height)
    matChR.resolution.set(size.width, size.height)
    matChC.resolution.set(size.width, size.height)
    matCategory.needsUpdate = true
    matWispy.needsUpdate = true
    matChR.needsUpdate = true
    matChC.needsUpdate = true
  }, [size.width, size.height, matCategory, matWispy, matChR, matChC])

  const nextChromaAtRef = useRef(0)
  const chromaUntilRef = useRef(0)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const w =
      0.03 +
      0.38 * Math.pow(0.5 + 0.5 * Math.sin(t * 0.48 + seed * 0.6), 1.6) *
        (0.55 + 0.45 * Math.sin(t * 1.1 + seed * 2.3) ** 2)
    const wispyOp = (ghost ? 0.45 : 1) * w
    if (matWispy.opacity !== wispyOp) {
      matWispy.opacity = wispyOp
      matWispy.needsUpdate = true
    }
    if (nextChromaAtRef.current === 0) {
      nextChromaAtRef.current = t + 2 + fract01(seed * 5.7) * 4
    }
    if (t >= nextChromaAtRef.current && chromaUntilRef.current <= t) {
      chromaUntilRef.current = t + 0.45
      nextChromaAtRef.current = t + 3.5 + fract01(seed * 11.3) * 5.5
    }
    const active = t < chromaUntilRef.current
    const wMul = 0.15 + 0.85 * Math.min(1, wispyOp * 2.2)
    const targetR = active ? (ghost ? 0.08 : 0.2) * wMul : 0
    const targetC = active ? (ghost ? 0.08 : 0.2) * wMul : 0
    if (matChR.opacity !== targetR) {
      matChR.opacity = targetR
      matChR.needsUpdate = true
    }
    if (matChC.opacity !== targetC) {
      matChC.opacity = targetC
      matChC.needsUpdate = true
    }
  })

  return (
    <>
      <primitive object={meshes.lineCategory} />
      <primitive object={meshes.lineWispy} />
      <primitive object={meshes.lineR} />
      <primitive object={meshes.lineC} />
    </>
  )
}

// ---------------------------------------------------------------------------
// SplatterBurst — external coloured bubble particles (main + R/C fringes)
// ---------------------------------------------------------------------------

const SPLATTER_PALETTE_HEX = [
  '#ff2255', '#ff9900', '#ffee00', '#22dd66', '#2299ff', '#aa44ff', '#00ddff', '#ff66bb',
]

type SplatterBurstProps = {
  spec: ShardSpec
  baseColour: string
  seed: number
}

function SplatterBurst({ spec, baseColour, seed }: SplatterBurstProps) {
  const spriteTex = useMemo(() => getCircleSpriteTexture(), [])

  const { mainGeom, chromaRGeom, chromaCGeom } = useMemo(() => {
    const N = 14 + Math.floor(fract01(seed * 3.7) * 18)
    const mainPos = new Float32Array(N * 3)
    const mainCol = new Float32Array(N * 3)
    const baseC = new THREE.Color(baseColour)
    const tipZ = spec.length
    const spread = 0.1 + spec.length * 0.42

    for (let i = 0; i < N; i++) {
      const zBias = fract01(seed * (i + 1.1) * 7.3)
      const z = zBias > 0.35
        ? tipZ * (0.6 + fract01(seed * i * 3.1) * 0.72)
        : tipZ * 0.3 * fract01(seed * i * 2.1)
      const angle = fract01(seed * i * 11.7) * Math.PI * 2
      const r = 0.025 + fract01(seed * i * 5.3) * spread
      mainPos[i * 3] = Math.cos(angle) * r
      mainPos[i * 3 + 1] = Math.sin(angle) * r
      mainPos[i * 3 + 2] = z
      const c = fract01(seed * i * 2.9) > 0.42
        ? baseC.clone()
        : new THREE.Color(SPLATTER_PALETTE_HEX[Math.floor(fract01(seed * i * 6.1) * SPLATTER_PALETTE_HEX.length)]!)
      mainCol[i * 3] = c.r;  mainCol[i * 3 + 1] = c.g;  mainCol[i * 3 + 2] = c.b
    }

    const chromaOff = 0.022
    const rPos = new Float32Array(N * 3)
    const cPos = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      rPos[i * 3] = mainPos[i * 3]! + chromaOff;   rPos[i * 3 + 1] = mainPos[i * 3 + 1]! + chromaOff * 0.6; rPos[i * 3 + 2] = mainPos[i * 3 + 2]!
      cPos[i * 3] = mainPos[i * 3]! - chromaOff;   cPos[i * 3 + 1] = mainPos[i * 3 + 1]! - chromaOff * 0.6; cPos[i * 3 + 2] = mainPos[i * 3 + 2]!
    }

    const mg = new THREE.BufferGeometry()
    mg.setAttribute('position', new THREE.BufferAttribute(mainPos, 3))
    mg.setAttribute('color', new THREE.BufferAttribute(mainCol, 3))
    const rg = new THREE.BufferGeometry()
    rg.setAttribute('position', new THREE.BufferAttribute(rPos, 3))
    const cg = new THREE.BufferGeometry()
    cg.setAttribute('position', new THREE.BufferAttribute(cPos, 3))

    return { mainGeom: mg, chromaRGeom: rg, chromaCGeom: cg }
  }, [spec.length, baseColour, seed, spec.pos])

  useEffect(
    () => () => {
      mainGeom.dispose()
      chromaRGeom.dispose()
      chromaCGeom.dispose()
    },
    [mainGeom, chromaRGeom, chromaCGeom],
  )

  return (
    <>
      <points geometry={mainGeom}>
        <pointsMaterial
          map={spriteTex}
          vertexColors
          transparent
          opacity={0.92}
          size={0.044}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.NormalBlending}
          toneMapped={false}
        />
      </points>
      <points geometry={chromaRGeom}>
        <pointsMaterial
          map={spriteTex}
          color="#ff2255"
          transparent
          opacity={0.22}
          size={0.052}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.NormalBlending}
          toneMapped={false}
        />
      </points>
      <points geometry={chromaCGeom}>
        <pointsMaterial
          map={spriteTex}
          color="#00ddff"
          transparent
          opacity={0.22}
          size={0.052}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.NormalBlending}
          toneMapped={false}
        />
      </points>
    </>
  )
}

// ---------------------------------------------------------------------------
// WhiteStipples — white dots at lit vertices (highlight / shine)
// ---------------------------------------------------------------------------

function WhiteStipples({ geometry, seed, ghost }: { geometry: THREE.BufferGeometry; seed: number; ghost: boolean }) {
  const stippleGeom = useMemo(() => {
    const pos = geometry.attributes.position as THREE.BufferAttribute | undefined
    const nrm = geometry.attributes.normal as THREE.BufferAttribute | undefined
    if (!pos || !nrm) return null
    const pts: number[] = []
    for (let i = 0; i < pos.count; i++) {
      const nx = nrm.getX(i), ny = nrm.getY(i), nz = nrm.getZ(i)
      const dot = nx * LIGHT_DIR_WORLD.x + ny * LIGHT_DIR_WORLD.y + nz * LIGHT_DIR_WORLD.z
      if (dot > 0.42 && fract01(seed + i * 0.317) > 0.5) {
        pts.push(pos.getX(i), pos.getY(i), pos.getZ(i))
      }
    }
    if (pts.length === 0) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3))
    return g
  }, [geometry, seed])

  useEffect(() => () => stippleGeom?.dispose(), [stippleGeom])

  if (!stippleGeom) return null
  return (
    <points geometry={stippleGeom} renderOrder={10}>
      <pointsMaterial map={getCircleSpriteTexture()} color="#ffffff" transparent opacity={ghost ? 0.38 : 0.78} size={0.016} sizeAttenuation depthWrite={false} toneMapped={false} />
    </points>
  )
}

// ---------------------------------------------------------------------------
// ContourWireMesh — batched LineSegments2. Dark: full wire + helix + heatmap.
// Light (print look): category edges on Shard are LightEdgeContour; black rim is PyramidSilhouetteOutline.
// ---------------------------------------------------------------------------

type ContourWireMeshProps = {
  geometry: THREE.BufferGeometry
  spec: ShardSpec
  baseHex: string
  theme: 'dark' | 'light'
  ghost: boolean
  seed: number
}

const _c0 = new THREE.Color()
const _c1 = new THREE.Color()
const CHARCOAL_LINE2 = 0x2a2a2a

function ContourWireMesh({ geometry, spec, baseHex, theme, ghost, seed }: ContourWireMeshProps) {
  const size = useThree((s) => s.size)
  const lightPrint = theme === 'light' && LIGHT_PRINT_LOOK
  const matG = useMemo(
    () =>
      new LineMaterial({
        color: theme === 'light' ? OUTLINE_COLOUR_LIGHT_NUM : 0xffffff,
        vertexColors: theme === 'light' ? false : true,
        transparent: true,
        opacity:
          theme === 'dark'
            ? ghost
              ? 0.14
              : 0.2
            : lightPrint
              ? ghost
                ? 0.18
                : 0.32
              : ghost
                ? 0.06
                : 0.14,
        linewidth: theme === 'dark' ? (ghost ? 2.05 : 2.7) : lightPrint ? (ghost ? 0.9 : 1.2) : 2.5,
        blending: theme === 'dark' ? THREE.AdditiveBlending : THREE.NormalBlending,
        depthWrite: false,
        depthTest: true,
      }),
    [ghost, theme, lightPrint],
  )
  const matC = useMemo(
    () =>
      new LineMaterial({
        color: theme === 'light' ? CHARCOAL_LINE2 : 0xffffff,
        vertexColors: theme === 'light' ? false : true,
        transparent: true,
        opacity: theme === 'dark' ? (ghost ? 0.38 : 0.56) : lightPrint ? (ghost ? 0.1 : 0.18) : ghost ? 0.34 : 0.5,
        linewidth: theme === 'dark' ? (ghost ? 0.92 : 1.2) : lightPrint ? (ghost ? 0.5 : 0.65) : ghost ? 0.9 : 1.2,
        blending: THREE.NormalBlending,
        depthWrite: false,
        depthTest: true,
      }),
    [ghost, theme, lightPrint],
  )
  const matD = useMemo(
    () =>
      new LineMaterial({
        color: OUTLINE_COLOUR_LIGHT_NUM,
        vertexColors: false,
        transparent: true,
        opacity: theme === 'light' ? (lightPrint ? (ghost ? 0.022 : 0.048) : 0) : 0,
        linewidth: 1,
        blending: THREE.NormalBlending,
        depthWrite: false,
        depthTest: true,
      }),
    [ghost, theme, lightPrint],
  )
  const matR = useMemo(
    () =>
      new LineMaterial({
        color: 0xffffff,
        vertexColors: true,
        transparent: true,
        opacity: theme === 'light' ? (lightPrint ? (ghost ? 0.4 : 0.58) : 0) : 0,
        linewidth: 1,
        blending: THREE.NormalBlending,
        depthWrite: false,
        depthTest: true,
      }),
    [ghost, theme, lightPrint],
  )

  const batched = useMemo(() => {
    const helixSteps = 14 + Math.floor((spec.depth + 1) * 3 + Math.sin(seed) * 2)
    const wire = new THREE.WireframeGeometry(geometry)
    const wf = wire.attributes.position.array as Float32Array
    const helix = helixSegmentPositions(spec.length, spec.baseW, spec.tipW, seed, helixSteps)
    wire.dispose()
    const positions =
      theme === 'light'
        ? lightPrint
          ? mergeFloat32(wf, helix)
          : new Float32Array(wf)
        : mergeFloat32(wf, helix)

    const nSeg = positions.length / 6
    // Slight per-segment endpoint offsets (light print: subtle, dark: full).
    const jitterThemeScale = theme === 'light' && lightPrint ? 0.42 : theme === 'light' ? 0 : 1
    const jScale = (ghost ? 0.55 : 1) * jitterThemeScale * (0.0042 + (spec.depth + 0.5) * 0.0007)
    const px = spec.pos[0]
    const py = spec.pos[1]
    const pz = spec.pos[2]
    for (let i = 0; i < nSeg; i++) {
      const b = i * 6
      for (const off of [0, 0.37] as const) {
        const k = b + (off === 0 ? 0 : 3)
        positions[k] += fbmPerlin3(seed + off, i * 0.19, px * 0.2 + pz * 0.15, 1) * jScale
        positions[k + 1] += fbmPerlin3(seed + 1.4 + off, i * 0.23, py * 0.2, 1) * jScale
        positions[k + 2] += fbmPerlin3(seed + 0.3 + off, i * 0.17, pz * 0.15 + seed * 0.02, 1) * jScale
      }
    }
    const colors = new Float32Array(nSeg * 6)
    const L = Math.max(0.001, spec.length)
    if (theme === 'light' && lightPrint) {
      for (let i = 0; i < nSeg * 6; i += 1) {
        colors[i] = 1
      }
    } else {
    for (let i = 0; i < nSeg; i++) {
      const b = i * 6
      const z0 = positions[b + 2]!
      const z1 = positions[b + 5]!
      const t0 = Math.max(0, Math.min(1, z0 / L))
      const t1 = Math.max(0, Math.min(1, z1 / L))
      heatmapAlongT(t0, baseHex, theme, ghost, _c0)
      heatmapAlongT(t1, baseHex, theme, ghost, _c1)
      colors[b] = _c0.r
      colors[b + 1] = _c0.g
      colors[b + 2] = _c0.b
      colors[b + 3] = _c1.r
      colors[b + 4] = _c1.g
      colors[b + 5] = _c1.b
      }
    }

    const g = new LineSegmentsGeometry()
    g.setPositions(positions)
    g.setColors(colors, 3)
    const wide = new LineSegments2(g, matG)
    const core = new LineSegments2(g, matC)

    let detailGeom: LineSegmentsGeometry | null = null
    let detail: LineSegments2 | null = null
    if (theme === 'light' && lightPrint) {
      const detailPositions = internalContourPositions(geometry)
      if (detailPositions.length > 0) {
        detailGeom = new LineSegmentsGeometry()
        detailGeom.setPositions(detailPositions)
        detail = new LineSegments2(detailGeom, matD)
      }
    }
    let rimGeom: LineSegmentsGeometry | null = null
    let rim: LineSegments2 | null = null
    let rimColors: Float32Array | null = null
    if (theme === 'light' && lightPrint) {
      rimGeom = new LineSegmentsGeometry()
      rimGeom.setPositions(positions)
      rimColors = new Float32Array((positions.length / 3) * 3)
      rimGeom.setColors(rimColors, 3)
      rim = new LineSegments2(rimGeom, matR)
    }
    return { geom: g, wide, core, detailGeom, detail, rimGeom, rim, rimColors, positions }
  }, [geometry, spec.length, spec.baseW, spec.tipW, spec.depth, baseHex, theme, ghost, seed, matG, matC, matD, matR, lightPrint])

  useEffect(() => {
    return () => {
      batched.geom.dispose()
      batched.detailGeom?.dispose()
      batched.rimGeom?.dispose()
    }
  }, [batched])

  useEffect(() => {
    return () => {
      matG.dispose()
      matC.dispose()
      matD.dispose()
      matR.dispose()
    }
  }, [matG, matC, matD, matR])

  useLayoutEffect(() => {
    matG.resolution.set(size.width, size.height)
    matC.resolution.set(size.width, size.height)
    matD.resolution.set(size.width, size.height)
    matR.resolution.set(size.width, size.height)
    matG.needsUpdate = true
    matC.needsUpdate = true
    matD.needsUpdate = true
    matR.needsUpdate = true
  }, [size.width, size.height, matG, matC, matD, matR])

  useFrame(() => {
    if (theme !== 'light' || !lightPrint || !batched.rim || !batched.rimColors) return
    const cols = batched.rimColors
    const pos = batched.positions
    const mw = batched.rim.matrixWorld
    const nSeg = pos.length / 6
    const lightDir = LIGHT_DIR_WORLD
    const mid = new THREE.Vector3()
    const n = new THREE.Vector3()
    for (let i = 0; i < nSeg; i++) {
      const b = i * 6
      const x0 = pos[b]!
      const y0 = pos[b + 1]!
      const z0 = pos[b + 2]!
      const x1 = pos[b + 3]!
      const y1 = pos[b + 4]!
      const z1 = pos[b + 5]!
      mid.set((x0 + x1) * 0.5, (y0 + y1) * 0.5, (z0 + z1) * 0.5)
      n.copy(mid).normalize().transformDirection(mw)
      const dot = THREE.MathUtils.clamp(n.dot(lightDir), 0, 1)
      const h = THREE.MathUtils.smoothstep(dot, 0.25, 0.95)
      const v = (ghost ? 0.65 : 1) * h
      cols[b] = v
      cols[b + 1] = v
      cols[b + 2] = v
      cols[b + 3] = v
      cols[b + 4] = v
      cols[b + 5] = v
    }
    if (batched.rimGeom) {
      batched.rimGeom.attributes.instanceColorStart.needsUpdate = true
      batched.rimGeom.attributes.instanceColorEnd.needsUpdate = true
    }
  })

  return (
    <>
      <primitive object={batched.wide} />
      <primitive object={batched.core} />
      {batched.detail ? <primitive object={batched.detail} /> : null}
      {batched.rim ? <primitive object={batched.rim} /> : null}
    </>
  )
}

// ---------------------------------------------------------------------------
// Connectors — thin additive lines (roots / stalks) + nebula point dust
// ---------------------------------------------------------------------------

function ConnectorLine({
  from,
  to,
  color,
  theme,
  opacity = 0.1,
}: {
  from: [number, number, number]
  to: [number, number, number]
  color: string
  theme: 'dark' | 'light'
  opacity?: number
}) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([...from, ...to]), 3),
    )
    return g
  }, [from, to, from[0], from[1], from[2], to[0], to[1], to[2]])
  useEffect(() => () => geom.dispose(), [geom])
  return (
    <lineSegments geometry={geom}>
      <lineBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        blending={theme === 'dark' ? THREE.AdditiveBlending : THREE.NormalBlending}
        depthWrite={false}
        toneMapped
      />
    </lineSegments>
  )
}

/** Faint filaments: anchor above true origin to avoid a visible “all spokes” hub. */
function ShardConnectors({
  specs,
  colour,
  armLen,
  theme,
}: {
  specs: ShardSpec[]
  colour: string
  armLen: number
  theme: 'dark' | 'light'
}) {
  const d2 = useMemo(() => specs.filter((s) => s.depth === 2), [specs])
  const fromRoot: [number, number, number] = [0, 0, Math.max(0.02, armLen * 0.1)]
  return (
    <>
      {specs
        .filter((s) => s.depth === 1 || s.depth === 2)
        .map((s, i) => (
          <ConnectorLine key={`root-${i}`} from={fromRoot} to={s.pos} color={colour} theme={theme} opacity={0.09} />
        ))}
      {specs
        .filter((s) => s.depth === 3)
        .map((s, i) => {
          let anchor: [number, number, number] = [0, 0, 0]
          if (d2.length > 0) {
            let best: ShardSpec = d2[0]!
            let bestD = Infinity
            for (const p of d2) {
              const dx = s.pos[0] - p.pos[0]
              const dy = s.pos[1] - p.pos[1]
              const dz = s.pos[2] - p.pos[2]
              const d2v = dx * dx + dy * dy + dz * dz
              if (d2v < bestD) {
                bestD = d2v
                best = p
              }
            }
            anchor = best.pos
          }
          return <ConnectorLine key={`d3-${i}`} from={anchor} to={s.pos} color={colour} theme={theme} />
        })}
    </>
  )
}

function CellParticles({
  armLen,
  colour,
  seed,
  ghost,
  score,
  theme,
}: {
  armLen: number
  colour: string
  seed: number
  ghost: boolean
  score: number
  theme: 'dark' | 'light'
}) {
  const geom = useMemo(() => {
    if (theme === 'light') {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3))
      return g
    }
    const depth = scoreToDepth(score)
    if (depth < 2) {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3))
      return g
    }
    const n = 90
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const t = i / n
      const u = fbmPerlin3(seed * 0.3 + i * 0.02, t * 4, seed * 0.1, 3)
      const v = fbmPerlin3(t * 3, seed * 0.2 - i * 0.01, u, 3)
      const w = fbmPerlin3(i * 0.05, v, u * 2, 2)
      const rz = armLen * (0.05 + t * 1.15 + u * 0.2)
      const rx = armLen * (0.02 + v * 0.45) * Math.sin(t * Math.PI * 2 + seed)
      const ry = armLen * (0.02 + w * 0.45) * Math.cos(t * Math.PI * 2 + seed * 0.7)
      pos[i * 3] = rx
      pos[i * 3 + 1] = ry
      pos[i * 3 + 2] = rz
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [armLen, seed, score, theme])
  useEffect(() => () => geom.dispose(), [geom])
  if (geom.attributes.position!.count === 0) return null
  return (
    <points geometry={geom}>
      <pointsMaterial
        color={colour}
        size={0.012}
        sizeAttenuation
        transparent
        opacity={ghost ? 0.04 : 0.08}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped
      />
    </points>
  )
}

// ---------------------------------------------------------------------------
// GyroscopeRings — three slowly counter-rotating wireframe circles at
// different tilts, sitting around the whole mandala. Architectural / orrery
// feel, not generative noise. Gives low-score nodes atmosphere for free.
// Beams take the category colour of the nearest FractalCell (by direction in
// world space); each ring’s opacity is lowest near the beam, strongest on
// the opposite side of the circle.
// ---------------------------------------------------------------------------

const GYRO_SWEEP_HEAD_A = 0.12
const GYRO_SWEEP_TAIL_A = -0.48
const GYRO_RING_SEGS = 96
const GYRO_BEAM_PTS = 20

const _gBeamW = new THREE.Vector3()
const _gCellW = new THREE.Vector3()
const _gC0 = new THREE.Color()
const _gC1 = new THREE.Color()
const _gBeamDim = new THREE.Color()
const _gBeamHot = new THREE.Color()

type GyroRingConfig = {
  phase: number
  speed: number
  /** Euler rotation of the orrery group (r2 / r3 tilt) */
  ringInit: [number, number, number]
  /** Slow spin of the whole ring/tumble */
  ringSpin: (g: THREE.Group, dt: number) => void
  /** Max opacity (matches former line material opacity) */
  opacityBase: number
}

function GyroscopeRing({ radius, baseColour, theme, mandalRootRef, cfg }: { radius: number; baseColour: string; theme: 'dark' | 'light'; mandalRootRef: RefObject<THREE.Group | null>; cfg: GyroRingConfig }) {
  const { phase, speed, ringInit, ringSpin, opacityBase } = cfg
  const ringG = useRef<THREE.Group>(null)
  const innerG = useRef<THREE.Group>(null)
  const baseC = useMemo(() => new THREE.Color(baseColour), [baseColour])

  const { circleGeom, beamGeom, nSeg } = useMemo(() => {
    const n = GYRO_RING_SEGS
    const pts = new Float32Array(n * 3)
    const cols = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const w = fbmPerlin3(3.1, i * 0.14, radius * 2.2, 2) * 0.044
      const rP = radius * (1 + fbmPerlin3(1.7, i * 0.18, radius, 2) * 0.02)
      pts[i * 3] = Math.cos(a + w) * rP
      pts[i * 3 + 1] = 0
      pts[i * 3 + 2] = Math.sin(a + w) * rP
      cols[i * 3] = 0.2
      cols[i * 3 + 1] = 0.2
      cols[i * 3 + 2] = 0.3
    }
    const gRing = new THREE.BufferGeometry()
    gRing.setAttribute('position', new THREE.BufferAttribute(pts, 3))
    gRing.setAttribute('color', new THREE.BufferAttribute(cols, 3))

    const nPts = GYRO_BEAM_PTS
    const nSeg0 = nPts - 1
    const positions = new Float32Array(nSeg0 * 6)
    const bcols = new Float32Array(nSeg0 * 6)
    for (let i = 0; i < nSeg0; i++) {
      const t0 = i / (nPts - 1)
      const t1 = (i + 1) / (nPts - 1)
      const w0 = fbmPerlin3(2.3, i * 0.21, 0, 2) * 0.03
      const w1 = fbmPerlin3(2.3, (i + 0.7) * 0.21, 0.2, 2) * 0.03
      const a0 = GYRO_SWEEP_TAIL_A + (GYRO_SWEEP_HEAD_A - GYRO_SWEEP_TAIL_A) * t0 + w0
      const a1 = GYRO_SWEEP_TAIL_A + (GYRO_SWEEP_HEAD_A - GYRO_SWEEP_TAIL_A) * t1 + w1
      const b = i * 6
      const r0 = radius * (1 + fbmPerlin3(0.4, i * 0.3, 1, 2) * 0.018)
      const r1 = radius * (1 + fbmPerlin3(0.4, (i + 1) * 0.3, 1, 2) * 0.018)
      positions[b] = Math.cos(a0) * r0
      positions[b + 1] = 0
      positions[b + 2] = Math.sin(a0) * r0
      positions[b + 3] = Math.cos(a1) * r1
      positions[b + 4] = 0
      positions[b + 5] = Math.sin(a1) * r1
      bcols[b] = 0
      bcols[b + 1] = 0
      bcols[b + 2] = 0
      bcols[b + 3] = 0
      bcols[b + 4] = 0
      bcols[b + 5] = 0
    }
    const gBeam = new THREE.BufferGeometry()
    gBeam.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    gBeam.setAttribute('color', new THREE.BufferAttribute(bcols, 3))
    return { circleGeom: gRing, beamGeom: gBeam, nSeg: nSeg0 }
  }, [radius])

  useEffect(
    () => () => {
      circleGeom.dispose()
      beamGeom.dispose()
    },
    [circleGeom, beamGeom],
  )

  const whiteTip = useMemo(
    () => (theme === 'dark' ? new THREE.Color('#e8f0ff') : new THREE.Color(baseColour)),
    [baseColour, theme],
  )

  useFrame((_, dt) => {
    const rg = ringG.current
    const inner = innerG.current
    const root = mandalRootRef.current
    if (!rg || !inner || !root) return

    ringSpin(rg, dt)
    inner.rotation.y += speed * dt

    const γ = GYRO_SWEEP_HEAD_A + inner.rotation.y + phase
    const n = GYRO_RING_SEGS
    const kMin = opacityBase * 0.1
    const kMax = opacityBase
    const colAttr = circleGeom.getAttribute('color') as THREE.BufferAttribute
    const o = colAttr.array as Float32Array
    const posAttr = circleGeom.getAttribute('position') as THREE.BufferAttribute
    const pa = posAttr.array as Float32Array
    for (let i = 0; i < n; i++) {
      const α = Math.atan2(pa[i * 3 + 2]!, pa[i * 3]!)
      const raw = 0.5 * (1 - Math.cos(α - γ))
      const t = THREE.MathUtils.clamp(
        (raw - 0.05) / 0.9,
        0,
        1,
      )
      const k = kMin + (kMax - kMin) * t
      o[i * 3] = baseC.r * k
      o[i * 3 + 1] = baseC.g * k
      o[i * 3 + 2] = baseC.b * k
    }
    colAttr.needsUpdate = true

    _gBeamW.set(Math.cos(γ), 0, Math.sin(γ))
    _gBeamW.transformDirection(rg.matrixWorld)
    _gBeamW.normalize()

    let bestKey: CategoryKey = KEYS[0]!
    let bestDot = -Infinity
    for (let i = 0; i < 6; i++) {
      const d0 = CELL_DIRECTIONS[i]!
      _gCellW.set(d0[0], d0[1], d0[2])
      _gCellW.transformDirection(root.matrixWorld)
      const d = _gBeamW.dot(_gCellW)
      if (d > bestDot) {
        bestDot = d
        bestKey = KEYS[i]!
      }
    }
    const catHex = ARM_COLOURS[bestKey]
    _gBeamDim.set(catHex)
    _gBeamDim.multiplyScalar(theme === 'dark' ? 0.1 : 0.09)
    _gBeamHot.set(catHex)
    _gBeamHot.lerp(whiteTip, theme === 'dark' ? 0.5 : 0.12)

    const bAttr = beamGeom.getAttribute('color') as THREE.BufferAttribute
    const bo = bAttr.array as Float32Array
    const nPts = GYRO_BEAM_PTS
    for (let i = 0; i < nSeg; i++) {
      const t0 = i / (nPts - 1)
      const t1 = (i + 1) / (nPts - 1)
      const w0 = t0 ** 1.35
      const w1 = t1 ** 1.35
      _gC0.copy(_gBeamDim).lerp(_gBeamHot, w0)
      _gC1.copy(_gBeamDim).lerp(_gBeamHot, w1)
      const b = i * 6
      bo[b] = _gC0.r
      bo[b + 1] = _gC0.g
      bo[b + 2] = _gC0.b
      bo[b + 3] = _gC1.r
      bo[b + 4] = _gC1.g
      bo[b + 5] = _gC1.b
    }
    bAttr.needsUpdate = true
  })

  return (
    <group ref={ringG} rotation={ringInit}>
      <lineLoop geometry={circleGeom}>
        <lineBasicMaterial
          color="#ffffff"
          transparent
          opacity={1}
          depthWrite={false}
          toneMapped
          vertexColors
        />
      </lineLoop>
      <group rotation={[0, phase, 0]}>
        <group ref={innerG}>
          <lineSegments geometry={beamGeom}>
            <lineBasicMaterial
              color="#ffffff"
              transparent
              opacity={theme === 'dark' ? 0.9 : 0.52}
              blending={theme === 'dark' ? THREE.AdditiveBlending : THREE.NormalBlending}
              depthWrite={false}
              toneMapped
              vertexColors
            />
          </lineSegments>
        </group>
      </group>
    </group>
  )
}

function GyroscopeRings({
  radius,
  colour,
  theme,
  mandalRootRef,
}: {
  radius: number
  colour: string
  theme: 'dark' | 'light'
  mandalRootRef: RefObject<THREE.Group | null>
}) {
  return (
    <>
      <GyroscopeRing
        key="g1"
        radius={radius}
        baseColour={colour}
        theme={theme}
        mandalRootRef={mandalRootRef}
        cfg={{
          phase: 0,
          speed: 0.64,
          ringInit: [0, 0, 0],
          ringSpin: (g, t) => { g.rotation.y += t * 0.05 },
          opacityBase: 0.34,
        }}
      />
      <GyroscopeRing
        key="g2"
        radius={radius}
        baseColour={colour}
        theme={theme}
        mandalRootRef={mandalRootRef}
        cfg={{
          phase: 2.15,
          speed: 0.52,
          ringInit: [Math.PI / 3, 0, 0],
          ringSpin: (g, t) => { g.rotation.z -= t * 0.032 },
          opacityBase: 0.3,
        }}
      />
      <GyroscopeRing
        key="g3"
        radius={radius}
        baseColour={colour}
        theme={theme}
        mandalRootRef={mandalRootRef}
        cfg={{
          phase: 4.3,
          speed: 0.57,
          ringInit: [0, 0, Math.PI / 3],
          ringSpin: (g, t) => { g.rotation.x += t * 0.041 },
          opacityBase: 0.26,
        }}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Shard — faint glass shell (depth / raycast) + batched wiremesh contours
// ---------------------------------------------------------------------------

type ShardProps = {
  spec: ShardSpec
  baseColour: string
  /** Category anchor for heatmap (same as baseColour) */
  theme: 'dark' | 'light'
  /** Raw 0..1000 category score; boosts stack subdivision and line count. */
  rawScore: number
  seed: number
  ghost: boolean
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void
}

function Shard({
  spec,
  baseColour,
  theme,
  rawScore,
  seed,
  ghost,
  onPointerDown,
  onPointerOver,
  onPointerOut,
}: ShardProps) {
  const lightPrint = theme === 'light' && LIGHT_PRINT_LOOK
  const noiseKey = seed * 0.13 + spec.depth * 0.9 + spec.length * 0.02
  const detailT = useMemo(() => scoreToDetailT(rawScore), [rawScore])
  const ringSeg = useMemo(() => {
    const base = spec.depth === 0 ? 8 : spec.depth === 3 ? 2 : 4
    const extra = Math.floor(detailT * 4) + (spec.depth === 0 ? 2 : 0) + (spec.depth === 3 ? 0 : 1)
    return Math.min(12, base + extra)
  }, [spec.depth, detailT])

  const geometry = useMemo(
    () => makeShardGeometry(spec.length, spec.baseW, spec.tipW, noiseKey, theme, ringSeg),
    [spec.length, spec.baseW, spec.tipW, noiseKey, theme, ringSeg],
  )
  useEffect(() => () => geometry.dispose(), [geometry])

  const body = useMemo(
    () =>
      theme === 'light'
        ? baseColour
        : deepen(baseColour, ghost ? 0.35 : 0.3 - spec.depth * 0.04),
    [baseColour, spec.depth, ghost, theme],
  )
  const useMatteSolid = useMemo(
    () => lightPrint && !ghost && fract01(seed * 12.9898) > 0.82,
    [lightPrint, ghost, seed],
  )
  const showHalftonePatch = useMemo(
    () => lightPrint && !ghost && !useMatteSolid && fract01(seed * 1.1 + 2.3) > 0.35,
    [lightPrint, ghost, useMatteSolid, seed],
  )
  const showSplatterBurst = useMemo(
    () => lightPrint && !ghost,
    [lightPrint, ghost],
  )
  const halftoneTex = useMemo(() => {
    if (theme !== 'light' || !showHalftonePatch) return null
    const t = getHalftonePatchTexture().clone()
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.offset.set(fract01(seed * 3.1), fract01(seed * 4.2))
    t.center.set(0.5, 0.5)
    t.rotation = (fract01(seed * 1.3) - 0.5) * Math.PI
    t.repeat.set(1.3 + fract01(seed) * 0.6, 1.3 + fract01(seed * 1.1) * 0.6)
    t.needsUpdate = true
    return t
  }, [theme, showHalftonePatch, seed])
  const matteWireGeometry = useMemo(
    () => (useMatteSolid ? new THREE.WireframeGeometry(geometry) : null),
    [useMatteSolid, geometry],
  )
  useEffect(() => () => matteWireGeometry?.dispose(), [matteWireGeometry])
  useEffect(() => () => halftoneTex?.dispose(), [halftoneTex])

  const meshRef = useRef<THREE.Mesh>(null)
  const catIridUniformsRef = useRef<Record<string, THREE.IUniform> | null>(null)

  /** View-dependent "oil slick" on the glass that stays in the sub-category colour (multiplies uCatCol). */
  const onBeforeCompileCategoryIrid = useCallback(
    (shader: { fragmentShader: string; uniforms: Record<string, THREE.IUniform> }) => {
      const c = new THREE.Color(baseColour)
      shader.uniforms.uCatCol = { value: new THREE.Vector3(c.r, c.g, c.b) }
      shader.uniforms.uIridSeed = { value: fract01(seed * 21.1) * 6.2831853 }
      shader.uniforms.uIridTime = { value: 0 }
      shader.uniforms.uIridBoost = { value: ghost ? 0.22 : 0.4 }
      catIridUniformsRef.current = shader.uniforms

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
uniform vec3 uCatCol;
uniform float uIridSeed;
uniform float uIridTime;
uniform float uIridBoost;`,
      )

      const iridBlock = `	{
		vec3 N = normalize( geometryNormal );
		vec3 V = normalize( geometryViewDir );
		float cosNV = clamp( abs( dot( N, V ) ), 0.0, 1.0 );
		float rim = pow( 1.0 - cosNV, 16.0 );
		float ph = uIridSeed + uIridTime * 0.12 + dot( N, vec3( 1.6, 2.1, 0.8 ) ) * 1.5;
		vec3 w = vec3(
			0.62 + 0.38 * cos( ph ),
			0.62 + 0.38 * cos( ph + 2.0943951 ),
			0.62 + 0.38 * cos( ph + 4.1887902 )
		);
		vec3 film = uCatCol * w;
		outgoingLight += uIridBoost * rim * film;
	}`

      const re =
        /vec3\s+outgoingLight\s*=\s*totalDiffuse\s*\+\s*totalSpecular\s*\+\s*totalEmissiveRadiance;/
      if (re.test(shader.fragmentShader)) {
        shader.fragmentShader = shader.fragmentShader.replace(
          re,
          `vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;${iridBlock}`,
        )
      } else {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <opaque_fragment>',
          `${iridBlock}
	#include <opaque_fragment>`,
        )
      }
    },
    [baseColour, ghost, seed],
  )

  useLayoutEffect(() => {
    const u = catIridUniformsRef.current
    if (!u?.uCatCol) return
    const col = new THREE.Color(baseColour)
    ;(u.uCatCol.value as THREE.Vector3).set(col.r, col.g, col.b)
  }, [baseColour])

  useFrame(({ clock }) => {
    const m = meshRef.current
    if (!m) return
    if (theme === 'light') {
      m.scale.setScalar(1)
      const t = catIridUniformsRef.current?.uIridTime
      if (t) t.value = clock.getElapsedTime()
      return
    }
    const t = clock.getElapsedTime()
    const s = 1 + noise3(seed, seed * 0.7, seed * 1.3, t * 0.9) * 0.014
    m.scale.setScalar(s)
  })

  return (
    <group position={spec.pos} rotation={spec.euler}>
      {theme === 'dark' ? (
      <mesh
        ref={meshRef}
        geometry={geometry}
        onPointerDown={onPointerDown}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        <meshStandardMaterial
          color={body}
          transparent
          opacity={ghost ? 0.06 : 0.04}
          metalness={0.08}
          roughness={0.4}
          emissive={body}
          emissiveIntensity={ghost ? 0.02 : 0.03}
          depthWrite={!ghost}
          depthTest
          toneMapped
          side={THREE.DoubleSide}
        />
      </mesh>
      ) : (
        <>
          {lightPrint ? (
            <PyramidSilhouetteOutline geometry={geometry} spec={spec} seed={seed} ghost={ghost} />
          ) : null}
          {/* Glass-fill panel: vibrant category color, semi-transparent */}
          <mesh
            ref={meshRef}
        geometry={geometry}
            onPointerDown={onPointerDown}
            onPointerOver={onPointerOver}
            onPointerOut={onPointerOut}
          >
            {lightPrint ? (
              <meshStandardMaterial
                color={body}
                transparent={!useMatteSolid}
                opacity={useMatteSolid ? 0.9 : ghost ? 0.08 : 0.52}
                metalness={0}
                roughness={0.88}
                emissive="#000000"
                emissiveIntensity={0}
                depthWrite={!ghost}
                depthTest
                toneMapped={false}
                side={THREE.DoubleSide}
                onBeforeCompile={onBeforeCompileCategoryIrid}
              />
            ) : (
              <meshStandardMaterial
                color={body}
                transparent={!useMatteSolid}
                opacity={useMatteSolid ? 0.9 : ghost ? 0.08 : 0.52}
                metalness={0}
                roughness={1}
                emissive="#000000"
                emissiveIntensity={0}
                depthWrite={!ghost}
                depthTest
                toneMapped={false}
                side={THREE.DoubleSide}
              />
            )}
          </mesh>
          {useMatteSolid && matteWireGeometry ? (
            <lineSegments geometry={matteWireGeometry} renderOrder={5}>
              <lineBasicMaterial color={OUTLINE_COLOUR_LIGHT} transparent opacity={0.18} depthWrite={false} toneMapped={false} />
            </lineSegments>
          ) : null}
          {!useMatteSolid ? (
            <>
              {/* Halftone dot grid — subtle dark texture on surface */}
              {showHalftonePatch && halftoneTex ? (
                <mesh geometry={geometry} renderOrder={3}>
                  <meshBasicMaterial
                    color={OUTLINE_COLOUR_LIGHT}
                    alphaMap={halftoneTex}
                    transparent
                    opacity={ghost ? 0.1 : 0.2}
                    depthWrite={false}
                    depthTest
                    polygonOffset
                    polygonOffsetFactor={-1.5}
                    polygonOffsetUnits={-1.5}
                    toneMapped={false}
                    side={THREE.FrontSide}
                  />
                </mesh>
              ) : null}
              {/* White specular stipples at lit vertices */}
              <WhiteStipples geometry={geometry} seed={seed} ghost={ghost} />
              {/* External paint-splatter bubbles with RGB fringes */}
              {showSplatterBurst ? (
                <SplatterBurst spec={spec} baseColour={baseColour} seed={seed} />
              ) : null}
            </>
          ) : null}
        </>
      )}
      {theme === 'light' && lightPrint ? (
        <LightEdgeContour geometry={geometry} spec={spec} baseHex={baseColour} ghost={ghost} seed={seed} />
      ) : (
        <ContourWireMesh geometry={geometry} spec={spec} baseHex={baseColour} theme={theme} ghost={ghost} seed={seed} />
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------
// FractalCell — one category's recursive cluster, rotated so +Z points outward
// ---------------------------------------------------------------------------

type FractalCellProps = {
  category: CategoryKey
  direction: readonly [number, number, number] // unit vector cell points along
  score: number
  expansionRef: React.MutableRefObject<number> // shared 0..1 spring
  /** Theme (heatmap + shell read). */
  theme: 'dark' | 'light'
  ghost: boolean
  onSelect: () => void
  onHover: (hovered: boolean) => void
  selected: boolean
}

function FractalCell({
  category,
  direction,
  score,
  expansionRef,
  theme,
  ghost,
  onSelect,
  onHover,
  selected,
}: FractalCellProps) {
  const depth = useMemo(() => {
    let d = scoreToDepth(score)
    if (theme === 'light') d = Math.max(0, d - 1)
    return ghost ? Math.min(1, d) : d
  }, [score, ghost, theme])

  const armLen = useMemo(() => scoreToArmLen(score), [score])

  // Stable seed per cell so jitter and sub-spec placement don't churn.
  const seed = useMemo(() => {
    let h = 0
    for (const c of category) h = (h * 31 + c.charCodeAt(0)) >>> 0
    return (h % 1000) / 17
  }, [category])

  const specs = useMemo(
    () => buildCellSpecs(depth, armLen, seed, score, theme),
    [depth, armLen, seed, score, theme],
  )

  const baseColour = armColourForTheme(category, theme)
  const groupRef = useRef<THREE.Group>(null)
  const spinRef = useRef<THREE.Group>(null)
  const spinRate = useMemo(() => {
    let h = 0
    for (const c of category) h = (h * 31 + c.charCodeAt(0)) >>> 0
    return 0.04 + (h % 100) * 0.0008
  }, [category])

  // Orient the cell's local +Z to point along `direction` (from origin outward).
  // Every shard inside the cell extrudes along +Z, so this rotation alone
  // distributes them across the 3D antiprism without touching their specs.
  const orientationQuat = useMemo(() => {
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(direction[0], direction[1], direction[2]).normalize(),
    )
    return q
  }, [direction[0], direction[1], direction[2]])

  // Self-spin + click-expand along +Z; expansion spring avoids React renders.
  useFrame((_, delta) => {
    const spin = spinRef.current
    if (spin) spin.rotation.z += delta * spinRate
    const g = groupRef.current
    if (!g) return
    const exp = expansionRef.current
    g.position.set(0, 0, exp * armLen * 0.18)
    const s = selected ? 1.05 : 1
    g.scale.setScalar(s)
  })

  return (
    <group quaternion={orientationQuat}>
      <group ref={spinRef}>
        <group ref={groupRef}>
          {specs.map((spec, idx) => (
            <Shard
              key={idx}
              spec={spec}
              baseColour={baseColour}
              theme={theme}
              rawScore={score}
              seed={seed + idx * 0.37}
              ghost={ghost}
              onPointerDown={(e) => {
                e.stopPropagation()
                onSelect()
              }}
              onPointerOver={(e) => {
                e.stopPropagation()
                onHover(true)
              }}
              onPointerOut={() => onHover(false)}
            />
          ))}
          <ShardConnectors specs={specs} colour={baseColour} armLen={armLen} theme={theme} />
          <CellParticles armLen={armLen} colour={baseColour} seed={seed} ghost={ghost} score={score} theme={theme} />
          <CoreRegionBubbles armLen={armLen} colour={baseColour} seed={seed} ghost={ghost} theme={theme} />
        </group>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Mandala — six cells + rotation + wobble + click-expand spring
// ---------------------------------------------------------------------------

type MandalaProps = {
  categories?: Partial<ReputationCategories>
  recentCategories?: Partial<ReputationCategories>
  theme: 'dark' | 'light'
  selected: CategoryKey | null
  onSelect: (key: CategoryKey) => void
  clickToken: number // increments on every click — Mandala captures own time
}

function Mandala({
  categories,
  recentCategories,
  theme,
  selected,
  onSelect,
  clickToken,
}: MandalaProps) {
  const rootRef = useRef<THREE.Group>(null)

  // Capture pulse start in the same clock space as useFrame.
  const pulseStartRef = useRef<number>(-1)
  const lastTokenRef = useRef<number>(clickToken)
  // Shared expansion value — cells read this per frame (no React state).
  const expansionRef = useRef(0)

  useFrame(({ clock }) => {
    const root = rootRef.current
    if (!root) return
    const t = clock.getElapsedTime()

    // Slow rotation around Y — the kinetic spine of the piece.
    root.rotation.y = t * 0.065

    // Irregular wobble: a small field driven by incommensurate sines.
    if (theme === 'light') {
      root.position.set(0, 0, 0)
      root.rotation.x = 0
      root.rotation.z = 0
    } else {
    root.position.x = noise3(0.1, 0.2, 0.3, t * 0.31) * 0.045
    root.position.y = noise3(1.1, 1.7, 0.9, t * 0.23 + 1.7) * 0.03
    root.position.z = noise3(2.3, 0.7, 1.9, t * 0.27 + 3.2) * 0.025
    // Whisper of tilt so the whole mandala breathes.
    root.rotation.x = noise3(3.1, 2.1, 1.1, t * 0.19) * 0.04
    root.rotation.z = noise3(4.1, 3.3, 2.5, t * 0.17 + 2.9) * 0.035
    }

    // Detect a new click from the parent and timestamp it in our clock.
    if (clickToken !== lastTokenRef.current) {
      lastTokenRef.current = clickToken
      pulseStartRef.current = t
    }

    // Click expansion spring — fast rise (~120 ms) then slow ease-out.
    const pulseStart = pulseStartRef.current
    let e = 0
    if (pulseStart >= 0) {
      const age = t - pulseStart
      if (age >= 0 && age < 1.15) {
        const rise = Math.min(1, age / 0.12)
        const fall = age < 0.12 ? 1 : Math.max(0, 1 - (age - 0.12) / 1.0)
        e = rise * fall
      } else if (age >= 1.15) {
        pulseStartRef.current = -1
      }
    }
    expansionRef.current = e
  })

  return (
    <group>
      <ambientLight intensity={theme === 'dark' ? 0.14 : 0.2} />
      <directionalLight position={[3, 4.5, 3]} intensity={theme === 'dark' ? 0.35 : 0.2} color="#ffffff" />
      <directionalLight position={[-2.5, -1.5, -2.5]} intensity={theme === 'dark' ? 0.1 : 0.05} color="#aab4d6" />
      <pointLight
        position={[0, 0.3, 0]}
        color={theme === 'dark' ? '#ffffff' : '#fff4d0'}
        intensity={theme === 'dark' ? 0.2 : 0}
        distance={2.6}
        decay={2}
      />
      {/* Soft category-coloured rim lights, one per antiprism pole, so each
          cell gets a coloured fill from its own direction (keep low to avoid
          HDRI-like blowout with bloom). */}
      {theme === 'dark' ? KEYS.map((k, i) => {
        const d = CELL_DIRECTIONS[i]!
        return (
          <pointLight
            key={k}
            position={[d[0] * 1.15, d[1] * 1.15, d[2] * 1.15]}
            color={armColourForTheme(k, theme)}
            intensity={0.08}
            distance={1.8}
            decay={2}
          />
        )
      }) : null}

      <group ref={rootRef}>
        {/* Architectural reference frame — three slowly counter-rotating
            wireframe rings at different tilts (orrery / astrolabe feel). */}
        {theme === 'dark' ? (
        <GyroscopeRings
          radius={1.35}
            colour="#8a8ab0"
          theme={theme}
          mandalRootRef={rootRef}
        />
        ) : null}

        {/* Ghost (90-day) mandala — smaller, translucent, depth-clamped. */}
        {recentCategories
          ? (
              <group scale={0.58} position={[0, 0, 0]}>
                {KEYS.map((k, i) => {
                  const dir = CELL_DIRECTIONS[i]!
                  const raw = Number(recentCategories?.[k] ?? 0)
                  return (
                    <FractalCell
                      key={`ghost-${k}`}
                      category={k}
                      direction={dir}
                      score={raw}
                      expansionRef={expansionRef}
                      theme={theme}
                      ghost
                      selected={false}
                      onHover={() => {}}
                      onSelect={() => {}}
                    />
                  )
                })}
              </group>
            )
          : null}

        {/* Main mandala. */}
        {KEYS.map((k, i) => {
          const dir = CELL_DIRECTIONS[i]!
          const raw = Number(categories?.[k] ?? 0)
          return (
            <FractalCell
              key={k}
              category={k}
              direction={dir}
              score={raw}
              expansionRef={expansionRef}
              theme={theme}
              ghost={false}
              selected={selected === k}
              onHover={(h) => {
                document.body.style.cursor = h ? 'pointer' : ''
              }}
              onSelect={() => onSelect(k)}
            />
          )
        })}
      </group>
    </group>
  )
}

/**
 * Post-process RGB split for **dark** theme only (composer not mounted in light mode).
 * Light mode uses per-shard `chromaARef` / `chromaBRef` mesh slips only—no full-frame aberration.
 */
function ChromaticMisregistration() {
  const offsetRef = useRef(new THREE.Vector2(CRYSTAL_CHROMA_OFFSET.x, CRYSTAL_CHROMA_OFFSET.y))
  useFrame(() => {
    offsetRef.current.copy(CRYSTAL_CHROMA_OFFSET)
  })
  return (
    <ChromaticAberration
      blendFunction={BlendFunction.NORMAL}
      offset={offsetRef.current}
      radialModulation
      modulationOffset={0.06}
    />
  )
}

// ---------------------------------------------------------------------------
// CrystalRadar3D — public component (API preserved)
// ---------------------------------------------------------------------------

export type CrystalRadarProps = {
  categories?: Partial<ReputationCategories>
  recentCategories?: Partial<ReputationCategories>
  /** Self profile / dashboard: total reputation (single running total, not sum of categories). */
  aggregateReputationScore?: number | null
  className?: string
  showDefinitions?: boolean
  theme?: 'dark' | 'light'
}

export function CrystalRadar3D({
  categories,
  recentCategories,
  aggregateReputationScore,
  className = '',
  showDefinitions = false,
  theme = 'dark',
}: CrystalRadarProps) {
  const viewRootRef = useRef<HTMLDivElement>(null)
  /** Don't even mount the Canvas until it's near the viewport — keeps initial page paint fast. */
  const [everInView, setEverInView] = useState(false)
  /** Stop the R3F loop when scrolled off-screen or tab in background. */
  const [inView, setInView] = useState(false)
  const [tabVisible, setTabVisible] = useState(
    () => (typeof document !== 'undefined' ? !document.hidden : true),
  )

  useEffect(() => {
    const t = () => setTabVisible(!document.hidden)
    document.addEventListener('visibilitychange', t)
    return () => document.removeEventListener('visibilitychange', t)
  }, [])

  useEffect(() => {
    const el = viewRootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setEverInView(true)
        setInView(e.isIntersecting)
      },
      { root: null, rootMargin: '200px 0px', threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const runLoop = inView && tabVisible

  const [selected, setSelected] = useState<CategoryKey | null>(null)
  // Bump a token on every click; Mandala captures its own frame-clock start.
  const [clickToken, setClickToken] = useState(0)
  const triggerPulse = useCallback(() => {
    setClickToken((x) => x + 1)
  }, [])

  // Derive the effective selection without an effect — if the selected key is
  // no longer present in the data, treat the drawer as closed.
  const effectiveSelected: CategoryKey | null =
    selected && categories && categories[selected] !== undefined ? selected : null

  const selectedRaw = effectiveSelected ? Number(categories?.[effectiveSelected] ?? 0) : 0
  const selectedRecent =
    effectiveSelected && recentCategories
      ? Number(recentCategories?.[effectiveSelected] ?? 0)
      : null

  const bgPanel =
    theme === 'dark'
      ? 'bg-[#0d0d1a] border-[#1a1a2e] text-white'
      : 'bg-zinc-900/75 border-white/20 text-white'
  const mutedText = 'text-white/90'
  const subtleText = 'text-white/95'

  const handleSelect = useCallback(
    (key: CategoryKey) => {
      setSelected((prev) => (prev === key ? null : key))
      triggerPulse()
    },
    [triggerPulse],
  )

  return (
    <div ref={viewRootRef} className={`relative overflow-visible ${className}`}>
      {/* Large square viewport; overflow visible on parents so layout never clips the art.
          Camera is pulled back so gyro rings + mandala stay fully in frame. */}
      <div
        className="mx-auto aspect-square w-full max-w-[min(100%,42rem)] overflow-visible bg-transparent sm:max-w-[44rem]"
        data-target-cursor-exclude=""
      >
        {everInView && (
        <Canvas
          className="!h-full !w-full touch-none"
          frameloop={runLoop ? 'always' : 'never'}
          style={{ display: 'block', overflow: 'visible' }}
          camera={{ position: [0, 0.88, 3.75], fov: 48 }}
          dpr={1}
          gl={{
            antialias: false,
            alpha: true,
            premultipliedAlpha: true,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: theme === 'dark' ? 0.45 : 0.5,
            outputColorSpace: THREE.SRGBColorSpace,
            preserveDrawingBuffer: false,
            stencil: false,
            depth: true,
          }}
          onPointerMissed={() => setSelected(null)}
          onCreated={({ gl, scene }) => {
            scene.background = null
            gl.setClearColor(0x000000, 0)
            gl.domElement.style.background = 'transparent'
          }}
        >
          <Mandala
            categories={categories}
            recentCategories={recentCategories}
            theme={theme}
            selected={effectiveSelected}
            onSelect={handleSelect}
            clickToken={clickToken}
          />
          <OrbitControls
            enableRotate
            enablePan={false}
            enableZoom={false}
            rotateSpeed={0.55}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={(Math.PI * 3) / 5}
            enableDamping
            dampingFactor={0.12}
          />
          {theme === 'dark' ? (
          <EffectComposer enableNormalPass={false} multisampling={0}>
            <Bloom
              mipmapBlur
              luminanceThreshold={0.88}
              luminanceSmoothing={0.1}
              intensity={0.075}
              levels={4}
            />
              <ChromaticMisregistration />
            <PartialPixelation cellCount={60} patchRadius={0.12} pixelIntensity={0.82} />
          </EffectComposer>
          ) : (
            <></>
          )}
        </Canvas>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {KEYS.map((k) => {
          const isSel = effectiveSelected === k
          const cat = Math.round(Number(categories?.[k] ?? 0))
          return (
            <button
              key={k}
              type="button"
              onClick={() => handleSelect(k)}
              data-cursor-target="legend"
              className={`cursor-target flex items-center gap-1 border px-1.5 py-0.5 font-mono text-small uppercase tracking-[0.16em] transition ${
                isSel
                  ? theme === 'dark'
                    ? 'border-white bg-white/10 text-white'
                    : 'border-black bg-black text-yellow-400'
                  : theme === 'dark'
                    ? 'border-transparent text-white/80 hover:text-white'
                    : 'border-transparent text-white hover:text-white'
              }`}
              title={
                showDefinitions
                  ? `${LABELS[k]} — ${cat} / 1000. ${GLOSSARY[k] ?? ''}`
                  : `${LABELS[k]} — ${cat} / 1000 (all-time category)`
              }
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-[1px]"
                style={{ background: armColourForTheme(k, theme) }}
              />
              {LABELS[k]}
              <span className="tabular-nums normal-case tracking-normal opacity-85">{cat}</span>
            </button>
          )
        })}
      </div>

      <div
        className={`mt-2 border-t pt-2 font-mono text-small ${
          theme === 'dark' ? 'border-[#1a1a2e]' : 'border-white/20'
        }`}
      >
        <p className={`mb-1 uppercase tracking-[0.14em] ${subtleText}`}>
          Category scores (all-time, each cap 1000)
        </p>
        <ul className="space-y-0.5">
          {KEYS.map((k) => {
            const all = Math.round(Number(categories?.[k] ?? 0))
            const recent =
              recentCategories != null ? Math.round(Number(recentCategories[k] ?? 0)) : null
            return (
              <li key={k} className="flex justify-between gap-3">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-[1px]"
                    style={{ background: armColourForTheme(k, theme) }}
                  />
                  <span className={`truncate ${mutedText}`}>{LABELS[k]}</span>
                </span>
                <span className="shrink-0 tabular-nums text-right">
                  <span className={theme === 'dark' ? 'text-white' : 'text-white'}>{all}</span>
                  <span className="opacity-70"> / 1000</span>
                  {recent !== null ? (
                    <span className={`ml-2 ${subtleText}`}>· ~90d {recent}</span>
                  ) : null}
                </span>
              </li>
            )
          })}
        </ul>
        {aggregateReputationScore != null && Number.isFinite(aggregateReputationScore) ? (
          <>
            <p
              className={`mt-2 border-t pt-2 ${
                theme === 'dark' ? 'border-[#1a1a2e]' : 'border-white/20'
              } ${theme === 'dark' ? 'text-white' : 'text-white'}`}
            >
              Aggregate score:{' '}
              <strong className="tabular-nums">{Math.round(aggregateReputationScore)}</strong> / 1000
            </p>
            <p className={`mt-1 text-small font-sans font-normal normal-case leading-relaxed tracking-normal ${mutedText}`}>
              The aggregate is derived from the six category buckets (sum, then clamped to the system cap).
              Activity awards add points into a specific category; the headline score updates from those buckets.
            </p>
          </>
        ) : null}
      </div>

      {effectiveSelected ? (
        <div
          className={`mt-3 border p-3 space-y-1 text-small ${bgPanel}`}
          role="dialog"
          aria-label={`${LABELS[effectiveSelected]} detail`}
        >
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-[1px]"
              style={{ background: armColourForTheme(effectiveSelected, theme) }}
            />
            <p className="font-mono text-small uppercase tracking-[0.18em]">
              {LABELS[effectiveSelected]}
            </p>
            <button
              type="button"
              onClick={() => setSelected(null)}
              data-cursor-target="close"
              className={`cursor-target ml-auto border px-1.5 py-0.5 font-mono text-small uppercase tracking-[0.14em] ${
                theme === 'dark'
                  ? 'border-[#333355] bg-transparent text-white/80 hover:text-white'
                  : 'border-white/30 bg-zinc-900/50 text-white hover:bg-white/10'
              }`}
              aria-label="Close detail"
            >
              Close
            </button>
          </div>
          <p className="font-mono text-small">
            This category (all-time): <strong>{Math.round(selectedRaw)}</strong> / 1000
          </p>
          {selectedRecent !== null ? (
            <p className={`font-mono text-small ${subtleText}`}>
              Last ~90 d: <strong>{Math.round(selectedRecent)}</strong>
            </p>
          ) : null}
          <p className={`text-small ${subtleText}`}>{GLOSSARY[effectiveSelected] ?? ''}</p>
          <p className={`text-small italic ${mutedText}`}>{ARM_HINT[effectiveSelected]}</p>
        </div>
      ) : (
        <p className={`mt-2 font-mono text-small ${mutedText}`}>
          Drag to rotate. Tap a cell to open its detail — the mandala unfolds.
        </p>
      )}
    </div>
  )
}
