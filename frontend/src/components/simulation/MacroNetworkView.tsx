import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import { Bloom, ChromaticAberration, EffectComposer } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'
import { LineMaterial, LineSegments2, LineSegmentsGeometry } from 'three-stdlib'
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react'
import {
  simEntityApi,
  type SimEvent,
  type SimNodeSummary,
  type SimProjectSummary,
  type SimSpaceSummary,
} from '../../lib/simApi'

export type Selection =
  | { kind: 'space'; id: string }
  | { kind: 'node'; alias: string }
  | { kind: 'project'; id: string }
  | null

type Props = {
  spaceIds: string[]
  heroAliases: string[]
  projectIds: string[]
  events: SimEvent[]
  selection: Selection
  onSelect: (s: Selection) => void
  /** Ghost mode: desaturated, low-opacity nodes for Act 1 */
  ghostMode?: boolean
}

const Y_FLATTEN = 0.4

/** Fibonacci sphere — tighter radius, shallow Y so reads as a flat-ish constellation. */
function fibonacciSphere(i: number, n: number, radius = 3.2) {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  const y = 1 - (i / Math.max(1, n - 1)) * 2
  const r = Math.sqrt(1 - y * y)
  const theta = goldenAngle * i
  const rx = Math.cos(theta) * r * radius
  const ry = y * radius * Y_FLATTEN
  const rz = Math.sin(theta) * r * radius
  return [rx, ry, rz] as const
}

function hash01(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return (h % 10000) / 10000
}

function normKind(k: string) {
  return k.toLowerCase()
}

/** Act II edge: blend space purple ↔ identity white (membership edges). */
const EDGE_ACT_II_HEX = new THREE.Color('#a78bfa').lerp(new THREE.Color('#f0f0ee'), 0.5).getHex()
const EDGE_GHOST_HEX = new THREE.Color('#1e1e3a').getHex()

const SPACE_PURPLE = '#a78bfa'
const PROJECT_CYAN = '#67e8f9'
const IDENTITY_LIGHT = '#f0f0ee'

/** Shard geometry per variant (visual hierarchy). */
const SHARD = {
  space: { radius: 0.32, detail: 1 as const, outerRingRadius: 0.48, outerRingDetail: 0 as const },
  project: { radius: 0.18, detail: 1 as const },
  identity: { radius: 0.1, detail: 0 as const },
}

function pulseScale(now: number, key: string, pulseAt: Map<string, number>) {
  const t = pulseAt.get(key)
  if (t == null) return 1
  const age = (now - t) / 1000
  if (age >= 1) return 1
  return 1 + 0.3 * (1 - age) * Math.sin(age * Math.PI)
}

const icosahedronGeomCache = new Map<string, THREE.IcosahedronGeometry>()
const wireframeIcosaCache = new Map<string, THREE.WireframeGeometry>()

function getIcosahedronGeometry(radius: number, detail: number) {
  const key = `${radius}:${detail}`
  let g = icosahedronGeomCache.get(key)
  if (!g) {
    g = new THREE.IcosahedronGeometry(radius, detail)
    icosahedronGeomCache.set(key, g)
  }
  return g
}

function getWireframeIcosahedronGeometry(radius: number, detail: number) {
  const key = `${radius}:${detail}`
  let g = wireframeIcosaCache.get(key)
  if (!g) {
    const icosa = new THREE.IcosahedronGeometry(radius, detail)
    g = new THREE.WireframeGeometry(icosa)
    icosa.dispose()
    wireframeIcosaCache.set(key, g)
  }
  return g
}

type ShardVariant = 'space' | 'project' | 'identity'

