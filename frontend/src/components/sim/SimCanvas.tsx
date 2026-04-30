import { useEffect, useMemo, useRef } from 'react'
import type { AgentNode } from '../../sim/agentModel'

type Props = {
  nodes: AgentNode[]
  documentationOn: boolean
  width: number
  height: number
  simTick: number
  flashStartedAt: Record<string, number>
  settlementArcs: { a: string; b: string }[]
}

const REP_MIN = 50
const REP_MAX = 1000

function hash01(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return (h % 997) / 997
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function lerpHex(c1: string, c2: string, t: number): string {
  const parse = (c: string) => [
    parseInt(c.slice(1, 3), 16),
    parseInt(c.slice(3, 5), 16),
    parseInt(c.slice(5, 7), 16),
  ]
  const [r1, g1, b1] = parse(c1)
  const [r2, g2, b2] = parse(c2)
  const r = Math.round(lerp(r1, r2, t))
  const g = Math.round(lerp(g1, g2, t))
  const b = Math.round(lerp(b1, b2, t))
  return `rgb(${r},${g},${b})`
}

function heatColor(rep: number, documentationOn: boolean): string {
  if (!documentationOn) return '#2a2a4a'
  const t = Math.min(1, Math.max(0, (rep - REP_MIN) / (REP_MAX - REP_MIN)))
  if (t <= 0.5) return lerpHex('#2a2a4a', '#7c3aed', t * 2)
  return lerpHex('#7c3aed', '#67e8f9', (t - 0.5) * 2)
}

function nodeRadius(rep: number): number {
  return Math.sqrt(rep / 1000) * 16 + 4
}

export default function SimCanvas({
  nodes,
  documentationOn,
  width,
  height,
  simTick,
  flashStartedAt,
  settlementArcs,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const positionsRef = useRef<
    Record<string, { x: number; y: number; px: number; py: number }>
  >({})
  const lastTickRef = useRef(simTick)
  const prevSimTickRef = useRef(simTick)

  const maxAttest = useMemo(() => {
    let m = 1
    for (const n of nodes) {
      for (const [, ld] of n.links) m = Math.max(m, ld.attestationCount)
    }
    return m
  }, [nodes])

  const cx = width / 2
  const cy = height / 2

  useEffect(() => {
    if (simTick < prevSimTickRef.current) {
      positionsRef.current = {}
      lastTickRef.current = simTick
    }
    prevSimTickRef.current = simTick
  }, [simTick])

  useEffect(() => {
    const ids = new Set(nodes.map((n) => n.id))
    const prev = positionsRef.current
    for (const id of Object.keys(prev)) {
      if (!ids.has(id)) delete prev[id]
    }
    const angStep = (Math.PI * 2) / Math.max(1, nodes.length)
    nodes.forEach((n, i) => {
      if (!prev[n.id]) {
        const ang = angStep * i + i * 0.37
        const rad = Math.min(width, height) * 0.28
        prev[n.id] = {
          x: cx + Math.cos(ang) * rad,
          y: cy + Math.sin(ang) * rad,
          px: cx + Math.cos(ang) * rad,
          py: cy + Math.sin(ang) * rad,
        }
      }
    })
  }, [nodes, width, height, cx, cy])

  useEffect(() => {
    if (simTick === lastTickRef.current) return
    lastTickRef.current = simTick
    const pos = positionsRef.current
    for (let s = 0; s < 19; s++) integrate(pos, nodes, width, height, cx, cy)
  }, [simTick, nodes, width, height, cx, cy])

  useEffect(() => {
    let raf = 0
    const canvas = canvasRef.current
    if (!canvas) return

    const paint = (now: number) => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      integrate(positionsRef.current, nodes, width, height, cx, cy)

      ctx.clearRect(0, 0, width, height)

      const edgeSeen = new Set<string>()
      ctx.lineWidth = 1
      for (const n of nodes) {
        const pa = positionsRef.current[n.id]
        if (!pa) continue
        for (const [tid, ld] of n.links) {
          const key = n.id < tid ? `${n.id}:${tid}` : `${tid}:${n.id}`
          if (edgeSeen.has(key)) continue
          edgeSeen.add(key)
          const pb = positionsRef.current[tid]
          if (!pb) continue
          const alpha = Math.min(1, (ld.attestationCount / maxAttest) * 0.85 + 0.08)
          ctx.strokeStyle = documentationOn ? `rgba(167,139,250,${alpha * 0.9})` : `rgba(42,42,74,${alpha})`
          ctx.globalAlpha = 1
          ctx.beginPath()
          ctx.moveTo(pa.x, pa.y)
          ctx.lineTo(pb.x, pb.y)
          ctx.stroke()
        }
      }

      ctx.font = `${Math.max(10, Math.round(width / 72))}px ui-monospace, monospace`
      ctx.textAlign = 'center'

      for (const n of nodes) {
        const p = positionsRef.current[n.id]
        if (!p) continue
        const baseR = nodeRadius(n.reputation)
        let scale = 1
        const started = flashStartedAt[n.id]
        if (started != null) {
          const age = now - started
          if (age >= 0 && age < 400) {
            const u = age / 400
            scale = 1 + 0.4 * Math.sin(Math.PI * u)
          }
        }
        const r = baseR * scale

        if (!documentationOn && started != null) {
          const age = now - started
          if (age >= 0 && age < 400) {
            ctx.beginPath()
            ctx.arc(p.x, p.y, r + 3, 0, Math.PI * 2)
            ctx.strokeStyle = `rgba(140,140,150,${0.35 + 0.35 * Math.sin((age / 400) * Math.PI)})`
            ctx.lineWidth = 2
            ctx.stroke()
          }
        }

        const fill = heatColor(n.reputation, documentationOn)
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fillStyle = fill
        ctx.globalAlpha = documentationOn ? 0.95 : 0.82
        ctx.fill()
        ctx.globalAlpha = 1

        if (documentationOn && started != null) {
          const age = now - started
          if (age >= 0 && age < 400) {
            ctx.beginPath()
            ctx.arc(p.x, p.y, r + 3, 0, Math.PI * 2)
            ctx.strokeStyle = heatColor(n.reputation, true)
            ctx.globalAlpha = 0.35 + 0.35 * Math.sin((age / 400) * Math.PI)
            ctx.lineWidth = 2
            ctx.stroke()
            ctx.globalAlpha = 1
          }
        }

        ctx.strokeStyle = documentationOn ? 'rgba(240,240,238,0.25)' : 'rgba(80,80,100,0.35)'
        ctx.lineWidth = 1
        ctx.stroke()

        const labelY = p.y + r + 14
        if (documentationOn) {
          ctx.fillStyle = '#a0a0a0'
          ctx.globalAlpha = 0.95
          ctx.fillText(n.alias, p.x, labelY)
          ctx.globalAlpha = 1
        } else {
          const w = 28 + hash01(n.id) * 26
          ctx.fillStyle = '#333333'
          ctx.fillRect(p.x - w / 2, labelY - 7, w, 7)
          if (hash01(`${n.id}:b`) > 0.55) {
            const w2 = 22 + hash01(`${n.id}:c`) * 18
            ctx.fillRect(p.x - w2 / 2, labelY + 3, w2, 6)
          }
        }
      }

      if (settlementArcs.length > 0) {
        for (const { a, b } of settlementArcs) {
          const pa = positionsRef.current[a]
          const pb = positionsRef.current[b]
          if (!pa || !pb) continue
          const mx = (pa.x + pb.x) / 2
          const my = (pa.y + pb.y) / 2
          const dx = pb.x - pa.x
          const dy = pb.y - pa.y
          const nx = -dy * 0.22
          const ny = dx * 0.22
          ctx.beginPath()
          ctx.moveTo(pa.x, pa.y)
          ctx.quadraticCurveTo(mx + nx, my + ny, pb.x, pb.y)
          if (documentationOn) {
            ctx.strokeStyle = 'rgba(103,232,249,0.65)'
            ctx.lineWidth = 2
            ctx.setLineDash([])
          } else {
            ctx.strokeStyle = 'rgba(160,160,170,0.45)'
            ctx.lineWidth = 1.5
            ctx.setLineDash([4, 6])
          }
          ctx.stroke()
          ctx.setLineDash([])
        }
      }

      raf = requestAnimationFrame(paint)
    }

    raf = requestAnimationFrame(paint)
    return () => cancelAnimationFrame(raf)
  }, [
    nodes,
    documentationOn,
    width,
    height,
    cx,
    cy,
    maxAttest,
    settlementArcs,
    flashStartedAt,
    simTick,
  ])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="block h-full w-full"
      data-target-cursor-exclude
    />
  )
}

