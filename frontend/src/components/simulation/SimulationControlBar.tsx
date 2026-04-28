import type { SimStatus } from '../../lib/simApi'

type Props = {
  simRunId: string | null
  status: SimStatus | 'none'
  onRun: () => void
  onPause: () => void
  onResume: () => void
  onRestart: () => void
  onReset: () => void
  onLoadSnapshot?: () => void
}

const btn =
  'px-3 py-1.5 text-small uppercase tracking-[0.18em] border border-white/30 rounded-sm hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition'

export function SimulationControlBar(props: Props) {
  const { simRunId, status, onRun, onPause, onResume, onRestart, onReset, onLoadSnapshot } = props
  const isRunning = status === 'running' || status === 'seeding'
  const isPaused = status === 'paused'

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-black/30 px-3 py-2">
      <span className="font-mono text-small uppercase tracking-[0.18em] text-white/50">
        Run: {simRunId ?? '—'} | {status}
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button type="button" className={btn} onClick={onRun} disabled={isRunning || isPaused}>
          Run
        </button>
        <button type="button" className={btn} onClick={onPause} disabled={!isRunning}>
          Pause
        </button>
        <button type="button" className={btn} onClick={onResume} disabled={!isPaused}>
          Resume
        </button>
        <button type="button" className={btn} onClick={onRestart} disabled={!simRunId}>
          Restart
        </button>
        <button type="button" className={btn} onClick={onReset} disabled={!simRunId}>
          Reset
        </button>
        {onLoadSnapshot ? (
          <button type="button" className={btn} onClick={onLoadSnapshot}>
            Load Snapshot
          </button>
        ) : null}
      </div>
    </div>
  )
}
