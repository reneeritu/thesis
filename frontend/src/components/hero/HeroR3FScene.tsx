import { editable, SheetProvider } from '@theatre/r3f'
import { useGLTF, useProgress, useTexture } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { PROJECT_COUNT, PROJECTS_DATA } from '../../data/projectsData'
import {
  E_LOGO_THEATRE_OBJECT_KEY,
  mainSheet,
  playWelcomeIntro,
} from '../../theatre/etchTheatre'
import {
  ORBIT_LINE_COLOR,
  ORBIT_SNAP_STOPS,
  ORBIT_SCROLL_SPAN,
  PHASE_ORBITAL_START,
  PHASE_P1_END,
  PHASE_P2_END,
  PHASE_P3_ORBIT_END,
  WORK_ORBIT_SEMI_A,
  WORK_ORBIT_SEMI_B,
  ORBIT_PLANE_TILT_DEG,
} from './heroPhaseConstants'
import { heroGlbUrl } from './heroGlb'

useGLTF.preload(heroGlbUrl())

/** After GLB reports fully loaded + mount, wait this long so frame 0 of the drop shows the “E” at rest. */
const WELCOME_INTRO_AFTER_LOAD_MS = 200

const EditableMesh = editable.mesh
const EditableGroup = editable.group

const orbitTiltRad = THREE.MathUtils.degToRad(ORBIT_PLANE_TILT_DEG)

function buildOrbitPolyline(): THREE.Vector3[] {
  const semiA = WORK_ORBIT_SEMI_A
  const semiB = WORK_ORBIT_SEMI_B
  const orbitSeg = 200
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= orbitSeg; i++) {
    const t = (i / orbitSeg) * Math.PI * 2
    const wobble =
      0.075 * Math.sin(t * 5 + 0.4) +
      0.048 * Math.sin(t * 11 - 0.9) +
      0.028 * Math.sin(t * 17 + 2.1)
    const aa = semiA + wobble
    const bb = semiB + wobble * 0.92
    pts.push(new THREE.Vector3(aa * Math.cos(t), 0, bb * Math.sin(t)))
  }
  return pts
}

function createWoodTexture() {
  const cn = document.createElement('canvas')
  cn.width = 512
  cn.height = 512
  const cx = cn.getContext('2d')!
  cx.fillStyle = '#e8dcc8'
  cx.fillRect(0, 0, 512, 512)
  for (let k = 0; k < 140; k++) {
    cx.strokeStyle = `rgba(72, 52, 38, ${0.05 + Math.random() * 0.09})`
    cx.lineWidth = 0.5 + Math.random() * 1.8
    cx.beginPath()
    cx.moveTo(Math.random() * 512, 0)
    cx.lineTo(Math.random() * 512, 512)
    cx.stroke()
  }
  const wt = new THREE.CanvasTexture(cn)
  wt.colorSpace = THREE.SRGBColorSpace
  wt.wrapS = THREE.RepeatWrapping
  wt.wrapT = THREE.RepeatWrapping
  wt.repeat.set(2.2, 2.2)
  return wt
}

function RoomEnvSetup() {
  const { gl, scene } = useThree()
  const pmrem = useMemo(() => new THREE.PMREMGenerator(gl), [gl])
  useLayoutEffect(() => {
    const rt = pmrem.fromScene(new RoomEnvironment(), 0.04)
    scene.environment = rt.texture
    return () => {
      rt.texture.dispose()
      pmrem.dispose()
    }
  }, [gl, scene, pmrem])
  return null
}

function WelcomeTheatreIntroWhenReady({ onComplete }: { onComplete: () => void }) {
  const { progress, loaded, total } = useProgress()
  const layoutMountedRef = useRef(false)
  const scheduledRef = useRef(false)

  useLayoutEffect(() => {
    layoutMountedRef.current = true
  }, [])

  useEffect(() => {
    if (!layoutMountedRef.current || scheduledRef.current) return
    const glbReady =
      progress >= 100 || (total > 0 && loaded >= total)
    if (!glbReady) return

    scheduledRef.current = true
    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        if (cancelled) return
        try {
          await playWelcomeIntro()
        } catch (e) {
          console.error('[WelcomeTheatreIntroWhenReady] Theatre intro play failed', e)
        }
        if (!cancelled) onComplete()
      })()
    }, WELCOME_INTRO_AFTER_LOAD_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      scheduledRef.current = false
    }
  }, [loaded, onComplete, progress, total])

  return null
}

