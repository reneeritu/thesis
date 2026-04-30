/**
 * Pure generative renderer for Etch provenance certificates.
 *
 * Builds a 3D Iterated Function System point cloud from `{ input, options }`
 * and mounts it in a Three.js scene the user can orbit, light, and capture.
 *
 *   - Each contributor → one transform.
 *   - Their weight   → that transform's selection probability.
 *   - Pivot count    → Z-axis twist of every transform.
 *   - Reference count → Z-axis shear.
 *   - traceCount     → Z-depth scale + raw iteration count.
 *
 * The 2D template's matrix supplies the XY plane; Z columns are synthesised
 * from project data so the same project always produces the same volumetric
 * attractor. Symmetry plots N-fold rotational copies of every chaos-game
 * point around the attractor centre.
 *
 * Output is captured as a PNG via `WebGLRenderer.toDataURL()`, which is why
 * the renderer is built with `preserveDrawingBuffer: true`.
 */

import { composeSeed, rngFromString, type Rng } from './rng'
import type { GenInput, GenOptions, GenParams } from './types'
import { RENDERER_VERSION } from './types'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// ── Seeding ────────────────────────────────────────────────────────────────

export function buildParams(input: GenInput, options: GenOptions): GenParams {
  const seed = composeSeed({
    blockHash: input.blockHash,
    projectId: input.projectId,
    rerollIndex: options.rerollIndex,
    version: RENDERER_VERSION,
  })
  return { version: RENDERER_VERSION, input, options, seed }
}

// ── Colour helpers ─────────────────────────────────────────────────────────

function hexToRgb01(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255]
}

function lerpRgb01(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]
}

function densityToColor(t: number, colors: GenOptions['colors']): THREE.Color {
  const ca = hexToRgb01(colors.a)
  const cb = hexToRgb01(colors.b)
  const cc = hexToRgb01(colors.c)
  const cd = hexToRgb01(colors.d)
  let rgb: [number, number, number]
  if (t < 0.333) rgb = lerpRgb01(ca, cb, t / 0.333)
  else if (t < 0.666) rgb = lerpRgb01(cb, cc, (t - 0.333) / 0.333)
  else rgb = lerpRgb01(cc, cd, (t - 0.666) / 0.334)
  return new THREE.Color(rgb[0], rgb[1], rgb[2])
}

// ── 3D IFS transforms ──────────────────────────────────────────────────────

type IFS3DTransform = {
  /** 3×3 matrix as a flat 9-tuple [a,b,c, d,e,f, g,h,i]. */
  m: [number, number, number, number, number, number, number, number, number]
  tx: number
  ty: number
  tz: number
  probability: number
  contributorIdx: number
}

// 2D template format: [a, b, c, d, e, f, probability]
type RawTransform2D = [number, number, number, number, number, number, number]

const IFS_TEMPLATES: Record<string, RawTransform2D[]> = {
  // Barnsley fern — organic, biological.
  fern: [
    [0, 0, 0, 0.16, 0, 0, 0.01],
    [0.85, 0.04, -0.04, 0.85, 0, 1.6, 0.85],
    [0.2, -0.26, 0.23, 0.22, 0, 1.6, 0.07],
    [-0.15, 0.28, 0.26, 0.24, 0, 0.44, 0.07],
  ],
  // Spiral — swirling, organic.
  spiral: [
    [0.787, -0.234, 0.234, 0.787, 0.088, 0.068, 0.7],
    [-0.121, 0.257, -0.257, -0.121, 0.8, 0.278, 0.15],
    [0.181, -0.136, 0.136, 0.181, 0.1, 0.4, 0.15],
  ],
  // Koch snowflake approximation — crystalline.
  koch: [
    [0.333, 0, 0, 0.333, 0, 0, 0.25],
    [0.167, -0.289, 0.289, 0.167, 0.333, 0, 0.25],
    [0.167, 0.289, -0.289, 0.167, 0.5, 0.289, 0.25],
    [0.333, 0, 0, 0.333, 0.667, 0, 0.25],
  ],
  // Sierpinski triangle — geometric.
  sierpinski: [
    [0.5, 0, 0, 0.5, 0, 0, 0.333],
    [0.5, 0, 0, 0.5, 0.5, 0, 0.333],
    [0.5, 0, 0, 0.5, 0.25, 0.5, 0.334],
  ],
  // Dragon curve — recursive.
  dragon: [
    [0.5, -0.5, 0.5, 0.5, 0, 0, 0.5],
    [-0.5, -0.5, 0.5, -0.5, 1, 0, 0.5],
  ],
  // Lévy C curve — angular.
  levy: [
    [0.5, -0.5, 0.5, 0.5, 0, 0, 0.5],
    [0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5],
  ],
}

