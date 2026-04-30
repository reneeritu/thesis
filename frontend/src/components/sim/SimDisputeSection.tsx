import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { simApi } from '../../lib/simApi'

// ─── Data types ──────────────────────────────────────────────────────────────

export type DisputeContributor = {
  alias: string
  role: string
  tracesLogged: number
  workPct: number
}

export type DisputeStory = {
  contributors: DisputeContributor[]
  withoutCredit: Record<string, number>
  withCredit: Record<string, number>
  disputeReason: string
  mediationEvidence: { without: string; with: string }
}

const FALLBACK: DisputeStory = {
  contributors: [
    { alias: 'mira_k', role: 'lead designer', tracesLogged: 12, workPct: 28 },
    { alias: 'dev_ro', role: 'technician', tracesLogged: 31, workPct: 47 },
    { alias: 'prof_k', role: 'mentor', tracesLogged: 18, workPct: 15 },
    { alias: 'assist_j', role: 'fabrication', tracesLogged: 8, workPct: 10 },
  ],
  withoutCredit: { mira_k: 70, dev_ro: 25, prof_k: 5, assist_j: 0 },
  withCredit: { mira_k: 40, dev_ro: 38, prof_k: 15, assist_j: 7 },
  disputeReason:
    'mira_k proposed 60/40 split with dev_ro. prof_k and assist_j not mentioned.',
  mediationEvidence: {
    without: 'No traces on record. No timestamps. No evidence. Mediators must decide based on reputation scores alone.',
    with: '61 traces found across 8 weeks. Activity types: fabrication (31), pedagogy (18), brainstorm (12).',
  },
}

const EVIDENCE_ITEMS = [
  '✓ 31 fabrication traces — dev_ro (verified timestamps)',
  '✓ 18 pedagogy traces — prof_k (verified timestamps)',
  '✓ 12 brainstorm traces — mira_k (verified timestamps)',
  '✓ 8 fabrication traces — assist_j (verified timestamps)',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  'lead designer': '#a78bfa',
  technician: '#67e8f9',
  mentor: '#4ade80',
  fabrication: '#fb923c',
}

function roleColor(role: string): string {
  return ROLE_COLORS[role] ?? '#888'
}

// ─── Backend hydration ────────────────────────────────────────────────────────

async function fetchLiveStory(): Promise<DisputeStory> {
  const storedId = localStorage.getItem('sim_run_id')
  if (!storedId) throw new Error('no sim run id')

  const snap = await simApi.status(storedId)
  if (snap.status !== 'complete') throw new Error('sim not complete')

  const projectIds = snap.projectIds ?? []
  if (projectIds.length === 0) throw new Error('no projects')

  type TraceRow = {
    nodeAlias: string
    activityType: string
    description?: string
  }

  const traceLists = await Promise.all(
    projectIds.slice(-4).map((id) =>
      api<TraceRow[]>(`/traces/project/${id}`).catch(() => [] as TraceRow[]),
    ),
  )

  const allTraces = traceLists.flat()
  if (allTraces.length < 4) throw new Error('insufficient traces')

  const countsByAlias: Record<string, number> = {}
  for (const t of allTraces) {
    countsByAlias[t.nodeAlias] = (countsByAlias[t.nodeAlias] ?? 0) + 1
  }

  const entries = Object.entries(countsByAlias).sort((a, b) => b[1] - a[1]).slice(0, 4)
  const totalWork = entries.reduce((s, [, c]) => s + c, 0)

  const contributors: DisputeContributor[] = entries.map(([alias, count], i) => ({
    alias,
    role: ['lead designer', 'technician', 'mentor', 'fabrication'][i] ?? 'contributor',
    tracesLogged: count,
    workPct: Math.round((count / totalWork) * 100),
  }))

  const top = contributors[0]?.alias ?? ''
  const sec = contributors[1]?.alias ?? ''
  const third = contributors[2]?.alias ?? ''
  const fourth = contributors[3]?.alias ?? ''

  return {
    contributors,
    withoutCredit: { [top]: 70, [sec]: 25, [third]: 5, [fourth]: 0 },
    withCredit: { [top]: 38, [sec]: 40, [third]: 15, [fourth]: 7 },
    disputeReason: `${top} proposed skewed split. ${third} and ${fourth} not mentioned.`,
    mediationEvidence: FALLBACK.mediationEvidence,
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-sm border border-white/10 px-2 py-0.5 font-mono text-[length:var(--text-xs)] uppercase tracking-[0.14em] text-[var(--text-ghost)]">
      {children}
    </span>
  )
}

