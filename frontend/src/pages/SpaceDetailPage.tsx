import { useEffect, useState, useCallback, useMemo, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { GenerativeAvatar } from '../components/GenerativeAvatar'
import { api } from '../lib/api'
import { activityLabel } from '../lib/activityLabels'
import { getAlias, getToken } from '../lib/session'
import { formatTimeAgo } from '../lib/timeAgo'
import { SpaceDiscussion } from '../components/space/SpaceDiscussion'

type InviteCode = {
  code: string
  used: boolean
  usedCount: number
  mode: 'single_use' | 'multi_use'
  expiresAt: string | null
  createdAt: string
}

type PendingVeto = { alias: string; notifiedAt: string }

type SpaceSettings = {
  projectAccess?: string
  privacyDefault?: string
  vetoAuthority?: string[]
  inviteMode?: string
  inviteExpiryDays?: number | null
  minDocRequirements?: string[]
  contentRestrictions?: string[]
}

type Space = {
  _id: string
  name: string
  description?: string
  logoSeed?: string
  members: string[]
  admins: string[]
  creatorAlias: string
  settings?: SpaceSettings
  pendingVeto?: PendingVeto[]
  inviteCodes?: InviteCode[]
  status?: string
}

type ProjectContributor = {
  alias: string
  accepted?: boolean | null
}

type ProjectRow = {
  _id: string
  title: string
  status: string
  logoSeed?: string
  creatorAlias?: string
  contributors?: ProjectContributor[]
}

type GenerateInviteOpts = {
  mode: 'single_use' | 'multi_use'
  expiryDays: number | null
}

type SpaceRecentTrace = {
  nodeAlias: string
  activityType: string
  timestamp: string
  projectId: string
  projectTitle: string
}

function AsideSectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 flex min-w-0 items-center gap-2">
      <span className="shrink-0 font-mono text-xs uppercase tracking-[0.22em] text-white/38">{children}</span>
      <span className="h-px min-w-0 flex-1 bg-white/12" aria-hidden />
    </div>
  )
}

function labelProjectAccess(v?: string) {
  switch (v) {
    case 'open':
      return 'open'
    case 'invite_only':
      return 'invite only'
    case 'application':
      return 'application'
    default:
      return v?.replace(/_/g, ' ') ?? '—'
  }
}

function labelPrivacy(v?: string) {
  switch (v) {
    case 'public':
      return 'public'
    case 'space_specific':
      return 'space-specific'
    case 'private':
      return 'private'
    default:
      return v?.replace(/_/g, ' ') ?? '—'
  }
}

function labelProjectStatus(status: string) {
  return status.replace(/_/g, ' ')
}

function contributorAliases(p: ProjectRow): string[] {
  const s = new Set<string>()
  if (p.creatorAlias) s.add(p.creatorAlias)
  for (const c of p.contributors ?? []) {
    if (c.accepted !== false) s.add(c.alias)
  }
  return [...s].slice(0, 14)
}

function SpaceProjectCard({ project }: { project: ProjectRow }) {
  const seed = project.logoSeed ?? project._id
  const aliases = contributorAliases(project)

  return (
    <Link
      to={`/projects/${encodeURIComponent(project._id)}`}
      className="group flex min-h-[260px] flex-col overflow-hidden rounded-sm border border-white/12 bg-black/28 transition hover:border-white/22"
    >
      <div className="relative min-h-[156px] flex-[3] w-full overflow-hidden bg-neutral-950/55">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <GenerativeAvatar seed={seed} size={280} monochrome={false} luminescent className="opacity-95 transition group-hover:opacity-100" />
        </div>
      </div>
      <div className="flex min-h-0 flex-[2] flex-col gap-1.5 bg-black/82 px-3 py-3">
        <h3 className="m-0 font-mono text-sm font-medium uppercase tracking-[0.1em] leading-snug text-white/90 line-clamp-2">
          {project.title}
        </h3>
        <p className="m-0 font-mono text-xs uppercase tracking-[0.16em] text-white/45">{labelProjectStatus(project.status)}</p>
        <div className="flex flex-wrap gap-1">
          {aliases.map((a) => (
            <span
              key={a}
              className="rounded px-1.5 py-0.5 font-mono text-xs text-white/55 bg-white/[0.06]"
            >
              {a}
            </span>
          ))}
        </div>
      </div>
    </Link>
  )
}