function DissolvingIdentityShard({
  pulseKey,
  pulseAt,
  selectedMul,
  onPointerDown,
}: {
  pulseKey: string
  pulseAt: MutableRefObject<Map<string, number>>
  selectedMul: number
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const geo = useMemo(() => new THREE.IcosahedronGeometry(SHARD.identity.radius, SHARD.identity.detail), [])
  const basePositions = useMemo(() => {
    const pos = geo.attributes.position as THREE.BufferAttribute
    return new Float32Array(pos.array)
  }, [geo])

  useEffect(
    () => () => {
      geo.dispose()
    },
    [geo],
  )

  useFrame(({ clock }) => {
    const g = groupRef.current
    if (g) {
      const s = pulseScale(performance.now(), pulseKey, pulseAt.current) * selectedMul
      g.scale.setScalar(s)
    }
    const mesh = meshRef.current
    if (!mesh) return
    const attr = mesh.geometry.attributes.position as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    const t = clock.elapsedTime
    for (let i = 0; i < arr.length; i += 3) {
      const vi = i / 3
      const bx = basePositions[i]!
      const by = basePositions[i + 1]!
      const bz = basePositions[i + 2]!
      const len = Math.sqrt(bx * bx + by * by + bz * bz) || 1
      const disp = Math.sin(t * 2 + vi) * 0.08
      arr[i] = bx + (bx / len) * disp
      arr[i + 1] = by + (by / len) * disp
      arr[i + 2] = bz + (bz / len) * disp
    }
    attr.needsUpdate = true
    mesh.geometry.computeBoundingSphere()
  })

  return (
    <group ref={groupRef} onPointerDown={onPointerDown}>
      <mesh ref={meshRef} geometry={geo}>
        <meshBasicMaterial
          color="#ffffff"
          wireframe
          transparent
          opacity={0.15}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

function CrystalShard({
  variant,
  ghostMode,
  pulseKey,
  pulseAt,
  selectedMul,
  onPointerDown,
}: {
  variant: ShardVariant
  ghostMode: boolean
  pulseKey: string
  pulseAt: MutableRefObject<Map<string, number>>
  selectedMul: number
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void
}) {
  const groupRef = useRef<THREE.Group>(null)

  const spec =
    variant === 'space'
      ? SHARD.space
      : variant === 'project'
        ? SHARD.project
        : SHARD.identity

  const innerRadius = spec.radius
  const innerDetail = spec.detail

  const wireGeom = useMemo(
    () => getWireframeIcosahedronGeometry(innerRadius, innerDetail),
    [innerRadius, innerDetail],
  )
  const solidGeom = useMemo(() => getIcosahedronGeometry(innerRadius, innerDetail), [innerRadius, innerDetail])

  const outerRingGeom = useMemo(() => {
    if (variant !== 'space') return null
    return getWireframeIcosahedronGeometry(SHARD.space.outerRingRadius, SHARD.space.outerRingDetail)
  }, [variant])

  let lineColor: string
  let lineOpacity: number
  let shellColor: string
  let shellOpacity: number

  if (ghostMode) {
    if (variant === 'space') {
      lineColor = '#2a2a4a'
      lineOpacity = 0.7
      shellColor = '#2a2a4a'
      shellOpacity = 0.12
    } else if (variant === 'project') {
      lineColor = '#1e1e3a'
      lineOpacity = 0.5
      shellColor = '#1e1e3a'
      shellOpacity = 0.08
    } else {
      lineColor = '#ffffff'
      lineOpacity = 0.15
      shellColor = '#ffffff'
      shellOpacity = 0.02
    }
  } else {
    lineColor =
      variant === 'space' ? SPACE_PURPLE : variant === 'project' ? PROJECT_CYAN : IDENTITY_LIGHT
    lineOpacity = 1
    shellColor = lineColor
    shellOpacity = 0.04
  }

  useFrame(() => {
    const g = groupRef.current
    if (!g) return
    const s = pulseScale(performance.now(), pulseKey, pulseAt.current) * selectedMul
    g.scale.setScalar(s)
  })

  if (variant === 'identity' && ghostMode) {
    return (
      <DissolvingIdentityShard
        pulseKey={pulseKey}
        pulseAt={pulseAt}
        selectedMul={selectedMul}
        onPointerDown={onPointerDown}
      />
    )
  }

  return (
    <group ref={groupRef} onPointerDown={onPointerDown}>
      <mesh geometry={solidGeom}>
        <meshBasicMaterial
          color={shellColor}
          transparent
          opacity={shellOpacity}
          depthWrite={false}
        />
      </mesh>
      <lineSegments geometry={wireGeom}>
        <lineBasicMaterial
          color={lineColor}
          transparent
          opacity={lineOpacity}
          depthWrite={false}
        />
      </lineSegments>
      {variant === 'space' && outerRingGeom ? (
        <lineSegments geometry={outerRingGeom}>
          <lineBasicMaterial
            color={ghostMode ? '#2a2a4a' : SPACE_PURPLE}
            transparent
            opacity={ghostMode ? 0.14 : 0.2}
            depthWrite={false}
          />
        </lineSegments>
      ) : null}
    </group>
  )
}

type Layout = { spaces: SimSpaceSummary[]; nodes: SimNodeSummary[]; projects: SimProjectSummary[] }

/** Same composer baseline as CrystalRadar3D — aberration-only in ghost, bloom in Act II. */
function SimPostFx({ ghostMode }: { ghostMode: boolean }) {
  const chromaOffset = useMemo(() => new THREE.Vector2(0.001, 0.001), [])
  return (
    <EffectComposer enableNormalPass={false} multisampling={0}>
      {ghostMode ? (
        <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={chromaOffset} />
      ) : (
        <Bloom mipmapBlur luminanceThreshold={0.85} intensity={0.12} levels={4} />
      )}
    </EffectComposer>
  )
}

function DynamicEdges({
  spacePos,
  nodeGroups,
  edges,
  ghostMode,
}: {
  spacePos: Map<string, THREE.Vector3>
  nodeGroups: MutableRefObject<Map<string, THREE.Group>>
  edges: { spaceId: string; alias: string }[]
  ghostMode: boolean
}) {
  const size = useThree((s) => s.size)
  const geom = useMemo(() => new LineSegmentsGeometry(), [])
  const material = useMemo(
    () =>
      new LineMaterial({
        color: EDGE_GHOST_HEX,
        linewidth: 0.8,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        resolution: new THREE.Vector2(1, 1),
      }),
    [],
  )

  const lineSegments = useMemo(() => new LineSegments2(geom, material), [geom, material])

  useEffect(
    () => () => {
      geom.dispose()
      material.dispose()
    },
    [geom, material],
  )

  useFrame(({ clock }) => {
    material.resolution.set(size.width, size.height)

    if (ghostMode) {
      material.linewidth = 0.8
      material.color.setHex(EDGE_GHOST_HEX)
      const pulse = Math.sin(clock.elapsedTime * 0.8) * 0.5 + 0.5
      material.opacity = 0.2 + pulse * 0.2
    } else {
      material.linewidth = 1.4
      material.color.setHex(EDGE_ACT_II_HEX)
      material.opacity = 0.6
    }

    const arr: number[] = []
    for (const { spaceId, alias } of edges) {
      const c = spacePos.get(spaceId)
      const g = nodeGroups.current.get(alias)
      if (!c || !g) continue
      const p = g.position
      arr.push(c.x, c.y, c.z, p.x, p.y, p.z)
    }
    if (arr.length >= 6) {
      geom.setPositions(arr)
    }
  })

  return <primitive object={lineSegments} />
}

function SpaceNodeLabel({
  spaceId,
  name,
  ghostMode,
}: {
  spaceId: string
  name: string
  ghostMode: boolean
}) {
  const barWidths = useMemo(() => {
    const count = hash01(`${spaceId}:nBars`) > 0.45 ? 2 : 1
    return Array.from({ length: count }, (_, i) => 40 + hash01(`${spaceId}:bar${i}`) * 40)
  }, [spaceId])

  return (
    <Html
      position={[0, 0.75, 0]}
      center
      distanceFactor={8}
      wrapperClass="pointer-events-none"
      style={{ pointerEvents: 'none' }}
    >
      {ghostMode ? (
        <div className="flex flex-col items-center gap-1">
          {barWidths.map((w, i) => (
            <div
              key={i}
              style={{
                width: `${w}px`,
                height: 8,
                background: '#333333',
                borderRadius: 2,
              }}
            />
          ))}
        </div>
      ) : (
        <div className="max-w-[200px] text-center font-mono text-xs uppercase tracking-widest text-[#a0a0a0]">
          {name}
        </div>
      )}
    </Html>
  )
}

function ProjectShard({
  id,
  spaceId,
  contribAlias,
  spacePos,
  nodeGroups,
  selected,
  pulseAt,
  onSelect,
  ghostMode,
}: {
  id: string
  spaceId: string
  contribAlias: string
  spacePos: Map<string, THREE.Vector3>
  nodeGroups: MutableRefObject<Map<string, THREE.Group>>
  selected: boolean
  pulseAt: MutableRefObject<Map<string, number>>
  onSelect: Props['onSelect']
  ghostMode: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)
  useFrame(() => {
    const m = groupRef.current
    if (!m) return
    const sc = spacePos.get(spaceId)
    if (!sc) return
    const g = nodeGroups.current.get(contribAlias)
    const end = g ? g.position : sc.clone().add(new THREE.Vector3(0, 0.9, 0))
    m.position.copy(sc.clone().lerp(end, 0.48).add(new THREE.Vector3(0, 0.32, 0)))
  })
  return (
    <group ref={groupRef}>
      <CrystalShard
        variant="project"
        ghostMode={ghostMode}
        pulseKey={`project:${id}`}
        pulseAt={pulseAt}
        selectedMul={selected ? 1.1 : 1}
        onPointerDown={(e) => {
          e.stopPropagation()
          onSelect({ kind: 'project', id })
        }}
      />
    </group>
  )
}

function SimScene({
  layout,
  spaceIds,
  events,
  selection,
  onSelect,
  ghostMode,
}: {
  layout: Layout
  spaceIds: string[]
  events: SimEvent[]
  selection: Selection
  onSelect: Props['onSelect']
  ghostMode?: boolean
}) {
  const pulseAt = useRef<Map<string, number>>(new Map())
  const nodeGroups = useRef<Map<string, THREE.Group>>(new Map())
  const orbitT = useRef(0)

  useEffect(() => {
    const ev = events[events.length - 1]
    if (!ev?.refs?.length) return
    const now = performance.now()
    for (const r of ev.refs) pulseAt.current.set(`${normKind(r.kind)}:${r.id}`, now)
  }, [events])

  const spacePos = useMemo(() => {
    const m = new Map<string, THREE.Vector3>()
    const n = spaceIds.length
    spaceIds.forEach((id, i) => {
      const [x, y, z] = fibonacciSphere(i, n)
      m.set(id, new THREE.Vector3(x, y, z))
    })
    return m
  }, [spaceIds])

  const { nodeOrbit, edges, projectsMeta } = useMemo(() => {
    const hero = new Set(layout.nodes.map((n) => n.alias))
    const nodeOrbit = new Map<string, { spaceId: string; angle0: number }>()
    for (const node of layout.nodes) {
      const sid =
        (node.spaces?.map(String).find((id) => spacePos.has(id)) ?? spaceIds[0]) || spaceIds[0]
      if (sid) nodeOrbit.set(node.alias, { spaceId: sid, angle0: hash01(node.alias) * Math.PI * 2 })
    }
    const edges: { spaceId: string; alias: string }[] = []
    for (const sp of layout.spaces) {
      const sid = String(sp._id)
      for (const mem of sp.members ?? []) {
        if (hero.has(mem) && nodeOrbit.has(mem)) edges.push({ spaceId: sid, alias: mem })
      }
    }
    const projectsMeta = layout.projects.map((p) => ({
      id: String(p._id),
      spaceId: String(p.spaceId),
      contribAlias:
        p.contributors.find((c) => c.isPrimary)?.alias ??
        p.contributors[0]?.alias ??
        p.creatorAlias,
    }))
    return { nodeOrbit, edges, projectsMeta }
  }, [layout, spaceIds, spacePos])

  const gm = ghostMode ?? false

  useFrame((_, dt) => {
    orbitT.current += dt
    const t = orbitT.current
    for (const node of layout.nodes) {
      const o = nodeOrbit.get(node.alias)
      const g = nodeGroups.current.get(node.alias)
      if (!o || !g) continue
      const sc = spacePos.get(o.spaceId)
      if (!sc) continue
      const ang = o.angle0 + t * 0.35
      g.position.set(
        sc.x + Math.cos(ang) * 1.4,
        sc.y + Math.sin(ang * 0.7) * 0.25,
        sc.z + Math.sin(ang) * 1.4,
      )
    }
  })

  return (
    <>
      <ambientLight intensity={gm ? 0.15 : 0.35} />
      <pointLight position={[10, 10, 10]} intensity={gm ? 0.3 : 0.8} />
      <DynamicEdges spacePos={spacePos} nodeGroups={nodeGroups} edges={edges} ghostMode={gm} />
      {layout.spaces.map((sp) => {
        const id = String(sp._id)
        const p = spacePos.get(id)
        if (!p) return null
        const sel = selection?.kind === 'space' && selection.id === id
        return (
          <group key={id} position={p}>
            <CrystalShard
              variant="space"
              ghostMode={gm}
              pulseKey={`space:${id}`}
              pulseAt={pulseAt}
              selectedMul={sel ? 1.08 : 1}
              onPointerDown={(e) => {
                e.stopPropagation()
                onSelect({ kind: 'space', id })
              }}
            />
            <SpaceNodeLabel spaceId={id} name={sp.name} ghostMode={gm} />
          </group>
        )
      })}
      {layout.nodes.map((n) => {
        const o = nodeOrbit.get(n.alias)
        if (!o) return null
        const sc = spacePos.get(o.spaceId)
        if (!sc) return null
        const ang = o.angle0
        const init = new THREE.Vector3(
          sc.x + Math.cos(ang) * 1.4,
          sc.y + Math.sin(ang * 0.7) * 0.25,
          sc.z + Math.sin(ang) * 1.4,
        )
        const sel = selection?.kind === 'node' && selection.alias === n.alias
        return (
          <group
            key={n.alias}
            ref={(g) => {
              if (g) {
                g.position.copy(init)
                nodeGroups.current.set(n.alias, g)
              } else nodeGroups.current.delete(n.alias)
            }}
          >
            <CrystalShard
              variant="identity"
              ghostMode={gm}
              pulseKey={`node:${n.alias}`}
              pulseAt={pulseAt}
              selectedMul={sel ? 1.06 : 1}
              onPointerDown={(e) => {
                e.stopPropagation()
                onSelect({ kind: 'node', alias: n.alias })
              }}
            />
          </group>
        )
      })}
      {projectsMeta.map((pm) => (
        <ProjectShard
          key={pm.id}
          id={pm.id}
          spaceId={pm.spaceId}
          contribAlias={pm.contribAlias}
          spacePos={spacePos}
          nodeGroups={nodeGroups}
          selected={selection?.kind === 'project' && selection.id === pm.id}
          pulseAt={pulseAt}
          onSelect={onSelect}
          ghostMode={gm}
        />
      ))}
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        autoRotate={!selection}
        autoRotateSpeed={0.35}
        minDistance={4}
        maxDistance={22}
      />
    </>
  )
}

function IdleScene() {
  const wireGeom = useMemo(() => getWireframeIcosahedronGeometry(1.2, 1), [])
  const solidGeom = useMemo(() => getIcosahedronGeometry(1.2, 1), [])
  return (
    <>
      <ambientLight intensity={0.2} />
      <group>
        <mesh geometry={solidGeom}>
          <meshBasicMaterial color="#1a1a2e" transparent opacity={0.04} depthWrite={false} />
        </mesh>
        <lineSegments geometry={wireGeom}>
          <lineBasicMaterial color="#1a1a2e" transparent opacity={0.35} depthWrite={false} />
        </lineSegments>
      </group>
      <Html center>
        <div className="max-w-xs px-4 text-center font-mono text-small leading-relaxed text-white/45">
          Run a simulation to populate the network
        </div>
      </Html>
      <OrbitControls enableDamping autoRotate autoRotateSpeed={0.2} />
    </>
  )
}

export default function MacroNetworkView({
  spaceIds,
  heroAliases,
  projectIds,
  events,
  selection,
  onSelect,
  ghostMode = false,
}: Props) {
  const [layout, setLayout] = useState<Layout | null>(null)
  const [loading, setLoading] = useState(false)
  const fetchKey = [spaceIds.join(','), heroAliases.join(','), projectIds.join(',')].join('|')

  useEffect(() => {
    if (!spaceIds.length) {
      queueMicrotask(() => {
        setLayout(null)
        setLoading(false)
      })
      return
    }
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setLoading(true)
    })
    ;(async () => {
      const [spaces, nodes, projects] = await Promise.all([
        simEntityApi.getSpacesByIds(spaceIds),
        simEntityApi.getNodesByAliases(heroAliases),
        Promise.all(projectIds.map((id) => simEntityApi.getProject(id).catch(() => null))),
      ])
      if (cancelled) return
      setLayout({
        spaces,
        nodes,
        projects: projects.filter((x): x is SimProjectSummary => x != null),
      })
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [fetchKey, spaceIds, heroAliases, projectIds])

  const empty = spaceIds.length === 0

  return (
    <div
      className="relative h-full min-h-[280px] w-full overflow-hidden rounded-md border border-white/10 bg-[#06060f]"
      data-target-cursor-exclude=""
    >
      <div
        className="pointer-events-none absolute inset-0 z-0 rounded-[inherit]"
        style={{
          background: 'radial-gradient(ellipse at center, #0d0d1f 0%, #06060f 100%)',
        }}
        aria-hidden
      />
      <Canvas
        className="relative z-[1] h-full w-full"
        camera={{ position: [0, 0, 9], fov: 55, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={['#06060f']} />
        <Suspense
          fallback={
            <Html center>
              <span className="font-mono text-small text-white/50">Loading…</span>
            </Html>
          }
        >
          {empty ? (
            <IdleScene />
          ) : loading || !layout ? (
            <group>
              <ambientLight intensity={0.15} />
              <Html center>
                <span className="font-mono text-small text-white/50">Loading…</span>
              </Html>
              <OrbitControls enableDamping autoRotate autoRotateSpeed={0.25} />
            </group>
          ) : (
            <SimScene
              layout={layout}
              spaceIds={spaceIds}
              events={events}
              selection={selection}
              onSelect={onSelect}
              ghostMode={ghostMode}
            />
          )}
        </Suspense>
        <SimPostFx ghostMode={ghostMode} />
      </Canvas>
    </div>
  )
}
