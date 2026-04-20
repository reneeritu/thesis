import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { HeroR3FCanvas } from './hero/HeroR3FScene'

function canvasSizePx(): number {
  const vmin = Math.min(window.innerWidth, window.innerHeight) / 100
  const base = Math.min(100 * vmin, 580)
  return Math.round(base * 1.8)
}

type HeroSectionProps = {
  /** When set (e.g. on `/welcome`), Theatre intro plays after the GLB is visible; see `WelcomeTheatreIntroWhenReady`. */
  onWelcomeTheatreIntroComplete?: () => void
}

export function HeroSection({ onWelcomeTheatreIntroComplete }: HeroSectionProps) {
  const reduceMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const [canvasSize, setCanvasSize] = useState(() => canvasSizePx())
  useEffect(() => {
    const onResize = () => setCanvasSize(canvasSizePx())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Simplified hero: 3D only. Theatre drives the `e logo` animation on `/welcome`.
  const scrollProgressRef = useRef(0)
  const modelScrollRef = useRef<THREE.Group | null>(null)
  const workCardMeshesRef = useRef<THREE.Mesh[]>([])
  const workCardsGroupRef = useRef<THREE.Group | null>(null)
  const orbitLineRef = useRef<THREE.Line | null>(null)
  const orbitPtsRef = useRef<THREE.Vector3[]>([])
  const pickHandlerRef = useRef<((clientX: number, clientY: number) => void) | null>(
    null,
  )
  const hoveredWorkIndexRef = useRef<number | null>(null)
  const orbitFocusUiRef = useRef<HTMLDivElement | null>(null)
  const orbitFocusTitleRef = useRef<HTMLDivElement | null>(null)
  const orbitFocusBodyRef = useRef<HTMLParagraphElement | null>(null)

  return (
    <section className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#18101F]">
      <HeroR3FCanvas
        scrollProgressRef={scrollProgressRef}
        reduceMotion={reduceMotion}
        onWelcomeTheatreIntroComplete={onWelcomeTheatreIntroComplete}
        modelScrollRef={modelScrollRef}
        workCardMeshesRef={workCardMeshesRef}
        workCardsGroupRef={workCardsGroupRef}
        orbitLineRef={orbitLineRef}
        orbitPtsRef={orbitPtsRef}
        pickHandlerRef={pickHandlerRef}
        hoveredWorkIndexRef={hoveredWorkIndexRef}
        syncDomWorkHover={() => {}}
        orbitFocusUiRef={orbitFocusUiRef}
        orbitFocusTitleRef={orbitFocusTitleRef}
        orbitFocusBodyRef={orbitFocusBodyRef}
        canvasSize={canvasSize}
      />
    </section>
  )
}
