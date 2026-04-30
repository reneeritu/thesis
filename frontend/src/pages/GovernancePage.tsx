import {
  Children,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { DefTerm } from '../components/DefTerm'
import { useDefinitions } from '../context/DefinitionsContext'
import { api } from '../lib/api'
import { GLOSSARY } from '../lib/glossary'

const CATEGORY_TO_TYPES: Record<string, string[]> = {
  emergency: ['csam', 'non_consensual_imagery'],
  content: [
    'hate_speech',
    'harassment',
    'impersonation',
    'doxxing',
    'illegal_content',
    'misinformation',
    'spam',
    'nudity',
  ],
  attribution: ['plagiarism', 'false_credit', 'undeclared_ai', 'missing_lineage'],
  governance: ['space_misconduct', 'moderator_bad_faith', 'contract_violation', 'false_flagging'],
  dispute: ['credit_dispute', 'veto_dispute', 'space_ban_dispute', 'classification_appeal'],
}

const TARGET_TYPES = ['node', 'trace', 'project', 'space', 'nft', 'contract', 'media']

/** Accent for flag category chips (Etch-like, distinct from activity palette). */
const FLAG_CATEGORY_COLOR: Record<string, string> = {
  emergency: '#FF5F4A',
  content: '#D062FF',
  attribution: '#fff34a',
  governance: '#91FF62',
  dispute: '#4AEAFF',
}

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

const COMPLEXITY_COPY: Record<number, { label: string; blurb: string; hours: number }> = {
  1: { label: 'Level 1 — quick review', blurb: 'Most straightforward cases.', hours: 48 },
  2: { label: 'Level 2 — dispute', blurb: 'Needs review from multiple parties.', hours: 168 },
  3: { label: 'Level 3 — chain panel', blurb: 'Sent to a moderation panel for structured review.', hours: 336 },
  4: { label: 'Level 4 — mediation', blurb: 'Full mediation with structured phases.', hours: 720 },
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

const inputBase = 'etch-control'

const selectClass = 'etch-select'

function SelectChevron() {
  return (
    <span
      className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs leading-none text-white/35"
      aria-hidden
    >
      ▾
    </span>
  )
}

function FieldHint({ term }: { term: string }) {
  const { definitionsOn } = useDefinitions()
  const text = GLOSSARY[term]
  if (!definitionsOn || !text) return null
  return <p className="etch-field-help">{text}</p>
}

function truncateId(id: string): string {
  if (!id) return '—'
  return id.length > 8 ? `${id.slice(0, 8)}...` : id
}

function formatShortDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function flagCategoryColor(cat: string): string {
  return FLAG_CATEGORY_COLOR[cat] ?? '#a3a3a3'
}

const MEDIATION_TRIGGER_COLOR: Record<string, string> = {
  credit_dispute: '#4AEAFF',
  veto_dispute: '#FF5F4A',
  space_ban_dispute: '#D062FF',
  classification_appeal: '#fff34a',
}

function mediationTriggerColor(trigger: string): string {
  return MEDIATION_TRIGGER_COLOR[trigger] ?? FLAG_CATEGORY_COLOR.dispute
}

function StatusChip({ status }: { status: string }) {
  const label = status.replace(/_/g, ' ')
  if (status === 'peer_to_peer') {
    return (
      <span className="etch-chip shrink-0 rounded-sm border border-teal-400/35 bg-teal-400/10 px-1.5 py-px text-teal-100/88">
        {label}
      </span>
    )
  }
  const amberOpen = [
    'open',
    'panel_assigned',
    'under_review',
    'appealed',
    'space_escalated',
    'chain_escalated',
  ].includes(status)
  if (amberOpen) {
    return (
      <span className="etch-chip shrink-0 rounded-sm border border-amber-400/40 bg-amber-400/10 px-1.5 py-px text-amber-100/90">
        {label}
      </span>
    )
  }
  return (
    <span className="etch-chip shrink-0 rounded-sm border border-white/14 bg-white/[0.04] px-1.5 py-px text-white/50">
      {label}
    </span>
  )
}

function FlagCard({ f }: { f: FlagRow }) {
  const catColor = flagCategoryColor(f.flagCategory)
  return (
    <div className="rounded-sm border border-white/[0.08] bg-black/30 px-3 py-2.5 space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className="truncate font-mono text-xs uppercase tracking-[0.12em]"
          style={{ color: catColor }}
        >
          {f.flagType.replace(/_/g, ' ')}
        </span>
        <StatusChip status={f.status} />
      </div>
      <p className="m-0 font-mono text-xs text-[var(--text-muted)]">
        {f.targetType} · <span className="text-[var(--text-subtle)]">{truncateId(f.targetId)}</span>
      </p>
      <p className="etch-meta m-0 text-[var(--text-muted)]">Raised {formatShortDate(f.createdAt)}</p>
    </div>
  )
}

function MediationCard({ m }: { m: MediationRow }) {
  const c = mediationTriggerColor(m.triggerType)
  return (
    <div className="rounded-sm border border-white/[0.08] bg-black/30 px-3 py-2.5 space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="truncate font-mono text-xs uppercase tracking-[0.12em]" style={{ color: c }}>
          {m.triggerType.replace(/_/g, ' ')}
        </span>
        <StatusChip status={m.status} />
      </div>
      <p className="m-0 font-mono text-xs text-[var(--text-muted)]">
        project · <span className="text-[var(--text-subtle)]">{truncateId(m.projectId)}</span>
      </p>
      <p className="etch-meta m-0 text-[var(--text-muted)]">
        entity {m.relatedEntityType} · {formatShortDate(m.createdAt)}
      </p>
    </div>
  )
}

function HistoryBlock({
  title,
  empty,
  children,
}: {
  title: string
  empty: string
  children: ReactNode
}) {
  const has = Children.count(children) > 0
  return (
    <div className="space-y-2">
      <h3 className="etch-card-title border-b border-white/10 pb-1.5 tracking-[0.2em]">
        {title}
      </h3>
      {has ? (
        <div className="space-y-2">{children}</div>
      ) : (
        <p className="m-0 font-mono text-xs text-[var(--text-muted)]">{empty}</p>
      )}
    </div>
  )
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
  const resolvedMediations = mediations.filter((m) => m.status === 'resolved')
  const resolvedTotal = closedFlags.length + resolvedMediations.length

  return (
    <AppShell title="Governance">
      <div className="min-h-0 min-w-0 font-mono text-white">
        <div className="grid min-h-0 grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-6 lg:items-start">
          {/* LEFT — context ~25% */}
          <aside className="flex min-w-0 flex-col gap-5 lg:col-span-3">
            <div>
              <p className="etch-page-header m-0">Governance</p>
              <p className="mt-2 font-mono text-base font-normal leading-relaxed text-[var(--text-muted)]">
                Flags initiate community review. Disputes are recorded on the chain. All resolutions are permanent and
                visible.
              </p>
            </div>

            <div>
              <p className="etch-section-rule m-0 mb-2">Status</p>
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-gutter:stable]">
                {[
                  { label: 'Open flags', n: openFlags.length },
                  { label: 'Mediations', n: mediations.length },
                  { label: 'Resolved', n: resolvedTotal },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="flex min-w-[104px] max-w-[120px] shrink-0 flex-col gap-0.5 rounded-sm border border-white/[0.07] bg-black/22 px-2.5 py-2"
                  >
                    <span className="font-mono text-sm font-medium uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                      {s.label}
                    </span>
                    <span className="etch-stat-num">{s.n}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-auto space-y-1.5 border-t border-white/10 pt-4">
              <p className="etch-section-rule m-0">Legend</p>
              <p className="m-0 font-mono text-base font-normal leading-relaxed text-[var(--text-muted)]">
                <span className="text-[var(--text-secondary)]">Dispute</span> — credit, veto, space ban, classification appeals.{' '}
                <span className="text-[var(--text-secondary)]">Governance</span> — space conduct, moderator good faith, contracts.{' '}
                <span className="text-[var(--text-secondary)]">Credit dispute</span> — attribution and provenance conflicts.
              </p>
            </div>
          </aside>

          {/* MIDDLE — form ~50% */}
          <main className="min-w-0 lg:col-span-6" data-target-cursor-exclude>
            <div className="border-t border-white/12 pt-1">
              <h1 className="etch-region-title m-0">Raise flag / dispute</h1>
            </div>

            <form onSubmit={onSubmit} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="etch-field-label">
                    <DefTerm term="flag_category">Category</DefTerm>
                  </label>
                  <div className="relative">
                    <select
                      value={flagCategory}
                      onChange={(e) => setFlagCategory(e.target.value)}
                      title={definitionsOn ? GLOSSARY[flagCategory] : undefined}
                      className={selectClass}
                    >
                      {Object.keys(CATEGORY_TO_TYPES).map((c) => (
                        <option key={c} value={c} title={definitionsOn ? GLOSSARY[c] : undefined}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <SelectChevron />
                  </div>
                  <FieldHint term={flagCategory} />
                </div>
                <div>
                  <label className="etch-field-label">
                    <DefTerm term="flag_type">Type</DefTerm>
                  </label>
                  <div className="relative">
                    <select
                      value={flagType}
                      onChange={(e) => setFlagType(e.target.value)}
                      title={definitionsOn ? GLOSSARY[flagType] : undefined}
                      className={selectClass}
                    >
                      {types.map((t) => (
                        <option key={t} value={t} title={definitionsOn ? GLOSSARY[t] : undefined}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <SelectChevron />
                  </div>
                  <FieldHint term={flagType} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="etch-field-label">
                    <DefTerm term="target_type">Target type</DefTerm>
                  </label>
                  <div className="relative">
                    <select
                      value={targetType}
                      onChange={(e) => setTargetType(e.target.value)}
                      title={definitionsOn ? GLOSSARY[targetType] : undefined}
                      className={selectClass}
                    >
                      {TARGET_TYPES.map((t) => (
                        <option key={t} value={t} title={definitionsOn ? GLOSSARY[t] : undefined}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <SelectChevron />
                  </div>
                  <FieldHint term={targetType} />
                </div>
                <div>
                  <label className="etch-field-label">
                    <DefTerm term="target_id">Target ID</DefTerm>
                  </label>
                  <input
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    required
                    title={definitionsOn ? GLOSSARY.target_id : undefined}
                    className={inputBase}
                  />
                  <FieldHint term="target_id" />
                </div>
              </div>

              <div>
                <label className="etch-field-label">
                  <DefTerm term="space_id_optional">Space ID (optional)</DefTerm>
                </label>
                <input
                  value={spaceId}
                  onChange={(e) => setSpaceId(e.target.value)}
                  title={definitionsOn ? GLOSSARY.space_id_optional : undefined}
                  className={inputBase}
                />
                <FieldHint term="space_id_optional" />
              </div>

              <div>
                <label className="etch-field-label">
                  <DefTerm term="reason">Reason</DefTerm>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  rows={6}
                  title={definitionsOn ? GLOSSARY.reason : undefined}
                  className={`${inputBase} min-h-[8.5rem] resize-y`}
                />
                <FieldHint term="reason" />
              </div>

              {error ? (
                <p className="rounded-sm border border-rose-400/35 bg-rose-950/30 px-3 py-2 text-base text-rose-100/90" role="alert">
                  {error}
                </p>
              ) : null}
              {ok ? (
                <p
                  className="border border-[#2a2a2a] border-l-[3px] border-l-[#1a4a2a] bg-[#06060a] px-3 py-2.5 font-mono text-base leading-snug text-white/55"
                  role="status"
                >
                  {ok}
                </p>
              ) : null}
              {lastFlag?.complexityLevel ? (() => {
                const info = COMPLEXITY_COPY[lastFlag.complexityLevel]
                const hours = lastFlag.timeLockHours ?? info?.hours
                return (
                  <div className="rounded-sm border border-amber-400/25 bg-black/40 px-3 py-2.5 space-y-1">
                    <p className="m-0 font-mono text-xs uppercase tracking-[0.14em] text-amber-200/85">
                      {info?.label ?? `Level ${lastFlag.complexityLevel}`}
                    </p>
                    <p className="m-0 text-xs leading-relaxed text-[var(--text-muted)]">
                      {info?.blurb ?? ''} {hours ? `${prettyWindow(hours)} time-lock.` : ''}
                    </p>
                  </div>
                )
              })() : null}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-sm border border-white/22 bg-transparent py-3 font-mono text-base uppercase tracking-[0.2em] text-white/85 transition hover:border-white/38 hover:bg-white/[0.04] disabled:opacity-45"
              >
                {busy ? 'Raising…' : 'Raise flag'}
              </button>
            </form>
          </main>

          {/* RIGHT — history ~25% */}
          <aside className="flex min-w-0 flex-col gap-8 lg:col-span-3">
            <HistoryBlock title="My open flags" empty="No open flags.">
              {openFlags.length > 0 ? openFlags.map((f) => <FlagCard key={f._id} f={f} />) : null}
            </HistoryBlock>

            <HistoryBlock title="My closed flags" empty="No closed flags.">
              {closedFlags.length > 0 ? closedFlags.map((f) => <FlagCard key={f._id} f={f} />) : null}
            </HistoryBlock>

            <HistoryBlock title="My mediations" empty="No mediations.">
              {mediations.length > 0 ? mediations.map((m) => <MediationCard key={m._id} m={m} />) : null}
            </HistoryBlock>
          </aside>
        </div>
      </div>
    </AppShell>
  )
}
