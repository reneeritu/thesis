import { useCallback, useEffect, useRef, useState } from 'react'
import { SimEntryScreen } from '../components/simulation/SimEntryScreen'
import { SimNarratorCard } from '../components/simulation/SimNarratorCard'
import { SimEndCard } from '../components/simulation/SimEndCard'
import { SimulationControlBar } from '../components/simulation/SimulationControlBar'
import { SimulationCounters } from '../components/simulation/SimulationCounters'
import { SimulationEventFeed } from '../components/simulation/SimulationEventFeed'
import { SimulationTimeline } from '../components/simulation/SimulationTimeline'
import MacroNetworkView, {
  type Selection,
} from '../components/simulation/MacroNetworkView'
import { EntityDrilldown } from '../components/simulation/EntityDrilldown'
import { simApi, type SimEvent } from '../lib/simApi'
import { useSimulationSnapshot } from '../hooks/useSimulationSnapshot'
import {
  type GamePhase,
  TRANSITION_TICK,
  NARRATOR_TRIGGER_TYPES,
  getNarratorText,
  buildEtchStats,
} from '../lib/simGameplay'

const NO_IDS: string[] = []
const NO_EVENTS: SimEvent[] = []

/** How long the "Same world. Now with documentation." interstitial holds before user can skip / auto-advances. */
const TRANSITION_MIN_MS = 2400
const TRANSITION_MAX_MS = 6000
/** If no snapshot has arrived after this many ms, drop the loading overlay anyway. */
const READY_FALLBACK_MS = 7000

type NarrLine = { id: number; text: string }

