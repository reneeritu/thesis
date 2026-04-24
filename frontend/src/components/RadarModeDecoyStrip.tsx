type RadarModeDecoyStripProps = {
  className?: string
}

const MODES = ['Petal', 'Wireframe', 'Compare'] as const

export function RadarModeDecoyStrip({ className = '' }: RadarModeDecoyStripProps) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 border border-white/20 bg-zinc-950/35 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.2em] ${className}`.trim()}
      role="tablist"
      aria-label="Radar render mode preview"
    >
      {MODES.map((mode) => {
        const active = mode === 'Wireframe'
        return (
          <span
            key={mode}
            role="tab"
            aria-selected={active}
            aria-label={`${mode} mode preview only`}
            className={`border-b ${
              active
                ? 'border-yellow-400 text-yellow-400'
                : 'border-transparent text-white/45'
            } px-0.5 pb-0.5`}
          >
            {mode}
          </span>
        )
      })}
      <span className="ml-1 text-white/35">preview only</span>
    </div>
  )
}
