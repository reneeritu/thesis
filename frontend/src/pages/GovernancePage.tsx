import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { Button } from '../components/Button'
import { DefTerm } from '../components/DefTerm'
import { useDefinitions } from '../context/DefinitionsContext'
import { api } from '../lib/api'
import { GLOSSARY } from '../lib/glossary'

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
  complexityLevel?: number
  timeLockHours?: number
}

/** Friendly labels + copy for the complexity tiers the backend assigns. */
const COMPLEXITY_COPY: Record<number, { label: string; blurb: string; hours: number }> = {
  1: { label: 'Level 1 — quick review', blurb: 'Most straightforward cases.',                       hours: 48 },
  2: { label: 'Level 2 — dispute',      blurb: 'Needs review from multiple parties.',                hours: 168 },
  3: { label: 'Level 3 — chain panel',  blurb: 'Sent to a moderation panel for structured review.',  hours: 336 },
  4: { label: 'Level 4 — mediation',    blurb: 'Full mediation with structured phases.',             hours: 720 },
}

function prettyWindow(hours?: number): string {
  if (!hours || !Number.isFinite(hours)) return ''
  if (hours < 48) return `~${hours} h`
  const days = Math.round(hours / 24)
  return `~${days} day${days === 1 ? '' : 's'} (${hours} h)`
}

type MediationRow = {
  _id: string
  triggerType: string
  status: string
  projectId: string
  relatedEntityType: string
  createdAt?: string
}