function pickTemplate(input: GenInput): RawTransform2D[] {
  const keys = Object.keys(IFS_TEMPLATES)
  const idx =
    (input.contributors.length + input.pivotCount * 2 + input.traceCount) %
    keys.length
  return IFS_TEMPLATES[keys[idx]!]!
}

function build3DTransforms(input: GenInput, rng: Rng): IFS3DTransform[] {
  const template = pickTemplate(input)
  const contribs: { alias: string; weight?: number }[] =
    input.contributors.length > 0
      ? input.contributors
      : [{ alias: 'self', weight: 1 }]
  const totalWeight = contribs.reduce((s, c) => s + (c.weight ?? 1), 0)

  // Project data drives 3D extension.
  const zDepth = 0.3 + Math.min(1.2, input.traceCount * 0.008)
  const pivotTwist = (input.pivotCount * Math.PI) / 6
  const refShear = Math.min(0.15, input.referenceCount * 0.01)

  return template.map((raw, i) => {
    const [a, b, c, d, e, f, prob] = raw
    const contribIdx = i % contribs.length
    const cw = (contribs[contribIdx]?.weight ?? 1) / totalWeight

    // Z column: each contributor owns a different angular slice on Z.
    const zAngle = pivotTwist + contribIdx * ((Math.PI * 2) / contribs.length)
    const zScale = zDepth * (0.5 + cw * 0.8)
    const zCos = Math.cos(zAngle) * zScale
    const zSin = Math.sin(zAngle) * zScale

    // 3×3 matrix: row-major [Xx, Xy, Xz,  Yx, Yy, Yz,  Zx, Zy, Zz].
    const m: IFS3DTransform['m'] = [
      a!,
      b!,
      refShear * Math.sin(zAngle),
      c!,
      d!,
      refShear * Math.cos(zAngle),
      zSin * cw * 0.3,
      zCos * cw * 0.3,
      zCos,
    ]

    return {
      m,
      tx: e!,
      ty: f!,
      tz:
        (contribIdx / Math.max(1, contribs.length - 1) - 0.5) * zDepth * 0.4 +
        rng.range(-0.05, 0.05),
      probability: prob!,
      contributorIdx: contribIdx,
    }
  })
}

function applyTransform3D(
  t: IFS3DTransform,
  x: number,
  y: number,
  z: number,
): { x: number; y: number; z: number } {
  const [m0, m1, m2, m3, m4, m5, m6, m7, m8] = t.m
  return {
    x: m0! * x + m1! * y + m2! * z + t.tx,
    y: m3! * x + m4! * y + m5! * z + t.ty,
    z: m6! * x + m7! * y + m8! * z + t.tz,
  }
}

function pickTransform(transforms: IFS3DTransform[], r: number): IFS3DTransform {
  let acc = 0
  for (const t of transforms) {
    acc += t.probability
    if (r <= acc) return t
  }
  return transforms[transforms.length - 1]!
}

// ── Point cloud generation ─────────────────────────────────────────────────

export type IFSPointCloud = {
  /** Interleaved xyz, length = count * 3. */
  positions: Float32Array
  /** Interleaved rgb (0–1), length = count * 3. */
  colors: Float32Array
  count: number
}