function EtchLogoEditable({
  modelScrollRef,
  onWelcomeTheatreIntroComplete,
}: {
  modelScrollRef: React.RefObject<THREE.Group | null>
  onWelcomeTheatreIntroComplete?: () => void
}) {
  const { scene } = useGLTF(heroGlbUrl())
  const prepared = useMemo(() => {
    const root = scene.clone(true)
    const box = new THREE.Box3().setFromObject(root)
    if (!box.isEmpty()) {
      const center = box.getCenter(new THREE.Vector3())
      root.position.sub(center)
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z, 1e-3)
      const baseScale = 2.38 / maxDim
      root.scale.setScalar(baseScale)
      root.userData.baseScale = baseScale
    }
    root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.frustumCulled = false
        child.renderOrder = 5
        const woodMap = createWoodTexture()
        const physMat = new THREE.MeshPhysicalMaterial({
          map: woodMap,
          color: new THREE.Color(0xf4eadc),
          roughness: 0.96,
          metalness: 0,
          envMapIntensity: 0.38,
        })
        const oldMat = child.material
        child.material = physMat
        if (oldMat && !Array.isArray(oldMat)) oldMat.dispose()
      }
    })
    return root
  }, [scene])

  return (
    <EditableMesh theatreKey={E_LOGO_THEATRE_OBJECT_KEY} castShadow>
      {onWelcomeTheatreIntroComplete ? (
        <WelcomeTheatreIntroWhenReady onComplete={onWelcomeTheatreIntroComplete} />
      ) : null}
      <group ref={modelScrollRef}>
        <primitive object={prepared} />
      </group>
    </EditableMesh>
  )
}

type HeroSceneInnerProps = {
  scrollProgressRef: React.RefObject<number>
  reduceMotion: boolean
  modelScrollRef: React.RefObject<THREE.Group | null>
  workCardMeshesRef: React.MutableRefObject<THREE.Mesh[]>
  workCardsGroupRef: React.RefObject<THREE.Group | null>
  orbitLineRef: React.RefObject<THREE.Line | null>
  orbitPtsRef: React.MutableRefObject<THREE.Vector3[]>
  pickHandlerRef: React.MutableRefObject<
    ((clientX: number, clientY: number) => void) | null
  >
  hoveredWorkIndexRef: React.MutableRefObject<number | null>
  syncDomWorkHover: (index: number | null) => void
  orbitFocusUiRef: React.RefObject<HTMLDivElement | null>
  orbitFocusTitleRef: React.RefObject<HTMLDivElement | null>
  orbitFocusBodyRef: React.RefObject<HTMLParagraphElement | null>
  onWelcomeTheatreIntroComplete?: () => void
}

