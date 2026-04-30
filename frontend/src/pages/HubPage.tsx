import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { CrystalRadar3DLazy } from '../components/CrystalRadar3DLazy'
import { GenerativeAvatar } from '../components/GenerativeAvatar'
import { useTheme } from '../context/ThemeContext'
import { api } from '../lib/api'
import { activityLabel } from '../lib/activityLabels'
import { getAlias, getToken } from '../lib/session'
import { createConversation } from '../lib/messagesApi'
import { formatTimeAgo } from '../lib/timeAgo'
import { INTEREST_PRESETS } from '../lib/interestPresets'
import {
  CATEGORY_COLOURS,
  clampReputationCategories,
  colourForActivity,
  REPUTATION_CATEGORY_ORDER,
  type ReputationCategory,
} from '../lib/reputationColours'
import { mixBlack } from '../lib/colorMix'

/** Hub right column: compact outlined actions, 1px #333, mono caps */
const hubOutlineAction =
  'etch-outlined-press inline-flex shrink-0 items-center justify-center border border-[#333333] bg-black/25 px-2.5 py-1 font-mono text-xs uppercase tracking-[0.12em] text-white/88 transition hover:border-white/40 hover:bg-white/[0.05] hover:text-white'

function chipColourForTag(tag: string): string {
  let h = 2166136261
  for (let i = 0; i < tag.length; i++) {
    h ^= tag.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return CATEGORY_COLOURS[REPUTATION_CATEGORY_ORDER[Math.abs(h) % REPUTATION_CATEGORY_ORDER.length]!]!
}

function interestChipStyle(
  col: string,
  surface: 'light' | 'dark',
  variant: 'toggle' | 'pill',
  selected?: boolean,
): CSSProperties {
  if (surface === 'light') {
    const ring = mixBlack(col, 0.3)
    return {
      backgroundColor: 'transparent',
      color: '#1a1a18',
      boxShadow:
        variant === 'pill' || selected ? `inset 0 0 0 1px ${ring}` : 'none',
    }
  }
  if (variant === 'toggle') {
    return {
      backgroundColor: `${col}22`,
      color: col,
      boxShadow: selected ? `inset 0 0 0 1px ${col}55` : 'none',
    }
  }
  return {
    backgroundColor: `${col}22`,
    color: col,
    boxShadow: `inset 0 0 0 1px ${col}44`,
  }
}

type TraceCard = {
  activityType: string
  timestamp: string
  projectId: string
  projectTitle: string
  projectStatus: string
}

type ProjectCard = {
  _id: string
  title: string
  status: string
  spaceName: string
  logoSeed?: string
}

type ArchivePreview = {
  id: string
  title: string
  medium: string
  createdAt: string
  projectId: string
}

type CompletedProject = {
  title: string
  nftId?: string | null
  projectId?: string
}

type SpaceWithName = {
  id: string
  name: string
  status?: string
}

type HubProfile = {
  _id?: string
  alias: string
  interests?: string[]
  portfolioUrl?: string
  keywords?: string[]
  profileStatement?: string
  profileLinks?: string[]
  spacesWithNames?: SpaceWithName[]
  completedProjects?: CompletedProject[]
  trustees?: string[]
  reputationCategories?: Partial<Record<ReputationCategory, number>>
  /** Present only when viewing your own node (GET /nodes/:alias with session). */
  reputationScore?: number
}

type RecentReputationResponse = {
  categories?: Partial<Record<ReputationCategory, number>>
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 mt-1 flex min-w-0 items-center gap-2">
      <span className="shrink-0 font-mono text-xs uppercase tracking-[0.22em] text-[var(--text-secondary)]">{children}</span>
      <span className="h-px min-w-0 flex-1 bg-white/12" aria-hidden />
    </div>
  )
}