function integrate(
  pos: Record<string, { x: number; y: number; px: number; py: number }>,
  nodes: AgentNode[],
  width: number,
  height: number,
  cx: number,
  cy: number,
) {
  const damping = 0.85
  const repulse = 820
  const spring = 0.042
  const rest = 95
  const pad = 48

  const ids = nodes.map((n) => n.id)
  const ax: Record<string, number> = {}
  const ay: Record<string, number> = {}
  for (const id of ids) {
    ax[id] = 0
    ay[id] = 0
  }

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const ia = ids[i]!
      const ib = ids[j]!
      const pa = pos[ia]
      const pb = pos[ib]
      if (!pa || !pb) continue
      let dx = pa.x - pb.x
      let dy = pa.y - pb.y
      let dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 12) dist = 12
      const f = repulse / (dist * dist)
      dx /= dist
      dy /= dist
      ax[ia] = (ax[ia] ?? 0) + dx * f
      ay[ia] = (ay[ia] ?? 0) + dy * f
      ax[ib] = (ax[ib] ?? 0) - dx * f
      ay[ib] = (ay[ib] ?? 0) - dy * f
    }
  }

  const edgeSeen = new Set<string>()
  for (const n of nodes) {
    const pa = pos[n.id]
    if (!pa) continue
    for (const tid of n.links.keys()) {
      const key = n.id < tid ? `${n.id}:${tid}` : `${tid}:${n.id}`
      if (edgeSeen.has(key)) continue
      edgeSeen.add(key)
      const pb = pos[tid]
      if (!pb) continue
      let dx = pb.x - pa.x
      let dy = pb.y - pa.y
      let dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 1) dist = 1
      const delta = dist - rest
      const f = spring * delta
      dx /= dist
      dy /= dist
      ax[n.id] = (ax[n.id] ?? 0) + dx * f
      ay[n.id] = (ay[n.id] ?? 0) + dy * f
      ax[tid] = (ax[tid] ?? 0) - dx * f
      ay[tid] = (ay[tid] ?? 0) - dy * f
    }
  }

  const grav = 0.018
  for (const id of ids) {
    const p = pos[id]
    if (!p) continue
    ax[id] = (ax[id] ?? 0) + (cx - p.x) * grav
    ay[id] = (ay[id] ?? 0) + (cy - p.y) * grav

    const nx = 2 * p.x - p.px + (ax[id] ?? 0) * 0.42
    const ny = 2 * p.y - p.py + (ay[id] ?? 0) * 0.42
    p.px = p.x
    p.py = p.y
    p.x = nx * damping + cx * (1 - damping) * 0.002
    p.y = ny * damping + cy * (1 - damping) * 0.002

    p.x = Math.min(width - pad, Math.max(pad, p.x))
    p.y = Math.min(height - pad, Math.max(pad, p.y))
  }
}