function HeroSceneInner(props: HeroSceneInnerProps) {
  const {
    scrollProgressRef,
    reduceMotion,
    modelScrollRef,
    workCardMeshesRef,
    workCardsGroupRef,
    orbitLineRef,
    orbitPtsRef,
    pickHandlerRef,
    hoveredWorkIndexRef,
    syncDomWorkHover,
    orbitFocusUiRef,
    orbitFocusTitleRef,
    orbitFocusBodyRef,
    onWelcomeTheatreIntroComplete,
  } = props

  const { camera, gl } = useThree()
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const pointerNdc = useMemo(() => new THREE.Vector2(), [])
  const orbitScratch = useMemo(
    () => ({
      worldPos: new THREE.Vector3(),
    }),
    [],
  )
  const lastCaptionIdx = useRef(-1)
  const pinkLightRef = useRef<THREE.PointLight>(null)
  const warmLightRef = useRef<THREE.PointLight>(null)

  const textures = useTexture(PROJECTS_DATA.map((p) => p.image))
  useLayoutEffect(() => {
    textures.forEach((t) => {
      t.colorSpace = THREE.SRGBColorSpace
    })
  }, [textures])

  const cardMeshes = useMemo(() => {
    const list: THREE.Mesh[] = []
    const maxAniso = Math.min(8, gl.capabilities.getMaxAnisotropy?.() ?? 4)
    for (let i = 0; i < PROJECT_COUNT; i++) {
      const tex = textures[i]!
      tex.anisotropy = maxAniso
      const img = tex.image as HTMLImageElement
      const aspect = img?.width && img?.height ? img.width / img.height : 16 / 10
      const h = 1.12
      const planeW = h * aspect
      const geo = new THREE.PlaneGeometry(planeW, h)
      const mat = new THREE.MeshPhysicalMaterial({
        map: tex,
        metalness: 0,
        roughness: 0.55,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        envMapIntensity: 0.75,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0,
      })
      mat.userData.baseColor = new THREE.Color(0xffffff)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.userData.projectIndex = i
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.renderOrder = 0
      list.push(mesh)
    }
    workCardMeshesRef.current = list
    return list
  }, [gl, textures, workCardMeshesRef])

  const orbitPts = useMemo(() => buildOrbitPolyline(), [])
  orbitPtsRef.current = orbitPts

  const orbitLineObj = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(orbitPts)
    const mat = new THREE.LineBasicMaterial({
      color: ORBIT_LINE_COLOR,
      transparent: true,
      opacity: 0,
    })
    return new THREE.Line(geo, mat)
  }, [orbitPts])

  useLayoutEffect(() => {
    if (orbitLineRef && 'current' in orbitLineRef) {
      ;(orbitLineRef as React.MutableRefObject<THREE.Line | null>).current = orbitLineObj
    }
  }, [orbitLineObj, orbitLineRef])

  useLayoutEffect(() => {
    pickHandlerRef.current = (clientX: number, clientY: number) => {
      const wglMeshes = workCardMeshesRef.current
      if (!wglMeshes.length) return
      const p = scrollProgressRef.current
      if (!Number.isFinite(p) || reduceMotion || p < PHASE_ORBITAL_START) {
        if (hoveredWorkIndexRef.current !== null) {
          hoveredWorkIndexRef.current = null
          syncDomWorkHover(null)
          for (const mesh of wglMeshes) {
            const m = mesh.material as THREE.MeshPhysicalMaterial
            m.emissive.setHex(0x000000)
            m.emissiveIntensity = 0
          }
        }
        return
      }

      const rect = gl.domElement.getBoundingClientRect()
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        if (hoveredWorkIndexRef.current !== null) {
          hoveredWorkIndexRef.current = null
          syncDomWorkHover(null)
          for (const mesh of wglMeshes) {
            const m = mesh.material as THREE.MeshPhysicalMaterial
            m.emissive.setHex(0x000000)
            m.emissiveIntensity = 0
          }
        }
        return
      }

      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointerNdc, camera)
      const hits = raycaster.intersectObjects(wglMeshes, false)
      const hit = hits[0]
      const idx =
        hit && typeof hit.object.userData.projectIndex === 'number'
          ? hit.object.userData.projectIndex
          : null

      if (idx !== hoveredWorkIndexRef.current) {
        hoveredWorkIndexRef.current = idx
        syncDomWorkHover(idx)
        wglMeshes.forEach((mesh, mi) => {
          const m = mesh.material as THREE.MeshPhysicalMaterial
          if (idx !== null && mi === idx) {
            m.emissive.setHex(0x224d48)
            m.emissiveIntensity = 0.5
          } else {
            m.emissive.setHex(0x000000)
            m.emissiveIntensity = 0
          }
        })
      }
    }
    return () => {
      pickHandlerRef.current = null
    }
  }, [
    camera,
    gl.domElement,
    hoveredWorkIndexRef,
    pickHandlerRef,
    pointerNdc,
    raycaster,
    reduceMotion,
    scrollProgressRef,
    syncDomWorkHover,
    workCardMeshesRef,
  ])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const pink = pinkLightRef.current
    const warm = warmLightRef.current
    if (pink) {
      pink.position.x = -3.5 + Math.sin(t * 0.145) * 0.75
      pink.position.y = 2.5 + Math.cos(t * 0.095) * 0.55
    }
    if (warm) {
      warm.position.x = 4.5 + Math.cos(t * 0.115) * 0.6
      warm.position.y = -0.8 + Math.sin(t * 0.085) * 0.4
    }

    const p = scrollProgressRef.current
    if (!Number.isFinite(p)) return

    // Logo transform is Theatre-driven (no auto-spin / auto-scale here).

    const wMeshes = workCardMeshesRef.current
    const wGroup = workCardsGroupRef.current
    const orbitLine = orbitLineObj
    if (!wMeshes.length || !wGroup) return

    const n = PROJECT_COUNT
    const lineMat = orbitLine.material as THREE.LineBasicMaterial
    const lineReveal =
      p < PHASE_P1_END ? 0 : p < PHASE_P2_END ? (p - PHASE_P1_END) / (PHASE_P2_END - PHASE_P1_END) : 1
    lineMat.opacity = lineReveal * 0.95
    orbitLine.visible = lineReveal > 0.02

    const inOrbit = !reduceMotion && p >= PHASE_ORBITAL_START && p < 1
    const focusWrap = orbitFocusUiRef.current
    const focusTitle = orbitFocusTitleRef.current
    const focusBody = orbitFocusBodyRef.current

    if (!inOrbit) {
      wGroup.visible = false
      gl.domElement.style.pointerEvents = 'none'
      if (focusWrap) {
        focusWrap.style.opacity = '0'
        focusWrap.classList.remove('hero-orbit-focus-ui--bar-in')
      }
      lastCaptionIdx.current = -1
      if (hoveredWorkIndexRef.current !== null) {
        hoveredWorkIndexRef.current = null
        syncDomWorkHover(null)
        for (const mesh of wMeshes) {
          const mat = mesh.material as THREE.MeshPhysicalMaterial
          mat.emissive.setHex(0x000000)
          mat.emissiveIntensity = 0
        }
      }
      return
    }

    wGroup.visible = true
    gl.domElement.style.pointerEvents = 'auto'

    const orbitalT =
      p < PHASE_ORBITAL_START ? 0 : p >= PHASE_P3_ORBIT_END ? 1 : (p - PHASE_ORBITAL_START) / ORBIT_SCROLL_SPAN
    const theta0 = orbitalT * Math.PI * 2
    const A = WORK_ORBIT_SEMI_A
    const B = WORK_ORBIT_SEMI_B
    const yLift = 0.08
    const fadeIn = Math.min(1, (p - PHASE_ORBITAL_START) / 0.1)

    const { worldPos: wPos } = orbitScratch
    const dists: number[] = []
    const focusTs: number[] = []

    for (let i = 0; i < n; i++) {
      const th = theta0 + (i * 2 * Math.PI) / n
      const x = A * Math.cos(th)
      const z = B * Math.sin(th)
      const mesh = wMeshes[i]!
      mesh.position.set(x, yLift, z)
      mesh.updateMatrixWorld(true)
      mesh.getWorldPosition(wPos)
      dists.push(wPos.distanceTo(camera.position))
    }

    let dMin = Infinity
    let dMax = -Infinity
    for (const d of dists) {
      if (d < dMin) dMin = d
      if (d > dMax) dMax = d
    }
    const dSpan = dMax - dMin || 1

    let bestIdx = 0
    let bestFocus = 0
    for (let i = 0; i < n; i++) {
      const focusT = Math.pow((dMax - dists[i]!) / dSpan, 0.92)
      focusTs.push(focusT)
      if (focusT > bestFocus) {
        bestFocus = focusT
        bestIdx = i
      }
    }

    const nearSnap = ORBIT_SNAP_STOPS.some((s) => Math.abs(p - s) < 0.045)

    for (let i = 0; i < n; i++) {
      const mesh = wMeshes[i]!
      const mat = mesh.material as THREE.MeshPhysicalMaterial
      const focusT = focusTs[i]!
      const back = mesh.position.z < 0

      mat.transparent = true
      mat.depthTest = true
      const baseOp = back ? 0.3 : 1
      mat.opacity = baseOp * fadeIn
      mat.depthWrite = !back && mat.opacity > 0.45
      mesh.renderOrder = back ? 1 : 10

      const sc = back ? 0.78 : 0.42 + 0.58 * focusT
      mesh.scale.setScalar(sc)

      if (i === bestIdx && focusT > 0.88) {
        if (!mesh.userData.uprightLock) {
          mesh.userData.uprightLock = true
          gsap.killTweensOf(mesh.rotation)
          gsap.to(mesh.rotation, {
            x: 0,
            y: 0,
            z: 0,
            duration: 0.45,
            ease: 'power2.out',
            overwrite: 'auto',
          })
        }
      } else {
        if (mesh.userData.uprightLock) {
          gsap.killTweensOf(mesh.rotation)
          mesh.userData.uprightLock = false
        }
        mesh.lookAt(camera.position)
        if (focusT > 0.78 && focusT <= 0.92) {
          const b = THREE.MathUtils.smoothstep(focusT, 0.78, 0.92)
          mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, 0, b)
          mesh.rotation.y = THREE.MathUtils.lerp(mesh.rotation.y, 0, b)
          mesh.rotation.z = THREE.MathUtils.lerp(mesh.rotation.z, 0, b)
        }
      }

      const baseCol =
        (mat.userData.baseColor as THREE.Color | undefined) ?? new THREE.Color(0xffffff)
      mat.color.copy(baseCol).lerp(new THREE.Color(0x8a8884), back ? 0.35 : 0)
      mat.envMapIntensity = back ? 0.22 : 0.35 + 0.65 * focusT
      mat.roughness = back ? 0.72 : 0.48

      const hi = hoveredWorkIndexRef.current
      if (hi === i) {
        mat.emissive.setHex(0x224d48)
        mat.emissiveIntensity = 0.5
      } else {
        mat.emissive.setHex(0x000000)
        mat.emissiveIntensity = 0
      }
    }

    if (focusWrap && focusTitle && focusBody) {
      if (bestFocus > 0.62) {
        focusWrap.style.opacity = String(Math.min(1, (bestFocus - 0.62) / 0.38) * fadeIn)
        if (lastCaptionIdx.current !== bestIdx) {
          lastCaptionIdx.current = bestIdx
          const proj = PROJECTS_DATA[bestIdx]!
          focusTitle.textContent = proj.title.toUpperCase()
          focusBody.textContent = proj.description
        }
        if (bestFocus > 0.78 && nearSnap) {
          focusWrap.classList.add('hero-orbit-focus-ui--bar-in')
        } else {
          focusWrap.classList.remove('hero-orbit-focus-ui--bar-in')
        }
      } else {
        focusWrap.style.opacity = '0'
        focusWrap.classList.remove('hero-orbit-focus-ui--bar-in')
        lastCaptionIdx.current = -1
      }
    }
  })

  return (
    <>
      <RoomEnvSetup />
      <ambientLight intensity={0.52} color="#fff5eb" />
      <directionalLight
        position={[4, 8, 5]}
        intensity={1.05}
        color="#fff8f0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0001}
        shadow-radius={10}
      />
      <pointLight
        ref={pinkLightRef}
        position={[-3.5, 2.5, -4]}
        intensity={2.2}
        color="#ff3388"
        distance={22}
      />
      <pointLight
        ref={warmLightRef}
        position={[4.5, -0.8, 3]}
        intensity={1.4}
        color="#ffaa55"
        distance={22}
      />
      <pointLight position={[0, -2, -5]} intensity={1} color={0xcc2266} distance={18} />
      <pointLight position={[0, 0.8, -5.5]} intensity={4.5} color={0xaaffee} distance={14} />

      <mesh rotation-x={-Math.PI / 2} position-y={-1.2} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <shadowMaterial opacity={0.09} />
      </mesh>

      <Suspense fallback={null}>
        <EtchLogoEditable
          modelScrollRef={modelScrollRef}
          onWelcomeTheatreIntroComplete={onWelcomeTheatreIntroComplete}
        />
      </Suspense>

      <group ref={workCardsGroupRef} rotation={[orbitTiltRad, 0, 0]} visible={false}>
        <primitive object={orbitLineObj} ref={orbitLineRef} />
        {cardMeshes.map((mesh, i) => (
          <EditableGroup key={PROJECTS_DATA[i]!.id} theatreKey={`Card ${i + 1}`}>
            <primitive object={mesh} />
          </EditableGroup>
        ))}
      </group>
    </>
  )
}

