import { useEffect } from 'react'
import { AppShell } from '../components/AppShell'

/** Sends users to the hash-router app until a React dashboard exists. */
export default function LegacyDashboardRedirect() {
  useEffect(() => {
    window.location.replace('/legacy/index.html#/dashboard')
  }, [])
  return (
    <AppShell>
      <div className="py-8 font-mono text-small text-grey-400">Opening dashboard…</div>
    </AppShell>
  )
}
