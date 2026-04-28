import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { api } from '../lib/api'
import { getAlias, getToken } from '../lib/session'
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

type Space = {
  _id: string
  name: string
  description?: string
  members: string[]
  admins: string[]
  creatorAlias: string
  settings?: {
    vetoAuthority?: string[]
    projectAccess?: string
    inviteMode?: string
    inviteExpiryDays?: number | null
  }
  pendingVeto?: PendingVeto[]
  inviteCodes?: InviteCode[]
  status?: string
}

type Project = {
  _id: string
  title: string
  status: string
}

type GenerateInviteOpts = {
  mode: 'single_use' | 'multi_use'
  expiryDays: number | null
}

export default function SpaceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const meAlias = getAlias()
  const isLoggedIn = Boolean(getToken())

  const [space, setSpace] = useState<Space | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  // Invite generation state
  const [genMode, setGenMode] = useState<'single_use' | 'multi_use'>('single_use')
  const [genExpiry, setGenExpiry] = useState<number | null>(15)
  const [genResult, setGenResult] = useState<{ inviteCode: string; expiresAt: string | null } | null>(null)
  const [spaceTab, setSpaceTab] = useState<'overview' | 'projects' | 'discussion'>('overview')

  const load = useCallback(async () => {
    if (!id) return
    try {
      const s = await api<Space>('/spaces/' + encodeURIComponent(id))
      let p: Project[] = []
      try { p = await api<Project[]>('/projects/space/' + encodeURIComponent(id)) } catch { /* ignore */ }
      setSpace(s)
      setProjects(p)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load space')
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  const isMember = Boolean(isLoggedIn && meAlias && space?.members?.includes(meAlias))
  const isAdmin = Boolean(isLoggedIn && meAlias && space?.admins?.includes(meAlias))
  const hasPendingVeto = Boolean(
    isLoggedIn && meAlias && space?.pendingVeto?.some((p) => p.alias === meAlias),
  )
  const isDormant = space?.status === 'dormant'

  async function leaveSpace() {
    if (!id) return
    if (!window.confirm('Leave this space?')) return
    setBusy(true)
    try {
      await api('/spaces/' + encodeURIComponent(id) + '/leave', { method: 'DELETE' })
      navigate('/spaces')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to leave space')
    } finally { setBusy(false) }
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
    } finally { setBusy(false) }
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
    } finally { setBusy(false) }
  }

  function copyToClipboard(text: string, key: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  const inviteJoinUrl = (code: string) =>
    `${window.location.origin}/spaces/join?space=${id}&code=${encodeURIComponent(code)}`

  return (
    <AppShell title={space?.name || 'Space'}>
      <div className="space-y-6">
        {error && (
          <p className="border border-black bg-grey-100 px-3 py-2 text-small font-mono text-white" role="alert">
            {error}
          </p>
        )}

        {space ? (
          <>
            <nav className="flex flex-wrap gap-2 border border-white/15 bg-zinc-950/30 p-1">
              {(
                [
                  ['overview', 'Overview'],
                  ['projects', 'Projects'],
                  ['discussion', 'Discussion'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSpaceTab(key)}
                  className={`border px-3 py-1.5 font-mono text-small uppercase tracking-[0.14em] transition ${
                    spaceTab === key
                      ? 'border-yellow-400 bg-yellow-400/15 text-yellow-400'
                      : 'border-transparent text-white hover:border-white/25'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>

            {spaceTab === 'overview' && (
          <div className="grid gap-8 xl:grid-cols-12">
            <div className="space-y-6 xl:col-span-5">
              {/* ── Info ── */}
              <section className="space-y-2 border border-white/20 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-block border border-black px-2 py-0.5 font-mono text-small uppercase tracking-[0.18em] ${
                      isDormant ? 'bg-grey-100 text-white' : 'bg-black text-yellow-400'
                    }`}
                    title={
                      isDormant
                        ? 'No recent activity. Invites remain active but no new contracts are expected.'
                        : 'Active — new contracts and invites are open.'
                    }
                  >
                    {isDormant ? 'Dormant' : 'Active'}
                  </span>
                  <p className="font-mono text-small text-white">
                    ID: <span className="break-all">{space._id}</span>
                  </p>
                </div>
                {space.description && <p className="text-body text-white">{space.description}</p>}
                <p className="font-mono text-small text-white">
                  Created by <strong>{space.creatorAlias}</strong> · {space.members.length} members
                  {space.settings?.vetoAuthority?.length
                    ? ` · Veto: ${space.settings.vetoAuthority.join(', ')}`
                    : ''}
                </p>
                {(space.pendingVeto?.length ?? 0) > 0 ? (
                  <div className="border border-grey-200 bg-grey-50 px-3 py-2 space-y-1">
                    <p className="font-mono text-small uppercase tracking-[0.18em] text-white">
                      Pending veto invites
                    </p>
                    <ul className="flex flex-wrap gap-1">
                      {space.pendingVeto!.map((p) => (
                        <li key={p.alias}>
                          <span className="inline-flex items-center gap-1 border border-white/25 bg-zinc-900/55 px-2 py-0.5 font-mono text-small">
                            <span className="text-white text-small uppercase tracking-[0.14em]">Veto invite</span>
                            <span>{p.alias}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>

              {/* ── Veto invitation for current user ── */}
              {hasPendingVeto && (
                <section className="border border-black p-4 space-y-3 bg-yellow-50">
                  <p className="font-mono text-small uppercase tracking-[0.18em]">
                    You have been invited to join this space as veto authority
                  </p>
                  <p className="text-small text-white">Choose how to respond:</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => respondVeto(true, true)}
                      className="border border-black bg-black text-yellow-400 px-3 py-1 font-mono text-small uppercase tracking-[0.14em] hover:bg-yellow-400 hover:text-white transition disabled:opacity-60"
                    >
                      Join + Accept Veto
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => respondVeto(true, false)}
                      className="border border-white/25 bg-zinc-900/55 px-3 py-1 font-mono text-small uppercase tracking-[0.14em] hover:bg-black hover:text-yellow-400 transition disabled:opacity-60"
                    >
                      Join Only (no veto)
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => respondVeto(false, false)}
                      className="border border-white/20 bg-zinc-900/50 px-3 py-1 font-mono text-small uppercase tracking-[0.14em] hover:bg-white/10 transition disabled:opacity-60 text-white"
                    >
                      Decline
                    </button>
                  </div>
                </section>
              )}

              {/* ── Actions ── */}
              <section className="flex flex-wrap gap-2 border border-white/20 p-3 text-small font-mono uppercase tracking-[0.18em]">
                {isLoggedIn ? (
                  <Link
                    to={`/projects/new?space=${encodeURIComponent(space._id)}`}
                    className="border border-black bg-yellow-400 px-3 py-1 text-white hover:bg-black hover:text-yellow-400 transition"
                  >
                    New project
                  </Link>
                ) : (
                  <Link
                    to="/login"
                    className="border border-white/25 bg-zinc-900/55 px-3 py-1 hover:bg-black hover:text-yellow-400 transition"
                  >
                    Log in to create a project
                  </Link>
                )}
                {isAdmin && (
                  <Link
                    to={`/spaces/${encodeURIComponent(space._id)}/settings`}
                    className="border border-white/25 bg-zinc-900/55 px-3 py-1 hover:bg-black hover:text-yellow-400 transition"
                  >
                    Settings
                  </Link>
                )}
                {isMember && space.creatorAlias !== meAlias && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={leaveSpace}
                    className="border border-grey-400 px-3 py-1 font-mono text-small uppercase tracking-[0.14em] text-white hover:border-black hover:text-white transition disabled:opacity-60"
                  >
                    Leave space
                  </button>
                )}
              </section>

              {/* ── Invite codes (admin only) ── */}
              {isAdmin && (
                <section className="space-y-3 border border-white/20 p-3">
                  <h2 className="text-h3 font-heading uppercase tracking-[0.18em]">Invite Codes</h2>

                  <div className="border border-grey-200 p-3 space-y-2">
                    <p className="font-mono text-small uppercase tracking-[0.14em] text-white">Generate new code</p>
                    <div className="flex flex-wrap gap-2 items-end">
                      <div>
                        <label className="block font-mono text-small text-white mb-0.5">Type</label>
                        <select
                          value={genMode}
                          onChange={(e) => setGenMode(e.target.value as 'single_use' | 'multi_use')}
                          className="border border-white/25 bg-zinc-900/55 px-2 py-1 font-mono text-small"
                        >
                          <option value="single_use">Single-use</option>
                          <option value="multi_use">Multi-use / shareable</option>
                        </select>
                      </div>
                      <div>
                        <label className="flex items-center gap-1 font-mono text-small text-white mb-0.5">
                          <input
                            type="checkbox"
                            checked={genExpiry !== null}
                            onChange={(e) => setGenExpiry(e.target.checked ? 15 : null)}
                          />
                          Expires in (days)
                        </label>
                        {genExpiry !== null && (
                          <input
                            type="number"
                            min={1}
                            value={genExpiry}
                            onChange={(e) => setGenExpiry(Number(e.target.value))}
                            className="w-20 border border-white/25 bg-zinc-900/55 px-2 py-1 font-mono text-small"
                          />
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => generateInvite({ mode: genMode, expiryDays: genExpiry })}
                        className="border border-white/25 bg-zinc-900/55 px-3 py-1 font-mono text-small uppercase tracking-[0.14em] hover:bg-black hover:text-yellow-400 transition disabled:opacity-60"
                      >
                        Generate
                      </button>
                    </div>

                    {genResult && (
                      <div className="mt-2 border border-black bg-grey-50 p-3 space-y-2">
                        <p className="font-mono text-small uppercase tracking-[0.12em] text-white">New invite code</p>
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-small tracking-widest break-all">{genResult.inviteCode}</code>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(genResult.inviteCode, 'code')}
                            className="border border-black px-2 py-0.5 font-mono text-small hover:bg-black hover:text-yellow-400 transition"
                          >
                            {copied === 'code' ? 'Copied!' : 'Copy code'}
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-small text-white break-all">{inviteJoinUrl(genResult.inviteCode)}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(inviteJoinUrl(genResult.inviteCode), 'url')}
                            className="border border-black px-2 py-0.5 font-mono text-small hover:bg-black hover:text-yellow-400 transition shrink-0"
                          >
                            {copied === 'url' ? 'Copied!' : 'Copy link'}
                          </button>
                        </div>
                        {genResult.expiresAt && (
                          <p className="font-mono text-small text-white">
                            Expires: {new Date(genResult.expiresAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Existing codes */}
                  {(space.inviteCodes?.length ?? 0) > 0 && (
                    <ul className="divide-y divide-grey-100 border border-grey-200">
                      {space.inviteCodes!.map((ic, i) => {
                        const isSingle = ic.mode !== 'multi_use'
                        const expired = ic.expiresAt ? new Date(ic.expiresAt).getTime() < Date.now() : false
                        const consumed = isSingle && (ic.used || (ic.usedCount ?? 0) >= 1)
                        return (
                          <li key={i} className="px-3 py-2 font-mono text-small space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`inline-block px-2 py-0.5 text-small uppercase tracking-[0.16em] border border-black ${
                                  isSingle
                                    ? 'bg-black text-yellow-400'
                                    : 'bg-zinc-800/80 text-white'
                                }`}
                                title={
                                  isSingle
                                    ? 'Single-use: one person can join with this code.'
                                    : 'Multi-use: everyone with the link can join until it expires.'
                                }
                              >
                                {isSingle ? 'Single-use' : 'Multi-use'}
                              </span>
                              {consumed ? (
                                <span className="inline-block border border-grey-300 bg-grey-100 px-2 py-0.5 text-small uppercase tracking-[0.16em] text-white">
                                  Used
                                </span>
                              ) : null}
                              {expired ? (
                                <span className="inline-block border border-grey-300 bg-grey-100 px-2 py-0.5 text-small uppercase tracking-[0.16em] text-white">
                                  Expired
                                </span>
                              ) : null}
                              <code className="tracking-widest break-all flex-1 min-w-0">{ic.code}</code>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(ic.code, 'ic-' + i)}
                                className="border border-black px-2 py-0.5 text-small hover:bg-black hover:text-yellow-400 transition shrink-0"
                              >
                                {copied === 'ic-' + i ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                            <p className="text-white">
                              used {ic.usedCount ?? (ic.used ? 1 : 0)}×
                              {ic.expiresAt ? ` · expires ${new Date(ic.expiresAt).toLocaleDateString()}` : ' · no expiry'}
                            </p>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>
              )}
            </div>

            <div className="space-y-6 xl:col-span-7">
              {/* ── Members list ── */}
              <section className="space-y-2">
                <h2 className="text-h3 font-heading uppercase tracking-[0.18em]">Members ({space.members.length})</h2>
                <ul className="divide-y divide-grey-100 border border-grey-200">
                  {space.members.map((alias) => (
                    <li key={alias} className="flex items-center justify-between px-3 py-2 font-mono text-small">
                      <Link to={`/nodes/${encodeURIComponent(alias)}`} className="hover:underline">
                        {alias}
                      </Link>
                      <span className="text-white">
                        {space.admins.includes(alias) ? 'admin' : 'member'}
                        {space.settings?.vetoAuthority?.includes(alias) ? ' · veto' : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
            )}

            {spaceTab === 'projects' && (
              <section className="space-y-3 border border-white/20 p-3">
                <h2 className="text-h3 font-heading uppercase tracking-[0.18em]">Projects</h2>
                {projects.length === 0 ? (
                  <p className="text-small text-white">No projects yet.</p>
                ) : (
                  <ul className="divide-y divide-grey-100 border border-grey-200">
                    {projects.map((p) => (
                      <li key={p._id} className="flex items-center justify-between px-3 py-2 text-small font-mono">
                        <span>{p.title}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-white text-small uppercase">{p.status}</span>
                          <Link
                            to={`/projects/${encodeURIComponent(p._id)}`}
                            className="border border-black px-2 py-0.5 text-small hover:bg-black hover:text-yellow-400 transition"
                          >
                            Open
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {spaceTab === 'discussion' && id ? (
              <SpaceDiscussion
                spaceId={id}
                isMember={isMember}
                isAdmin={isAdmin}
                meAlias={meAlias}
              />
            ) : null}
          </>
        ) : (
          !error && <p className="text-small font-mono text-white">Loading…</p>
        )}
      </div>
    </AppShell>
  )
}
