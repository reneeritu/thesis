import { useEffect, useRef, useState } from 'react'
import { simApi, type SimSnapshot } from '../lib/simApi'

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

    async function tick() {
      if (cancelled.current || !simRunId) return
      try {
        const s = await simApi.status(simRunId)
        if (cancelled.current) return
        setSnapshot(s)
        setError(null)
        const interval =
          s.status === 'running' || s.status === 'seeding' ? 320 : 3000
        timer = setTimeout(tick, interval)
      } catch (e) {
        if (cancelled.current) return
        setError(e instanceof Error ? e.message : 'sim status fetch failed')
        timer = setTimeout(tick, 3000)
      }
    }
    tick()

    return () => {
      cancelled.current = true
      if (timer) clearTimeout(timer)
    }
  }, [simRunId])

  return { snapshot, error }
}
