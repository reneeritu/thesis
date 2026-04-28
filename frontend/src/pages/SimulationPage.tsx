import { useCallback, useState } from 'react'

const NO_SNAPSHOT_IDS: string[] = []
import { SimulationControlBar } from '../components/simulation/SimulationControlBar'
import { SimulationCounters } from '../components/simulation/SimulationCounters'
import { SimulationEventFeed } from '../components/simulation/SimulationEventFeed'
import { SimulationTimeline } from '../components/simulation/SimulationTimeline'
import MacroNetworkView, {
  type Selection,
} from '../components/simulation/MacroNetworkView'
import { EntityDrilldown } from '../components/simulation/EntityDrilldown'
import { simApi } from '../lib/simApi'
import { useSimulationSnapshot } from '../hooks/useSimulationSnapshot'

export default function SimulationPage() {
  const [simRunId, setSimRunId] = useState<string | null>(null)
  const [selection, setSelection] = useState<Selection>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const { snapshot, error } = useSimulationSnapshot(simRunId)

  const onRun = useCallback(async () => {
    try {
      setActionError(null)
      const r = await simApi.run()
      setSimRunId(r.simRunId)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to start simulation')
    }
  }, [])

  const onRestart = useCallback(async () => {
    if (!simRunId) return
    try {
      setActionError(null)
      await simApi.reset(simRunId).catch(() => {})
      const r = await simApi.run(simRunId)
      setSimRunId(r.simRunId)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to restart simulation')
    }
  }, [simRunId])

  const onPause = useCallback(async () => {
    if (!simRunId) return
    try {
      setActionError(null)
      await simApi.pause(simRunId)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to pause simulation')
    }
  }, [simRunId])

  const onResume = useCallback(async () => {
    if (!simRunId) return
    try {
      setActionError(null)
      await simApi.resume(simRunId)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to resume simulation')
    }
  }, [simRunId])

  const onReset = useCallback(async () => {
    if (!simRunId) return
    try {
      setActionError(null)
      await simApi.reset(simRunId)
      setSimRunId(null)
      setSelection(null)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to reset simulation')
    }
  }, [simRunId])

  const status = snapshot?.status ?? 'none'

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-black text-white">
      <SimulationControlBar
        simRunId={simRunId}
        status={status}
        onRun={onRun}
        onPause={onPause}
        onResume={onResume}
        onRestart={onRestart}
        onReset={onReset}
      />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
          <div className="flex min-h-0 flex-1 flex-col">
            <MacroNetworkView
              spaceIds={snapshot?.spaceIds ?? NO_SNAPSHOT_IDS}
              heroAliases={snapshot?.heroNodeAliases ?? NO_SNAPSHOT_IDS}
              projectIds={snapshot?.projectIds ?? NO_SNAPSHOT_IDS}
              events={snapshot?.events ?? []}
              selection={selection}
              onSelect={setSelection}
            />
          </div>
          <SimulationTimeline
            currentTick={snapshot?.currentTick ?? 0}
            events={snapshot?.events ?? []}
            onSeek={() => undefined}
          />
        </div>
        <aside className="flex w-[360px] min-h-0 shrink-0 flex-col gap-3 overflow-y-auto border-l border-white/10 bg-black/40 p-3">
          <SimulationCounters counters={snapshot?.counters} />
          <div className="flex min-h-0 flex-1 flex-col">
            <h3 className="font-mono text-small uppercase tracking-[0.18em] text-white/50">
              Event Feed
            </h3>
            <SimulationEventFeed events={snapshot?.events ?? []} />
          </div>
          <EntityDrilldown
            selection={selection}
            onNavigateSpace={(id) => setSelection({ kind: 'space', id })}
          />
          {error || actionError ? (
            <div className="rounded border border-red-500/40 bg-red-900/20 p-2 text-small text-red-200">
              {actionError ?? error}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
