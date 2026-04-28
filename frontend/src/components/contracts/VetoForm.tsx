import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { Button } from '../Button'

const VETO_TYPES = ['hard_stop', 'scope_limit', 'content_flag', 'nda_seal'] as const

const VETO_HELP: Record<string, string> = {
  hard_stop: 'Halts the project. Requires majority sign-off or veto authority.',
  scope_limit: 'Restricts scope. Takes effect immediately.',
  content_flag: 'Flags targeted content. Takes effect immediately.',
  nda_seal: 'Encrypts targeted traces. Hash stays on chain. Content becomes private.',
}

type TraceItem = { _id: string; activityType?: string }

type Props = {
  projectId: string
  traces: TraceItem[]
  onDone: () => void
}

export function VetoForm({ projectId, traces, onDone }: Props) {
  const [vetoType, setVetoType] = useState<(typeof VETO_TYPES)[number]>(VETO_TYPES[0])
  const [reason, setReason] = useState('')
  const [selectedTraceIds, setSelectedTraceIds] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function toggleTrace(id: string) {
    setSelectedTraceIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      await api('/vetos', {
        method: 'POST',
        body: {
          projectId,
          vetoType,
          reason,
          targetTraceIds: [...selectedTraceIds],
        },
      })
      setResult('Veto raised.')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border border-white/25 bg-zinc-900/55 p-4 space-y-3">
      <h3 className="text-small font-heading uppercase tracking-[0.18em]">Raise Veto</h3>
      <form onSubmit={onSubmit} className="space-y-3 text-small">
        <div>
          <label className="block font-mono uppercase tracking-[0.18em] text-white mb-1">Type</label>
          <select
            value={vetoType}
            onChange={(e) => setVetoType(e.target.value as typeof vetoType)}
            className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 font-mono text-small"
          >
            {VETO_TYPES.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <p className="mt-1 font-mono text-small text-white">{VETO_HELP[vetoType]}</p>
        </div>

        <div>
          <label className="block font-mono uppercase tracking-[0.18em] text-white mb-1">Reason</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            rows={3}
            className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 font-sans text-body"
          />
        </div>

        {traces.length > 0 && (
          <details className="text-small">
            <summary className="cursor-pointer font-mono uppercase tracking-[0.18em] text-white">
              Target traces ({selectedTraceIds.size} selected)
            </summary>
            <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
              {traces.map((t) => (
                <label key={t._id} className="flex items-center gap-2 font-mono text-small">
                  <input
                    type="checkbox"
                    checked={selectedTraceIds.has(t._id)}
                    onChange={() => toggleTrace(t._id)}
                  />
                  <span className="break-all">{t._id}</span>
                  {t.activityType && <span className="text-white">{t.activityType}</span>}
                </label>
              ))}
            </div>
          </details>
        )}

        {error && <p className="border border-black bg-grey-100 px-3 py-2 font-mono" role="alert">{error}</p>}
        {result ? (
          <div className="border border-white/25 bg-zinc-900/55 px-3 py-2 font-mono space-y-2">
            <p>{result}</p>
            <Link
              to={`/governance?category=dispute&type=veto_dispute&targetType=project&targetId=${encodeURIComponent(projectId)}`}
              className="underline underline-offset-4"
            >
              Raise dispute flag for this project
            </Link>
          </div>
        ) : null}

        <Button type="submit" variant="danger" loading={busy}>Raise Veto</Button>
      </form>
    </div>
  )
}
