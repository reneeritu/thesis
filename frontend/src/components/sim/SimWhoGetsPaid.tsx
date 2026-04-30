import { useEffect, useMemo, useState } from 'react'
import { topKCreditSharePct, type AgentNode } from '../../sim/agentModel'

type Variant = 'without' | 'with'

function totalCredit(nodes: AgentNode[]): number {
  return nodes.reduce((s, n) => s + n.creditReceived, 0)
}

function workCreditPercents(nodes: AgentNode[]) {
  const tw = nodes.reduce((s, n) => s + n.cumulativeWork, 0)
  const tc = totalCredit(nodes)
  return nodes.map((n) => ({
    node: n,
    workPct: tw > 0 ? (n.cumulativeWork / tw) * 100 : 0,
    creditPct: tc > 0 ? (n.creditReceived / tc) * 100 : 0,
  }))
}

function worstMismatchLines(nodes: AgentNode[], limit = 8): string[] {
  const rows = workCreditPercents(nodes).filter((r) => r.workPct >= 2)
  rows.sort((a, b) => {
    const unfairA = a.workPct / Math.max(a.creditPct, 0.4)
    const unfairB = b.workPct / Math.max(b.creditPct, 0.4)
    return unfairB - unfairA
  })
  return rows.slice(0, limit).map(
    (r) =>
      `${r.node.alias} did ${r.workPct.toFixed(0)}% of the work. received ${r.creditPct.toFixed(0)}% of the credit.`,
  )
}

function bestMatchLines(nodes: AgentNode[], limit = 8): string[] {
  const rows = workCreditPercents(nodes).filter((r) => r.workPct >= 2)
  rows.sort((a, b) => {
    const da = Math.abs(a.workPct - a.creditPct)
    const db = Math.abs(b.workPct - b.creditPct)
    return da - db
  })
  return rows.slice(0, limit).map((r) => {
    const cr = r.creditPct.toFixed(0)
    const wr = r.workPct.toFixed(0)
    return `${r.node.alias} did ${wr}% of the work. received ${cr}% of the credit. verified.`
  })
}

const MAX_BAR_PX = 220

