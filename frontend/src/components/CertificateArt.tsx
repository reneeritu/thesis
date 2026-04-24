import { useMemo } from 'react'
import {
  DEFAULT_OPTIONS,
  MAX_REROLLS,
  PALETTE_LIST,
  renderSvg,
  type Density,
  type GenInput,
  type GenOptions,
  type LineWeight,
  type Motif,
} from '../lib/provenanceArt'

type Props = {
  input: GenInput
  options?: GenOptions
  className?: string
}

/**
 * Draws the generated SVG inline. Trusted content only — produced locally from
 * our own deterministic engine; never accept foreign SVG here.
 */
export function CertificateArt({ input, options = DEFAULT_OPTIONS, className = '' }: Props) {
  const svg = useMemo(() => renderSvg(input, options), [input, options])
  return (
    <div
      className={`aspect-square overflow-hidden border border-black ${className}`}
      // trusted: we generated the SVG ourselves in this session
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

const motifs: { id: Motif; label: string }[] = [
  { id: 'facet', label: 'Facet' },
  { id: 'scatter', label: 'Scatter' },
  { id: 'sigil', label: 'Sigil' },
  { id: 'nebula', label: 'Nebula' },
]

const lineWeights: { id: LineWeight; label: string }[] = [
  { id: 'hairline', label: 'Hairline' },
  { id: 'regular', label: 'Regular' },
  { id: 'bold', label: 'Bold' },
]

const densities: { id: Density; label: string }[] = [
  { id: 'sparse', label: 'Sparse' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'dense', label: 'Dense' },
]

type CustomiserProps = {
  value: GenOptions
  onChange: (opts: GenOptions) => void
  /** Total rerolls already used this session. Hits MAX_REROLLS and button disables. */
  rerollsUsed: number
  onReroll: () => void
}

export function CertificateCustomiser({ value, onChange, rerollsUsed, onReroll }: CustomiserProps) {
  const set = <K extends keyof GenOptions>(key: K, v: GenOptions[K]) =>
    onChange({ ...value, [key]: v })

  const setLayer = <K extends keyof GenOptions['layers']>(key: K, v: boolean) =>
    onChange({ ...value, layers: { ...value.layers, [key]: v } })

  const remaining = Math.max(0, MAX_REROLLS - rerollsUsed)

  return (
    <div className="border border-white/25 bg-zinc-900/55 p-3 space-y-3 text-small">
      <h3 className="font-heading text-[11px] uppercase tracking-[0.18em]">Customise</h3>

      <section className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white">Motif</p>
        <div className="flex flex-wrap gap-1">
          {motifs.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => set('motif', m.id)}
              className={`border border-black px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition ${
                value.motif === m.id ? 'bg-black text-yellow-400' : 'bg-zinc-800/60 hover:bg-white/10'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white">Palette</p>
        <div className="flex flex-wrap gap-1">
          {PALETTE_LIST.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => set('palette', p.id)}
              className={`flex items-center gap-1 border border-black px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition ${
                value.palette === p.id ? 'bg-black text-yellow-400' : 'bg-zinc-800/60 hover:bg-white/10'
              }`}
            >
              <span className="inline-flex">
                {p.fills.map((f, i) => (
                  <span key={i} className="h-3 w-3 border border-black" style={{ background: f }} />
                ))}
              </span>
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white">Line weight</p>
          <div className="flex flex-wrap gap-1">
            {lineWeights.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => set('lineWeight', w.id)}
                className={`border border-black px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition ${
                  value.lineWeight === w.id ? 'bg-black text-yellow-400' : 'bg-zinc-800/60 hover:bg-white/10'
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white">Density</p>
          <div className="flex flex-wrap gap-1">
            {densities.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => set('density', d.id)}
                className={`border border-black px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition ${
                  value.density === d.id ? 'bg-black text-yellow-400' : 'bg-zinc-800/60 hover:bg-white/10'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white">Layers</p>
        <label className="flex items-center gap-2 font-mono text-[11px]">
          <input
            type="checkbox"
            checked={value.layers.titleGlyphs}
            onChange={(e) => setLayer('titleGlyphs', e.target.checked)}
          />
          Title glyphs
        </label>
        <label className="flex items-center gap-2 font-mono text-[11px]">
          <input
            type="checkbox"
            checked={value.layers.contributorTicks}
            onChange={(e) => setLayer('contributorTicks', e.target.checked)}
          />
          Contributor marks
        </label>
        <label className="flex items-center gap-2 font-mono text-[11px]">
          <input
            type="checkbox"
            checked={value.layers.provenanceBand}
            onChange={(e) => setLayer('provenanceBand', e.target.checked)}
          />
          Provenance band (block hash ring)
        </label>
      </section>

      <section className="flex items-center justify-between border-t border-grey-200 pt-2">
        <p className="font-mono text-[10px] text-white">
          Rerolls: {rerollsUsed} / {MAX_REROLLS}
        </p>
        <button
          type="button"
          onClick={onReroll}
          disabled={remaining === 0}
          className="border border-black bg-yellow-400 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-white hover:bg-black hover:text-yellow-400 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Reroll
        </button>
      </section>
    </div>
  )
}
