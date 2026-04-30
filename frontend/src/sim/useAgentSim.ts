import { useCallback, useEffect, useRef, useState } from 'react'
// narrator triggers removed — Sim 01 narration is handled by SimWhoGetsPaid
import {
  type CoreParams,
  type SimState,
  advanceSynchronizedPair,
  initPairedStates,
  rngForTick,
  buildSnapshot,
} from './agentModel'

export const DEFAULT_CORE_PARAMS: CoreParams = {
  numNodes: 20,
  activityRate: 0.4,
  attestationRate: 0.35,
  traceGain: 2,
  collaborationBias: 0.7,
  projectFrequency: 4,
  projectCreditPool: 100,
  equalSplit: false,
}

const TICK_MS = 1200

export type NarratorLine = { id: number; text: string }

export function useAgentSim() {
  const seedRef = useRef((Date.now() >>> 0) as number)
  const paramsRef = useRef<CoreParams>({ ...DEFAULT_CORE_PARAMS })

  const pairRef = useRef(initPairedStates(paramsRef.current, seedRef.current))

  const [params, setParamsState] = useState<CoreParams>(() => ({ ...DEFAULT_CORE_PARAMS }))
  const [left, setLeft] = useState<SimState>(() => pairRef.current.left)
  const [right, setRight] = useState<SimState>(() => pairRef.current.right)

  const [paused, setPaused] = useState(false)
  const [narrator, setNarrator] = useState<NarratorLine | null>(null)

  const syncPairToReact = useCallback((L: SimState, R: SimState) => {
    pairRef.current = { left: L, right: R }
    setLeft(L)
    setRight(R)
  }, [])

  const reset = useCallback(() => {
    seedRef.current = Date.now() >>> 0
    const { left: L, right: R } = initPairedStates(paramsRef.current, seedRef.current)
    syncPairToReact(L, R)
    setNarrator(null)
  }, [syncPairToReact])

  const setParams = useCallback(
    (patch: Partial<CoreParams>) => {
      const prev = paramsRef.current
      const next = { ...prev, ...patch }
      paramsRef.current = next
      setParamsState(next)
      if (patch.numNodes != null && patch.numNodes !== prev.numNodes) {
        queueMicrotask(reset)
      }
    },
    [reset],
  )

  const advanceOnce = useCallback(() => {
    const { left: L0, right: R0 } = pairRef.current
    const rng = rngForTick(L0.seed, L0.tick)
    const out = advanceSynchronizedPair(L0, R0, paramsRef.current, rng)
    syncPairToReact(out.left, out.right)

  }, [syncPairToReact])

  useEffect(() => {
    if (paused) return
    const id = window.setInterval(advanceOnce, TICK_MS)
    return () => window.clearInterval(id)
  }, [paused, advanceOnce])

  useEffect(() => {
    paramsRef.current = params
  }, [params])

  const dismissNarrator = useCallback(() => setNarrator(null), [])

  return {
    leftState: left,
    rightState: right,
    leftSnapshot: buildSnapshot(left),
    rightSnapshot: buildSnapshot(right),
    params,
    setParams,
    pause: () => setPaused(true),
    resume: () => setPaused(false),
    paused,
    reset,
    narrator,
    dismissNarrator,
    tickMs: TICK_MS,
  }
}