function HubTallCard({
  seed,
  title,
  href,
  subtitle,
  status,
  variant = 'default',
  showStatusDot = true,
}: {
  seed: string
  title: string
  href: string
  subtitle?: string
  status?: string
  variant?: 'default' | 'completed' | 'archive'
  showStatusDot?: boolean
}) {
  const dotActive =
    status === 'active'
      ? 'bg-emerald-400 shadow-[0_0_7px_rgba(52,211,153,0.45)]'
      : 'bg-amber-300/90 shadow-[0_0_6px_rgba(251,191,36,0.35)]'

  const shell =
    variant === 'completed'
      ? 'etch-card-hover-border border border-amber-400/40 ring-1 ring-amber-400/20 hover:border-amber-400/55'
      : variant === 'archive'
        ? 'etch-card-hover-border border border-white/10 opacity-[0.82] saturate-[0.72] hover:border-white/20'
        : 'etch-card-hover-border border border-white/12 hover:border-white/26'

  return (
    <Link
      to={href}
      className={`group flex h-[208px] w-[118px] shrink-0 flex-col overflow-hidden rounded-sm bg-black/28 transition hover:border-white/22 ${shell}`}
    >
      <div className="relative min-h-0 flex-[7] w-full overflow-hidden bg-neutral-950/55">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <GenerativeAvatar
            seed={seed}
            size={220}
            monochrome={false}
            luminescent
            className="opacity-92 transition group-hover:opacity-100"
          />
        </div>
        {showStatusDot && variant !== 'archive' ? (
          <span
            className={`absolute right-2 top-2 h-2 w-2 rounded-full ${status === 'active' ? dotActive : 'bg-white/30'}`}
            title={status === 'active' ? 'Active' : 'Dormant'}
            aria-hidden
          />
        ) : null}
      </div>
      <div className="flex min-h-0 flex-[3] flex-col justify-center gap-0.5 px-2 py-1.5">
        <span className="line-clamp-2 font-mono text-xs uppercase tracking-[0.16em] text-white/88">{title}</span>
        {subtitle ? (
          <span className="line-clamp-2 text-xs leading-tight text-[var(--text-muted)]">{subtitle}</span>
        ) : null}
      </div>
    </Link>
  )
}

function ViewAllTall({ href }: { href: string }) {
  return (
    <Link
      to={href}
      className="flex h-[208px] w-[118px] shrink-0 flex-col items-center justify-center gap-1 rounded-sm border border-white/16 bg-black/18 font-mono text-xs uppercase tracking-[0.18em] text-white/58 transition hover:border-white/38 hover:text-white/88"
    >
      View all
      <span aria-hidden className="text-base">
        →
      </span>
    </Link>
  )
}

function AddTall({ href, label }: { href: string; label: string }) {
  return (
    <Link
      to={href}
      className="flex h-[208px] w-[118px] shrink-0 flex-col items-center justify-center rounded-sm border border-dashed border-white/22 bg-transparent text-[22px] font-light leading-none text-white/42 transition hover:border-white/42 hover:text-white/78"
      aria-label={label}
    >
      +
    </Link>
  )
}

