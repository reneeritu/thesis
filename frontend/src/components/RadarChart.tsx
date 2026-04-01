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

const LABELS = ['CRAFT', 'RESEARCH', 'COLLAB', 'PEDAGOGY', 'CONSIST', 'COMMUNITY']

function norm(v: number) {
  const n = Number.isFinite(v) ? v : 0
  return Math.max(0, Math.min(1, n / 1000))
}

function pt(cx: number, cy: number, r: number, i: number, total: number) {
  const ang = -Math.PI / 2 + (i * 2 * Math.PI) / total
  return { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang), ang }
}

export function RadarChart({
  categories,
  className = '',
}: {
  categories?: Partial<ReputationCategories>
  className?: string
}) {
  const cx = 110
  const cy = 110
  const r = 76
  const total = KEYS.length
  const vals = KEYS.map((k) => norm(Number(categories?.[k] ?? 0)))

  const poly = vals
    .map((v, i) => {
      const p = pt(cx, cy, r * v, i, total)
      return `${p.x},${p.y}`
    })
    .join(' ')

  return (
    <svg
      viewBox="0 0 220 240"
      className={className}
      role="img"
      aria-label="Reputation radar chart"
    >
      {[0.2, 0.4, 0.6, 0.8, 1].map((k) => {
        const ring = KEYS.map((_, i) => {
          const p = pt(cx, cy, r * k, i, total)
          return `${p.x},${p.y}`
        }).join(' ')
        return <polygon key={k} points={ring} fill="none" stroke="currentColor" opacity="0.25" />
      })}

      {KEYS.map((_, i) => {
        const p = pt(cx, cy, r, i, total)
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="currentColor" opacity="0.5" />
      })}

      <polygon points={poly} fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r="4" fill="#06b6d4" stroke="black" />

      {LABELS.map((label, i) => {
        const p = pt(cx, cy, r + 20, i, total)
        return (
          <text
            key={label}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            className="font-mono text-[9px]"
            style={{ fontSize: 9 }}
          >
            {label}
          </text>
        )
      })}
    </svg>
  )
}