export default function SimulationPage() {
  const [phase, setPhase] = useState<GamePhase>('entry')
  const [simRunId, setSimRunId] = useState<string | null>(null)
  const [selection, setSelection] = useState<Selection>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [narratorQueue, setNarratorQueue] = useState<NarrLine[]>([])
  const [showExplore, setShowExplore] = useState(false)
  const [storyReady, setStoryReady] = useState(false)
  const [transitionCanSkip, setTransitionCanSkip] = useState(false)

  const { snapshot, error } = useSimulationSnapshot(simRunId)

  const processedNarratorEvents = useRef(0)
  const nextNarrLineId = useRef(0)
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transitionMinTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const readyFallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const act1MidTransitionDone = useRef(false)

  const ghostMode = phase === 'act1' || phase === 'transition'
  const hideLiveStoryData = phase === 'act1' && !storyReady
  const liveEvents = hideLiveStoryData ? NO_EVENTS : snapshot?.events ?? NO_EVENTS

  const status = snapshot?.status ?? 'none'
  const etchStats = buildEtchStats(
    snapshot?.counters ?? {
      tracesLogged: 0,
      mediationsResolved: 0,
      nftsMinted: 0,
    },
  )

  // ─── Phase helpers ─────────────────────────────────────────────────────────

  const advanceNarrator = useCallback(() => {
    setNarratorQueue((q) => q.slice(1))
  }, [])

  const triggerTransition = useCallback(() => {
    if (act1MidTransitionDone.current) return
    act1MidTransitionDone.current = true
    setNarratorQueue([])
    setTransitionCanSkip(false)
    setPhase('transition')

    transitionMinTimer.current = window.setTimeout(() => {
      setTransitionCanSkip(true)
    }, TRANSITION_MIN_MS)

    transitionTimer.current = window.setTimeout(() => {
      setPhase('act2')
    }, TRANSITION_MAX_MS)
  }, [])

  const skipTransition = useCallback(() => {
    if (!transitionCanSkip) return
    if (transitionTimer.current) window.clearTimeout(transitionTimer.current)
    if (transitionMinTimer.current) window.clearTimeout(transitionMinTimer.current)
    setPhase('act2')
  }, [transitionCanSkip])

  const goToEnd = useCallback(() => {
    setPhase('end')
    setNarratorQueue([])
  }, [])

  const watchAgain = useCallback(async () => {
    if (transitionTimer.current) window.clearTimeout(transitionTimer.current)
    if (transitionMinTimer.current) window.clearTimeout(transitionMinTimer.current)
    if (readyFallbackTimer.current) window.clearTimeout(readyFallbackTimer.current)
    if (simRunId) await simApi.reset(simRunId).catch(() => {})
    setSimRunId(null)
    setPhase('entry')
    setNarratorQueue([])
    setSelection(null)
    processedNarratorEvents.current = 0
    nextNarrLineId.current = 0
    act1MidTransitionDone.current = false
    setStoryReady(false)
    setTransitionCanSkip(false)
  }, [simRunId])

  const startAct1 = useCallback(async () => {
    try {
      setActionError(null)
      act1MidTransitionDone.current = false
      processedNarratorEvents.current = 0
      nextNarrLineId.current = 0
      setNarratorQueue([])
      setStoryReady(false)
      const r = await simApi.run()
      setSimRunId(r.simRunId)
      setPhase('act1')
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to start simulation')
    }
  }, [])

  // ─── Reset narrator pipeline when entering an act ──────────────────────────

  useEffect(() => {
    if (phase !== 'act1' && phase !== 'act2') return
    processedNarratorEvents.current = 0
    nextNarrLineId.current = 0
    setNarratorQueue([])
  }, [phase])

  // ─── Ready as soon as the world has spaces (works for `seeding` too) ───────

  useEffect(() => {
    if (phase !== 'act1') {
      setStoryReady(false)
      if (readyFallbackTimer.current) window.clearTimeout(readyFallbackTimer.current)
      return
    }

    const hasSpaces = (snapshot?.spaceIds?.length ?? 0) > 0
    const liveStatus =
      snapshot?.status === 'running' ||
      snapshot?.status === 'paused' ||
      snapshot?.status === 'seeding' ||
      snapshot?.status === 'complete'

    if (snapshot && hasSpaces && liveStatus) {
      setStoryReady(true)
      if (readyFallbackTimer.current) window.clearTimeout(readyFallbackTimer.current)
      return
    }

    // Fallback: drop the overlay after a few seconds even if backend is silent,
    // so we never get stuck on "Loading simulation…" forever.
    if (!readyFallbackTimer.current) {
      readyFallbackTimer.current = window.setTimeout(() => {
        setStoryReady(true)
      }, READY_FALLBACK_MS)
    }
  }, [phase, snapshot?.spaceIds, snapshot?.status, snapshot])

  // ─── Enqueue narrator lines as events arrive (one card at a time, queued) ──

  useEffect(() => {
    if (phase !== 'act1' && phase !== 'act2') return
    if (phase === 'act1' && !storyReady) return

    const events = snapshot?.events ?? []
    const start = processedNarratorEvents.current
    if (start >= events.length) return

    const newLines: NarrLine[] = []
    for (let i = start; i < events.length; i++) {
      const ev = events[i]
      if (NARRATOR_TRIGGER_TYPES.has(ev.type)) {
        const t = getNarratorText(ev.type, phase === 'act1' ? 'act1' : 'act2')
        if (t) newLines.push({ id: nextNarrLineId.current++, text: t })
      }
    }
    processedNarratorEvents.current = events.length
    if (newLines.length) setNarratorQueue((q) => [...q, ...newLines])
  }, [snapshot?.events, phase, storyReady])

  // ─── Act 1 → transition: narrator queue empty AND backend past TRANSITION_TICK ──

  useEffect(() => {
    if (phase !== 'act1') return
    if (!storyReady) return
    if ((snapshot?.currentTick ?? 0) < TRANSITION_TICK) return
    if (narratorQueue.length > 0) return
    triggerTransition()
  }, [phase, storyReady, snapshot?.currentTick, narratorQueue.length, triggerTransition])

  // ─── Act 2 → end: narrator queue empty AND backend complete ────────────────

  useEffect(() => {
    if (phase !== 'act2') return
    if (snapshot?.status !== 'complete') return
    if (narratorQueue.length > 0) return
    const t = window.setTimeout(goToEnd, 1200)
    return () => window.clearTimeout(t)
  }, [snapshot?.status, phase, narratorQueue.length, goToEnd])

  // ─── Spacebar / Enter: advance narrator, skip transition ───────────────────

  useEffect(() => {
    if (phase === 'entry' || phase === 'end') return

    const handler = (ev: KeyboardEvent) => {
      if (ev.key !== ' ' && ev.key !== 'Enter' && ev.key !== 'ArrowRight') return
      const targetEl = ev.target as HTMLElement | null
      if (
        targetEl &&
        (targetEl.tagName === 'INPUT' ||
          targetEl.tagName === 'TEXTAREA' ||
          targetEl.isContentEditable)
      ) {
        return
      }
      ev.preventDefault()
      if (phase === 'transition') {
        skipTransition()
        return
      }
      if (narratorQueue.length > 0) {
        advanceNarrator()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [phase, narratorQueue.length, advanceNarrator, skipTransition])

  // ─── Cleanup timers on unmount ─────────────────────────────────────────────

  useEffect(
    () => () => {
      if (transitionTimer.current) window.clearTimeout(transitionTimer.current)
      if (transitionMinTimer.current) window.clearTimeout(transitionMinTimer.current)
      if (readyFallbackTimer.current) window.clearTimeout(readyFallbackTimer.current)
    },
    [],
  )

  // ─── Dev controls ──────────────────────────────────────────────────────────

  const onRestart = useCallback(async () => {
    if (!simRunId) return
    try {
      setActionError(null)
      await simApi.reset(simRunId).catch(() => {})
      const r = await simApi.run(simRunId)
      setSimRunId(r.simRunId)
      setPhase('act1')
      act1MidTransitionDone.current = false
      setStoryReady(false)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to restart')
    }
  }, [simRunId])

  const onPause = useCallback(async () => {
    if (!simRunId) return
    try {
      await simApi.pause(simRunId)
    } catch {
      /* noop */
    }
  }, [simRunId])

  const onResume = useCallback(async () => {
    if (!simRunId) return
    try {
      await simApi.resume(simRunId)
    } catch {
      /* noop */
    }
  }, [simRunId])

  const onReset = useCallback(async () => {
    if (!simRunId) return
    try {
      await simApi.reset(simRunId)
      setSimRunId(null)
      setPhase('entry')
      setSelection(null)
      setNarratorQueue([])
      act1MidTransitionDone.current = false
      setStoryReady(false)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to reset')
    }
  }, [simRunId])

  const head = narratorQueue[0]

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-black text-white">

      {phase === 'entry' && <SimEntryScreen onStart={startAct1} />}

      {phase === 'transition' && (
        <button
          type="button"
          onClick={skipTransition}
          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black"
          style={{ cursor: transitionCanSkip ? 'pointer' : 'default' }}
        >
          <p className="animate-pulse font-mono text-base uppercase tracking-[0.32em] text-white/30">
            Same world.
          </p>
          <p
            className="animate-pulse font-mono text-base uppercase tracking-[0.32em] text-white/30"
            style={{ animationDelay: '0.4s' }}
          >
            Now with documentation.
          </p>
          <p
            className="mt-6 font-mono text-[10px] uppercase tracking-[0.28em] transition-opacity duration-700"
            style={{
              color: 'rgba(255,255,255,0.35)',
              opacity: transitionCanSkip ? 1 : 0,
            }}
          >
            [Space] continue →
          </p>
        </button>
      )}

      {phase === 'end' && (
        <SimEndCard
          etchStats={etchStats}
          onExplore={() => {
            setPhase('act2')
            setShowExplore(true)
          }}
          onWatchAgain={watchAgain}
        />
      )}

      <div
        className="relative flex min-h-0 flex-1 flex-col"
        style={{ visibility: phase === 'entry' ? 'hidden' : 'visible' }}
      >
        {phase === 'act1' && !storyReady && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/85">
            <p className="font-mono text-base uppercase tracking-[0.28em] text-white/45">
              Loading simulation…
            </p>
            <p className="max-w-xs text-center font-mono text-xs uppercase tracking-[0.14em] text-white/25">
              Building the world. Spaces and nodes will appear shortly.
            </p>
          </div>
        )}

        {(phase === 'act1' || phase === 'act2' || phase === 'end') && (
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2">
            <span className="font-mono text-xs uppercase tracking-[0.28em] text-white/30">
              {phase === 'act1'
                ? 'Act I — Without documentation'
                : 'Act II — With Etch'}
            </span>
            <button
              type="button"
              onClick={() => setShowExplore((v) => !v)}
              className="font-mono text-xs uppercase tracking-[0.22em] text-white/20 transition hover:text-white/50"
            >
              {showExplore ? 'Hide controls' : 'Explore ↓'}
            </button>
          </div>
        )}

        {showExplore && (
          <SimulationControlBar
            simRunId={simRunId}
            status={status}
            onRun={startAct1}
            onPause={onPause}
            onResume={onResume}
            onRestart={onRestart}
            onReset={onReset}
          />
        )}

        <div className="flex min-h-0 flex-1">
          <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
            <div className="relative flex min-h-0 flex-1 flex-col">
              <MacroNetworkView
                spaceIds={snapshot?.spaceIds ?? NO_IDS}
                heroAliases={snapshot?.heroNodeAliases ?? NO_IDS}
                projectIds={snapshot?.projectIds ?? NO_IDS}
                events={liveEvents}
                selection={selection}
                onSelect={setSelection}
                ghostMode={ghostMode}
              />

              {/* Narrator card — manual advance */}
              {(phase === 'act1' || phase === 'act2') && head && (phase === 'act2' || storyReady) && (
                <SimNarratorCard
                  key={head.id}
                  text={head.text}
                  phase={phase}
                  onAdvance={advanceNarrator}
                  queueCount={narratorQueue.length}
                />
              )}

              {/* Idle hint when between beats */}
              {(phase === 'act1' || phase === 'act2') &&
                !head &&
                (phase === 'act2' || storyReady) && (
                  <div className="pointer-events-none absolute bottom-6 right-4 z-20 font-mono text-[10px] uppercase tracking-[0.28em] text-white/25">
                    waiting for next beat…
                  </div>
                )}
            </div>
            <SimulationTimeline
              currentTick={hideLiveStoryData ? 0 : snapshot?.currentTick ?? 0}
              events={liveEvents}
              onSeek={() => undefined}
            />
          </div>

          <aside className="flex w-[360px] min-h-0 shrink-0 flex-col gap-3 overflow-y-auto border-l border-white/10 bg-black/40 p-3">
            <SimulationCounters
              counters={snapshot?.counters}
              ghostMode={ghostMode}
            />
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <h3 className="font-mono text-small uppercase tracking-[0.18em] text-white/50">
                Event Feed
              </h3>
              <SimulationEventFeed
                events={liveEvents}
                ghostMode={ghostMode}
              />
            </div>
            <EntityDrilldown
              selection={selection}
              onNavigateSpace={(id) => setSelection({ kind: 'space', id })}
            />
            {(error || actionError) && (
              <div className="rounded border border-red-500/40 bg-red-900/20 p-2 text-small text-red-200">
                {actionError ?? error}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