export function SimWhoGetsPaidPanel({
  nodes,
  variant,
  week,
}: {
  nodes: AgentNode[]
  variant: Variant
  week: number
}) {
  const [lineIdx, setLineIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  const total = totalCredit(nodes)
  const top3Pct = topKCreditSharePct(nodes, 3)
  const maxCr = Math.max(1, ...nodes.map((n) => n.creditReceived))

  const sortedByCreditDesc = useMemo(
    () => [...nodes].sort((a, b) => b.creditReceived - a.creditReceived),
    [nodes],
  )

  const segments =
    total <= 0
      ? nodes.map((n) => ({ node: n, pct: 100 / Math.max(1, nodes.length) }))
      : variant === 'without'
        ? sortedByCreditDesc.map((n) => ({ node: n, pct: (n.creditReceived / total) * 100 }))
        : nodes.map((n) => ({ node: n, pct: (n.creditReceived / total) * 100 }))

  const top3Ids = useMemo(() => {
    const ids = [...nodes]
      .sort((a, b) => b.creditReceived - a.creditReceived)
      .slice(0, 3)
      .map((n) => n.id)
    return new Set(ids)
  }, [nodes])

  const rotation = useMemo(
    () => (variant === 'without' ? worstMismatchLines(nodes) : bestMatchLines(nodes)),
    [nodes, variant],
  )

  useEffect(() => {
    setLineIdx(0)
  }, [nodes, variant, week])

  useEffect(() => {
    if (rotation.length <= 1) return
    const id = window.setInterval(() => {
      setVisible(false)
      window.setTimeout(() => {
        setLineIdx((i) => (i + 1) % rotation.length)
        setVisible(true)
      }, 500)
    }, 4000)
    return () => window.clearInterval(id)
  }, [rotation.length])

  const injusticeLine = rotation[lineIdx] ?? ''

  const segmentColorWithout = (rank: number) => {
    if (rank === 0) return '#b91c1c'
    if (rank === 1) return '#ea580c'
    if (rank === 2) return '#f97316'
    return '#4b5563'
  }

  const rankById = new Map<string, number>()
  sortedByCreditDesc.forEach((n, i) => rankById.set(n.id, i))

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col gap-4 px-3 py-4 ${
        variant === 'without' ? 'bg-[rgba(239,68,68,0.03)]' : 'bg-[rgba(103,232,249,0.03)]'
      }`}
    >
      <div className="text-center">
        <p
          className={`font-mono text-[clamp(1.25rem,4vw,2.25rem)] font-semibold uppercase leading-tight tracking-[0.06em] ${
            variant === 'without' ? 'text-[#ef4444]' : 'text-[#67e8f9]'
          }`}
        >
          TOP 3 NODES OWN {top3Pct}% OF ALL CREDIT
        </p>

        <div className="mt-3 flex h-6 w-full overflow-hidden">
          {segments.map(({ node, pct }) => {
            const rank = rankById.get(node.id) ?? 0
            const nodeIndex = nodes.findIndex((x) => x.id === node.id)
            const bg =
              variant === 'without'
                ? segmentColorWithout(rank)
                : `hsl(${(nodeIndex * (360 / Math.max(1, nodes.length))) % 360} 35% 52%)`
            return (
              <div
                key={node.id}
                title={`${node.alias}: ${pct.toFixed(1)}%`}
                className="min-w-0 transition-[width] duration-[600ms] ease-out"
                style={{ width: `${pct}%`, backgroundColor: bg }}
              />
            )
          })}
        </div>
      </div>

      <div className="flex min-h-[240px] flex-1 items-end gap-1 pt-2">
        {nodes.map((n, nodeIndex) => {
          const h = Math.max(2, (n.creditReceived / maxCr) * MAX_BAR_PX)
          const tw = nodes.reduce((s, x) => s + x.cumulativeWork, 0)
          const tc = totalCredit(nodes)
          const workPct = tw > 0 ? (n.cumulativeWork / tw) * 100 : 0
          const creditPct = tc > 0 ? (n.creditReceived / tc) * 100 : 0
          const tip = `${n.alias}\n${n.creditReceived} credit\nwork ${workPct.toFixed(1)}%\ncredit ${creditPct.toFixed(1)}%`
          const isTop = top3Ids.has(n.id)
          return (
            <div
              key={n.id}
              title={tip}
              className="flex min-w-0 flex-1 flex-col items-stretch justify-end"
            >
              <div
                className={`w-full transition-[height] duration-[600ms] ease-out ${
                  variant === 'without'
                    ? isTop
                      ? 'bg-[#7c3aed]'
                      : 'bg-[#2a2a4a]'
                    : ''
                }`}
                style={{
                  height: `${h}px`,
                  backgroundColor:
                    variant === 'with'
                      ? `hsl(${(nodeIndex * (360 / Math.max(1, nodes.length))) % 360} 42% 48%)`
                      : undefined,
                  boxShadow:
                    variant === 'without' && isTop
                      ? '0 0 8px rgba(124, 58, 237, 0.4)'
                      : undefined,
                }}
              />
            </div>
          )
        })}
      </div>

      <p
        className={`min-h-[3rem] font-mono text-[length:var(--text-sm)] leading-snug transition-opacity duration-500 ${
          variant === 'without' ? 'text-[#ef4444]' : 'text-[#67e8f9]'
        } ${visible ? 'opacity-100' : 'opacity-0'}`}
      >
        {injusticeLine || '—'}
      </p>
    </div>
  )
}

export function SimWhoGetsPaidSection({
  leftNodes,
  rightNodes,
  week,
}: {
  leftNodes: AgentNode[]
  rightNodes: AgentNode[]
  week: number
}) {
  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 pb-2 pt-6">
      <h2 className="font-mono text-[length:var(--text-lg)] uppercase tracking-[0.28em] text-[var(--text-muted)]">
        SIM 01 — WHO GETS PAID?
      </h2>
      <p className="mt-2 max-w-3xl font-mono text-[length:var(--text-sm)] italic text-[var(--text-ghost)]">
        When no one records their work, the loudest person gets the credit.
      </p>

      <div className="relative mt-8 flex min-h-[320px] w-full flex-row border-y border-[#1a1a2e]">
        <SimWhoGetsPaidPanel nodes={leftNodes} variant="without" week={week} />

        <div className="relative flex w-px shrink-0 bg-[#1a1a2e]">
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-mono text-[length:var(--text-xs)] uppercase tracking-[0.2em] text-[var(--text-ghost)] [writing-mode:vertical-rl]">
            WEEK [{week}]
          </span>
        </div>

        <SimWhoGetsPaidPanel nodes={rightNodes} variant="with" week={week} />
      </div>

      <div className="mt-3 flex justify-between font-mono text-[length:var(--text-xs)] uppercase tracking-[0.14em] text-[var(--text-muted)]">
        <span>WITHOUT ETCH</span>
        <span>WITH ETCH</span>
      </div>
    </section>
  )
}
