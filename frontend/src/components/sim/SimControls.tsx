import type { CoreParams } from '../../sim/agentModel'

type Props = {
  params: CoreParams
  setParams: (p: Partial<CoreParams>) => void
  paused: boolean
  onPause: () => void
  onResume: () => void
  onReset: () => void
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
}) {
  return (
    <label className="flex min-w-[180px] flex-1 flex-col gap-1 font-mono text-[length:var(--text-xs)] tracking-[0.06em] text-[var(--text-muted)]">
      <span className="flex justify-between gap-2 text-[var(--text-ghost)]">
        <span>{label}</span>
        <span className="tabular-nums text-[var(--text-secondary)]">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#7c3aed]"
      />
    </label>
  )
}

export function SimControls({
  params,
  setParams,
  paused,
  onPause,
  onResume,
  onReset,
}: Props) {
  return (
    <div className="mx-auto mt-6 flex w-full max-w-[1600px] flex-col gap-5 border border-[#1a1a2e] bg-black/20 px-4 py-5">
      <div className="flex flex-wrap items-end gap-6">
        <Slider
          label="HOW MANY PEOPLE"
          min={10}
          max={40}
          step={1}
          value={params.numNodes}
          onChange={(numNodes) => setParams({ numNodes })}
        />
        <Slider
          label="HOW OFTEN PEOPLE WORK"
          min={0}
          max={1}
          step={0.05}
          value={params.activityRate}
          onChange={(activityRate) => setParams({ activityRate })}
        />
        <Slider
          label="HOW OFTEN PEOPLE VOUCH FOR EACH OTHER"
          min={0}
          max={1}
          step={0.05}
          value={params.attestationRate}
          onChange={(attestationRate) => setParams({ attestationRate })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={onReset}
          className="cursor-target rounded border border-white/25 bg-transparent px-5 py-2 font-mono text-[length:var(--text-xs)] uppercase tracking-[0.2em] text-[var(--text-primary)] hover:bg-white/5"
        >
          RESET
        </button>
        <button
          type="button"
          onClick={paused ? onResume : onPause}
          className="cursor-target rounded border border-white/25 bg-transparent px-5 py-2 font-mono text-[length:var(--text-xs)] uppercase tracking-[0.2em] text-[var(--text-primary)] hover:bg-white/5"
        >
          {paused ? 'RESUME' : 'PAUSE'}
        </button>
        <label className="ml-2 flex cursor-pointer items-center gap-2 font-mono text-[length:var(--text-xs)] uppercase tracking-[0.12em] text-[var(--text-ghost)]">
          <input
            type="checkbox"
            checked={params.equalSplit}
            onChange={(e) => setParams({ equalSplit: e.target.checked })}
            className="accent-[#67e8f9]"
          />
          SPLIT CREDIT EQUALLY
        </label>
      </div>

      <p className="text-center font-mono text-[length:var(--text-xs)] tracking-[0.12em] text-[var(--text-ghost)]">
        same world. same people. same activity. the only difference: documentation.
      </p>
    </div>
  )
}
