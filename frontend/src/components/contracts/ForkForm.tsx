import { useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { Button } from '../Button'

type Props = {
  projectId: string
  onDone: () => void
}

export function ForkForm({ projectId, onDone }: Props) {
  const [title, setTitle] = useState('')
  const [forkReason, setForkReason] = useState('')
  const [targetSpaceId, setTargetSpaceId] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const body: Record<string, unknown> = {
        parentProjectId: projectId,
        title,
        forkReason,
      }
      if (targetSpaceId.trim()) body.targetSpaceId = targetSpaceId.trim()
      const res = await api<{ forkedProject: { _id: string } }>('/forks', { method: 'POST', body })
      setResult(`Fork created: ${res.forkedProject._id}`)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border border-white/25 bg-zinc-900/55 p-4 space-y-3">
      <h3 className="text-small font-heading uppercase tracking-[0.18em]">Fork Project</h3>
      <form onSubmit={onSubmit} className="space-y-3 text-small">
        <div>
          <label className="block font-mono uppercase tracking-[0.18em] text-white mb-1">New title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 font-sans text-body"
          />
        </div>

        <div>
          <label className="block font-mono uppercase tracking-[0.18em] text-white mb-1">Reason</label>
          <textarea
            value={forkReason}
            onChange={(e) => setForkReason(e.target.value)}
            required
            rows={3}
            className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 font-sans text-body"
          />
        </div>

        <div>
          <label className="block font-mono uppercase tracking-[0.18em] text-white mb-1">Target space ID (optional)</label>
          <input
            value={targetSpaceId}
            onChange={(e) => setTargetSpaceId(e.target.value)}
            className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 font-mono text-small"
          />
        </div>

        {error && <p className="border border-black bg-grey-100 px-3 py-2 font-mono" role="alert">{error}</p>}
        {result && <p className="border border-white/25 bg-zinc-900/55 px-3 py-2 font-mono">{result}</p>}

        <Button type="submit" variant="primary" loading={busy}>Create Fork</Button>
      </form>
    </div>
  )
}