function TimelineBars({
  contributors,
  withDoc,
  showDisputed,
}: {
  contributors: DisputeContributor[]
  withDoc: boolean
  showDisputed: boolean
}) {
  const maxTraces = Math.max(1, ...contributors.map((c) => c.tracesLogged))
  return (
    <div className="flex flex-col gap-2">
      {contributors.map((c) => {
        const barPct = (c.tracesLogged / maxTraces) * 100
        const disputed = showDisputed && c.alias === 'dev_ro'
        return (
          <div key={c.alias} className="flex items-center gap-2">
            <div className="w-[7rem] shrink-0">
              <div className="font-mono text-[length:var(--text-xs)] uppercase tracking-[0.1em] text-[var(--text-primary)]">
                {c.alias}
              </div>
              <div className="font-mono text-[length:var(--text-xs)] text-[var(--text-ghost)]">
                {c.role}
              </div>
            </div>
            <div className="relative flex flex-1 items-center">
              <div className="h-3 w-full overflow-hidden rounded-sm bg-[#0e0e1a]">
                <div
                  className="h-full"
                  style={{
                    width: `${barPct}%`,
                    backgroundColor: withDoc ? roleColor(c.role) : '#2a2a4a',
                  }}
                />
              </div>
              {disputed && (
                <span className="ml-2 shrink-0 rounded-sm bg-[#ef4444] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-white">
                  DISPUTED
                </span>
              )}
            </div>
            <div className="w-14 shrink-0 text-right font-mono text-[length:var(--text-xs)] text-[var(--text-ghost)]">
              {withDoc ? `${c.tracesLogged} tr` : '—'}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ProposedSplit({ story, withDoc }: { story: DisputeStory; withDoc: boolean }) {
  const proposed = { mira_k: 60, dev_ro: 40, prof_k: 0, assist_j: 0 }
  const keys = story.contributors.map((c) => c.alias)
  const total = 100
  return (
    <div className="mt-4 border-t border-[#1a1a2e] pt-4">
      <p className="mb-1 font-mono text-[length:var(--text-xs)] uppercase tracking-[0.12em] text-[var(--text-ghost)]">
        PROPOSED CREDIT SPLIT
        {!withDoc && (
          <span className="ml-2 rounded-sm bg-[#ea580c]/20 px-1.5 py-0.5 text-[#ea580c]">
            PENDING, UNVERIFIED
          </span>
        )}
        {withDoc && (
          <span className="ml-2 rounded-sm bg-[#ea580c]/20 px-1.5 py-0.5 text-[#ea580c]">
            PROPOSED, PENDING
          </span>
        )}
      </p>
      <div className="flex h-6 w-full overflow-hidden">
        {keys.map((alias, i) => {
          const pct = ((proposed[alias as keyof typeof proposed] ?? 0) / total) * 100
          const col = withDoc ? roleColor(story.contributors[i]?.role ?? '') : ['#7c3aed', '#4b5563', '#374151', '#1f2937'][i] ?? '#333'
          return (
            <div
              key={alias}
              title={`${alias}: ${proposed[alias as keyof typeof proposed] ?? 0}%`}
              style={{ width: `${pct}%`, backgroundColor: pct > 0 ? col : undefined }}
            />
          )
        })}
      </div>
      <div className="mt-1 flex gap-3">
        {keys.map((alias) => (
          <span key={alias} className="font-mono text-[10px] text-[var(--text-ghost)]">
            {alias} {proposed[alias as keyof typeof proposed] ?? 0}%
          </span>
        ))}
      </div>
    </div>
  )
}

function EvidencePanel({ story, withDoc }: { story: DisputeStory; withDoc: boolean }) {
  return (
    <div className="mt-4 border-t border-[#1a1a2e] pt-4">
      <p className="mb-3 font-mono text-[length:var(--text-xs)] uppercase tracking-[0.12em] text-[var(--text-ghost)]">
        MEDIATORS ASK FOR EVIDENCE
      </p>
      {withDoc ? (
        <div className="flex flex-col gap-2">
          {EVIDENCE_ITEMS.map((item, i) => (
            <div
              key={i}
              className="font-mono text-[length:var(--text-xs)] text-[#67e8f9]"
              style={{
                animation: `fadeInUp 300ms ${i * 200}ms both`,
              }}
            >
              {item}
            </div>
          ))}
        </div>
      ) : (
        <p className="font-mono text-[length:var(--text-sm)] uppercase leading-relaxed text-[#ef4444]">
          {story.mediationEvidence.without}
        </p>
      )}
    </div>
  )
}

function RulingBar({ story, withDoc }: { story: DisputeStory; withDoc: boolean }) {
  const map = withDoc ? story.withCredit : story.withoutCredit
  const keys = story.contributors.map((c) => c.alias)
  const total = Object.values(map).reduce((a, b) => a + b, 0) || 1
  return (
    <div className="mt-4 border-t border-[#1a1a2e] pt-4">
      <p className="mb-1 font-mono text-[length:var(--text-xs)] uppercase tracking-[0.12em] text-[var(--text-ghost)]">
        FINAL RULING
      </p>
      <div className="flex h-6 w-full overflow-hidden">
        {keys.map((alias, i) => {
          const pct = ((map[alias] ?? 0) / total) * 100
          const col = withDoc ? roleColor(story.contributors[i]?.role ?? '') : ['#b91c1c', '#ea580c', '#f97316', '#6b7280'][i] ?? '#333'
          return (
            <div
              key={alias}
              title={`${alias}: ${map[alias] ?? 0}%`}
              style={{ width: `${pct}%`, backgroundColor: pct > 0 ? col : undefined }}
            />
          )
        })}
      </div>
      <div className="mt-1 flex gap-3">
        {keys.map((alias) => (
          <span key={alias} className="font-mono text-[10px] text-[var(--text-ghost)]">
            {alias} {map[alias] ?? 0}%
          </span>
        ))}
      </div>

      <table className="mt-4 w-full border-collapse font-mono text-[length:var(--text-xs)]">
        <thead>
          <tr className="border-b border-[#1a1a2e]">
            <th className="pb-1 text-left uppercase tracking-[0.1em] text-[var(--text-ghost)]">Name</th>
            <th className="pb-1 text-right uppercase tracking-[0.1em] text-[var(--text-ghost)]">Work done</th>
            <th className="pb-1 text-right uppercase tracking-[0.1em] text-[var(--text-ghost)]">Credit</th>
            <th className="pb-1 text-right uppercase tracking-[0.1em] text-[var(--text-ghost)]">Fair?</th>
          </tr>
        </thead>
        <tbody>
          {story.contributors.map((c) => {
            const credit = map[c.alias] ?? 0
            const diff = Math.abs(c.workPct - credit)
            const fair = diff <= 8
            return (
              <tr key={c.alias} className="border-b border-[#1a1a2e]">
                <td className="py-1.5 text-[var(--text-secondary)]">{c.alias}</td>
                <td className="py-1.5 text-right text-[var(--text-muted)]">{c.workPct}%</td>
                <td className="py-1.5 text-right text-[var(--text-muted)]">{credit}%</td>
                <td className={`py-1.5 text-right ${withDoc ? 'text-[#67e8f9]' : credit === 0 && c.workPct > 0 ? 'text-[#ef4444]' : 'text-[#ef4444]'}`}>
                  {withDoc || fair ? '✓ VERIFIED' : credit === 0 && c.workPct > 0 ? '✗ INVISIBLE' : diff > c.workPct * 0.4 ? '✗ UNDERPAID' : '✗ ERASED'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function OutcomeText({ withDoc, story }: { withDoc: boolean; story: DisputeStory }) {
  const contribs = story.contributors
  const c1 = contribs[1]
  const c2 = contribs[2]
  const c3 = contribs[3]

  if (withDoc) {
    const map = story.withCredit
    return (
      <div
        className="flex flex-col items-start gap-5 px-4 py-8"
        style={{ backgroundColor: 'rgba(103, 232, 249, 0.05)' }}
      >
        {[c1, c2, c3].map((c) => {
          if (!c) return null
          const credit = map[c.alias] ?? 0
          const roleLabel = c.role
          const traceLabel = `${c.tracesLogged} ${roleLabel} traces`
          return (
            <p key={c.alias} className="font-mono text-[length:var(--text-sm)] leading-relaxed text-[var(--text-primary)]">
              <span className="text-[#67e8f9]">{c.alias}</span>
              {"'s "}
              {traceLabel}.<br />
              <span className="text-[var(--text-secondary)]">On the chain. Undeniable.</span>
              <br />
              <span className="text-[var(--text-ghost)]">Cited. Credited. {credit}%.</span>
            </p>
          )
        })}
        <p className="mt-4 font-mono text-[length:var(--text-base)] uppercase leading-loose tracking-[0.18em] text-[#67e8f9]">
          THE WORK HAPPENED.<br />THE RECORD AGREED.
        </p>
      </div>
    )
  }

  const map = story.withoutCredit
  return (
    <div
      className="flex flex-col items-start gap-5 px-4 py-8"
      style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)' }}
    >
      {[c1, c2, c3].map((c) => {
        if (!c) return null
        const credit = map[c.alias] ?? 0
        const verb = c.alias === c1?.alias ? 'built the technical core' : c.alias === c2?.alias ? 'guided the project for 8 weeks' : 'fabricated the final object'
        return (
          <p key={c.alias} className="font-mono text-[length:var(--text-sm)] leading-relaxed text-[var(--text-primary)]">
            <span className="text-[var(--text-secondary)]">{c.alias}</span>{' '}
            {verb}.<br />
            <span className="text-[var(--text-ghost)]">
              Got {credit > 0 ? `${credit}%.` : 'nothing.'}
            </span>
          </p>
        )
      })}
      <p className="mt-4 font-mono text-[length:var(--text-base)] uppercase leading-loose tracking-[0.18em] text-[#ef4444]">
        THE WORK HAPPENED.<br />THE RECORD DISAGREED.
      </p>
    </div>
  )
}

// ─── Per-act column content ───────────────────────────────────────────────────

function ActColumn({
  act,
  story,
  withDoc,
}: {
  act: number
  story: DisputeStory
  withDoc: boolean
}) {
  if (act === 5) {
    return <OutcomeText withDoc={withDoc} story={story} />
  }

  return (
    <div className="flex flex-col p-4">
      {act >= 1 && <TimelineBars contributors={story.contributors} withDoc={withDoc} showDisputed={act >= 2} />}
      {act >= 2 && <ProposedSplit story={story} withDoc={withDoc} />}
      {act >= 3 && <EvidencePanel story={story} withDoc={withDoc} />}
      {act >= 4 && <RulingBar story={story} withDoc={withDoc} />}
    </div>
  )
}

// ─── Act meta ─────────────────────────────────────────────────────────────────

const ACT_META = [
  {
    act: 1,
    title: 'THE WORK',
    description: 'Eight weeks. Four people. One project. The work is done.',
    nextLabel: 'SEE WHAT HAPPENS NEXT →',
  },
  {
    act: 2,
    title: 'THE SPLIT IS PROPOSED',
    description:
      'mira_k proposes the credit split. dev_ro disputes. prof_k and assist_j are not mentioned at all.',
    nextLabel: 'MEDIATION OPENS →',
  },
  {
    act: 3,
    title: 'MEDIATION OPENS',
    description: 'The mediators ask for evidence. Both worlds produce what they have.',
    nextLabel: 'SEE THE RULING →',
  },
  {
    act: 4,
    title: 'THE RULING',
    description:
      'Mediators decide. Without evidence, they default to the original proposal. With evidence, they rebalance.',
    nextLabel: 'SEE THE OUTCOME →',
  },
  {
    act: 5,
    title: 'THE OUTCOME',
    description: '',
    nextLabel: '',
  },
]

// ─── Main section ─────────────────────────────────────────────────────────────

export function SimDisputeSection() {
  const [story, setStory] = useState<DisputeStory>(FALLBACK)
  const [currentAct, setCurrentAct] = useState(1)
  const [visible, setVisible] = useState(true)
  const transRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetchLiveStory()
      .then(setStory)
      .catch(() => {})
  }, [])

  const goToAct = (next: number) => {
    if (transRef.current) clearTimeout(transRef.current)
    setVisible(false)
    transRef.current = window.setTimeout(() => {
      setCurrentAct(next)
      setVisible(true)
    }, 300)
  }

  const meta = ACT_META[currentAct - 1]!

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 pb-8 pt-6">
      <div className="mb-2 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-mono text-[length:var(--text-lg)] uppercase tracking-[0.28em] text-[var(--text-muted)]">
            SIM 02 — THE DISPUTE
          </h2>
          <p className="mt-2 max-w-2xl font-mono text-[length:var(--text-sm)] italic text-[var(--text-ghost)]">
            Without a paper trail, the person with more power wins. Every time.
          </p>
        </div>
        <div className="shrink-0 font-mono text-[length:var(--text-xs)] uppercase tracking-[0.18em] text-[var(--text-ghost)]">
          ACT [{currentAct}] / 5
        </div>
      </div>

      <div
        className="transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <div className="mt-1">
          <SectionLabel>{meta.title}</SectionLabel>
        </div>

        <div className="mt-4 flex min-h-[280px] w-full flex-row border-y border-[#1a1a2e]">
          <div
            className="flex min-h-0 flex-1 flex-col"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.03)' }}
          >
            {currentAct === 5 ? null : (
              <div className="border-b border-[#1a1a2e] px-4 py-2 font-mono text-[length:var(--text-xs)] uppercase tracking-[0.18em] text-[var(--text-ghost)]">
                WITHOUT ETCH
              </div>
            )}
            <ActColumn act={currentAct} story={story} withDoc={false} />
          </div>

          <div className="w-px shrink-0 bg-[#1a1a2e]" />

          <div
            className="flex min-h-0 flex-1 flex-col"
            style={{ backgroundColor: 'rgba(103, 232, 249, 0.03)' }}
          >
            {currentAct === 5 ? null : (
              <div className="border-b border-[#1a1a2e] px-4 py-2 font-mono text-[length:var(--text-xs)] uppercase tracking-[0.18em] text-[var(--text-primary)]">
                WITH ETCH
              </div>
            )}
            <ActColumn act={currentAct} story={story} withDoc={true} />
          </div>
        </div>

        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            {meta.description ? (
              <p className="max-w-2xl font-mono text-[length:var(--text-sm)] text-[var(--text-secondary)]">
                {meta.description}
              </p>
            ) : null}
            {currentAct === 2 && (
              <p className="mt-1 font-mono text-[length:var(--text-xs)] text-[var(--text-ghost)]">
                {story.disputeReason}
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            {currentAct < 5 ? (
              <button
                type="button"
                onClick={() => goToAct(currentAct + 1)}
                className="cursor-target rounded border border-white/25 bg-transparent px-5 py-2 font-mono text-[length:var(--text-xs)] uppercase tracking-[0.2em] text-[var(--text-primary)] hover:bg-white/5"
              >
                {meta.nextLabel}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => goToAct(1)}
                className="cursor-target rounded border border-white/20 bg-transparent px-5 py-2 font-mono text-[length:var(--text-xs)] uppercase tracking-[0.2em] text-[var(--text-ghost)] hover:bg-white/5"
              >
                RESTART THIS STORY
              </button>
            )}
            {currentAct > 1 && currentAct < 5 && (
              <button
                type="button"
                onClick={() => goToAct(currentAct - 1)}
                className="font-mono text-[length:var(--text-xs)] uppercase tracking-[0.14em] text-[var(--text-ghost)] hover:text-[var(--text-primary)]"
              >
                ← BACK
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  )
}
