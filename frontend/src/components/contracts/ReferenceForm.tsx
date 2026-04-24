import { useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { Button } from '../Button'

const RELATIONSHIP_TYPES = [
  'inspired_by',
  'built_on',
  'forked_from',
  'in_response_to',
  'pedagogical_source',
  'ai_generated',
  'other',
] as const

type Props = {
  projectId: string
  onDone: () => void
}

export function ReferenceForm({ projectId, onDone }: Props) {
  const [relationshipType, setRelationshipType] = useState<(typeof RELATIONSHIP_TYPES)[number]>(RELATIONSHIP_TYPES[0])
  const [otherExplanation, setOtherExplanation] = useState('')
  const [sourceKind, setSourceKind] = useState<'url' | 'project' | 'cite'>('url')
  const [externalUrl, setExternalUrl] = useState('')
  const [sourceProjectId, setSourceProjectId] = useState('')
  const [citation, setCitation] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const body: Record<string, unknown> = { projectId, relationshipType }
      if (sourceKind === 'url') body.externalUrl = externalUrl
      if (sourceKind === 'project') body.sourceProjectId = sourceProjectId
      if (sourceKind === 'cite') body.citation = citation
      if (relationshipType === 'other') body.otherExplanation = otherExplanation
      await api('/references', { method: 'POST', body })
      setResult('Reference added.')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border border-white/25 bg-zinc-900/55 p-4 space-y-3">
      <h3 className="text-small font-heading uppercase tracking-[0.18em]">Add Reference</h3>
      <form onSubmit={onSubmit} className="space-y-3 text-small">
        <div>
          <label className="block font-mono uppercase tracking-[0.18em] text-white mb-1">Relationship</label>
          <select
            value={relationshipType}
            onChange={(e) => setRelationshipType(e.target.value as typeof relationshipType)}
            className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 font-mono text-small"
          >
            {RELATIONSHIP_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {relationshipType === 'other' && (
          <div>
            <label className="block font-mono uppercase tracking-[0.18em] text-white mb-1">Other explanation</label>
            <input
              value={otherExplanation}
              onChange={(e) => setOtherExplanation(e.target.value)}
              required
              className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 font-sans text-body"
            />
          </div>
        )}

        <div>
          <label className="block font-mono uppercase tracking-[0.18em] text-white mb-1">Source</label>
          <select
            value={sourceKind}
            onChange={(e) => setSourceKind(e.target.value as typeof sourceKind)}
            className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 font-mono text-small"
          >
            <option value="url">External URL</option>
            <option value="project">On-chain Project ID</option>
            <option value="cite">Citation text</option>
          </select>
        </div>

        {sourceKind === 'url' && (
          <div>
            <label className="block font-mono uppercase tracking-[0.18em] text-white mb-1">URL</label>
            <input
              type="url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              required
              className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 font-mono text-small"
            />
          </div>
        )}
        {sourceKind === 'project' && (
          <div>
            <label className="block font-mono uppercase tracking-[0.18em] text-white mb-1">Project ID</label>
            <input
              value={sourceProjectId}
              onChange={(e) => setSourceProjectId(e.target.value)}
              required
              className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 font-mono text-small"
            />
          </div>
        )}
        {sourceKind === 'cite' && (
          <div>
            <label className="block font-mono uppercase tracking-[0.18em] text-white mb-1">Citation</label>
            <textarea
              value={citation}
              onChange={(e) => setCitation(e.target.value)}
              required
              rows={3}
              className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 font-sans text-body"
            />
          </div>
        )}

        {error && <p className="border border-black bg-grey-100 px-3 py-2 font-mono" role="alert">{error}</p>}
        {result && <p className="border border-white/25 bg-zinc-900/55 px-3 py-2 font-mono">{result}</p>}

        <Button type="submit" variant="primary" loading={busy}>Add Reference</Button>
      </form>
    </div>
  )
}
