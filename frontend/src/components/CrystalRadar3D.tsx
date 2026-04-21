/**
 * Reputation visualisation — 3D crystal facet.
 *
 * Six tapered crystal arms radiate from a central gem, one per reputation category.
 * Arm length is the sqrt-normalised score (consistent with the 2D radar), so a mixed
 * profile reads as an asymmetric crystal rather than a flat blob.
 *
 * Interaction model (v1 — rotation kept static as requested):
 *   - Orbit camera (mouse drag) — polar angle clamped so the viewer can't go upside-down.
 *   - Pan + auto-rotate disabled.
 *   - Click / tap an arm → the side drawer opens with:
 *       • category name + 1-line definition
 *       • raw all-time score (out of 1000)
 *       • last-90-days score if provided
 *       • "activity hint" for what grows this axis
 *
 * If `recentCategories` is provided, a translucent ghost crystal grows inside the main
 * one, representing the last ~90 days. This replaces the dashed 2D overlay.
 *
 * Palette: cream background (transparent canvas) + charcoal outlines + primary-ish
 * colours for each arm. Matches the Etch house palette.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { Edges, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { GLOSSARY } from '../lib/glossary'

type ReputationCategories = {
  craft: number
  research: number
  collaboration: number
  pedagogy: number
  consistency: number
  community: number
}

const KEYS: Array<keyof ReputationCategories> = [
  'craft',
  'research',
  'collaboration',
  'pedagogy',
  'consistency',
  'community',
]

const LABELS: Record<keyof ReputationCategories, string> = {
  craft: 'Craft',
  research: 'Research',
  collaboration: 'Collab',
  pedagogy: 'Pedagogy',
  consistency: 'Consist',
  community: 'Community',
}

/** One colour per arm — pulled from the house primary palette. */
const ARM_COLOURS: Record<keyof ReputationCategories, string> = {
  craft: '#f5c518', // yellow
  research: '#2563eb', // blue
  collaboration: '#dc2626', // red
  pedagogy: '#16a34a', // green
  consistency: '#9333ea', // violet
  community: '#0891b2', // cyan
}

const ARM_HINT: Record<keyof ReputationCategories, string> = {
  craft: 'Grows when you log execution traces — making the thing.',
  research: 'Grows when you log reference / study traces — investigating.',
  collaboration: 'Grows when you log group work and co-authored traces.',
  pedagogy: 'Grows when you mentor, teach, or review others.',
  consistency: 'Grows from steady cadence — showing up across time.',
  community: 'Grows from cross-space work and public-facing projects.',
}

/** Match the 2D radar's compression so visuals stay consistent. */
function norm(v: number): number {
  const n = Number.isFinite(v) ? v : 0
  const ratio = Math.max(0, Math.min(1, n / 1000))
  return Math.sqrt(ratio)
}

type ArmProps = {
  angle: number
  length: number
  colour: string
  width?: number
  opacity?: number
  onClick?: (e: ThreeEvent<MouseEvent>) => void
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void
  highlighted?: boolean
}

/**
 * One crystal arm — a 4-sided tapered cone lying along +X, rotated into position.
 * The arm mesh is scaled on its length axis to animate growth.
 */
function Arm({
  angle,
  length,
  colour,
  width = 0.1,
  opacity = 1,
  onClick,
  onPointerOver,
  onPointerOut,
  highlighted = false,
}: ArmProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const lengthRef = useRef(length)

  useFrame((_state, delta) => {
    if (!meshRef.current) return
    // ease toward target length; linear interp with frame-rate independent factor
    const current = lengthRef.current
    const next = current + (length - current) * Math.min(1, delta * 6)
    lengthRef.current = next
    meshRef.current.scale.setScalar(1)
    meshRef.current.scale.x = Math.max(0.001, next)
  })

  return (
    <group rotation={[0, angle, 0]}>
      <mesh
        ref={meshRef}
        position={[0.5, 0, 0]}
        rotation={[0, 0, -Math.PI / 2]}
        scale={[length, 1, 1]}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        {/* ConeGeometry(radius, height, radialSegments). Height=1, we scale on X. */}
        <coneGeometry args={[width, 1, 4, 1]} />
        <meshStandardMaterial
          color={colour}
          metalness={0.15}
          roughness={0.35}
          transparent={opacity < 1}
          opacity={opacity}
          emissive={highlighted ? colour : '#000000'}
          emissiveIntensity={highlighted ? 0.45 : 0}
        />
        {opacity >= 1 ? <Edges color="#111111" threshold={15} /> : null}
      </mesh>
    </group>
  )
}

type CrystalProps = {
  categories?: Partial<ReputationCategories>
  recentCategories?: Partial<ReputationCategories>
  onSelect?: (key: keyof ReputationCategories) => void
  selected?: keyof ReputationCategories | null
}

