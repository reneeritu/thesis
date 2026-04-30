import { useEffect, useState, useCallback, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { loginUrl } from '../lib/authNavigate'
import { getAlias, getToken } from '../lib/session'
import { AppShell } from '../components/AppShell'
import { MediaPreview } from '../components/MediaPreview'
import { GenerativeAvatar } from '../components/GenerativeAvatar'
import { ProjectTimeline, type TimelineEntry } from '../components/contracts/ProjectTimeline'
import { TraceForm } from '../components/contracts/TraceForm'
import { ReferenceForm } from '../components/contracts/ReferenceForm'
import { PivotForm } from '../components/contracts/PivotForm'
import { VetoForm } from '../components/contracts/VetoForm'
import { ForkForm } from '../components/contracts/ForkForm'
import { CreditForm } from '../components/contracts/CreditForm'

type Contributor = {
  alias: string
  role?: string
  isPrimary?: boolean
  accepted?: boolean | null
  invitedAt?: string | null
}

type Project = {
  _id: string
  title: string
  status: string
  spaceId: string
  visibility?: string
  /** Strangers see summary-only project payload without process log */
  publicProcessLogRestricted?: boolean
  context?: string
  logoSeed?: string
  creatorAlias?: string
  mentorAlias?: string
  contributors?: Contributor[]
  updatedAt?: string
}

type TraceRow = { _id: string; activityType?: string; description?: string; nodeAlias?: string; timestamp?: string; createdAt?: string; [k: string]: unknown }
type RefRow = {
  _id: string
  relationshipType?: string
  nodeAlias?: string
  createdAt?: string
  sourceProjectId?: string
  externalUrl?: string
  citation?: string
  [k: string]: unknown
}
type PivotRow = { _id: string; reason?: string; nodeAlias?: string; createdAt?: string; [k: string]: unknown }
type VetoRow = { _id: string; vetoType?: string; nodeAlias?: string; createdAt?: string; [k: string]: unknown }

type NftCredit = {
  nft: {
    _id: string
    title?: string
    createdAt?: string
    contributors?: { alias: string; role: string; weight: number; timeLogged?: number }[]
  }
}

type MediaItem = {
  mediaId: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  hash: string
  uploaderAlias: string
  createdAt: string
  url: string
}

type ActiveForm = 'trace' | 'reference' | 'pivot' | 'veto' | 'fork' | 'credit' | null

function fmtShortId(id: string) {
  if (id.length <= 14) return id
  return `${id.slice(0, 8)}…${id.slice(-6)}`
}

function apiBase(): string {
  const m = document.querySelector('meta[name="aura-api-base"]')
  const b = m?.getAttribute('content')
  if (b?.trim()) return b.replace(/\/$/, '')
  return window.location.origin.replace(/\/$/, '')
}

function fmtPct(weight: number): string {
  const pct = weight <= 1 ? weight * 100 : weight
  return `${pct.toFixed(1)}%`
}

function ProvenanceChainLockIcon({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className ?? ''}`} aria-hidden>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
      </svg>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="11" width="14" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
    </span>
  )
}

function MediaThumbCard({ m }: { m: MediaItem }) {
  const src = `${apiBase()}/media/${m.mediaId}`
  const isImage = m.mimeType.startsWith('image/')
  const dateStr = new Date(m.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-sm border border-white/12 bg-black/35 transition hover:border-white/22"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-950/70">
        {isImage ? (
          <img src={src} alt="" className="h-full w-full object-cover opacity-95 transition group-hover:opacity-100" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-mono text-xs uppercase tracking-[0.14em] text-white/35">
            {m.mimeType.split('/')[0] || 'file'}
          </div>
        )}
      </div>
      <div className="min-w-0 border-t border-white/10 px-2 py-2">
        <p className="m-0 truncate font-mono text-base text-white/82" title={m.originalName}>
          {m.originalName}
        </p>
        <p className="m-0 mt-0.5 font-mono text-xs text-white/38">{dateStr}</p>
      </div>
    </a>
  )
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const meAlias = getAlias()
  const isLoggedIn = Boolean(getToken())
  const [project, setProject] = useState<Project | null>(null)
  const [spaceName, setSpaceName] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [traces, setTraces] = useState<TraceRow[]>([])
  const [referencesList, setReferencesList] = useState<RefRow[]>([])
  const [pivotsList, setPivotsList] = useState<PivotRow[]>([])
  const [creditBundle, setCreditBundle] = useState<NftCredit | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeForm, setActiveForm] = useState<ActiveForm>(null)
  const [loadKey, setLoadKey] = useState(0)
  const [respondBusy, setRespondBusy] = useState(false)
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])

  const reload = useCallback(() => setLoadKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) return
      try {
        const p = await api<Project>('/projects/' + encodeURIComponent(id))
        if (cancelled) return
        setProject(p)

        let name: string | null = null
        try {
          const sp = await api<{ name: string }>('/spaces/' + encodeURIComponent(p.spaceId))
          name = sp.name
        } catch {
          name = null
        }
        if (!cancelled) setSpaceName(name)

        const processRestricted = Boolean(p.publicProcessLogRestricted)

        if (processRestricted) {
          if (!cancelled) {
            setTraces([])
            setReferencesList([])
            setPivotsList([])
            setMediaItems([])
            setTimeline([])
          }
        } else {
          const [traceRes, refRes, pivotRes, vetoRes, mediaRes] = await Promise.all([
            api<TraceRow[]>('/traces/project/' + encodeURIComponent(id)).catch(() => [] as TraceRow[]),
            api<RefRow[]>('/references/project/' + encodeURIComponent(id)).catch(() => [] as RefRow[]),
            api<PivotRow[]>('/pivots/project/' + encodeURIComponent(id)).catch(() => [] as PivotRow[]),
            api<VetoRow[]>('/vetos/project/' + encodeURIComponent(id)).catch(() => [] as VetoRow[]),
            api<MediaItem[]>('/media/project/' + encodeURIComponent(id)).catch(() => [] as MediaItem[]),
          ])
          if (cancelled) return

          setTraces(traceRes)
          setReferencesList(refRes)
          setPivotsList(pivotRes)
          setMediaItems(mediaRes)

          const entries: TimelineEntry[] = []
          for (const t of traceRes) {
            entries.push({
              kind: 'trace',
              timestamp: new Date(t.timestamp || t.createdAt || 0).getTime(),
              data: t as unknown as Record<string, unknown>,
            })
          }
          for (const r of refRes) {
            entries.push({
              kind: 'reference',
              timestamp: new Date(r.createdAt || 0).getTime(),
              data: r as unknown as Record<string, unknown>,
            })
          }
          for (const pv of pivotRes) {
            entries.push({
              kind: 'pivot',
              timestamp: new Date(pv.createdAt || 0).getTime(),
              data: pv as unknown as Record<string, unknown>,
            })
          }
          for (const v of vetoRes) {
            entries.push({
              kind: 'veto',
              timestamp: new Date(v.createdAt || 0).getTime(),
              data: v as unknown as Record<string, unknown>,
            })
          }
          entries.sort((a, b) => a.timestamp - b.timestamp)
          setTimeline(entries)
        }

        if (p.status === 'completed') {
          try {
            const cr = await api<NftCredit>('/credits/project/' + encodeURIComponent(id))
            if (!cancelled) setCreditBundle(cr?.nft ? cr : null)
          } catch {
            if (!cancelled) setCreditBundle(null)
          }
        } else if (!cancelled) setCreditBundle(null)

        setError(null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load project')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id, loadKey])

  const isActive = project?.status === 'active'
  const contributors = project?.contributors ?? []
  const myContrib = contributors.find((c) => c.alias === meAlias)
  const myPendingInvite =
    myContrib?.accepted === null || myContrib?.accepted === undefined ? myContrib : null
  const amPrimary = Boolean(myContrib?.isPrimary && myContrib?.accepted)
  const amListed = Boolean(myContrib)
  const isPublic = project
    ? ['process_visible', 'fully_public'].includes(project.visibility || '')
    : false

  const canActOnProject = isLoggedIn && amListed && !myPendingInvite
  const processRestricted = Boolean(project?.publicProcessLogRestricted)

  const [joinReqNote, setJoinReqNote] = useState('')
  const [joinReqBusy, setJoinReqBusy] = useState(false)
  const [joinReqMsg, setJoinReqMsg] = useState<string | null>(null)

  async function sendJoinRequest() {
    if (!id) return
    setJoinReqBusy(true)
    setJoinReqMsg(null)
    try {
      await api('/projects/' + encodeURIComponent(id) + '/join-request', {
        method: 'POST',
        body: { note: joinReqNote.trim() },
      })
      setJoinReqMsg('Request sent. The primary contributors will see it in their notifications.')
      setJoinReqNote('')
    } catch (e) {
      setJoinReqMsg(e instanceof Error ? e.message : 'Failed to send request')
    } finally {
      setJoinReqBusy(false)
    }
  }

  const [exportBusy, setExportBusy] = useState(false)
  async function exportProject() {
    if (!id) return
    setExportBusy(true)
    try {
      const data = await api<Record<string, unknown>>('/projects/' + encodeURIComponent(id) + '/export')
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `project-${id}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExportBusy(false)
    }
  }

  const [inviteAlias, setInviteAlias] = useState('')
  const [inviteRole, setInviteRole] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteMsg, setInviteMsg] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)

  async function sendInvite() {
    if (!id || !inviteAlias.trim()) return
    setInviteBusy(true)
    setInviteMsg(null)
    try {
      await api('/projects/' + encodeURIComponent(id) + '/contributors', {
        method: 'POST',
        body: {
          alias: inviteAlias.trim().toLowerCase(),
          role: inviteRole.trim() || undefined,
        },
      })
      setInviteMsg(`Invite sent to ${inviteAlias.trim()}.`)
      setInviteAlias('')
      setInviteRole('')
      reload()
    } catch (e) {
      setInviteMsg(e instanceof Error ? e.message : 'Failed to invite')
    } finally {
      setInviteBusy(false)
    }
  }

  async function respondContributor(accept: boolean) {
    if (!id) return
    setRespondBusy(true)
    try {
      await api('/projects/' + encodeURIComponent(id) + '/contributors/respond', {
        method: 'POST',
        body: { accept },
      })
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to respond')
    } finally {
      setRespondBusy(false)
    }
  }

  function toggle(form: ActiveForm) {
    setActiveForm((prev) => (prev === form ? null : form))
  }

  const compactAction = (label: string, form: ActiveForm, primary?: boolean, danger?: boolean) => (
    <button
      type="button"
      onClick={() => toggle(form)}
      className={`shrink-0 rounded-sm border px-2.5 py-1.5 font-mono text-xs uppercase tracking-[0.14em] transition ${
        activeForm === form
          ? 'border-yellow-400 bg-yellow-400/20 text-yellow-200'
          : primary
            ? 'border-yellow-400/90 bg-yellow-400 text-black hover:bg-yellow-300'
            : danger
              ? 'border-rose-400/40 bg-rose-950/40 text-rose-100/90 hover:border-rose-400/60'
              : 'border-white/18 bg-black/40 text-white/70 hover:border-white/35 hover:text-white/90'
      }`}
    >
      {label}
    </button>
  )

  function guestAuthAction(label: string, reason: string, primary?: boolean, danger?: boolean) {
    const idle = primary
      ? 'border-yellow-400/90 bg-yellow-400 text-black hover:bg-yellow-300'
      : danger
        ? 'border-rose-400/40 bg-rose-950/40 text-rose-100/90 hover:border-rose-400/60'
        : 'border-white/18 bg-black/40 text-white/70 hover:border-white/35 hover:text-white/90'
    return (
      <button
        type="button"
        onClick={() => window.location.assign(loginUrl({ reason }))}
        className={`shrink-0 rounded-sm border px-2.5 py-1.5 font-mono text-xs uppercase tracking-[0.14em] opacity-50 transition ${idle}`}
      >
        {label}
      </button>
    )
  }

  const artSeed = project?.logoSeed ?? project?._id ?? ''
  const contextText = project?.context?.trim()

  function contributorRoleLabel(c: Contributor): string {
    if (!project) return c.role || 'Contributor'
    if (c.alias === project.creatorAlias) return 'Creator'
    if (project.mentorAlias && c.alias === project.mentorAlias) return 'Mentor'
    const raw = (c.role || 'contributor').toLowerCase()
    if (raw === 'mentor') return 'Mentor'
    if (raw === 'contributor') return 'Contributor'
    return c.role || 'Contributor'
  }

  return (
    <AppShell title={project?.title || 'Project'} scrollMain>
      <div className="font-mono text-white">
        {error && (
          <p className="mb-4 border border-white/15 bg-black/40 px-3 py-2 text-xs" role="alert">
            {error}
          </p>
        )}

        {project ? (
          <div className="grid min-h-0 grid-cols-1 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start lg:gap-10">
            {/* LEFT ~60% */}
            <div className="min-w-0 space-y-5">
              <div className="relative h-[160px] w-full overflow-hidden rounded-sm bg-neutral-950/75">
                <GenerativeAvatar
                  seed={artSeed}
                  size={720}
                  monochrome={false}
                  luminescent
                  className="pointer-events-none absolute left-1/2 top-1/2 min-h-[120%] min-w-[120%] -translate-x-1/2 -translate-y-1/2 object-cover opacity-95"
                />
              </div>

              <div className="space-y-2">
                <h1 className="m-0 max-w-[90vw] font-mono text-[clamp(1.35rem,3vw,2rem)] font-semibold uppercase tracking-[0.08em] leading-tight text-white">
                  {project.title}
                </h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-base uppercase tracking-[0.12em]">
                  <span className="inline-flex items-center rounded-sm border border-yellow-400/50 bg-yellow-400/10 px-2 py-0.5 text-yellow-200/95">
                    {project.status}
                  </span>
                  <span className="max-w-[min(100%,280px)] truncate text-white/42" title={project._id}>
                    {fmtShortId(project._id)}
                  </span>
                  {amListed && isLoggedIn ? (
                    <button
                      type="button"
                      onClick={() => void exportProject()}
                      disabled={exportBusy}
                      className="text-xs tracking-[0.14em] text-white/38 underline decoration-white/18 underline-offset-2 transition hover:text-white/65 disabled:opacity-60"
                      title="Download project export JSON"
                    >
                      {exportBusy ? 'Exporting…' : 'Export JSON'}
                    </button>
                  ) : null}
                </div>
                <p className="m-0">
                  <Link
                    to={`/spaces/${encodeURIComponent(project.spaceId)}`}
                    className="font-mono text-xs text-white/45 transition hover:text-white/72"
                  >
                    {spaceName ?? 'Space'}
                  </Link>
                </p>
              </div>

              {isActive && !amListed && isPublic ? (
                <section className="rounded-sm border border-white/12 bg-black/25 px-4 py-4 space-y-3">
                  <p className="m-0 text-xs uppercase tracking-[0.2em] text-white/45">Collaborate</p>
                  {!isLoggedIn ? (
                    <p className="m-0 text-xs text-white/65">
                      <button
                        type="button"
                        onClick={() =>
                          window.location.assign(
                            loginUrl({ reason: `log in to collaborate on ${project.title}` }),
                          )
                        }
                        className="border-0 bg-transparent p-0 font-inherit text-yellow-400/90 underline underline-offset-2 opacity-80 transition hover:opacity-100"
                      >
                        Log in
                      </button>{' '}
                      to send a collaboration request.
                    </p>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <input
                          value={joinReqNote}
                          onChange={(e) => setJoinReqNote(e.target.value)}
                          placeholder="short note (optional)"
                          className="min-w-[200px] flex-1 rounded-sm border border-white/14 bg-black/45 px-3 py-2 text-xs outline-none placeholder:text-white/30 focus:border-white/28"
                        />
                        <button
                          type="button"
                          disabled={joinReqBusy}
                          onClick={() => void sendJoinRequest()}
                          className="rounded-sm border border-yellow-400/90 bg-yellow-400 px-4 py-2 text-base uppercase tracking-[0.14em] text-black transition hover:bg-yellow-300 disabled:opacity-60"
                        >
                          {joinReqBusy ? 'Sending…' : 'Request to collaborate'}
                        </button>
                      </div>
                      {joinReqMsg ? <p className="m-0 text-xs text-white/65">{joinReqMsg}</p> : null}
                    </>
                  )}
                </section>
              ) : null}

              {myPendingInvite && (
                <section className="rounded-sm border border-amber-400/35 bg-amber-400/8 px-4 py-4 space-y-3">
                  <p className="m-0 text-base uppercase tracking-[0.16em] text-amber-100/95">
                    You&apos;ve been invited as a contributor
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={respondBusy}
                      onClick={() => void respondContributor(true)}
                      className="rounded-sm border border-yellow-400 bg-yellow-400 px-4 py-1.5 text-base uppercase tracking-[0.14em] text-black transition hover:bg-yellow-300 disabled:opacity-60"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={respondBusy}
                      onClick={() => void respondContributor(false)}
                      className="rounded-sm border border-white/18 px-4 py-1.5 text-base uppercase tracking-[0.14em] text-white/65 transition hover:border-white/35 disabled:opacity-60"
                    >
                      Decline
                    </button>
                  </div>
                </section>
              )}

              {/* Contributors */}
              <section className="space-y-2">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="font-mono text-xs uppercase tracking-[0.22em] text-white/38">Contributors</span>
                    <span className="h-px min-w-[2rem] flex-1 bg-white/12" aria-hidden />
                  </div>
                  {isActive && isLoggedIn && amPrimary ? (
                    <button
                      type="button"
                      onClick={() => setInviteOpen((v) => !v)}
                      className="shrink-0 rounded-sm border border-white/18 bg-black/35 px-3 py-1.5 font-mono text-xs uppercase tracking-[0.18em] text-white/65 transition hover:border-white/38 hover:text-white/88"
                    >
                      + Invite
                    </button>
                  ) : null}
                </div>

                {inviteOpen && isActive && isLoggedIn && amPrimary ? (
                  <div className="rounded-sm border border-white/12 bg-black/30 px-4 py-4 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <input
                        value={inviteAlias}
                        onChange={(e) => setInviteAlias(e.target.value)}
                        placeholder="alias"
                        className="min-w-[140px] flex-1 rounded-sm border border-white/14 bg-black/45 px-3 py-2 text-xs outline-none placeholder:text-white/30"
                      />
                      <input
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value)}
                        placeholder="role (optional)"
                        className="min-w-[120px] flex-1 rounded-sm border border-white/14 bg-black/45 px-3 py-2 text-xs outline-none placeholder:text-white/30"
                      />
                      <button
                        type="button"
                        disabled={inviteBusy || !inviteAlias.trim()}
                        onClick={() => void sendInvite()}
                        className="rounded-sm border border-yellow-400/80 bg-yellow-400 px-4 py-2 text-base uppercase tracking-[0.14em] text-black transition hover:bg-yellow-300 disabled:opacity-60"
                      >
                        {inviteBusy ? 'Sending…' : 'Send'}
                      </button>
                    </div>
                    {inviteMsg ? <p className="m-0 text-xs text-white/65">{inviteMsg}</p> : null}
                    <p className="m-0 text-base text-white/42">
                      They&apos;ll get a notification to accept or decline. Your node:{' '}
                      <Link to={`/nodes/${encodeURIComponent(meAlias)}`} className="text-white/55 underline decoration-white/22">
                        /nodes/{meAlias}
                      </Link>
                    </p>
                  </div>
                ) : null}

                {contributors.length ? (
                  <ul className="m-0 list-none divide-y divide-white/10 p-0">
                    {contributors.map((c) => (
                      <li
                        key={c.alias}
                        className="flex max-h-[60px] min-h-[44px] items-center gap-3 py-2 first:pt-0 last:pb-0"
                      >
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/12 bg-black/40">
                          <GenerativeAvatar seed={c.alias} size={80} monochrome={false} luminescent className="opacity-95" />
                        </div>
                        <div className="flex min-w-0 flex-1 items-center gap-x-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          <Link
                            to={`/nodes/${encodeURIComponent(c.alias)}`}
                            className="shrink-0 font-mono text-sm lowercase tracking-normal text-white/88 hover:text-white"
                          >
                            {c.alias.toLowerCase()}
                          </Link>
                          <span className="shrink-0 rounded-sm border border-white/14 bg-white/[0.04] px-1.5 py-px font-mono text-xs uppercase tracking-[0.12em] text-white/55">
                            {contributorRoleLabel(c)}
                          </span>
                          {c.isPrimary ? (
                            <span className="shrink-0 rounded-sm border border-yellow-400/45 bg-yellow-400/10 px-1.5 py-px font-mono text-xs uppercase tracking-[0.12em] text-yellow-200/90">
                              Primary
                            </span>
                          ) : null}
                          {c.accepted === null ? (
                            <span
                              className="shrink-0 rounded-sm border border-white/16 px-1.5 py-px font-mono text-xs uppercase tracking-[0.1em] text-white/45"
                              title="Waiting on response"
                            >
                              Pending
                            </span>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-white/42">No contributors listed.</p>
                )}
              </section>

              {processRestricted ? (
                <p className="m-0 max-w-[62ch] text-xs leading-relaxed text-white/42">
                  the process log for this project is visible to space members only.
                </p>
              ) : null}

              {contextText ? (
                <section className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs uppercase tracking-[0.22em] text-white/38">About</span>
                    <span className="h-px min-w-0 flex-1 bg-white/12" aria-hidden />
                  </div>
                  <p className="m-0 max-w-[62ch] text-base leading-relaxed text-white/72">{contextText}</p>
                </section>
              ) : null}

              {isActive && !processRestricted && canActOnProject ? (
                <section className="flex flex-wrap gap-2">
                  {compactAction('Log work', 'trace', true)}
                  {compactAction('Add reference', 'reference')}
                  {compactAction('Record pivot', 'pivot')}
                  {compactAction('Raise veto', 'veto', false, true)}
                  {compactAction('Fork', 'fork')}
                  {compactAction('End project', 'credit', false, true)}
                </section>
              ) : null}

              {isActive && !processRestricted && !canActOnProject && !isLoggedIn ? (
                <section className="flex flex-wrap gap-2">
                  {guestAuthAction('Log work', `log in to log work on ${project.title}`, true)}
                  {guestAuthAction('Add reference', `log in to add a reference on ${project.title}`)}
                  {guestAuthAction('Record pivot', `log in to record a pivot on ${project.title}`)}
                  {guestAuthAction('Raise veto', `log in to raise a veto on ${project.title}`, false, true)}
                  {guestAuthAction('Fork', `log in to fork ${project.title}`)}
                  {guestAuthAction('End project', `log in to end ${project.title}`, false, true)}
                </section>
              ) : null}

              {project.status === 'completed' && !processRestricted && canActOnProject ? (
                <section className="flex flex-wrap gap-2">{compactAction('Credit / sign', 'credit')}</section>
              ) : null}

              {!processRestricted && activeForm === 'trace' && <TraceForm projectId={project._id} onDone={reload} />}
              {!processRestricted && activeForm === 'reference' && <ReferenceForm projectId={project._id} onDone={reload} />}
              {!processRestricted && activeForm === 'pivot' && <PivotForm projectId={project._id} onDone={reload} />}
              {!processRestricted && activeForm === 'veto' && <VetoForm projectId={project._id} traces={traces} onDone={reload} />}
              {!processRestricted && activeForm === 'fork' && <ForkForm projectId={project._id} onDone={reload} />}
              {!processRestricted && activeForm === 'credit' && (
                <CreditForm
                  projectId={project._id}
                  contributors={contributors}
                  onDone={reload}
                  isPrimary={amPrimary}
                  genInput={{
                    projectId: project._id,
                    title: project.title,
                    contributors: contributors.map((c) => ({ alias: c.alias })),
                    traceCount: timeline.filter((e) => e.kind === 'trace').length,
                    pivotCount: timeline.filter((e) => e.kind === 'pivot').length,
                    referenceCount: timeline.filter((e) => e.kind === 'reference').length,
                  }}
                />
              )}

              {!processRestricted ? (
              <>
              {/* Proof & media */}
              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs uppercase tracking-[0.22em] text-white/38">Proof &amp; media</span>
                  <span className="h-px min-w-0 flex-1 bg-white/12" aria-hidden />
                </div>
                {mediaItems.length === 0 ? (
                  <p className="m-0 text-xs text-white/35">No media attached yet.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {mediaItems.map((m) => (
                      <MediaThumbCard key={m.mediaId} m={m} />
                    ))}
                  </div>
                )}
                {mediaItems.length > 0 ? (
                  <details className="rounded-sm border border-white/10 bg-black/20 px-3 py-2 text-base text-white/45">
                    <summary className="cursor-pointer font-mono uppercase tracking-[0.14em] text-white/55">
                      Verification details
                    </summary>
                    <p className="mt-2 mb-0 leading-relaxed">
                      Files are hashed (SHA-256) before storage; hashes are recorded with traces. Download a file and hash it locally to verify it matches.
                    </p>
                    <ul className="mt-3 space-y-6 divide-y divide-white/10 border-t border-white/10 pt-3">
                      {mediaItems.map((m) => (
                        <li key={`d-${m.mediaId}`} className="pt-4 first:pt-0">
                          <MediaPreview
                            mediaId={m.mediaId}
                            mimeType={m.mimeType}
                            hash={m.hash}
                            originalName={m.originalName}
                          />
                          <p className="mt-2 font-mono text-xs text-white/38">
                            SHA-256 · <span className="break-all text-white/55">{m.hash}</span>
                          </p>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </section>

              {/* References (logged contracts) */}
              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs uppercase tracking-[0.22em] text-white/38">References</span>
                  <span className="h-px min-w-0 flex-1 bg-white/12" aria-hidden />
                </div>
                {referencesList.length === 0 ? (
                  <p className="m-0 text-xs text-white/35">No references declared.</p>
                ) : (
                  <ul className="m-0 list-none divide-y divide-white/10 p-0">
                    {referencesList.map((r) => (
                      <ReferenceDeclaredRow key={r._id} refRow={r} />
                    ))}
                  </ul>
                )}
              </section>

              {/* Pivots — hide if empty */}
              {pivotsList.length > 0 ? (
                <section className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs uppercase tracking-[0.22em] text-white/38">Pivot points</span>
                    <span className="h-px min-w-0 flex-1 bg-white/12" aria-hidden />
                  </div>
                  <ul className="m-0 list-none space-y-2 border-l border-amber-400/25 pl-3 p-0">
                    {pivotsList.map((pv) => (
                      <li key={pv._id} className="space-y-1">
                        <p className="m-0 font-mono text-base text-white/55">
                          {pv.createdAt ? new Date(pv.createdAt).toLocaleString() : '—'} ·{' '}
                          <span className="font-mono lowercase text-white/78">{String(pv.nodeAlias ?? '—').toLowerCase()}</span>
                        </p>
                        <p className="m-0 text-sm leading-relaxed text-white/72">{pv.reason ?? '—'}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              </>
              ) : null}

              {project.status === 'completed' ? (
                <section
                  className="mt-7 rounded-md border border-amber-400/45 bg-gradient-to-b from-amber-950/[0.22] to-black/[0.35] px-5 py-5 shadow-[inset_0_1px_0_0_rgba(251,191,36,0.15)]"
                  aria-labelledby="provenance-cert-heading"
                >
                  <div className="flex items-center gap-2.5">
                    <ProvenanceChainLockIcon className="shrink-0 text-amber-400/90" />
                    <h2
                      id="provenance-cert-heading"
                      className="m-0 font-mono text-xs uppercase tracking-[0.28em] text-amber-100/95"
                    >
                      PROVENANCE CERTIFICATE
                    </h2>
                  </div>
                  <p className="mt-4 mb-0 font-mono text-base leading-relaxed text-white/65">
                    <span className="text-white/38">Minted</span>{' '}
                    {creditBundle?.nft?.createdAt
                      ? new Date(creditBundle.nft.createdAt).toLocaleString(undefined, {
                          dateStyle: 'long',
                          timeStyle: 'short',
                        })
                      : project.updatedAt
                        ? new Date(project.updatedAt).toLocaleString(undefined, {
                            dateStyle: 'long',
                            timeStyle: 'short',
                          })
                        : '—'}
                  </p>

                  {contributors.filter((c) => c.accepted !== false).length === 0 ? (
                    <p className="mt-4 mb-0 border-t border-amber-400/15 pt-4 font-mono text-xs text-white/42">
                      No contributors on record.
                    </p>
                  ) : (
                    <ul className="mt-4 list-none border-t border-amber-400/15 p-0 pt-4">
                      {contributors
                        .filter((c) => c.accepted !== false)
                        .map((c) => {
                          const role = contributorRoleLabel(c)
                          const w = creditBundle?.nft?.contributors?.find((x) => x.alias === c.alias)?.weight
                          const showWeight =
                            creditBundle?.nft?.contributors &&
                            creditBundle.nft.contributors.length > 0 &&
                            w != null &&
                            Number.isFinite(w)
                          return (
                            <li
                              key={c.alias}
                              className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-amber-400/[0.07] py-2 font-mono text-xs last:border-b-0"
                            >
                              <span className="lowercase text-white/88">{c.alias.toLowerCase()}</span>
                              <span className="text-right text-white/48">
                                {showWeight ? (
                                  <>
                                    <span className="text-white/55">{role}</span>
                                    <span className="mx-1.5 text-white/22">·</span>
                                    <span className="tabular-nums text-amber-100/75">{fmtPct(w)}</span>
                                  </>
                                ) : (
                                  <span className="text-white/55">{role}</span>
                                )}
                              </span>
                            </li>
                          )
                        })}
                    </ul>
                  )}

                  <p className="mt-5 border-t border-amber-400/15 pt-4 font-mono text-xs uppercase tracking-[0.22em] text-white/32">
                    CHAIN RECORD VERIFIED
                    <span className="mt-2 block break-all font-mono text-xs normal-case tracking-[0.04em] text-white/38">
                      {project._id}
                    </span>
                  </p>

                  <div className="mt-4 border-t border-amber-400/15 pt-4">
                    {amListed && isLoggedIn ? (
                      <button
                        type="button"
                        onClick={() => void exportProject()}
                        disabled={exportBusy}
                        className="cursor-pointer border-0 bg-transparent p-0 font-mono text-base uppercase tracking-[0.22em] text-amber-200/90 underline decoration-amber-400/40 underline-offset-[5px] transition hover:text-amber-50 hover:decoration-amber-300/60 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {exportBusy ? 'Exporting…' : 'Export'}
                      </button>
                    ) : !isLoggedIn ? (
                      <button
                        type="button"
                        onClick={() =>
                          window.location.assign(
                            loginUrl({
                              reason: `log in as a contributor to export the chain record for ${project.title}`,
                            }),
                          )
                        }
                        className="cursor-pointer border-0 bg-transparent p-0 font-mono text-base uppercase tracking-[0.22em] text-amber-200/90 underline decoration-amber-400/40 underline-offset-[5px] opacity-50 transition hover:text-amber-50 hover:opacity-80 hover:decoration-amber-300/60"
                      >
                        Export
                      </button>
                    ) : (
                      <p className="m-0 font-mono text-xs leading-relaxed text-white/38">
                        Only listed contributors can export the chain JSON.
                      </p>
                    )}
                  </div>
                </section>
              ) : null}
            </div>

            {/* RIGHT ~40% — chain record */}
            <aside className="min-w-0 space-y-8 lg:sticky lg:top-4 lg:self-start">
              {processRestricted ? (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="font-mono text-xs uppercase tracking-[0.28em] text-white/45">Chain record</span>
                    <span className="h-px min-w-0 flex-1 bg-white/12" aria-hidden />
                  </div>
                  <p className="m-0 text-xs leading-relaxed text-white/42">
                    the process log for this project is visible to space members only.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="font-mono text-xs uppercase tracking-[0.28em] text-white/45">Chain record</span>
                    <span className="h-px min-w-0 flex-1 bg-white/12" aria-hidden />
                  </div>
                  <ProjectTimeline entries={timeline} projectId={id} variant="chainRecord" />
                </div>
              )}

              {project.status === 'completed' && creditBundle?.nft ? (
                <section className="rounded-sm border border-amber-400/55 bg-amber-400/[0.06] p-5 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.12)]">
                  <h3 className="m-0 font-mono text-base uppercase tracking-[0.28em] text-amber-200/95">
                    Provenance certificate
                  </h3>
                  <p className="mt-3 mb-0 font-mono text-base text-white/55">
                    Minted{' '}
                    {creditBundle.nft.createdAt
                      ? new Date(creditBundle.nft.createdAt).toLocaleString()
                      : '—'}
                  </p>
                  {creditBundle.nft.contributors && creditBundle.nft.contributors.length > 0 ? (
                    <ul className="mt-4 list-none space-y-2 border-t border-amber-400/20 p-0 pt-4">
                      {creditBundle.nft.contributors.map((cw) => {
                        const pct = cw.weight <= 1 ? cw.weight * 100 : cw.weight
                        return (
                          <li key={cw.alias} className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-xs">
                            <span className="text-white/85">{cw.alias}</span>
                            <span className="text-white/45">
                              {pct.toFixed(1)}% · {cw.role}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                  <Link
                    to={`/provenance/${encodeURIComponent(creditBundle.nft._id)}`}
                    className="mt-5 inline-block font-mono text-xs uppercase tracking-[0.18em] text-amber-200/85 underline decoration-amber-400/35 underline-offset-4 transition hover:text-amber-100"
                  >
                    View on chain →
                  </Link>
                </section>
              ) : null}
            </aside>
          </div>
        ) : !error ? (
          <p className="text-sm text-white/55">Loading…</p>
        ) : null}
      </div>
    </AppShell>
  )
}

const REL_TAG_STYLE: Record<string, string> = {
  inspired_by: 'border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-100/95',
  built_on: 'border-sky-400/40 bg-sky-400/10 text-sky-100/95',
  forked_from: 'border-amber-400/45 bg-amber-400/12 text-amber-100/95',
  in_response_to: 'border-rose-400/35 bg-rose-400/10 text-rose-100/90',
  pedagogical_source: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100/95',
  ai_generated: 'border-violet-400/40 bg-violet-400/10 text-violet-100/95',
  other: 'border-white/20 bg-white/[0.06] text-white/75',
}

function relLabel(t?: string) {
  if (!t) return 'Reference'
  const map: Record<string, string> = {
    inspired_by: 'Inspired by',
    built_on: 'Built on',
    forked_from: 'Forked from',
    in_response_to: 'In response to',
    pedagogical_source: 'Pedagogical source',
    ai_generated: 'AI generated',
    other: 'Other',
  }
  return map[t] ?? t.replace(/_/g, ' ')
}

function referenceTarget(refRow: RefRow): ReactNode {
  const cite = refRow.citation?.trim()
  if (cite) return cite
  const url = refRow.externalUrl?.trim()
  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="break-all text-sky-300/90 underline decoration-white/20 hover:text-sky-200">
        {url}
      </a>
    )
  }
  const sid = refRow.sourceProjectId && String(refRow.sourceProjectId).trim()
  if (sid) {
    return (
      <Link
        to={`/projects/${encodeURIComponent(sid)}`}
        className="text-white/82 underline decoration-white/22 hover:text-white"
      >
        Linked project {fmtShortId(sid)}
      </Link>
    )
  }
  return '—'
}

function ReferenceDeclaredRow({ refRow }: { refRow: RefRow }) {
  const rt = refRow.relationshipType || 'other'
  const tagClass = REL_TAG_STYLE[rt] ?? REL_TAG_STYLE.other
  const when = refRow.createdAt ? new Date(refRow.createdAt).toLocaleString() : '—'

  return (
    <li className="py-3 first:pt-0">
      <div className="flex flex-wrap items-center gap-2 gap-y-2">
        <span className={`rounded-sm border px-2 py-0.5 font-mono text-xs uppercase tracking-[0.12em] ${tagClass}`}>
          {relLabel(rt)}
        </span>
      </div>
      <p className="m-0 mt-1.5 text-sm leading-relaxed text-white/78">{referenceTarget(refRow)}</p>
      <p className="m-0 mt-1.5 font-mono text-xs text-white/38">
        Declared by <span className="font-mono lowercase text-white/55">{String(refRow.nodeAlias ?? '—').toLowerCase()}</span>{' '}
        · {when}
      </p>
    </li>
  )
}