function FieldHint({ term }: { term: string }) {
  const { definitionsOn } = useDefinitions()
  const text = GLOSSARY[term]
  if (!definitionsOn || !text) return null
  return <p className="mt-1 text-[11px] font-mono leading-snug text-white">{text}</p>
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
  const [lastFlag, setLastFlag] = useState<FlagRow | null>(null)
  const { definitionsOn } = useDefinitions()

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
      const res = await api<{ flag?: FlagRow }>('/flags', { method: 'POST', body })
      setOk(`Flag raised${res?.flag?._id ? `: ${res.flag._id}` : '.'}`)
      if (res?.flag) setLastFlag(res.flag)
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
        <section className="max-w-4xl border border-white/25 bg-zinc-900/55 p-4 space-y-3">
          <h2 className="text-small font-heading uppercase tracking-[0.18em]">
            Raise <DefTerm term="flag">flag</DefTerm> / <DefTerm term="dispute">dispute</DefTerm>
          </h2>
          <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3 text-small">
            <div>
              <label className="mb-1 block font-mono uppercase tracking-[0.18em] text-white">
                <DefTerm term="flag_category">Category</DefTerm>
              </label>
              <select
                value={flagCategory}
                onChange={(e) => setFlagCategory(e.target.value)}
                title={definitionsOn ? GLOSSARY[flagCategory] : undefined}
                className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 font-mono"
              >
                {Object.keys(CATEGORY_TO_TYPES).map((c) => (
                  <option key={c} value={c} title={definitionsOn ? GLOSSARY[c] : undefined}>
                    {c}
                  </option>
                ))}
              </select>
              <FieldHint term={flagCategory} />
            </div>
            <div>
              <label className="mb-1 block font-mono uppercase tracking-[0.18em] text-white">
                <DefTerm term="flag_type">Type</DefTerm>
              </label>
              <select
                value={flagType}
                onChange={(e) => setFlagType(e.target.value)}
                title={definitionsOn ? GLOSSARY[flagType] : undefined}
                className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 font-mono"
              >
                {types.map((t) => (
                  <option key={t} value={t} title={definitionsOn ? GLOSSARY[t] : undefined}>
                    {t}
                  </option>
                ))}
              </select>
              <FieldHint term={flagType} />
            </div>
            <div>
              <label className="mb-1 block font-mono uppercase tracking-[0.18em] text-white">
                <DefTerm term="target_type">Target type</DefTerm>
              </label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
                title={definitionsOn ? GLOSSARY[targetType] : undefined}
                className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 font-mono"
              >
                {TARGET_TYPES.map((t) => (
                  <option key={t} value={t} title={definitionsOn ? GLOSSARY[t] : undefined}>
                    {t}
                  </option>
                ))}
              </select>
              <FieldHint term={targetType} />
            </div>
            <div>
              <label className="mb-1 block font-mono uppercase tracking-[0.18em] text-white">
                <DefTerm term="target_id">Target ID</DefTerm>
              </label>
              <input
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                required
                title={definitionsOn ? GLOSSARY.target_id : undefined}
                className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 font-mono"
              />
              <FieldHint term="target_id" />
            </div>
            <div>
              <label className="mb-1 block font-mono uppercase tracking-[0.18em] text-white">
                <DefTerm term="space_id_optional">Space ID (optional)</DefTerm>
              </label>
              <input
                value={spaceId}
                onChange={(e) => setSpaceId(e.target.value)}
                title={definitionsOn ? GLOSSARY.space_id_optional : undefined}
                className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 font-mono"
              />
              <FieldHint term="space_id_optional" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block font-mono uppercase tracking-[0.18em] text-white">
                <DefTerm term="reason">Reason</DefTerm>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                rows={3}
                title={definitionsOn ? GLOSSARY.reason : undefined}
                className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2"
              />
              <FieldHint term="reason" />
            </div>
            {error ? <p className="md:col-span-2 border border-black bg-grey-100 px-3 py-2 font-mono" role="alert">{error}</p> : null}
            {ok ? <p className="md:col-span-2 border border-white/25 bg-zinc-900/55 px-3 py-2 font-mono">{ok}</p> : null}
            {lastFlag?.complexityLevel ? (() => {
              const info = COMPLEXITY_COPY[lastFlag.complexityLevel]
              const hours = lastFlag.timeLockHours ?? info?.hours
              return (
                <div className="md:col-span-2 border-l-4 border-yellow-400 bg-grey-50 px-3 py-2 space-y-0.5">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em]">
                    This looks like {info?.label ?? `Level ${lastFlag.complexityLevel}`}
                  </p>
                  <p className="text-[12px] text-white">
                    {info?.blurb ?? ''}{' '}
                    {hours ? `${prettyWindow(hours)} time-lock.` : ''}
                  </p>
                </div>
              )
            })() : null}
            <div className="md:col-span-2">
              <Button type="submit" variant="primary" loading={busy}>Raise Flag</Button>
            </div>
          </form>
        </section>

        <section className="space-y-2">
          <h2 className="text-small font-heading uppercase tracking-[0.18em] text-white">
            My open <DefTerm term="flag">flags</DefTerm>
          </h2>
          {openFlags.length === 0 ? (
            <p className="text-small text-white">None.</p>
          ) : (
            <div className="space-y-2">
              {openFlags.map((f) => (
                <div key={f._id} className="border border-white/25 bg-zinc-900/55 p-3 text-small">
                  <p className="font-mono">{f.flagCategory} / {f.flagType} / {f.status}</p>
                  <p className="text-white break-all">{f.targetType}: {f.targetId}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-small font-heading uppercase tracking-[0.18em] text-white">
            My closed <DefTerm term="flag">flags</DefTerm>
          </h2>
          {closedFlags.length === 0 ? (
            <p className="text-small text-white">None.</p>
          ) : (
            <div className="space-y-2">
              {closedFlags.map((f) => (
                <div key={f._id} className="border border-white/25 bg-zinc-900/55 p-3 text-small">
                  <p className="font-mono">{f.flagCategory} / {f.flagType} / {f.status}</p>
                  <p className="text-white break-all">{f.targetType}: {f.targetId}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-small font-heading uppercase tracking-[0.18em] text-white">
            My <DefTerm term="mediation">mediations</DefTerm>
          </h2>
          {mediations.length === 0 ? (
            <p className="text-small text-white">None.</p>
          ) : (
            <div className="space-y-2">
              {mediations.map((m) => (
                <div key={m._id} className="border border-white/25 bg-zinc-900/55 p-3 text-small">
                  <p className="font-mono">{m.triggerType} / {m.status}</p>
                  <p className="text-white break-all">project: {m.projectId} · entity: {m.relatedEntityType}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  )
}

