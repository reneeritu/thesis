import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
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

function fibonacciSphere(i: number, n: number, radius = 6) {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  const y = 1 - (i / Math.max(1, n - 1)) * 2
  const r = Math.sqrt(1 - y * y)
  const theta = goldenAngle * i
  return [Math.cos(theta) * r * radius, y * radius, Math.sin(theta) * r * radius] as const
}

function hash01(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return (h % 10000) / 10000
}

function normKind(k: string) {
  return k.toLowerCase()
}

function pulseScale(now: number, key: string, pulseAt: Map<string, number>) {
  const t = pulseAt.get(key)
  if (t == null) return 1
  const age = (now - t) / 1000
  if (age >= 1) return 1
  return 1 + 0.3 * (1 - age) * Math.sin(age * Math.PI)
}

type Layout = { spaces: SimSpaceSummary[]; nodes: SimNodeSummary[]; projects: SimProjectSummary[] }

function DynamicEdges({
  spacePos,
  nodeGroups,
  edges,
}: {
  spacePos: Map<string, THREE.Vector3>
  nodeGroups: MutableRefObject<Map<string, THREE.Group>>
  edges: { spaceId: string; alias: string }[]
}) {
  const lineRef = useRef<THREE.LineSegments>(null)
  const geom = useMemo(() => new THREE.BufferGeometry(), [])
  useFrame(() => {
    const ls = lineRef.current
    if (!ls) return
    const arr: number[] = []
    for (const { spaceId, alias } of edges) {
      const c = spacePos.get(spaceId)
      const g = nodeGroups.current.get(alias)
      if (!c || !g) continue
      const p = g.position
      arr.push(c.x, c.y, c.z, p.x, p.y, p.z)
    }
    if (arr.length) {
      ls.geometry.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3))
      ls.geometry.computeBoundingSphere()
    }
  })
  return (
    <lineSegments ref={lineRef} geometry={geom}>
      <lineBasicMaterial color="#ffffff" transparent opacity={0.14} depthWrite={false} />
    </lineSegments>
  )
}

