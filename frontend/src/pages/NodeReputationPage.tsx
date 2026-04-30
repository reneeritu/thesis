import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { CrystalRadar3DLazy } from '../components/CrystalRadar3DLazy'
import { useTheme } from '../context/ThemeContext'
import { api } from '../lib/api'
import {
  CATEGORY_LABELS,
  clampReputationCategories,
  REPUTATION_CATEGORY_ORDER,
  type ReputationCategory,
} from '../lib/reputationColours'

/** Muted top accents for education cards + sliders (distinct from live crystal jewel tones). */
const CARD_ACCENTS: Record<ReputationCategory, string> = {
  craft: '#7a6a4a',
  research: '#4a6a7a',
  collaboration: '#5a4a7a',
  pedagogy: '#4a7a5a',
  consistency: '#7a5a4a',
  community: '#6a7a4a',
}

type HubProfile = {
  alias: string
  reputationCategories?: Partial<Record<ReputationCategory, number>>
  reputationScore?: number
}

type CategoryCopy = {
  def: string
  increases: string[]
  decreases: string[]
}

const CATEGORY_COPY: Record<ReputationCategory, CategoryCopy> = {
  craft: {
    def: 'skill and execution in documented making',
    increases: ['fabrication traces', 'skillwork traces', 'technical tool declarations', 'endorsed making steps'],
    decreases: ['long inactivity (slow decay)', 'no new making documented'],
  },
  research: {
    def: 'inquiry, sourcing, and ideation',
    increases: [
      'primary research traces',
      'secondary research traces',
      'brainstorm traces',
      'cited references on projects',
    ],
    decreases: ['slow decay without new research traces'],
  },
  collaboration: {
    def: 'joint work, cross-space reliability',
    increases: [
      'multi-contributor projects',
      'invited contributor accepts role',
      'cross-space project participation',
      'proxy logs confirmed by subject',
    ],
    decreases: ['invited contributions declined repeatedly', 'proxy logs disputed'],
  },
  pedagogy: {
    def: 'teaching, mentoring, and knowledge transfer',
    increases: [
      'pedagogy traces',
      'mentor role on projects',
      'endorsed as mentored by another node',
      'teaching cited as pedagogical source in references',
    ],
    decreases: ['slow decay', 'not typically penalized, only grows or holds'],
  },
  consistency: {
    def: 'regularity of documentation over time',
    increases: ['regular trace logging across weeks/months', 'sustained activity in multiple projects'],
    decreases: [
      'this is the primary decay category — gaps in documentation reduce it.',
      'long absence causes noticeable drop.',
      'most sensitive to time.',
    ],
  },
  community: {
    def: 'attestations, endorsements, cross-space health',
    increases: [
      'giving endorsements to others',
      'receiving endorsements',
      'attestations on archive work',
      'being cited as inspiration in references',
    ],
    decreases: [
      'flags raised against you that are upheld',
      'governance bad faith findings',
      'repeated false flags (slashing)',
    ],
  },
}

function slidersFromCategories(cats: Partial<Record<ReputationCategory, number>>) {
  const o = {} as Record<ReputationCategory, number>
  for (const k of REPUTATION_CATEGORY_ORDER) {
    const raw = Math.round((Number(cats[k] ?? 0) / 1000) * 100)
    o[k] = Math.max(0, Math.min(100, raw))
  }
  return o
}

function categoriesFromSliders(sliders: Record<ReputationCategory, number>) {
  const out: Partial<Record<ReputationCategory, number>> = {}
  for (const k of REPUTATION_CATEGORY_ORDER) {
    out[k] = Math.max(0, Math.min(1000, Math.round((sliders[k] ?? 0) * 10)))
  }
  return out
}

function simulatedAggregateScore(sliders: Record<ReputationCategory, number>) {
  const sum = REPUTATION_CATEGORY_ORDER.reduce((s, k) => s + (sliders[k] ?? 0), 0)
  return Math.min(1000, Math.round((sum / 600) * 1000))
}

function RepSlider({
  cat,
  value,
  accent,
  onChange,
}: {
  cat: ReputationCategory
  value: number
  accent: string
  onChange: (v: number) => void
}) {
  const pct = `${value}%`
  const style = {
    '--rep-accent': accent,
    '--rep-fill': pct,
  } as CSSProperties

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,140px)_1fr_auto]">
      <span className="font-mono text-sm uppercase tracking-[0.08em] text-[#aaaaaa] [html.light-mode_&]:text-[var(--text-secondary)]">
        {CATEGORY_LABELS[cat]}
      </span>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="etch-rep-range col-span-2 sm:col-span-1 min-h-[28px] sm:min-h-0"
        style={style}
        aria-valuenow={value}
        aria-label={`${CATEGORY_LABELS[cat]} simulation`}
      />
      <span className="font-mono text-sm tabular-nums text-[#666666] [html.light-mode_&]:text-[var(--text-muted)] sm:text-right">
        {value}
      </span>
    </div>
  )
}

