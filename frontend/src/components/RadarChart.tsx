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

const LABELS = ['CRAFT', 'RESEARCH', 'COLLAB', 'PEDAGOGY', 'CONSIST', 'COMMUNITY']

/**
 * Normalised radial distance for a raw score.
 * Uses sqrt compression so low values get more visible spread without capping the peaks —
 * "less flat" when people have mixed activity profiles.
 */
function norm(v: number) {
  const n = Number.isFinite(v) ? v : 0
  const ratio = Math.max(0, Math.min(1, n / 1000))
  return Math.sqrt(ratio)
}

function pt(cx: number, cy: number, r: number, i: number, total: number) {
  const ang = -Math.PI / 2 + (i * 2 * Math.PI) / total
  return { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang), ang }
}

type Props = {
  categories?: Partial<ReputationCategories>
  /**
   * Second polygon overlaid inside the all-time one, representing the last ~90 days.
   * When present, it renders as a thinner translucent shape so motion = recent change.
   */
  recentCategories?: Partial<ReputationCategories>
  className?: string
  /** When true, each axis label reveals a hover definition + the raw value. */
  showDefinitions?: boolean
}

export function RadarChart({
  categories,
  recentCategories,
  className = '',
  showDefinitions = false,
}: Props) {
  const cx = 110
  const cy = 110
  const r = 76
  const total = KEYS.length
  const rawVals = KEYS.map((k) => Number(categories?.[k] ?? 0))
  const vals = rawVals.map((v) => norm(v))

  const poly = vals
    .map((v, i) => {
      const p = pt(cx, cy, r * v, i, total)
      return `${p.x},${p.y}`
    })
    .join(' ')

  const hasRecent = !!recentCategories
  const recentVals = hasRecent
    ? KEYS.map((k) => norm(Number(recentCategories?.[k] ?? 0)))
    : null
  const recentPoly = recentVals
    ? recentVals
        .map((v, i) => {
          const p = pt(cx, cy, r * v, i, total)
          return `${p.x},${p.y}`
        })
        .join(' ')
    : null

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
        return <polygon key={k} points={ring} fill="none" stroke="currentColor" opacity="0.2" />
      })}

      {KEYS.map((_, i) => {
        const p = pt(cx, cy, r, i, total)
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="currentColor" opacity="0.4" />
      })}

      {/* All-time polygon */}
      <polygon
        points={poly}
        fill="currentColor"
        fillOpacity="0.14"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      {/* Last 90 days overlay — thinner, translucent */}
      {recentPoly ? (
        <polygon
          points={recentPoly}
          fill="#06b6d4"
          fillOpacity="0.18"
          stroke="#06b6d4"
          strokeWidth="1"
          strokeDasharray="3 2"
        />
      ) : null}

      <circle cx={cx} cy={cy} r="4" fill="#06b6d4" stroke="black" />

      {LABELS.map((label, i) => {
        const p = pt(cx, cy, r + 20, i, total)
        const axisKey = KEYS[i]
        const value = Math.round(rawVals[i])
        const def = GLOSSARY[axisKey] ?? ''
        const hint = showDefinitions
          ? `${label.charAt(0) + label.slice(1).toLowerCase()} — ${value} / 1000. ${def}`
          : undefined
        return (
          <text
            key={label}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            className="font-mono text-small"
            style={{ fontSize: 14 }}
          >
            {hint ? <title>{hint}</title> : null}
            {label}
          </text>
        )
      })}
    </svg>
  )
}