function ProjectGem({
  id,
  spaceId,
  contribAlias,
  spacePos,
  nodeGroups,
  selected,
  pulseAt,
  onSelect,
}: {
  id: string
  spaceId: string
  contribAlias: string
  spacePos: Map<string, THREE.Vector3>
  nodeGroups: MutableRefObject<Map<string, THREE.Group>>
  selected: boolean
  pulseAt: MutableRefObject<Map<string, number>>
  onSelect: Props['onSelect']
}) {
  const mesh = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const sc = spacePos.get(spaceId)
    if (!sc) return
    const g = nodeGroups.current.get(contribAlias)
    const end = g ? g.position : sc.clone().add(new THREE.Vector3(0, 0.9, 0))
    m.position.copy(sc.clone().lerp(end, 0.48).add(new THREE.Vector3(0, 0.32, 0)))
    const s = pulseScale(performance.now(), `project:${id}`, pulseAt.current) * (selected ? 1.1 : 1)
    m.scale.setScalar(s)
  })
  return (
    <mesh
      ref={mesh}
      onPointerDown={(e) => {
        e.stopPropagation()
        onSelect({ kind: 'project', id })
      }}
    >
      <octahedronGeometry args={[0.22]} />
      <meshStandardMaterial
        color="#a78bfa"
        emissive="#7c3aed"
        emissiveIntensity={selected ? 0.9 : 0.45}
        toneMapped={false}
      />
    </mesh>
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

  const ghostOpacity = ghostMode ? 0.28 : 1
  const spaceColor = ghostMode ? '#4a5568' : '#4fd1c5'
  const spaceEmissive = ghostMode ? '#1a202c' : '#0d9488'
  const nodeColor = ghostMode ? '#a0a0a0' : '#fef08a'
  const nodeEmissive = ghostMode ? '#333333' : '#facc15'

  return (
    <>
      <ambientLight intensity={ghostMode ? 0.15 : 0.35} />
      <pointLight position={[10, 10, 10]} intensity={ghostMode ? 0.3 : 0.8} />
      <DynamicEdges spacePos={spacePos} nodeGroups={nodeGroups} edges={edges} />
      {layout.spaces.map((sp) => {
        const id = String(sp._id)
        const p = spacePos.get(id)
        if (!p) return null
        const sel = selection?.kind === 'space' && selection.id === id
        return (
          <group key={id} position={p}>
            <PulsingGroup
              pulseKey={`space:${id}`}
              pulseAt={pulseAt}
              selectedMul={sel ? 1.08 : 1}
            >
              <mesh
                onPointerDown={(e) => {
                  e.stopPropagation()
                  onSelect({ kind: 'space', id })
                }}
              >
                <sphereGeometry args={[0.6, 24, 24]} />
                <meshStandardMaterial
                  color={spaceColor}
                  emissive={spaceEmissive}
                  emissiveIntensity={ghostMode ? 0.1 : sel ? 1.2 : 0.55}
                  transparent={ghostMode}
                  opacity={ghostOpacity}
                  toneMapped={false}
                />
              </mesh>
            </PulsingGroup>
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
            <PulsingSphere
              radius={0.18}
              pulseKey={`node:${n.alias}`}
              pulseAt={pulseAt}
              selectedScale={sel ? 1.06 : 1}
              onPointerDown={(e) => {
                e.stopPropagation()
                onSelect({ kind: 'node', alias: n.alias })
              }}
              color={nodeColor}
              emissive={nodeEmissive}
              emissiveIntensity={ghostMode ? 0.05 : sel ? 1.4 : 0.9}
              transparent={ghostMode}
              opacity={ghostOpacity}
            />
          </group>
        )
      })}
      {projectsMeta.map((pm) => (
        <ProjectGem
          key={pm.id}
          id={pm.id}
          spaceId={pm.spaceId}
          contribAlias={pm.contribAlias}
          spacePos={spacePos}
          nodeGroups={nodeGroups}
          selected={selection?.kind === 'project' && selection.id === pm.id}
          pulseAt={pulseAt}
          onSelect={onSelect}
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

function PulsingGroup({
  pulseKey,
  pulseAt,
  selectedMul,
  children,
}: {
  pulseKey: string
  pulseAt: MutableRefObject<Map<string, number>>
  selectedMul: number
  children: ReactNode
}) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    const gr = g.current
    if (!gr) return
    gr.scale.setScalar(
      pulseScale(performance.now(), pulseKey, pulseAt.current) * selectedMul,
    )
  })
  return <group ref={g}>{children}</group>
}

function PulsingSphere({
  radius,
  pulseKey,
  pulseAt,
  selectedScale,
  onPointerDown,
  color,
  emissive,
  emissiveIntensity,
  transparent,
  opacity,
}: {
  radius: number
  pulseKey: string
  pulseAt: MutableRefObject<Map<string, number>>
  selectedScale: number
  onPointerDown: (e: { stopPropagation: () => void }) => void
  color: string
  emissive: string
  emissiveIntensity: number
  transparent?: boolean
  opacity?: number
}) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const m = ref.current
    if (!m) return
    const s =
      pulseScale(performance.now(), pulseKey, pulseAt.current) * selectedScale
    m.scale.setScalar(s)
  })
  return (
    <mesh ref={ref} onPointerDown={onPointerDown}>
      <sphereGeometry args={[radius, 16, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        transparent={transparent}
        opacity={opacity ?? 1}
        toneMapped={false}
      />
    </mesh>
  )
}

function IdleScene() {
  return (
    <>
      <ambientLight intensity={0.2} />
      <mesh>
        <icosahedronGeometry args={[1.2, 1]} />
        <meshBasicMaterial color="#1e293b" wireframe transparent opacity={0.35} />
      </mesh>
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
      className="relative h-full min-h-[280px] w-full overflow-hidden rounded-md border border-white/10 bg-black"
      data-target-cursor-exclude=""
    >
      <Canvas
        className="h-full w-full"
        camera={{ position: [0, 2, 14], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={['#000000']} />
        <fogExp2 attach="fog" args={['#020203', 0.038]} />
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
      </Canvas>
    </div>
  )
}