/**
 * Run the chaos game in 3D with N-fold symmetry. Returns a single contiguous
 * point cloud + per-point colour buffer suitable for a BufferGeometry.
 *
 * Same `(projectId, blockHash, rerollIndex, options)` → identical buffers.
 */
export function generatePointCloud(
  input: GenInput,
  options: GenOptions,
): IFSPointCloud {
  const params = buildParams(input, options)
  const rng = rngFromString(params.seed)
  const transforms = build3DTransforms(input, rng)
  const symmetry = Math.max(1, Math.min(12, Math.round(options.symmetry)))

  const baseCount = Math.round(
    Math.min(
      60000,
      Math.max(
        18000,
        18000 + input.traceCount * 40 + input.contributors.length * 600,
      ),
    ),
  )
  const totalPoints = baseCount * symmetry

  const positions = new Float32Array(totalPoints * 3)
  const colors = new Float32Array(totalPoints * 3)

  // Warmup to find bounds — first 50 iters are pure transient.
  let px = rng.range(-0.2, 0.2)
  let py = rng.range(-0.2, 0.2)
  let pz = 0
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity

  for (let i = 0; i < 300; i++) {
    const t = pickTransform(transforms, rng.next())
    const n = applyTransform3D(t, px, py, pz)
    px = n.x
    py = n.y
    pz = n.z
    if (i > 50) {
      if (px < minX) minX = px
      if (px > maxX) maxX = px
      if (py < minY) minY = py
      if (py > maxY) maxY = py
      if (pz < minZ) minZ = pz
      if (pz > maxZ) maxZ = pz
    }
  }

  const rangeX = maxX - minX || 2
  const rangeY = maxY - minY || 2
  const rangeZ = maxZ - minZ || 1

  // Density pass: record normalised positions plus contributor index.
  // Flat number array keeps it tight without a sub-object allocation per pt.
  const rawPts: number[] = []
  for (let i = 0; i < baseCount; i++) {
    const t = pickTransform(transforms, rng.next())
    const n = applyTransform3D(t, px, py, pz)
    px = n.x
    py = n.y
    pz = n.z

    // Normalise into the [-1, 1] cube.
    const nx = ((px - minX) / rangeX) * 2 - 1
    const ny = ((py - minY) / rangeY) * 2 - 1
    const nz = ((pz - minZ) / rangeZ) * 2 - 1

    rawPts.push(nx, ny, nz, t.contributorIdx)
  }

  // Symmetry pass + colour mapping.
  let idx = 0
  const contribCount = Math.max(1, transforms.length - 1)

  for (let i = 0; i < rawPts.length; i += 4) {
    const rx = rawPts[i]!
    const ry = rawPts[i + 1]!
    const rz = rawPts[i + 2]!
    const ci = rawPts[i + 3]!

    // Radial distance from origin → density proxy, gamma-corrected.
    const dist = Math.sqrt(rx * rx + ry * ry + rz * rz)
    const densityT = Math.pow(Math.max(0, 1 - dist * 0.7), 0.45)
    const col = densityToColor(densityT, options.colors)

    for (let s = 0; s < symmetry; s++) {
      const angle = (s / symmetry) * Math.PI * 2
      const sx = rx * Math.cos(angle) - ry * Math.sin(angle)
      const sy = rx * Math.sin(angle) + ry * Math.cos(angle)

      positions[idx * 3] = sx
      positions[idx * 3 + 1] = sy
      positions[idx * 3 + 2] = rz

      // Contributor tint: slight R bias for higher contributor indices.
      const tint = (ci / contribCount) * 0.2
      colors[idx * 3] = Math.min(1, col.r + tint * 0.3)
      colors[idx * 3 + 1] = Math.min(1, col.g)
      colors[idx * 3 + 2] = Math.min(1, col.b + tint * 0.15)

      idx++
    }
  }

  return { positions, colors, count: idx }
}

// ── Three.js scene factory ────────────────────────────────────────────────

