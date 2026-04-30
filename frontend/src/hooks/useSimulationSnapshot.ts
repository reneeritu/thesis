import { useEffect, useRef, useState } from 'react'
import { simApi, type SimSnapshot } from '../lib/simApi'

const POLL_RUNNING_MS = 2000
const POLL_SLOW_MS = 3000

export function useSimulationSnapshot(simRunId: string | null) {
  const [snapshot, setSnapshot] = useState<SimSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false
    if (!simRunId) {
      let aborted = false
      queueMicrotask(() => {
        if (aborted || cancelled.current) return
        setSnapshot(null)
      })
      return () => {
        aborted = true
        cancelled.current = true
      }
    }

    let timer: ReturnType<typeof setTimeout> | null = null

    function clearPollTimer() {
      if (timer != null) {
        clearTimeout(timer)
        timer = null
      }
    }

    async function tick() {
      if (cancelled.current || !simRunId) return
      try {
        const s = await simApi.status(simRunId)
        if (cancelled.current) return
        setSnapshot(s)
        setError(null)

        if (s.status === 'complete') {
          clearPollTimer()
          return
        }

        const delayMs =
          s.status === 'running' || s.status === 'seeding'
            ? POLL_RUNNING_MS
            : POLL_SLOW_MS

        clearPollTimer()
        timer = setTimeout(tick, delayMs)
      } catch (e) {
        if (cancelled.current) return
        setError(e instanceof Error ? e.message : 'sim status fetch failed')
        clearPollTimer()
        timer = setTimeout(tick, POLL_SLOW_MS)
      }
    }

    tick()

    return () => {
      cancelled.current = true
      clearPollTimer()
    }
  }, [simRunId])

  return { snapshot, error }
}
