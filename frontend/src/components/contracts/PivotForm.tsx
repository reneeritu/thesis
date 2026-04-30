import { useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { Button } from '../Button'

type Props = {
  projectId: string
  onDone: () => void
}

export function PivotForm({ projectId, onDone }: Props) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      await api('/pivots', { method: 'POST', body: { projectId, reason } })
      setResult('Pivot recorded.')
      setReason('')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border border-white/25 bg-zinc-900/55 p-4 space-y-3">
      <h3 className="text-small font-heading uppercase tracking-[0.18em]">Record Pivot</h3>
      <p className="text-small text-white">A pivot records a change in direction. It does not stop the project.</p>
      <form onSubmit={onSubmit} className="space-y-3 text-small">
        <div>
          <label className="block font-mono uppercase tracking-[0.18em] text-white mb-1">What changed</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            rows={3}
            className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 font-mono text-base"
          />
        </div>

        {error && <p className="border border-black bg-grey-100 px-3 py-2 font-mono" role="alert">{error}</p>}
        {result && <p className="border border-white/25 bg-zinc-900/55 px-3 py-2 font-mono">{result}</p>}

        <Button type="submit" variant="primary" loading={busy}>Record Pivot</Button>
      </form>
    </div>
  )
}
