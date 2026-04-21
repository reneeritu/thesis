import { useEffect, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { getAlias } from '../lib/session'
import { AppShell } from '../components/AppShell'
import { MediaPreview } from '../components/MediaPreview'
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
  contributors?: Contributor[]
}

type TraceRow = { _id: string; activityType?: string; description?: string; nodeAlias?: string; timestamp?: string; createdAt?: string; [k: string]: unknown }
type RefRow = { _id: string; relationshipType?: string; nodeAlias?: string; createdAt?: string; [k: string]: unknown }
type PivotRow = { _id: string; reason?: string; nodeAlias?: string; createdAt?: string; [k: string]: unknown }
type VetoRow = { _id: string; vetoType?: string; nodeAlias?: string; createdAt?: string; [k: string]: unknown }

type NftCredit = { nft: { _id: string } }

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

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const meAlias = getAlias()
  const [project, setProject] = useState<Project | null>(null)
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [traces, setTraces] = useState<TraceRow[]>([])
  const [nftId, setNftId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeForm, setActiveForm] = useState<ActiveForm>(null)
  const [loadKey, setLoadKey] = useState(0)
  const [respondBusy, setRespondBusy] = useState(false)
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [showMedia, setShowMedia] = useState(false)

  const reload = useCallback(() => setLoadKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) return
      try {
        const p = await api<Project>('/projects/' + encodeURIComponent(id))
        if (cancelled) return
        setProject(p)

        const [traceRes, refRes, pivotRes, vetoRes, mediaRes] = await Promise.all([
          api<TraceRow[]>('/traces/project/' + encodeURIComponent(id)).catch(() => [] as TraceRow[]),
          api<RefRow[]>('/references/project/' + encodeURIComponent(id)).catch(() => [] as RefRow[]),
          api<PivotRow[]>('/pivots/project/' + encodeURIComponent(id)).catch(() => [] as PivotRow[]),
          api<VetoRow[]>('/vetos/project/' + encodeURIComponent(id)).catch(() => [] as VetoRow[]),
          api<MediaItem[]>('/media/project/' + encodeURIComponent(id)).catch(() => [] as MediaItem[]),
        ])
        if (cancelled) return

        setTraces(traceRes)
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

        if (p.status === 'completed') {
          try {
            const cr = await api<NftCredit>('/credits/project/' + encodeURIComponent(id))
            if (!cancelled && cr?.nft?._id) setNftId(cr.nft._id)
          } catch { /* no credit yet */ }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load project')
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, loadKey])

  const isActive = project?.status === 'active'
  const contributors = project?.contributors ?? []
  const myContrib = contributors.find((c) => c.alias === meAlias)
  const myPendingInvite = myContrib?.accepted === null || myContrib?.accepted === undefined
    ? myContrib
    : null
  const amPrimary = Boolean(myContrib?.isPrimary && myContrib?.accepted)
  const amListed = Boolean(myContrib)
  const isPublic = project ? ['process_visible', 'fully_public'].includes((project as unknown as { visibility?: string }).visibility || '') : false

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
      const data = await api<Record<string, unknown>>(
        '/projects/' + encodeURIComponent(id) + '/export',
      )
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

  const actionBtn = (label: string, form: ActiveForm, variant: 'secondary' | 'danger' = 'secondary') => (
    <button
      type="button"
      onClick={() => toggle(form)}
      className={`px-3 py-1 text-[11px] font-mono uppercase tracking-[0.16em] border border-black transition ${
        activeForm === form
          ? 'bg-black text-yellow-400'
          : variant === 'danger'
            ? 'bg-grey-100 hover:bg-black hover:text-yellow-400'
            : 'bg-white hover:bg-black hover:text-yellow-400'
      }`}
    >
      {label}
    </button>
  )

  return (
    <AppShell title={project?.title || 'Project'}>
      <div className="space-y-4">
        {error && (
          <p className="border border-black bg-grey-100 px-3 py-2 text-small font-mono text-black" role="alert">
            {error}
          </p>
        )}

        {project ? (
          <>
            <section className="flex flex-wrap items-center gap-3">
              <span className="inline-block border border-black bg-black px-2 py-1 text-[11px] font-mono uppercase tracking-[0.16em] text-yellow-400">
                {project.status}
              </span>
              <span className="text-small text-grey-400 font-mono break-all">
                {project._id}
              </span>
              {nftId && (
                <Link
                  to={`/nfts/${encodeURIComponent(nftId)}`}
                  className="border border-black bg-yellow-400 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.16em] text-black hover:bg-black hover:text-yellow-400 transition"
                  title="Open the certificate minted at the end of this project"
                >
                  Provenance certificate
                </Link>
              )}
              {amListed ? (
                <button
                  type="button"
                  onClick={() => void exportProject()}
                  disabled={exportBusy}
                  className="border border-black bg-white px-3 py-1 text-[11px] font-mono uppercase tracking-[0.16em] hover:bg-black hover:text-yellow-400 transition disabled:opacity-60"
                  title="Download project + its chain slice (traces, references, pivots, vetos) as JSON"
                >
                  {exportBusy ? 'Exporting…' : 'Export JSON'}
                </button>
              ) : null}
            </section>

            {/* Non-contributor: request to collaborate */}
            {isActive && !amListed && isPublic ? (
              <section className="border border-grey-200 bg-white p-3 space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-grey-400">
                  Want to collaborate?
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={joinReqNote}
                    onChange={(e) => setJoinReqNote(e.target.value)}
                    placeholder="short note (optional)"
                    className="min-w-[220px] flex-1 border border-black bg-white px-3 py-2 font-mono text-small"
                  />
                  <button
                    type="button"
                    disabled={joinReqBusy}
                    onClick={() => void sendJoinRequest()}
                    className="border border-black bg-yellow-400 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-black hover:bg-black hover:text-yellow-400 transition disabled:opacity-60"
                  >
                    {joinReqBusy ? 'Sending…' : 'Request to collaborate'}
                  </button>
                </div>
                {joinReqMsg ? (
                  <p className="font-mono text-[11px] text-grey-600">{joinReqMsg}</p>
                ) : null}
              </section>
            ) : null}

            {/* Pending contributor invitation for current user */}
            {myPendingInvite && (
              <section className="border border-black p-4 space-y-3 bg-yellow-50">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em]">
                  You have been invited as a contributor to this project
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={respondBusy}
                    onClick={() => respondContributor(true)}
                    className="border border-black bg-black text-yellow-400 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] hover:bg-yellow-400 hover:text-black transition disabled:opacity-60"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={respondBusy}
                    onClick={() => respondContributor(false)}
                    className="border border-grey-400 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-grey-600 hover:border-black hover:text-black transition disabled:opacity-60"
                  >
                    Decline
                  </button>
                </div>
              </section>
            )}

            {/* Contributors */}
            <section className="space-y-2">
              <h2 className="text-small font-mono uppercase tracking-[0.18em] text-grey-400">
                Contributors
              </h2>
              {contributors.length ? (
                <ul className="space-y-1 text-small font-mono">
                  {contributors.map((c) => (
                    <li key={c.alias} className="flex items-center gap-2">
                      <Link to={`/nodes/${encodeURIComponent(c.alias)}`} className="hover:underline">
                        {c.alias}
                      </Link>
                      {c.role ? <span className="text-grey-400">({c.role})</span> : null}{' '}
                      {c.isPrimary ? (
                        <span className="inline-block border border-black bg-black px-1 py-0.5 text-[10px] uppercase tracking-[0.16em] text-yellow-400">
                          Primary
                        </span>
                      ) : null}
                      {c.accepted === null ? (
                        <span className="inline-block border border-grey-300 px-1 py-0.5 text-[10px] uppercase tracking-[0.12em] text-grey-400">
                          Pending
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-small text-grey-400">—</p>
              )}

              {isActive && amPrimary ? (
                <div className="border border-grey-200 bg-white p-3 space-y-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-grey-400">
                    Invite a collaborator
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <input
                      value={inviteAlias}
                      onChange={(e) => setInviteAlias(e.target.value)}
                      placeholder="alias"
                      className="min-w-[160px] flex-1 border border-black bg-white px-3 py-2 font-mono text-small"
                    />
                    <input
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      placeholder="role (optional)"
                      className="min-w-[140px] flex-1 border border-black bg-white px-3 py-2 font-mono text-small"
                    />
                    <button
                      type="button"
                      disabled={inviteBusy || !inviteAlias.trim()}
                      onClick={() => void sendInvite()}
                      className="border border-black bg-black px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-yellow-400 transition hover:bg-yellow-400 hover:text-black disabled:opacity-60"
                    >
                      {inviteBusy ? 'Sending…' : 'Send invite'}
                    </button>
                  </div>
                  {inviteMsg ? (
                    <p className="font-mono text-[11px] text-grey-600">{inviteMsg}</p>
                  ) : null}
                  <p className="font-mono text-[10px] text-grey-400">
                    They'll get a notification to accept or decline. Share your own details with{' '}
                    <Link
                      to={`/nodes/${encodeURIComponent(meAlias)}`}
                      className="underline hover:text-black"
                    >
                      /nodes/{meAlias}
                    </Link>
                    .
                  </p>
                </div>
              ) : null}
            </section>

            {/* Action bar */}
            {isActive && (
              <section className="flex flex-wrap gap-2">
                {actionBtn('Log Work', 'trace')}
                {actionBtn('Add Reference', 'reference')}
                {actionBtn('Record Pivot', 'pivot')}
                {actionBtn('Raise Veto', 'veto', 'danger')}
                {actionBtn('Fork', 'fork')}
                {actionBtn('End Project', 'credit', 'danger')}
              </section>
            )}
            {!isActive && project.status === 'completed' && (
              <section className="flex flex-wrap gap-2">
                {actionBtn('Credit / Sign', 'credit')}
              </section>
            )}

            {/* Active contract form */}
            {activeForm === 'trace' && <TraceForm projectId={project._id} onDone={reload} />}
            {activeForm === 'reference' && <ReferenceForm projectId={project._id} onDone={reload} />}
            {activeForm === 'pivot' && <PivotForm projectId={project._id} onDone={reload} />}
            {activeForm === 'veto' && <VetoForm projectId={project._id} traces={traces} onDone={reload} />}
            {activeForm === 'fork' && <ForkForm projectId={project._id} onDone={reload} />}
            {activeForm === 'credit' && (
              <CreditForm projectId={project._id} contributors={contributors} onDone={reload} />
            )}

            {/* Media proof panel */}
            <section className="space-y-2">
              <button
                type="button"
                onClick={() => setShowMedia((v) => !v)}
                className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-grey-400 hover:text-black"
              >
                <span>{showMedia ? '▾' : '▸'}</span>
                Proof & Media ({mediaItems.length} file{mediaItems.length !== 1 ? 's' : ''})
              </button>

              {showMedia && (
                <div className="space-y-2">
                  <div className="border border-dashed border-grey-300 bg-grey-50 px-4 py-3 space-y-1">
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-grey-500">How verification works</p>
                    <p className="text-[12px] text-grey-600">
                      Every uploaded file is hashed with SHA-256 before it's stored. The hash is recorded on the trace entry (on-chain). To verify a file hasn't been tampered with: download it, compute its SHA-256, and compare to the hash shown here — they must match exactly.
                    </p>
                  </div>

                  {mediaItems.length === 0 ? (
                    <p className="text-small text-grey-400 font-mono">No proof files yet. Attach an image, video, or audio file when logging work.</p>
                  ) : (
                    <ul className="divide-y divide-grey-100 border border-grey-200">
                      {mediaItems.map((m) => (
                        <li key={m.mediaId} className="px-4 py-3 space-y-2">
                          <div className="space-y-0.5 min-w-0">
                            <p className="font-mono text-[12px] truncate">{m.originalName}</p>
                            <p className="font-mono text-[10px] text-grey-400">
                              {m.mimeType} · {(m.size / 1024).toFixed(1)} KB · uploaded by {m.uploaderAlias}
                            </p>
                          </div>
                          <MediaPreview
                            mediaId={m.mediaId}
                            mimeType={m.mimeType}
                            hash={m.hash}
                            originalName={m.originalName}
                          />
                          <div className="space-y-0.5">
                            <p className="font-mono text-[10px] text-grey-400">
                              Media ID — <span className="text-black tracking-wider">{m.mediaId}</span>
                            </p>
                            <p className="font-mono text-[10px] text-grey-400">SHA-256 fingerprint</p>
                            <p className="font-mono text-[10px] break-all text-grey-700">{m.hash}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>

            {/* Timeline */}
            <section className="space-y-2">
              <h2 className="text-small font-mono uppercase tracking-[0.18em] text-grey-400">
                Activity Timeline
              </h2>
              <ProjectTimeline entries={timeline} projectId={id} />
            </section>

            <p className="pt-2">
              <Link
                to={`/archive/new?space=${encodeURIComponent(project.spaceId)}`}
                className="font-mono text-small underline underline-offset-4"
              >
                Archive past work in this space
              </Link>
            </p>
          </>
        ) : !error ? (
          <p className="text-small font-mono text-grey-400">Loading…</p>
        ) : null}
      </div>
    </AppShell>
  )
}
