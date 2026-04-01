import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { api } from '../lib/api'
import { Button } from '../components/Button'

const CATEGORY_TO_TYPES: Record<string, string[]> = {
  emergency: ['csam', 'non_consensual_imagery'],
  content: ['hate_speech', 'harassment', 'impersonation', 'doxxing', 'illegal_content', 'misinformation', 'spam', 'nudity'],
  attribution: ['plagiarism', 'false_credit', 'undeclared_ai', 'missing_lineage'],
  governance: ['space_misconduct', 'moderator_bad_faith', 'contract_violation', 'false_flagging'],
  dispute: ['credit_dispute', 'veto_dispute', 'space_ban_dispute', 'classification_appeal'],
}

const TARGET_TYPES = ['node', 'trace', 'project', 'space', 'nft', 'contract', 'media']

type FlagRow = {
  _id: string
  flagCategory: string
  flagType: string
  targetType: string
  targetId: string
  status: string
  createdAt?: string
  reason?: string
}

type MediationRow = {
  _id: string
  triggerType: string
  status: string
  projectId: string
  relatedEntityType: string
  createdAt?: string
}

export default function GovernancePage() {
  const [searchParams] = useSearchParams()
  const preCategory = searchParams.get('category') || 'dispute'
  const preType = searchParams.get('type') || 'credit_dispute'
  const preTargetType = searchParams.get('targetType') || 'project'
  const preTargetId = searchParams.get('targetId') || ''

  const [flagCategory, setFlagCategory] = useState(preCategory)
  const [flagType, setFlagType] = useState(preType)
  const [targetType, setTargetType] = useState(preTargetType)
  const [targetId, setTargetId] = useState(preTargetId)
  const [spaceId, setSpaceId] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const [flags, setFlags] = useState<FlagRow[]>([])
  const [mediations, setMediations] = useState<MediationRow[]>([])

  const types = useMemo(() => CATEGORY_TO_TYPES[flagCategory] || [], [flagCategory])

  useEffect(() => {
    if (!types.includes(flagType) && types.length > 0) {
      setFlagType(types[0])
    }
  }, [types, flagType])

  async function load() {
    const [mineFlags, mineMediations] = await Promise.all([
      api<FlagRow[]>('/flags/mine').catch(() => []),
      api<MediationRow[]>('/mediations/mine').catch(() => []),
    ])
    setFlags(mineFlags)
    setMediations(mineMediations)
  }

  useEffect(() => {
    load().catch(() => {})
  }, [])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setOk(null)
    try {
      const body: Record<string, unknown> = {
        flagCategory,
        flagType,
        targetType,
        targetId,
        reason,
      }
      if (spaceId.trim()) body.spaceId = spaceId.trim()
      const res = await api<{ flag?: { _id?: string } }>('/flags', { method: 'POST', body })
      setOk(`Flag raised${res?.flag?._id ? `: ${res.flag._id}` : '.'}`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to raise flag')
    } finally {
      setBusy(false)
    }
  }

  const openFlags = flags.filter((f) => ['open', 'panel_assigned', 'under_review', 'appealed'].includes(f.status))
  const closedFlags = flags.filter((f) => !['open', 'panel_assigned', 'under_review', 'appealed'].includes(f.status))

  return (
    <AppShell title="Governance">
      <div className="space-y-6">
        <section className="border border-black bg-white p-4 space-y-3">
          <h2 className="text-small font-mono uppercase tracking-[0.18em]">Raise flag / dispute</h2>
          <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3 text-small">
            <div>
              <label className="block font-mono uppercase tracking-[0.18em] text-grey-400 mb-1">Category</label>
              <select value={flagCategory} onChange={(e) => setFlagCategory(e.target.value)} className="w-full border border-black bg-white px-3 py-2 font-mono">
                {Object.keys(CATEGORY_TO_TYPES).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-mono uppercase tracking-[0.18em] text-grey-400 mb-1">Type</label>
              <select value={flagType} onChange={(e) => setFlagType(e.target.value)} className="w-full border border-black bg-white px-3 py-2 font-mono">
                {types.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-mono uppercase tracking-[0.18em] text-grey-400 mb-1">Target type</label>
              <select value={targetType} onChange={(e) => setTargetType(e.target.value)} className="w-full border border-black bg-white px-3 py-2 font-mono">
                {TARGET_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-mono uppercase tracking-[0.18em] text-grey-400 mb-1">Target ID</label>
              <input value={targetId} onChange={(e) => setTargetId(e.target.value)} required className="w-full border border-black bg-white px-3 py-2 font-mono" />
            </div>
            <div>
              <label className="block font-mono uppercase tracking-[0.18em] text-grey-400 mb-1">Space ID (optional)</label>
              <input value={spaceId} onChange={(e) => setSpaceId(e.target.value)} className="w-full border border-black bg-white px-3 py-2 font-mono" />
            </div>
            <div className="md:col-span-2">
              <label className="block font-mono uppercase tracking-[0.18em] text-grey-400 mb-1">Reason</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} required rows={3} className="w-full border border-black bg-white px-3 py-2" />
            </div>
            {error ? <p className="md:col-span-2 border border-black bg-grey-100 px-3 py-2 font-mono" role="alert">{error}</p> : null}
            {ok ? <p className="md:col-span-2 border border-black bg-white px-3 py-2 font-mono">{ok}</p> : null}
            <div className="md:col-span-2">
              <Button type="submit" variant="primary" loading={busy}>Raise Flag</Button>
            </div>
          </form>
        </section>

        <section className="space-y-2">
          <h2 className="text-small font-mono uppercase tracking-[0.18em] text-grey-400">My open flags</h2>
          {openFlags.length === 0 ? (
            <p className="text-small text-grey-400">None.</p>
          ) : (
            <div className="space-y-2">
              {openFlags.map((f) => (
                <div key={f._id} className="border border-black bg-white px-3 py-2 text-small">
                  <p className="font-mono">{f.flagCategory} / {f.flagType} / {f.status}</p>
                  <p className="text-grey-400 break-all">{f.targetType}: {f.targetId}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-small font-mono uppercase tracking-[0.18em] text-grey-400">My closed flags</h2>
          {closedFlags.length === 0 ? (
            <p className="text-small text-grey-400">None.</p>
          ) : (
            <div className="space-y-2">
              {closedFlags.map((f) => (
                <div key={f._id} className="border border-black bg-grey-100 px-3 py-2 text-small">
                  <p className="font-mono">{f.flagCategory} / {f.flagType} / {f.status}</p>
                  <p className="text-grey-400 break-all">{f.targetType}: {f.targetId}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-small font-mono uppercase tracking-[0.18em] text-grey-400">My mediations</h2>
          {mediations.length === 0 ? (
            <p className="text-small text-grey-400">None.</p>
          ) : (
            <div className="space-y-2">
              {mediations.map((m) => (
                <div key={m._id} className="border border-black bg-white px-3 py-2 text-small">
                  <p className="font-mono">{m.triggerType} / {m.status}</p>
                  <p className="text-grey-400 break-all">project: {m.projectId} · entity: {m.relatedEntityType}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  )
}