export default function NodeReputationPage() {
  const { alias: aliasParam } = useParams<{ alias: string }>()
  const alias = aliasParam?.trim() ?? ''
  const { theme } = useTheme()

  const [profile, setProfile] = useState<HubProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sliders, setSliders] = useState<Record<ReputationCategory, number>>(() =>
    Object.fromEntries(REPUTATION_CATEGORY_ORDER.map((k) => [k, 0])) as Record<
      ReputationCategory,
      number
    >,
  )
  const [baselineSliders, setBaselineSliders] = useState<Record<ReputationCategory, number> | null>(
    null,
  )

  const load = useCallback(async () => {
    if (!alias) {
      setError('Missing profile alias')
      return
    }
    try {
      const me = await api<HubProfile>('/nodes/' + encodeURIComponent(alias))
      setProfile(me)
      const cats = clampReputationCategories(me.reputationCategories)
      const next = slidersFromCategories(cats)
      setSliders(next)
      setBaselineSliders(next)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load profile')
      setProfile(null)
    }
  }, [alias])

  useEffect(() => {
    void load()
  }, [load])

  const hubCats = useMemo(
    () => (profile ? clampReputationCategories(profile.reputationCategories) : {}),
    [profile],
  )

  const simCats = useMemo(() => categoriesFromSliders(sliders), [sliders])

  const displayAggregate =
    profile?.reputationScore != null && Number.isFinite(profile.reputationScore)
      ? Math.round(profile.reputationScore)
      : Math.round(
          REPUTATION_CATEGORY_ORDER.reduce((s, k) => s + (hubCats[k] ?? 0), 0) /
            REPUTATION_CATEGORY_ORDER.length,
        )

  const simScore = simulatedAggregateScore(sliders)

  const heroViewport =
    'mx-auto aspect-auto h-[min(70vh,500px)] w-[min(100%,520px)] shrink-0 overflow-visible bg-transparent [html.light-mode_&]:bg-[var(--bg-primary)]'

  const simViewport =
    'mx-auto aspect-auto h-[min(42vh,320px)] w-[min(100%,340px)] shrink-0 overflow-visible bg-transparent [html.light-mode_&]:bg-[var(--bg-primary)]'

  return (
    <AppShell title={alias ? `Reputation · ${alias}` : 'Reputation'} scrollMain>
      <div className="mx-auto flex w-full max-w-[1100px] flex-col font-mono text-white [html.light-mode_&]:text-[var(--text-primary)]">
        {error ? (
          <p className="mb-6 border border-white/15 px-3 py-2 text-sm text-white [html.light-mode_&]:border-[var(--border-default)] [html.light-mode_&]:text-[var(--text-primary)]" role="alert">
            {error}
          </p>
        ) : null}

        {/* SECTION 1 — HERO */}
        <section className="relative flex min-h-[70vh] flex-col pb-10">
          <div className="mb-6 flex justify-start">
            <Link
              to={`/nodes/${encodeURIComponent(alias)}`}
              className="font-mono text-sm text-[var(--text-muted)] transition hover:text-white [html.light-mode_&]:hover:text-[var(--text-primary)]"
            >
              ← {alias || 'profile'}
            </Link>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center">
            {profile ? (
              <CrystalRadar3DLazy
                categories={hubCats}
                aggregateReputationScore={
                  profile.reputationScore != null && Number.isFinite(profile.reputationScore)
                    ? profile.reputationScore
                    : null
                }
                hideLegendPanels
                theme={theme}
                mandalaRotateYSpeed={0.024}
                crystalViewportClassName={heroViewport}
              />
            ) : (
              !error && (
                <div className="h-[min(70vh,520px)] w-[min(100%,520px)] animate-pulse bg-white/5 [html.light-mode_&]:bg-black/5" />
              )
            )}

            <div className="mt-8 flex flex-col items-center text-center">
              <p className="mb-1 font-mono text-sm uppercase tracking-[0.14em] text-[#666666] [html.light-mode_&]:text-[var(--text-muted)]">
                Reputation score
              </p>
              <p className="flex items-baseline justify-center gap-2">
                <span className="font-mono text-2xl text-white [html.light-mode_&]:text-[var(--text-primary)]">
                  {profile ? displayAggregate : '—'}
                </span>
                <span className="font-mono text-sm text-[#666666] [html.light-mode_&]:text-[var(--text-muted)]">
                  / 1000
                </span>
              </p>
              <p className="mt-2 max-w-xl font-mono text-sm leading-relaxed text-[#777777] [html.light-mode_&]:text-[var(--text-muted)]">
                soft power signal · not a ranking · recomputed on each new documented contribution
              </p>
            </div>
          </div>

          <hr className="mt-8 border-0 border-t border-[#1a1a1a] [html.light-mode_&]:border-[var(--border-default)]" />
        </section>

        {/* SECTION 2 */}
        <section className="grid grid-cols-1 gap-10 py-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="mb-6 font-mono text-lg uppercase tracking-[0.12em] text-white [html.light-mode_&]:text-[var(--text-primary)]">
              What is the reputation crystal?
            </h2>
            <div className="max-w-[520px] space-y-5 font-mono text-base leading-[1.7] text-[#888888] [html.light-mode_&]:text-[var(--text-muted)]">
              <p>
                the crystal is a visual representation of six categories of documented contribution. its shape
                changes as the balance between categories shifts — a node that only fabricates looks different from
                one that teaches and researches.
              </p>
              <p>
                it is not a score for hiring, payment, or status. it is a record of what kind of work you have
                documented, and with what consistency.
              </p>
              <p>
                the shape is the point. two nodes with the same aggregate number can have completely different crystals
                — because the distribution across categories is what the platform actually tracks.
              </p>
            </div>
          </div>

          <div>
            <h3 className="mb-4 font-mono text-sm uppercase tracking-[0.12em] text-[#555555] [html.light-mode_&]:text-[var(--text-muted)]">
              How the score is built
            </h3>
            <dl className="space-y-0">
              {[
                ['Traces logged', 'each trace adds to the relevant category based on activity type.'],
                [
                  'Completed projects',
                  'closing a project with CREDIT gives a reputation boost to all primary contributors.',
                ],
                ['Endorsements', 'peer endorsements on your traces add independent credibility weight.'],
                [
                  'Pedagogy',
                  'mentoring and teaching traces are tracked separately and weighted — invisible labor made visible.',
                ],
              ].map(([t, d]) => (
                <div
                  key={t}
                  className="grid grid-cols-[160px_1fr] gap-x-4 border-b border-[#1a1a1a] py-[12px] [html.light-mode_&]:border-[var(--border-default)]"
                >
                  <dt className="font-mono text-sm uppercase tracking-[0.06em] text-white [html.light-mode_&]:text-[var(--text-primary)]">
                    {t}
                  </dt>
                  <dd className="font-mono text-sm leading-snug text-[#888888] [html.light-mode_&]:text-[var(--text-muted)]">
                    {d}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 font-mono text-xs leading-relaxed text-[#555555] [html.light-mode_&]:text-[var(--text-muted)]">
              archive projects carry lower base weight than live traced work. this is intentional — reconstructed history
              is less verifiable.
            </p>
          </div>
        </section>

        <hr className="border-0 border-t border-[#1a1a1a] [html.light-mode_&]:border-[var(--border-default)]" />

        {/* SECTION 3 — SIX CARDS */}
        <section className="py-12">
          <h2 className="mb-2 font-mono text-lg uppercase tracking-[0.12em] text-white [html.light-mode_&]:text-[var(--text-primary)]">
            The six axes
          </h2>
          <p className="mb-10 font-mono text-sm text-[#666666] [html.light-mode_&]:text-[var(--text-muted)]">
            the crystal is a radar of these six dimensions
          </p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {REPUTATION_CATEGORY_ORDER.map((k) => {
              const bar = CARD_ACCENTS[k]
              const copy = CATEGORY_COPY[k]
              return (
                <article
                  key={k}
                  className="border border-[#1a1a1a] bg-[#0d0d0b] p-5 [html.light-mode_&]:border-[var(--border-default)] [html.light-mode_&]:bg-[var(--bg-secondary)]"
                  style={{ boxShadow: `inset 0 3px 0 0 ${bar}` }}
                >
                  <h3 className="mb-1.5 font-mono text-[length:var(--text-md)] uppercase tracking-[0.1em] text-white [html.light-mode_&]:text-[var(--text-primary)]">
                    {CATEGORY_LABELS[k]}
                  </h3>
                  <p className="mb-4 font-mono text-sm text-[#888888] [html.light-mode_&]:text-[var(--text-muted)]">
                    {copy.def}
                  </p>
                  <p className="mb-1.5 font-mono text-xs uppercase tracking-[0.1em] text-[#555555] [html.light-mode_&]:text-[var(--text-muted)]">
                    Increases when:
                  </p>
                  <ul className="mb-4 list-disc space-y-0.5 pl-5 font-mono text-sm leading-[1.8] text-[#aaaaaa] marker:text-[#666666] [html.light-mode_&]:text-[var(--text-secondary)]">
                    {copy.increases.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <p className="mb-1.5 font-mono text-xs uppercase tracking-[0.1em] text-[#555555] [html.light-mode_&]:text-[var(--text-muted)]">
                    Decreases / decays when:
                  </p>
                  <ul className="list-disc space-y-0.5 pl-5 font-mono text-sm leading-[1.8] text-[#666666] marker:text-[#555555] [html.light-mode_&]:text-[var(--text-muted)]">
                    {copy.decreases.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </article>
              )
            })}
          </div>
        </section>

        <hr className="border-0 border-t border-[#1a1a1a] [html.light-mode_&]:border-[var(--border-default)]" />

        {/* SECTION 4 — EXPLORER */}
        <section className="py-12">
          <h2 className="mb-2 font-mono text-lg uppercase tracking-[0.12em] text-white [html.light-mode_&]:text-[var(--text-primary)]">
            What if?
          </h2>
          <p className="mb-8 max-w-2xl font-mono text-sm leading-relaxed text-[#666666] [html.light-mode_&]:text-[var(--text-muted)]">
            drag the sliders to see how different contribution patterns change the crystal shape. this does not affect
            your actual reputation.{' '}
            <span className="font-mono text-xs text-[var(--text-subtle)] [html.light-mode_&]:text-[var(--text-subtle)]">
              · simulation only ·
            </span>
          </p>

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,40%)_minmax(0,55%)] lg:justify-between lg:gap-12">
            <div className="flex flex-col gap-6">
              {REPUTATION_CATEGORY_ORDER.map((k) => (
                <RepSlider
                  key={k}
                  cat={k}
                  value={sliders[k] ?? 0}
                  accent={CARD_ACCENTS[k]}
                  onChange={(v) => setSliders((prev) => ({ ...prev, [k]: v }))}
                />
              ))}
              <button
                type="button"
                className="self-start border-0 bg-transparent p-0 font-mono text-sm tracking-[0.04em] text-[#555555] underline-offset-2 transition hover:text-[#888888] hover:underline [html.light-mode_&]:text-[var(--text-muted)]"
                onClick={() => baselineSliders && setSliders({ ...baselineSliders })}
              >
                RESET TO MY ACTUAL SCORES
              </button>
            </div>

            <div className="flex flex-col items-center">
              <CrystalRadar3DLazy
                categories={simCats}
                aggregateReputationScore={simScore}
                hideLegendPanels
                theme={theme}
                mandalaRotateYSpeed={0.035}
                crystalViewportClassName={simViewport}
              />
              <p className="mt-3 text-center font-mono text-xs uppercase tracking-[0.12em] text-[#555555] [html.light-mode_&]:text-[var(--text-muted)]">
                Simulated crystal
              </p>
              <p className="mt-1 text-center font-mono text-sm uppercase tracking-[0.06em] text-[#777777] [html.light-mode_&]:text-[var(--text-muted)]">
                Simulated score: {simScore} / 1000
              </p>
            </div>
          </div>
        </section>

        <hr className="border-0 border-t border-[#1a1a1a] [html.light-mode_&]:border-[var(--border-default)]" />

        {/* SECTION 5 */}
        <section className="mx-auto max-w-[680px] py-16 pb-24">
          <h2 className="mb-6 font-mono text-lg uppercase tracking-[0.12em] text-white [html.light-mode_&]:text-[var(--text-primary)]">
            Why a number if this isn&apos;t a competition?
          </h2>
          <div className="space-y-6 font-mono text-base leading-[1.8] text-[#888888] [html.light-mode_&]:text-[var(--text-muted)]">
            <p>
              the aggregate score exists for governance, not status. when the platform eventually moves toward
              proof-of-reputation validators — nodes who help maintain the integrity of the chain — it needs a way to
              weight participation in votes and draw moderator panels. the score is that weight.
            </p>
            <p>
              it is deliberately not shown prominently. on your profile, there is no number — only the crystal shape.
              the number exists in the data model and becomes relevant in governance contexts, not social ones.
            </p>
            <p>
              the six-axis breakdown matters more than the total. a node with 800 points concentrated entirely in
              craft contributes differently to a pedagogy dispute than one with 400 points spread evenly. the shape is
              the signal.
            </p>
          </div>
          <aside className="mt-8 border border-[#2a2a2a] bg-[#0d0d0b] p-4 font-mono text-sm leading-[1.6] text-[#888888] [html.light-mode_&]:border-[var(--border-default)] [html.light-mode_&]:bg-[var(--bg-secondary)] [html.light-mode_&]:text-[var(--text-muted)]">
            etch is not a leaderboard. there is no public ranking of nodes by score. the number is yours to understand
            your own contribution pattern — not to compare against others.
          </aside>
        </section>
      </div>
    </AppShell>
  )
}