export type HeroR3FCanvasProps = {
  /** Fires once WebGL canvas is ready (for DOM styling / hit-testing). */
  onCanvasReady?: (canvas: HTMLCanvasElement) => void
  scrollProgressRef: React.RefObject<number>
  reduceMotion: boolean
  modelScrollRef: React.RefObject<THREE.Group | null>
  workCardMeshesRef: React.MutableRefObject<THREE.Mesh[]>
  workCardsGroupRef: React.RefObject<THREE.Group | null>
  orbitLineRef: React.RefObject<THREE.Line | null>
  orbitPtsRef: React.MutableRefObject<THREE.Vector3[]>
  pickHandlerRef: React.MutableRefObject<
    ((clientX: number, clientY: number) => void) | null
  >
  hoveredWorkIndexRef: React.MutableRefObject<number | null>
  syncDomWorkHover: (index: number | null) => void
  orbitFocusUiRef: React.RefObject<HTMLDivElement | null>
  orbitFocusTitleRef: React.RefObject<HTMLDivElement | null>
  orbitFocusBodyRef: React.RefObject<HTMLParagraphElement | null>
  canvasSize: number
  onWelcomeTheatreIntroComplete?: () => void
}

export function HeroR3FCanvas(props: HeroR3FCanvasProps) {
  const {
    canvasSize,
    scrollProgressRef,
    reduceMotion,
    modelScrollRef,
    workCardMeshesRef,
    workCardsGroupRef,
    orbitLineRef,
    orbitPtsRef,
    pickHandlerRef,
    hoveredWorkIndexRef,
    syncDomWorkHover,
    orbitFocusUiRef,
    orbitFocusTitleRef,
    orbitFocusBodyRef,
    onWelcomeTheatreIntroComplete,
  } = props

  return (
    <Canvas
      onCreated={({ gl, camera }) => {
        props.onCanvasReady?.(gl.domElement as HTMLCanvasElement)
        camera.position.set(0, 0, 8.85)
        camera.lookAt(0, 0, 0)
        camera.updateMatrixWorld()
      }}
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      }}
      shadows
      dpr={[1, 2]}
      style={{
        display: 'block',
        width: canvasSize,
        height: canvasSize,
        maxWidth: 'min(180vmin, 1044px)',
        mixBlendMode: 'normal',
      }}
      camera={{ position: [0, 0, 8.85], fov: 44, near: 0.05, far: 200 }}
    >
      <SheetProvider sheet={mainSheet}>
        <HeroSceneInner
          scrollProgressRef={scrollProgressRef}
          reduceMotion={reduceMotion}
          modelScrollRef={modelScrollRef}
          workCardMeshesRef={workCardMeshesRef}
          workCardsGroupRef={workCardsGroupRef}
          orbitLineRef={orbitLineRef}
          orbitPtsRef={orbitPtsRef}
          pickHandlerRef={pickHandlerRef}
          hoveredWorkIndexRef={hoveredWorkIndexRef}
          syncDomWorkHover={syncDomWorkHover}
          orbitFocusUiRef={orbitFocusUiRef}
          orbitFocusTitleRef={orbitFocusTitleRef}
          orbitFocusBodyRef={orbitFocusBodyRef}
          onWelcomeTheatreIntroComplete={onWelcomeTheatreIntroComplete}
        />
      </SheetProvider>
    </Canvas>
  )
}