export default function HubPage() {
  const { theme } = useTheme()
  const params = useParams<{ alias?: string }>()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<HubProfile | null>(null)
  const [traces, setTraces] = useState<TraceCard[]>([])
  const [projects, setProjects] = useState<ProjectCard[]>([])
  const [archives, setArchives] = useState<ArchivePreview[]>([])
  const [recentCrystalCategories, setRecentCrystalCategories] = useState<
    Partial<Record<ReputationCategory, number>> | undefined
  >(undefined)
  const [hashCopied, setHashCopied] = useState(false)
  const [pulseInterest, setPulseInterest] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [statement, setStatement] = useState('')
  const [portfolioUrl, setPortfolioUrl] = useState('')
  const [extraLinks, setExtraLinks] = useState<string[]>([])
  const [interestSel, setInterestSel] = useState<Set<string>>(() => new Set())
  const [customInterest, setCustomInterest] = useState('')
  const [stmtEditing, setStmtEditing] = useState(false)
  const [interestInputOpen, setInterestInputOpen] = useState(false)
  /** Collapsed by default so Links / Trustees stay reachable without scrolling the full preset grid */
  const [hubInterestsExpanded, setHubInterestsExpanded] = useState(false)

  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  const baselineRef = useRef('')
  const stmtRef = useRef<HTMLTextAreaElement | null>(null)

  const [msgOpen, setMsgOpen] = useState(false)
  const [msgIntro, setMsgIntro] = useState('')
  const [msgBusy, setMsgBusy] = useState(false)
  const [msgErr, setMsgErr] = useState<string | null>(null)

  const sessionAlias = getAlias().trim()
  const authed = !!getToken()
  const urlAliasParam = params.alias?.trim() ?? ''
  const viewingAlias = urlAliasParam || sessionAlias

  const isOwnProfile = useMemo(
    () =>
      !!(
        sessionAlias &&
        viewingAlias &&
        sessionAlias.toLowerCase() === viewingAlias.toLowerCase()
      ),
    [sessionAlias, viewingAlias],
  )

  const canMessage =
    authed &&
    !isOwnProfile &&
    Boolean(viewingAlias) &&
    Boolean(sessionAlias) &&
    viewingAlias.toLowerCase() !== sessionAlias.toLowerCase()

  const viewerInterestCount = (profile?.interests ?? []).length
  const hubInterestsToggleable =
    isOwnProfile || viewerInterestCount > 8

  const load = useCallback(async () => {
    try {
      const a = viewingAlias.trim()
      if (!a) {
        setError('Missing profile')
        return
      }

      const traceUrl =
        isOwnProfile && sessionAlias
          ? '/nodes/me/traces?limit=8'
          : '/nodes/' + encodeURIComponent(a) + '/traces?limit=8'

      const [me, projList, traceList, archList, recentRep] = await Promise.all([
        api<HubProfile>('/nodes/' + encodeURIComponent(a)),
        api<ProjectCard[]>('/projects/by-node/' + encodeURIComponent(a)).catch(() => []),
        api<TraceCard[]>(traceUrl).catch(() => []),
        isOwnProfile
          ? api<ArchivePreview[]>('/nodes/me/archives-preview').catch(() => [])
          : Promise.resolve([]),
        api<RecentReputationResponse>(
          '/nodes/' + encodeURIComponent(a) + '/reputation/recent?days=90',
        ).catch(() => null),
      ])
      setProfile(me)
      setRecentCrystalCategories(
        recentRep?.categories != null
          ? clampReputationCategories(recentRep.categories)
          : undefined,
      )
      setProjects(projList)
      setTraces(traceList)
      setArchives(archList)
      const st = me.profileStatement ?? ''
      const pf = me.portfolioUrl ?? ''
      const links = Array.isArray(me.profileLinks) ? me.profileLinks : []
      const ints = me.interests ?? []
      setStatement(st)
      setPortfolioUrl(pf)
      setExtraLinks(links)
      setInterestSel(new Set(ints))
      baselineRef.current = JSON.stringify({
        profileStatement: st.trim(),
        portfolioUrl: pf.trim(),
        profileLinks: links.map((u) => u.trim()).filter(Boolean).slice().sort(),
        interests: [...ints].filter(Boolean).slice().sort(),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load hub')
    }
  }, [viewingAlias, isOwnProfile, sessionAlias])

  useEffect(() => {
    let cancel = false
    void (async () => {
      await load()
      if (cancel) return
    })()
    return () => {
      cancel = true
    }
  }, [load])

  const persistQuiet = useCallback(async () => {
    if (!profile || !isOwnProfile) return
    setSaving(true)
    setSavedFlash(false)
    try {
      const interests = [...interestSel].filter(Boolean)
      const updated = await api<HubProfile>('/nodes/me', {
        method: 'PATCH',
        body: {
          interests,
          portfolioUrl: portfolioUrl.trim(),
          profileStatement: statement.trim(),
          profileLinks: extraLinks.map((u) => u.trim()).filter(Boolean),
          keywords: profile.keywords ?? [],
        },
      })
      setProfile(updated)
      const ints = updated.interests ?? []
      setInterestSel(new Set(ints))
      setStatement(updated.profileStatement ?? '')
      setPortfolioUrl(updated.portfolioUrl ?? '')
      setExtraLinks(Array.isArray(updated.profileLinks) ? updated.profileLinks : [])
      baselineRef.current = JSON.stringify({
        profileStatement: (updated.profileStatement ?? '').trim(),
        portfolioUrl: (updated.portfolioUrl ?? '').trim(),
        profileLinks: (Array.isArray(updated.profileLinks) ? updated.profileLinks : [])
          .map((u) => u.trim())
          .filter(Boolean)
          .slice()
          .sort(),
        interests: [...ints].filter(Boolean).slice().sort(),
      })
      setSavedFlash(true)
      window.setTimeout(() => setSavedFlash(false), 1800)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [profile, isOwnProfile, interestSel, statement, portfolioUrl, extraLinks])

  useEffect(() => {
    if (!profile || !isOwnProfile) return
    const cur = JSON.stringify({
      profileStatement: statement.trim(),
      portfolioUrl: portfolioUrl.trim(),
      profileLinks: extraLinks.map((u) => u.trim()).filter(Boolean).slice().sort(),
      interests: [...interestSel].filter(Boolean).slice().sort(),
    })
    if (cur === baselineRef.current) return
    const id = window.setTimeout(() => void persistQuiet(), 720)
    return () => clearTimeout(id)
  }, [statement, portfolioUrl, extraLinks, interestSel, profile, isOwnProfile, persistQuiet])

  function toggleInterest(tag: string) {
    if (!isOwnProfile) return
    setInterestSel((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else {
        next.add(tag)
        setPulseInterest(tag)
        window.setTimeout(() => setPulseInterest(null), 380)
      }
      return next
    })
  }

  function addCustomInterest() {
    if (!isOwnProfile) return
    const t = customInterest.trim()
    if (!t || interestSel.has(t)) return
    setInterestSel((prev) => new Set(prev).add(t))
    setCustomInterest('')
    setInterestInputOpen(false)
  }

  function removeInterest(tag: string) {
    if (!isOwnProfile) return
    setInterestSel((prev) => {
      const next = new Set(prev)
      next.delete(tag)
      return next
    })
  }

  async function copyNodeHash() {
    const id = profile?._id
    if (!id) return
    try {
      await navigator.clipboard.writeText(id)
      setHashCopied(true)
      window.setTimeout(() => setHashCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  const activeProjects = projects.filter((p) => p.status === 'active').slice(0, 2)
  const completedProjects = profile?.completedProjects ?? []
  const completedTwo = completedProjects.slice(0, 2)
  const spaces = profile?.spacesWithNames ?? []

  const lastTrace = traces[0]

  const hubCrystalCategories = useMemo(
    () => clampReputationCategories(profile?.reputationCategories),
    [profile?.reputationCategories],
  )

  const title = profile?.alias?.trim() ? profile.alias : viewingAlias.trim() || 'Home'

  return (
    <AppShell title={title} scrollMain={false}>
      <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden font-mono text-white">
        {savedFlash ? (
          <p
            className="pointer-events-none absolute right-3 top-2 z-10 font-mono text-xs uppercase tracking-[0.14em] text-emerald-400/85 transition-opacity"
            role="status"
          >
            Saved
          </p>
        ) : null}

        {error ? (
          <p className="shrink-0 border border-white/15 px-3 py-2 text-small text-white" role="alert">
            {error}
          </p>
        ) : null}

            {profile ? (
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden px-1 pb-2 pt-1 lg:grid-cols-[35fr_35fr_30fr] lg:gap-3 lg:px-2">
            {/* LEFT — identity + proof */}
            <section className="flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto overflow-x-hidden lg:border-r lg:border-white/10 lg:pr-2">
              <div className="group/crystal relative min-h-[42vh] shrink-0 lg:min-h-0 lg:flex-[1_1_65%] lg:basis-[65%]">
                <button
                  type="button"
                  className="absolute right-2 top-2 z-[2] flex h-[18px] w-[18px] cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-[#666666] transition-colors hover:text-white [html.light-mode_&]:text-[var(--text-muted)] [html.light-mode_&]:hover:text-[var(--text-primary)]"
                  title="expand reputation"
                  aria-label="expand reputation"
                  onClick={(e) => {
                    e.stopPropagation()
                    const a = profile.alias?.trim()
                    if (!a) return
                    navigate(`/nodes/${encodeURIComponent(a)}/reputation`)
                  }}
                >
                  <span className="pointer-events-none text-[14px] leading-none" aria-hidden>
                    ↗
                  </span>
                </button>
                <CrystalRadar3DLazy
                  categories={isOwnProfile ? hubCrystalCategories : {}}
                  recentCategories={isOwnProfile ? recentCrystalCategories : {}}
                  aggregateReputationScore={
                    isOwnProfile &&
                    profile.reputationScore != null &&
                    Number.isFinite(profile.reputationScore)
                      ? profile.reputationScore
                      : null
                  }
                  className="h-full w-full"
                  hideLegendPanels
                  theme={theme}
                  onCrystalViewportDoubleClick={(e) => {
                    e.preventDefault()
                    const a = profile.alias?.trim()
                    if (!a) return
                    navigate(`/nodes/${encodeURIComponent(a)}/reputation`)
                  }}
                />
                <p className="pointer-events-none mt-1 text-center text-[length:var(--text-xs)] text-[var(--text-ghost)] opacity-0 transition-opacity duration-200 group-hover/crystal:opacity-100">
                  double-click to expand
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <p className="text-md font-normal leading-snug text-[var(--text-subtle)]">{profile.alias}</p>
                {canMessage ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMsgErr(null)
                      setMsgIntro('')
                      setMsgOpen(true)
                    }}
                    className={hubOutlineAction}
                  >
                    Message
                  </button>
                ) : null}
              </div>

              <p className="shrink-0 text-xs leading-relaxed text-[var(--text-muted)]">
                {lastTrace ? (
                  <>
                    Last logged: {activityLabel(lastTrace.activityType)} · {formatTimeAgo(lastTrace.timestamp)}
                  </>
                ) : (
                  <>Last logged: —</>
                )}
              </p>

              <div className="proof-of-work-strip space-y-2">
                <SectionLabel>Proof of work</SectionLabel>
                <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-gutter:stable]">
                {traces.length === 0 ? (
                  <p className="text-base text-[var(--text-muted)]">No traces yet.</p>
                ) : (
                  traces.map((t) => (
                    <div
                      key={`${t.projectId}-${t.timestamp}`}
                      className="flex min-w-[120px] max-w-[148px] shrink-0 flex-col gap-0.5 rounded-sm border border-white/[0.07] bg-black/22 px-2.5 py-2"
                      role="group"
                    >
                      <span
                        className="truncate text-xs uppercase tracking-[0.12em]"
                        style={
                          theme === 'light'
                            ? { color: 'var(--text-primary, #1a1a18)' }
                            : { color: colourForActivity(t.activityType) }
                        }
                      >
                        {activityLabel(t.activityType)}
                      </span>
                      <span className="truncate font-mono text-xs text-white/82">{t.projectTitle}</span>
                      <span className="text-xs text-white/38">
                        {new Date(t.timestamp).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  ))
                )}
                </div>
              </div>
            </section>

            {/* MIDDLE — voice */}
            <section
              className={`relative flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto overflow-x-hidden border-white/10 lg:border-x lg:px-3 ${isOwnProfile ? '[&_textarea]:cursor-text' : ''}`}
            >
              {profile._id ? (
                <div className="flex items-center gap-2 pt-0.5 font-mono text-xs tracking-[0.06em] text-white/38">
                  <span className="min-w-0 flex-1 truncate" title={profile._id}>
                    {profile._id.slice(0, 14)}…{profile._id.slice(-10)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void copyNodeHash()}
                    className="shrink-0 rounded border border-transparent p-0.5 text-white/45 transition hover:border-white/18 hover:text-white/75"
                    aria-label="Copy node hash"
                  >
                    {hashCopied ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    )}
                  </button>
                </div>
              ) : null}

              <div>
                <SectionLabel>Personal statement</SectionLabel>
                {isOwnProfile ? (
                  !stmtEditing ? (
                    <button
                      type="button"
                      className="w-full cursor-text rounded-sm border border-transparent px-0 py-1 text-left text-small leading-relaxed text-white/88 transition hover:bg-white/[0.04]"
                      onClick={() => {
                        setStmtEditing(true)
                        window.requestAnimationFrame(() => stmtRef.current?.focus())
                      }}
                    >
                      {statement.trim() ? (
                        <span className="whitespace-pre-wrap">{statement}</span>
                      ) : (
                        <span className="italic text-white/42">what drives your practice</span>
                      )}
                    </button>
                  ) : (
                    <textarea
                      ref={stmtRef}
                      value={statement}
                      onChange={(e) => setStatement(e.target.value)}
                      onBlur={() => setStmtEditing(false)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          setStmtEditing(false)
                        }
                      }}
                      placeholder="what drives your practice"
                      rows={6}
                      className="w-full resize-y rounded-sm border border-white/18 bg-black/25 px-2.5 py-2 text-small leading-relaxed text-white/90 placeholder:text-white/35 focus:border-white/32 focus:outline-none"
                    />
                  )
                ) : (
                  <p className="text-small leading-relaxed text-white/85">
                    {statement.trim() ? (
                      <span className="whitespace-pre-wrap">{statement}</span>
                    ) : (
                      <span className="italic text-white/38">—</span>
                    )}
                  </p>
                )}
              </div>

              <div>
                <SectionLabel>Interests</SectionLabel>
                <div
                  className={
                    hubInterestsToggleable && !hubInterestsExpanded
                      ? 'max-h-[9.5rem] overflow-hidden'
                      : undefined
                  }
                >
                  {isOwnProfile ? (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                      {INTEREST_PRESETS.map((tag) => {
                        const on = interestSel.has(tag)
                        const col = chipColourForTag(tag)
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleInterest(tag)}
                            className={`cursor-pointer rounded-full px-2.5 py-0.5 text-base tracking-wide transition hover:brightness-110 ${pulseInterest === tag ? 'etch-interest-pulse' : ''}`}
                            style={interestChipStyle(
                              col,
                              theme === 'light' ? 'light' : 'dark',
                              'toggle',
                              on,
                            )}
                          >
                            {tag}
                          </button>
                        )
                      })}
                      {[...interestSel]
                        .filter((t) => !(INTEREST_PRESETS as readonly string[]).includes(t))
                        .map((tag) => {
                          const col = chipColourForTag(tag)
                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => removeInterest(tag)}
                              className="cursor-pointer rounded-full px-2.5 py-0.5 text-base tracking-wide transition hover:brightness-110"
                              style={interestChipStyle(
                                col,
                                theme === 'light' ? 'light' : 'dark',
                                'pill',
                              )}
                            >
                              {tag}
                            </button>
                          )
                        })}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-x-2 gap-y-2">
                      {(profile.interests ?? []).map((tag) => {
                        const col = chipColourForTag(tag)
                        return (
                          <span
                            key={tag}
                            className="rounded-full px-2.5 py-0.5 text-base tracking-wide"
                            style={interestChipStyle(
                              col,
                              theme === 'light' ? 'light' : 'dark',
                              'pill',
                            )}
                          >
                            {tag}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
                {isOwnProfile ? (
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-2">
                    {interestInputOpen ? (
                      <input
                        autoFocus
                        value={customInterest}
                        onChange={(e) => setCustomInterest(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addCustomInterest()
                          }
                          if (e.key === 'Escape') {
                            setInterestInputOpen(false)
                            setCustomInterest('')
                          }
                        }}
                        onBlur={() => {
                          if (customInterest.trim()) addCustomInterest()
                          else setInterestInputOpen(false)
                        }}
                        placeholder="tag"
                        className="min-w-[5rem] max-w-[180px] bg-transparent text-base text-white/75 outline-none placeholder:text-white/35"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setInterestInputOpen(true)}
                        className="text-base font-light leading-none text-white/45 transition hover:text-white/78"
                        aria-label="Add interest"
                      >
                        +
                      </button>
                    )}
                  </div>
                ) : null}
                {hubInterestsToggleable ? (
                  <button
                    type="button"
                    onClick={() => setHubInterestsExpanded(!hubInterestsExpanded)}
                    className={`mt-2 inline-flex items-center gap-1 font-mono text-xs uppercase tracking-[0.12em] transition hover:underline hover:underline-offset-2 ${
                      theme === 'light'
                        ? 'text-[var(--text-secondary,#3a3a36)]'
                        : 'text-white/48 hover:text-white/78'
                    }`}
                    aria-expanded={hubInterestsExpanded}
                  >
                    <span aria-hidden>{hubInterestsExpanded ? '▴' : '▾'}</span>
                    {hubInterestsExpanded ? 'Show less' : 'Show all interests'}
                  </button>
                ) : null}
              </div>

              <div>
                <SectionLabel>Links</SectionLabel>
                <div className="flex flex-col gap-2 text-small">
                  {isOwnProfile ? (
                    <>
                      <input
                        type="url"
                        value={portfolioUrl}
                        onChange={(e) => setPortfolioUrl(e.target.value)}
                        placeholder="Portfolio URL"
                        className="w-full border-0 border-b border-transparent bg-transparent py-1 text-white/88 outline-none placeholder:text-white/35 focus:border-white/22"
                      />
                      {extraLinks.map((url, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <input
                            type="url"
                            value={url}
                            onChange={(e) => {
                              const next = [...extraLinks]
                              next[i] = e.target.value
                              setExtraLinks(next)
                            }}
                            placeholder="https://"
                            className="min-w-0 flex-1 border-0 border-b border-transparent bg-transparent py-1 text-white/82 outline-none focus:border-white/22"
                          />
                          <button
                            type="button"
                            className="shrink-0 px-1 text-white/45 hover:text-white/85"
                            onClick={() => setExtraLinks(extraLinks.filter((_, j) => j !== i))}
                            aria-label="Remove link"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {extraLinks.length < 12 ? (
                        <button
                          type="button"
                          className="self-start text-base font-light text-white/42 hover:text-white/78"
                          onClick={() => setExtraLinks([...extraLinks, ''])}
                          aria-label="Add link"
                        >
                          +
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {profile.portfolioUrl?.trim() ? (
                        <a
                          href={profile.portfolioUrl.trim()}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate text-white/78 underline decoration-white/25 underline-offset-2 hover:text-white"
                        >
                          {profile.portfolioUrl.trim()}
                        </a>
                      ) : null}
                      {(profile.profileLinks ?? []).map((u) => (
                        <a
                          key={u}
                          href={u}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate text-white/72 underline decoration-white/22 underline-offset-2 hover:text-white"
                        >
                          {u}
                        </a>
                      ))}
                    </>
                  )}
                </div>
              </div>

              <div className="mt-auto pb-2 pt-2">
                <SectionLabel>Trustees</SectionLabel>
                <div className="flex flex-wrap items-baseline gap-x-1 gap-y-1 font-mono text-xs leading-relaxed text-white/50">
                  {(profile.trustees ?? []).length ? (
                    profile.trustees!.map((t) => <span key={t}>{t}</span>)
                  ) : isOwnProfile ? (
                    <>
                      <span className="text-white/45">no trustees set.</span>
                      <span className="text-white/28" aria-hidden>
                        {' '}
                        —{' '}
                      </span>
                      <button
                        type="button"
                        className="bg-transparent p-0 font-mono text-xs text-[var(--text-subtle)] underline-offset-2 hover:text-[var(--text-muted)] hover:underline"
                        title="Enter 3–5 trustee aliases (comma-separated)"
                        onClick={() => {
                          const raw = window.prompt(
                            'Trustee aliases (comma-separated). Recovery requires 3–5 active nodes.',
                            (profile.trustees ?? []).join(', '),
                          )
                          if (raw == null) return
                          const list = raw
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean)
                          if (list.length < 3 || list.length > 5) {
                            window.alert('Please enter between 3 and 5 trustee aliases.')
                            return
                          }
                          void (async () => {
                            try {
                              await api<{ trustees: string[] }>('/nodes/me/trustees', {
                                method: 'PUT',
                                body: { trustees: list },
                              })
                              await load()
                            } catch (e) {
                              setError(e instanceof Error ? e.message : 'Trustees update failed')
                            }
                          })()
                        }}
                      >
                        add trustee
                      </button>
                    </>
                  ) : (
                    <span className="text-white/32">—</span>
                  )}
                </div>
              </div>

              {saving ? (
                <span className="pointer-events-none absolute bottom-2 right-3 font-mono text-xs text-white/35">Saving…</span>
              ) : null}
            </section>

            {/* RIGHT — spaces & work */}
            <section className="flex min-h-0 min-w-0 flex-col gap-6 overflow-y-auto overflow-x-hidden lg:pl-2">
              <div>
                <SectionLabel>Spaces you&apos;re a part of</SectionLabel>
                <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
                  {spaces.length === 0 ? (
                    isOwnProfile ? (
                      <>
                        <Link to="/spaces/new" className={hubOutlineAction}>
                          Create a space
                        </Link>
                        <Link to="/spaces/join" className={hubOutlineAction}>
                          Join a space
                        </Link>
                      </>
                    ) : (
                      <span className="text-base text-white/38">—</span>
                    )
                  ) : (
                    <>
                      {spaces.slice(0, 2).map((s) => (
                        <HubTallCard
                          key={s.id}
                          seed={s.id}
                          title={s.name}
                          href={`/spaces/${s.id}`}
                          status={s.status === 'active' ? 'active' : 'dormant'}
                          showStatusDot
                        />
                      ))}
                      {isOwnProfile ? (
                        <>
                          <ViewAllTall href="/spaces" />
                          <AddTall href="/spaces/new" label="New space" />
                        </>
                      ) : null}
                    </>
                  )}
                </div>
              </div>

              <div>
                <SectionLabel>Active projects</SectionLabel>
                <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
                  {activeProjects.length === 0 ? (
                    isOwnProfile ? (
                      <Link to="/projects/new" className={hubOutlineAction}>
                        Start a project
                      </Link>
                    ) : (
                      <span className="text-base text-white/38">—</span>
                    )
                  ) : (
                    <>
                      {activeProjects.map((p) => (
                        <HubTallCard
                          key={p._id}
                          seed={p.logoSeed ?? p._id}
                          title={p.title}
                          subtitle={p.spaceName}
                          href={`/projects/${p._id}`}
                          status="active"
                          showStatusDot
                        />
                      ))}
                      {isOwnProfile ? (
                        <>
                          <ViewAllTall href="/projects" />
                          <AddTall href="/projects/new" label="New project" />
                        </>
                      ) : null}
                    </>
                  )}
                </div>
              </div>

              <div>
                <SectionLabel>Completed projects / NFTs</SectionLabel>
                <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
                  {completedTwo.length === 0 ? (
                    <span className="text-base text-white/38">—</span>
                  ) : (
                    <>
                      {completedTwo.map((c) => (
                        <HubTallCard
                          key={c.projectId ?? c.title}
                          seed={c.projectId ?? c.title}
                          title={c.title}
                          href={c.projectId ? `/projects/${c.projectId}` : '/projects'}
                          variant="completed"
                          showStatusDot={false}
                        />
                      ))}
                      {isOwnProfile ? <ViewAllTall href="/projects" /> : null}
                    </>
                  )}
                </div>
              </div>

              <div>
                <SectionLabel>Archives</SectionLabel>
                <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
                  {!isOwnProfile ? (
                    <span className="text-base text-white/38">—</span>
                  ) : archives.length === 0 ? (
                    <Link to="/archive/new" className={hubOutlineAction}>
                      + archive past work
                    </Link>
                  ) : (
                    <>
                      {archives.slice(0, 2).map((a) => (
                        <HubTallCard
                          key={a.id}
                          seed={a.id}
                          title={a.title}
                          subtitle={a.medium}
                          href={a.projectId ? `/projects/${a.projectId}` : '/archive/new'}
                          variant="archive"
                          showStatusDot={false}
                        />
                      ))}
                      <ViewAllTall href="/archive/new" />
                    </>
                  )}
                </div>
              </div>
            </section>
          </div>
        ) : (
          <p className="p-4 text-small text-white/70">Loading…</p>
        )}

        {msgOpen && viewingAlias ? (
          <div
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal
            aria-label="Send connection request"
          >
            <div className="w-full max-w-md space-y-3 border border-white/25 bg-zinc-950 p-4 shadow-xl">
              <p className="font-mono text-small uppercase tracking-[0.16em] text-white">
                Message @{viewingAlias}
              </p>
              <p className="text-small text-white/80">
                They&apos;ll get a connection request with this intro. You can chat after they accept.
              </p>
              <textarea
                value={msgIntro}
                onChange={(e) => setMsgIntro(e.target.value)}
                placeholder="Intro line…"
                rows={4}
                className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 font-mono text-small text-white placeholder:text-white/35"
              />
              {msgErr ? (
                <p className="border border-white/15 bg-grey-100 px-2 py-1 font-mono text-small text-white">
                  {msgErr}
                </p>
              ) : null}
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="border border-white/25 px-3 py-1 font-mono text-small uppercase text-white transition hover:bg-white/10"
                  onClick={() => setMsgOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={msgBusy || !msgIntro.trim()}
                  className="border border-black bg-yellow-400 px-3 py-1 font-mono text-small uppercase text-black transition hover:bg-yellow-300 disabled:opacity-50"
                  onClick={() => {
                    void (async () => {
                      setMsgBusy(true)
                      setMsgErr(null)
                      try {
                        const r = await createConversation(viewingAlias, msgIntro.trim())
                        setMsgOpen(false)
                        navigate('/messages/' + encodeURIComponent(r.conversation._id))
                      } catch (e) {
                        setMsgErr(e instanceof Error ? e.message : 'Failed')
                      } finally {
                        setMsgBusy(false)
                      }
                    })()
                  }}
                >
                  {msgBusy ? 'Sending…' : 'Send request'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}
