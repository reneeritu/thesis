import { useLayoutEffect, useRef } from 'react'

const MOTION_VAR_KEYS = ['--atmosphere-dtx', '--atmosphere-dty', '--atmosphere-dots-scale'] as const

function setMotionVar(host: HTMLElement, name: (typeof MOTION_VAR_KEYS)[number], value: string) {
  host.style.setProperty(name, value)
  document.documentElement.style.setProperty(name, value)
}

function clearAllMotionVars(host: HTMLElement) {
  for (const k of MOTION_VAR_KEYS) {
    host.style.removeProperty(k)
    document.documentElement.style.removeProperty(k)
  }
}

/**
 * Fixed ambient background: dark base + Ben-Day / screen halftone stacks.
 */
export function AppAtmosphere() {
  const hostRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    clearAllMotionVars(host)
    setMotionVar(host, '--atmosphere-dtx', '0')
    setMotionVar(host, '--atmosphere-dty', '0')
    setMotionVar(host, '--atmosphere-dots-scale', '1')
    return () => clearAllMotionVars(host)
  }, [])

  return (
    <div ref={hostRef} className="app-atmosphere" aria-hidden>
      <div className="app-atmosphere__base" />
      <div className="app-atmosphere__benday" aria-hidden>
        <div className="app-atmosphere__benday-layer app-atmosphere__benday-layer--c" />
        <div className="app-atmosphere__benday-layer app-atmosphere__benday-layer--m" />
        <div className="app-atmosphere__benday-layer app-atmosphere__benday-layer--y" />
      </div>
      <div className="app-atmosphere__screenhalftone" aria-hidden>
        <div className="app-atmosphere__screen-layer app-atmosphere__screen-layer--c" />
        <div className="app-atmosphere__screen-layer app-atmosphere__screen-layer--m" />
        <div className="app-atmosphere__screen-layer app-atmosphere__screen-layer--y" />
      </div>
      <div className="app-atmosphere__screen-slip" aria-hidden>
        <div className="app-atmosphere__screen-layer app-atmosphere__screen-layer--c" />
        <div className="app-atmosphere__screen-layer app-atmosphere__screen-layer--m" />
        <div className="app-atmosphere__screen-layer app-atmosphere__screen-layer--y" />
      </div>
    </div>
  )
}