export type IFSSceneHandle = {
  canvas: HTMLCanvasElement
  dispose: () => void
  /** Captures the current viewport as a PNG data URL. */
  capture: () => string
  /** Updates options live without rebuilding the renderer. */
  setOptions: (opts: Partial<GenOptions>) => void
}

/**
 * Mount a live Three.js scene rendering the IFS point cloud into `container`.
 * The returned handle owns the WebGL renderer, scene graph, animation loop,
 * and resize observer — call `.dispose()` on unmount to free everything.
 */
export function createIFSScene(
  container: HTMLElement,
  input: GenInput,
  options: GenOptions,
): IFSSceneHandle {
  const W = container.clientWidth || 800
  const H = container.clientHeight || 800

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    // Required for toDataURL() — without it the canvas is cleared between
    // frames and reads back as blank.
    preserveDrawingBuffer: true,
    alpha: false,
  })
  renderer.setSize(W, H)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(options.colors.bg)

  const camera = new THREE.PerspectiveCamera(60, W / H, 0.01, 100)
  camera.position.set(0, 0, 3.5)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.autoRotate = options.camera.autoRotate
  controls.autoRotateSpeed = options.camera.rotateSpeed

  // Mutable closure that tracks the *currently applied* options across
  // successive setOptions calls. The initial value is the passed-in options.
  let currentOptions: GenOptions = options

  let geometry: THREE.BufferGeometry = new THREE.BufferGeometry()
  let points: THREE.Points | null = null

  function buildPoints(opts: GenOptions) {
    if (points) {
      scene.remove(points)
      geometry.dispose()
      if (points.material instanceof THREE.Material) points.material.dispose()
    }

    const cloud = generatePointCloud(input, opts)
    geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(cloud.positions.slice(0, cloud.count * 3), 3),
    )
    geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(cloud.colors.slice(0, cloud.count * 3), 3),
    )

    const mat = new THREE.PointsMaterial({
      size: 0.008 + opts.effects.bloom * 0.006,
      vertexColors: true,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.85 + opts.effects.bloom * 0.15,
      depthWrite: false,
    })

    points = new THREE.Points(geometry, mat)
    scene.add(points)
    scene.background = new THREE.Color(opts.colors.bg)
    controls.autoRotate = opts.camera.autoRotate
    controls.autoRotateSpeed = opts.camera.rotateSpeed
  }

  buildPoints(options)

  // rAF animation loop.
  let animId = 0
  function animate() {
    animId = requestAnimationFrame(animate)
    controls.update()
    renderer.render(scene, camera)
  }
  animate()

  // Track container size — Three.js needs explicit resize calls.
  function onResize() {
    const w = container.clientWidth
    const h = container.clientHeight
    if (w === 0 || h === 0) return
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  }
  const ro = new ResizeObserver(onResize)
  ro.observe(container)

  return {
    canvas: renderer.domElement,
    dispose: () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
      controls.dispose()
      geometry.dispose()
      if (points?.material instanceof THREE.Material) points.material.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    },
    capture: () => {
      renderer.render(scene, camera)
      return renderer.domElement.toDataURL('image/png')
    },
    setOptions: (opts: Partial<GenOptions>) => {
      const merged: GenOptions = {
        ...currentOptions,
        ...opts,
        colors: { ...currentOptions.colors, ...(opts.colors ?? {}) },
        effects: { ...currentOptions.effects, ...(opts.effects ?? {}) },
        camera: { ...currentOptions.camera, ...(opts.camera ?? {}) },
      }
      currentOptions = merged
      buildPoints(merged)
    },
  }
}

// ── Compatibility stub ────────────────────────────────────────────────────
//
// The previous engine exported `renderSvg`. A handful of historic call sites
// still try to import it; this returns a trivial empty SVG so they keep
// type-checking until they're migrated to the new Three.js flow.
export function renderSvg(_input: GenInput, _options: GenOptions): string {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>'
}