function Crystal({ categories, recentCategories, onSelect, selected }: CrystalProps) {
  const armData = useMemo(() => {
    return KEYS.map((key, i) => {
      const angle = (i * 2 * Math.PI) / KEYS.length
      const raw = Number(categories?.[key] ?? 0)
      const recentRaw = Number(recentCategories?.[key] ?? 0)
      return {
        key,
        angle,
        // max arm length 1.35 world units at score = 1000
        length: 0.25 + norm(raw) * 1.1,
        recentLength: recentCategories ? 0.12 + norm(recentRaw) * 1.0 : 0,
        colour: ARM_COLOURS[key],
      }
    })
  }, [categories, recentCategories])

  return (
    <group>
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 5, 4]} intensity={0.9} />
      <directionalLight position={[-3, -2, -1]} intensity={0.25} />

      {/* Central gem */}
      <mesh>
        <dodecahedronGeometry args={[0.18, 0]} />
        <meshStandardMaterial color="#fafaf5" metalness={0.1} roughness={0.3} />
        <Edges color="#111111" threshold={15} />
      </mesh>

      {/* All-time arms */}
      {armData.map((a) => (
        <Arm
          key={a.key}
          angle={a.angle}
          length={a.length}
          colour={a.colour}
          width={0.11}
          highlighted={selected === a.key}
          onClick={(e) => {
            e.stopPropagation()
            onSelect?.(a.key)
          }}
        />
      ))}

      {/* 90-day ghost arms inside the main ones */}
      {recentCategories
        ? armData.map((a) => (
            <Arm
              key={`recent-${a.key}`}
              angle={a.angle}
              length={a.recentLength}
              colour={a.colour}
              width={0.05}
              opacity={0.45}
            />
          ))
        : null}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Public component

export type CrystalRadarProps = {
  categories?: Partial<ReputationCategories>
  recentCategories?: Partial<ReputationCategories>
  className?: string
  /** Show hint tooltips — driven by the Hints toggle in the dashboard. */
  showDefinitions?: boolean
}

export function CrystalRadar3D({
  categories,
  recentCategories,
  className = '',
  showDefinitions = false,
}: CrystalRadarProps) {
  const [selected, setSelected] = useState<keyof ReputationCategories | null>(null)

  // close drawer when data changes from underneath us
  useEffect(() => {
    if (!selected) return
    if (categories && categories[selected] === undefined && categories[selected] !== 0) {
      setSelected(null)
    }
  }, [categories, selected])

  const selectedRaw = selected ? Number(categories?.[selected] ?? 0) : 0
  const selectedRecent =
    selected && recentCategories ? Number(recentCategories?.[selected] ?? 0) : null

  return (
    <div className={`relative ${className}`}>
      <div className="aspect-square w-full border border-black bg-white">
        <Canvas
          camera={{ position: [0, 1.35, 3.3], fov: 38 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
          onPointerMissed={() => setSelected(null)}
        >
          <color attach="background" args={['#faf8f2']} />
          <Crystal
            categories={categories}
            recentCategories={recentCategories}
            onSelect={setSelected}
            selected={selected}
          />
          <OrbitControls
            enableRotate
            enablePan={false}
            enableZoom={false}
            rotateSpeed={0.6}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={(Math.PI * 3) / 5}
            enableDamping
            dampingFactor={0.12}
          />
        </Canvas>
      </div>

      {/* Legend row below canvas */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {KEYS.map((k) => {
          const isSel = selected === k
          return (
            <button
              key={k}
              type="button"
              onClick={() => setSelected(isSel ? null : k)}
              className={`flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] transition ${
                isSel
                  ? 'border-black bg-black text-yellow-400'
                  : 'border-transparent text-grey-500 hover:text-black'
              }`}
              title={showDefinitions ? `${LABELS[k]} — ${Math.round(Number(categories?.[k] ?? 0))} / 1000. ${GLOSSARY[k] ?? ''}` : undefined}
            >
              <span
                className="inline-block h-2.5 w-2.5 border border-black"
                style={{ background: ARM_COLOURS[k] }}
              />
              {LABELS[k]}
            </button>
          )
        })}
      </div>

      {/* Right-side arm detail drawer — absolute within the parent card */}
      {selected ? (
        <div
          className="mt-3 border border-black bg-white p-3 space-y-1 text-small"
          role="dialog"
          aria-label={`${LABELS[selected]} detail`}
        >
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 border border-black"
              style={{ background: ARM_COLOURS[selected] }}
            />
            <p className="font-mono text-[11px] uppercase tracking-[0.18em]">
              {LABELS[selected]}
            </p>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="ml-auto border border-black bg-white px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] hover:bg-grey-100"
              aria-label="Close detail"
            >
              Close
            </button>
          </div>
          <p className="font-mono text-[11px]">
            All-time: <strong>{Math.round(selectedRaw)}</strong> / 1000
          </p>
          {selectedRecent !== null ? (
            <p className="font-mono text-[11px] text-grey-600">
              Last ~90 d: <strong>{Math.round(selectedRecent)}</strong>
            </p>
          ) : null}
          <p className="text-[11px] text-grey-600">{GLOSSARY[selected] ?? ''}</p>
          <p className="text-[11px] text-grey-400 italic">{ARM_HINT[selected]}</p>
        </div>
      ) : (
        <p className="mt-2 font-mono text-[10px] text-grey-400">
          Drag to rotate. Tap an arm to see its score.
        </p>
      )}
    </div>
  )
}