export default function SpaceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const meAlias = getAlias()
  const isLoggedIn = Boolean(getToken())

  const [space, setSpace] = useState<Space | null>(null)
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const [genMode, setGenMode] = useState<'single_use' | 'multi_use'>('single_use')
  const [genExpiry, setGenExpiry] = useState<number | null>(15)
  const [genResult, setGenResult] = useState<{ inviteCode: string; expiresAt: string | null } | null>(null)
  const [spaceTab, setSpaceTab] = useState<'overview' | 'projects' | 'discussion' | 'admin'>('overview')
  const [recentTraces, setRecentTraces] = useState<SpaceRecentTrace[]>([])

  const load = useCallback(async () => {
    if (!id) return
    try {
      const s = await api<Space>('/spaces/' + encodeURIComponent(id))
      let p: ProjectRow[] = []
      try {
        p = await api<ProjectRow[]>('/projects/space/' + encodeURIComponent(id))
      } catch {
        /* ignore */
      }
      let traces: SpaceRecentTrace[] = []
      try {
        traces = await api<SpaceRecentTrace[]>(
          '/spaces/' + encodeURIComponent(id) + '/traces/recent?limit=5',
        )
      } catch {
        traces = []
      }
      setSpace(s)
      setProjects(p)
      setRecentTraces(Array.isArray(traces) ? traces : [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load space')
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const isMember = Boolean(isLoggedIn && meAlias && space?.members?.includes(meAlias))
  const isAdmin = Boolean(isLoggedIn && meAlias && space?.admins?.includes(meAlias))
  const hasPendingVeto = Boolean(
    isLoggedIn && meAlias && space?.pendingVeto?.some((p) => p.alias === meAlias),
  )
  const isDormant = space?.status === 'dormant'

  const memberCount = space?.members?.length ?? 0

  const sortedMembers = useMemo(() => {
    if (!space) return []
    return [...space.members].sort((a, b) => {
      const aa = space.admins.includes(a) ? 0 : 1
      const bb = space.admins.includes(b) ? 0 : 1
      if (aa !== bb) return aa - bb
      return a.localeCompare(b)
    })
  }, [space])

  const settings = space?.settings
  const minDocs = settings?.minDocRequirements ?? []
  const restrictions = settings?.contentRestrictions ?? []
  const hasRulesContent = minDocs.length > 0 || restrictions.length > 0
  const vetoList = settings?.vetoAuthority ?? []

  useEffect(() => {
    if (!isAdmin && spaceTab === 'admin') setSpaceTab('overview')
  }, [isAdmin, spaceTab])

  const tabs = useMemo(() => {
    const rows: ['overview' | 'projects' | 'discussion' | 'admin', string][] = [
      ['overview', 'Overview'],
      ['projects', 'Projects'],
      ['discussion', 'Discussion'],
    ]
    if (isAdmin) rows.push(['admin', 'Admin'])
    return rows
  }, [isAdmin])

  async function leaveSpace() {
    if (!id) return
    if (!window.confirm('Leave this space?')) return
    setBusy(true)
    try {
      await api('/spaces/' + encodeURIComponent(id) + '/leave', { method: 'DELETE' })
      navigate('/spaces')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to leave space')
    } finally {
      setBusy(false)
    }
  }

  async function generateInvite(opts: GenerateInviteOpts) {
    if (!id) return
    setBusy(true)
    try {
      const r = await api<{ inviteCode: string; expiresAt: string | null }>(
        '/spaces/' + encodeURIComponent(id) + '/invite',
        {
          method: 'POST',
          body: { mode: opts.mode, expiryDays: opts.expiryDays },
        },
      )
      setGenResult(r)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate invite')
    } finally {
      setBusy(false)
    }
  }

  async function respondVeto(joinSpace: boolean, acceptVeto: boolean) {
    if (!id) return
    setBusy(true)
    try {
      await api('/spaces/' + encodeURIComponent(id) + '/veto-respond', {
        method: 'POST',
        body: { joinSpace, acceptVeto },
      })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to respond')
    } finally {
      setBusy(false)
    }
  }

  function copyToClipboard(text: string, key: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  const inviteJoinUrl = (code: string) =>
    `${window.location.origin}/spaces/join?space=${id}&code=${encodeURIComponent(code)}`

  const artSeed = space?.logoSeed ?? space?._id ?? ''

  return (
    <AppShell title={space?.name || 'Space'} scrollMain>
      <div className="font-mono text-white">
        {error && (
          <p className="mb-3 shrink-0 border border-white/15 bg-black/40 px-3 py-2 text-small text-white" role="alert">
            {error}
          </p>
        )}

        {space ? (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,65fr)_minmax(0,35fr)] lg:items-start lg:gap-10">
            {/* LEFT */}
            <div className="flex min-w-0 flex-col">
              <div className="relative h-[180px] w-full shrink-0 overflow-hidden bg-neutral-950/70">
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <GenerativeAvatar seed={artSeed} size={560} monochrome={false} luminescent className="min-h-full min-w-full opacity-95" />
                </div>
              </div>

              <div className="mt-5 shrink-0 space-y-3">
                <h1 className="m-0 font-mono text-[clamp(1.25rem,3vw,1.75rem)] font-semibold uppercase tracking-[0.1em] leading-tight text-white">
                  {space.name}
                </h1>
                <div className="flex flex-wrap items-center gap-3 font-mono text-base uppercase tracking-[0.14em]">
                  <span className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        isDormant ? 'bg-amber-300/90' : 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.45)]'
                      }`}
                      aria-hidden
                    />
                    <span className={isDormant ? 'text-amber-200/85' : 'text-emerald-300/90'}>
                      {isDormant ? 'Dormant' : 'Active'}
                    </span>
                  </span>
                  <span className="text-white/42">{memberCount} members</span>
                </div>
                {space.description?.trim() ? (
                  <p className="m-0 max-w-[52ch] text-sm leading-relaxed text-white/58">{space.description.trim()}</p>
                ) : null}
              </div>

              <nav className="mt-8 flex shrink-0 flex-wrap gap-8 border-b border-white/12 pb-0">
                {tabs.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSpaceTab(key)}
                    className={`border-b-2 pb-2 font-mono text-base uppercase tracking-[0.22em] transition-colors ${
                      spaceTab === key
                        ? 'border-white text-white'
                        : 'border-transparent text-white/42 hover:text-white/72'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </nav>

              <div className="mt-6 space-y-10 pb-4">
                {spaceTab === 'overview' && (
                  <div className="flex flex-col gap-8">
                    <section className="space-y-3 text-sm leading-relaxed text-white/78">
                      <p className="m-0">
                        <span className="text-white/45">open to · </span>
                        {labelProjectAccess(settings?.projectAccess)}
                      </p>
                      <p className="m-0">
                        <span className="text-white/45">privacy · </span>
                        {labelPrivacy(settings?.privacyDefault)}
                      </p>
                      <p className="m-0">
                        <span className="text-white/45">created by · </span>
                        {space.creatorAlias}
                      </p>
                    </section>

                    {hasPendingVeto && (
                      <section className="border border-amber-400/35 bg-amber-400/5 px-4 py-4 space-y-3">
                        <p className="m-0 font-mono text-base uppercase tracking-[0.18em] text-amber-200/95">
                          You have been invited to join this space as veto authority
                        </p>
                        <p className="m-0 text-xs text-white/75">Choose how to respond:</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => respondVeto(true, true)}
                            className="border border-amber-400/50 bg-black/40 px-3 py-2 text-base uppercase tracking-[0.14em] text-amber-100 transition hover:bg-black/60 disabled:opacity-60"
                          >
                            Join + Accept Veto
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => respondVeto(true, false)}
                            className="border border-white/18 px-3 py-2 text-base uppercase tracking-[0.14em] text-white/75 transition hover:border-white/35 disabled:opacity-60"
                          >
                            Join Only (no veto)
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => respondVeto(false, false)}
                            className="border border-white/12 px-3 py-2 text-base uppercase tracking-[0.14em] text-white/55 transition hover:border-white/28 disabled:opacity-60"
                          >
                            Decline
                          </button>
                        </div>
                      </section>
                    )}

                    <div>
                      <AsideSectionLabel>Recent activity</AsideSectionLabel>
                      {recentTraces.length === 0 ? (
                        <p className="m-0 text-xs text-white/42">No traces yet.</p>
                      ) : (
                        <ul className="m-0 list-none space-y-2.5 p-0">
                          {recentTraces.map((t, idx) => (
                            <li
                              key={`${t.projectId}-${t.timestamp}-${idx}`}
                              className="text-xs leading-relaxed text-white/75"
                            >
                              <span className="text-white/88">{t.nodeAlias}</span>
                              <span className="text-white/35"> · </span>
                              <span>{activityLabel(t.activityType)}</span>
                              <span className="text-white/35"> · </span>
                              <span>{t.projectTitle}</span>
                              <span className="text-white/35"> · </span>
                              <span className="text-xs text-white/38">{formatTimeAgo(t.timestamp)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <section className="flex flex-wrap items-center gap-4">
                      {isLoggedIn ? (
                        <Link
                          to={`/projects/new?space=${encodeURIComponent(space._id)}`}
                          className="border border-yellow-400/90 bg-yellow-400 px-5 py-2.5 font-mono text-base font-medium uppercase tracking-[0.18em] text-black transition hover:bg-yellow-300"
                        >
                          New project
                        </Link>
                      ) : (
                        <Link
                          to="/login"
                          className="border border-yellow-400/90 bg-yellow-400 px-5 py-2.5 font-mono text-base uppercase tracking-[0.18em] text-black transition hover:bg-yellow-300"
                        >
                          Log in to create a project
                        </Link>
                      )}
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={() => setSpaceTab('admin')}
                          className="font-mono text-base uppercase tracking-[0.2em] text-white/55 transition hover:text-white/85"
                        >
                          Admin →
                        </button>
                      ) : null}
                      {!isAdmin && isMember && space.creatorAlias !== meAlias ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={leaveSpace}
                          className="border border-white/18 bg-transparent px-4 py-2 font-mono text-base uppercase tracking-[0.18em] text-white/65 transition hover:border-white/35 hover:text-white/88 disabled:opacity-60"
                        >
                          Leave space
                        </button>
                      ) : null}
                    </section>
                  </div>
                )}

                {spaceTab === 'projects' && id && (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {projects.map((p) => (
                      <SpaceProjectCard key={p._id} project={p} />
                    ))}
                    <Link
                      to={`/projects/new?space=${encodeURIComponent(space._id)}`}
                      className="flex min-h-[260px] flex-col items-center justify-center rounded-sm border border-dashed border-white/22 bg-transparent text-[28px] font-extralight text-white/38 transition hover:border-white/38 hover:text-white/65"
                      aria-label="New project"
                    >
                      +
                    </Link>
                  </div>
                )}

                {spaceTab === 'discussion' && id ? (
                  <SpaceDiscussion spaceId={id} isMember={isMember} isAdmin={isAdmin} meAlias={meAlias} />
                ) : null}

                {spaceTab === 'admin' && isAdmin ? (
                  <div className="flex flex-col gap-8">
                    <div>
                      <AsideSectionLabel>Space settings</AsideSectionLabel>
                      <Link
                        to={`/spaces/${encodeURIComponent(space._id)}/settings`}
                        className="inline-block font-mono text-xs uppercase tracking-[0.12em] text-white/70 underline decoration-white/25 underline-offset-[3px] transition hover:text-white"
                      >
                        Open full settings →
                      </Link>
                    </div>

                    {(space.pendingVeto?.length ?? 0) > 0 ? (
                      <section className="space-y-2 border border-white/12 bg-black/25 px-4 py-3">
                        <p className="m-0 font-mono text-xs uppercase tracking-[0.2em] text-white/45">
                          Pending veto invites
                        </p>
                        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                          {(space.pendingVeto ?? []).map((p) => (
                            <li key={p.alias}>
                              <span className="inline-block rounded-sm border border-white/14 px-2 py-1 font-mono text-base text-white/75">
                                {p.alias}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ) : null}

                    <section className="space-y-4 border border-white/12 bg-black/20 p-4">
                      <h2 className="m-0 font-mono text-xs uppercase tracking-[0.2em] text-white/45">Invite codes</h2>
                      <div className="flex flex-wrap items-end gap-4">
                        <label className="flex flex-col gap-1 font-mono text-xs uppercase tracking-[0.16em] text-white/42">
                          Mode
                          <select
                            value={genMode}
                            onChange={(e) => setGenMode(e.target.value as 'single_use' | 'multi_use')}
                            className="border border-white/18 bg-black/50 px-2 py-1.5 font-mono text-xs text-white/85"
                          >
                            <option value="single_use">Single use</option>
                            <option value="multi_use">Multi use</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 font-mono text-xs uppercase tracking-[0.16em] text-white/42">
                          Expires in
                          <select
                            value={genExpiry === null ? 'never' : String(genExpiry)}
                            onChange={(e) => {
                              const v = e.target.value
                              setGenExpiry(v === 'never' ? null : Number(v))
                            }}
                            className="border border-white/18 bg-black/50 px-2 py-1.5 font-mono text-xs text-white/85"
                          >
                            <option value="7">7 days</option>
                            <option value="15">15 days</option>
                            <option value="30">30 days</option>
                            <option value="never">Never</option>
                          </select>
                        </label>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => generateInvite({ mode: genMode, expiryDays: genExpiry })}
                          className="border border-yellow-400/80 bg-yellow-400/90 px-4 py-2 font-mono text-base uppercase tracking-[0.16em] text-black transition hover:bg-yellow-300 disabled:opacity-60"
                        >
                          Generate code
                        </button>
                      </div>
                      {genResult ? (
                        <div className="rounded-sm border border-emerald-400/35 bg-emerald-400/8 px-3 py-3 space-y-2">
                          <p className="m-0 font-mono text-base text-emerald-100/95">
                            New code: <span className="select-all text-white">{genResult.inviteCode}</span>
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => copyToClipboard(inviteJoinUrl(genResult.inviteCode), 'join')}
                              className="border border-white/22 px-3 py-1.5 font-mono text-xs uppercase tracking-[0.14em] text-white/75 transition hover:border-white/40"
                            >
                              {copied === 'join' ? 'Copied' : 'Copy join link'}
                            </button>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(genResult.inviteCode, 'code')}
                              className="border border-white/22 px-3 py-1.5 font-mono text-xs uppercase tracking-[0.14em] text-white/75 transition hover:border-white/40"
                            >
                              {copied === 'code' ? 'Copied' : 'Copy code'}
                            </button>
                          </div>
                        </div>
                      ) : null}
                      {(space.inviteCodes?.length ?? 0) === 0 ? (
                        <p className="m-0 text-xs text-white/42">No invite codes yet.</p>
                      ) : (
                        <ul className="m-0 list-none space-y-2 p-0">
                          {(space.inviteCodes ?? []).map((ic) => (
                            <li
                              key={ic.code}
                              className="flex flex-wrap items-center justify-between gap-2 border border-white/10 bg-black/35 px-3 py-2 text-base text-white/72"
                            >
                              <span className="font-mono select-all">{ic.code}</span>
                              <span className="text-xs uppercase tracking-[0.12em] text-white/38">
                                {ic.mode.replace('_', ' ')}
                                {ic.used ? ' · used' : ''} · {ic.usedCount} uses
                                {ic.expiresAt
                                  ? ` · expires ${new Date(ic.expiresAt).toLocaleDateString()}`
                                  : ' · no expiry'}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(inviteJoinUrl(ic.code), ic.code)}
                                className="shrink-0 border border-white/18 px-2 py-1 font-mono text-xs uppercase tracking-[0.12em] text-white/65 transition hover:border-white/35"
                              >
                                {copied === ic.code ? 'Copied' : 'Copy link'}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>

                    {isMember && space.creatorAlias !== meAlias ? (
                      <section>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={leaveSpace}
                          className="border border-white/18 bg-transparent px-4 py-2 font-mono text-base uppercase tracking-[0.18em] text-white/65 transition hover:border-white/35 hover:text-white/88 disabled:opacity-60"
                        >
                          Leave space
                        </button>
                      </section>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            {/* RIGHT */}
            <aside className="flex flex-col gap-8 border-white/10 pb-4 lg:border-l lg:pl-8">
              <div>
                <AsideSectionLabel>Members</AsideSectionLabel>
                <ul className="m-0 flex list-none flex-col gap-1 p-0">
                  {sortedMembers.map((alias) => {
                    const admin = space.admins.includes(alias)
                    return (
                      <li key={alias}>
                        <Link
                          to={`/nodes/${encodeURIComponent(alias)}`}
                          className="flex items-center gap-3 rounded-md py-2 pr-2 transition hover:bg-white/[0.04]"
                        >
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/12 bg-black/40">
                            <GenerativeAvatar seed={alias} size={80} monochrome={false} luminescent className="opacity-95" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="block truncate font-mono text-xs text-white/88">{alias}</span>
                            <span className="text-xs uppercase tracking-[0.16em] text-white/38">{admin ? 'admin' : 'member'}</span>
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>

              <div>
                <AsideSectionLabel>Space rules</AsideSectionLabel>
                {hasRulesContent ? (
                  <div className="space-y-4 text-base leading-relaxed text-white/58">
                    {minDocs.length > 0 ? (
                      <div>
                        <p className="m-0 mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Minimum documentation</p>
                        <ul className="m-0 list-disc space-y-1 pl-4">
                          {minDocs.map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {restrictions.length > 0 ? (
                      <div>
                        <p className="m-0 mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Content restrictions</p>
                        <ul className="m-0 list-disc space-y-1 pl-4">
                          {restrictions.map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="m-0 text-base italic leading-relaxed text-white/38">
                    No additional rules beyond chain defaults.
                  </p>
                )}
              </div>

              <div>
                <AsideSectionLabel>Veto authority</AsideSectionLabel>
                {vetoList.length > 0 ? (
                  <ul className="m-0 list-none space-y-1.5 p-0 font-mono text-base text-white/65">
                    {vetoList.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="m-0 text-base text-white/38">none assigned</p>
                )}
              </div>

              <p className="mt-10 font-mono text-xs leading-relaxed tracking-wide text-white/28 break-all">
                {space._id}
              </p>
            </aside>
          </div>
        ) : (
          !error && <p className="text-small text-white/65">Loading…</p>
        )}
      </div>
    </AppShell>
  )
}
