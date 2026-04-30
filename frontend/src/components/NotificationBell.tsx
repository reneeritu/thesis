import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChromeBackdropWhileOpen } from '../context/ChromeBackdropContext'
import { api } from '../lib/api'
import { getToken } from '../lib/session'
import { AnchoredGlassDropdownPanel } from './AnchoredGlassDropdownPanel'
import { HEADER_NAV_ICON_BUTTON_CLASS, HEADER_NAV_ICON_SVG_CLASS } from './HelpDrawer'

type Notification = {
  _id: string
  type?: string
  read?: boolean
  createdAt?: string
  relatedId?: string
  relatedType?: string
  metadata?: {
    message?: string
    spaceId?: string
    spaceName?: string
    projectId?: string
    projectTitle?: string
    pendingVeto?: string[]
    requesterAlias?: string
    [k: string]: unknown
  }
}

export function NotificationBell() {
  const [notes, setNotes] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const token = getToken()
  const navigate = useNavigate()
  useChromeBackdropWhileOpen(open)

  const load = useCallback(() => {
    if (!token) return
    void api<Notification[]>('/notifications')
      .then((n) => setNotes(n))
      .catch(() => {})
  }, [token])

  useEffect(() => {
    load()
    const id = window.setInterval(load, 30_000)
    return () => window.clearInterval(id)
  }, [load])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  if (!token) return null

  const unread = notes.filter((n) => !n.read).length

  async function markAllRead() {
    try {
      await api('/notifications/read-all', { method: 'PATCH' })
      setNotes((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch { /* ignore */ }
  }

  async function markRead(id: string) {
    try {
      await api('/notifications/' + id + '/read', { method: 'PATCH' })
      setNotes((prev) => prev.map((n) => n._id === id ? { ...n, read: true } : n))
    } catch { /* ignore */ }
  }

  async function vetoRespond(n: Notification, joinSpace: boolean, acceptVeto: boolean) {
    const spaceId = n.metadata?.spaceId || n.relatedId
    if (!spaceId) return
    setBusy(n._id)
    try {
      await api('/spaces/' + encodeURIComponent(spaceId) + '/veto-respond', {
        method: 'POST',
        body: { joinSpace, acceptVeto },
      })
      await markRead(n._id)
      load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(null) }
  }

  async function contribRespond(n: Notification, accept: boolean) {
    const projectId = n.metadata?.projectId || n.relatedId
    if (!projectId) return
    setBusy(n._id)
    try {
      await api('/projects/' + encodeURIComponent(projectId) + '/contributors/respond', {
        method: 'POST',
        body: { accept },
      })
      await markRead(n._id)
      load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(null) }
  }

  async function collabRequestRespond(n: Notification, accept: boolean) {
    const projectId = n.metadata?.projectId || n.relatedId
    const requesterAlias = typeof n.metadata?.requesterAlias === 'string'
      ? n.metadata.requesterAlias
      : ''
    if (!projectId || !requesterAlias) return
    setBusy(n._id)
    try {
      await api('/projects/' + encodeURIComponent(projectId) + '/join-request/respond', {
        method: 'POST',
        body: { requesterAlias, accept },
      })
      await markRead(n._id)
      load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(null) }
  }

  function openRelated(n: Notification) {
    setOpen(false)
    if (n.relatedType === 'space' && (n.metadata?.spaceId || n.relatedId)) {
      navigate('/spaces/' + (n.metadata?.spaceId || n.relatedId))
    } else if (n.relatedType === 'project' && (n.metadata?.projectId || n.relatedId)) {
      navigate('/projects/' + (n.metadata?.projectId || n.relatedId))
    }
  }

  const label = (n: Notification) =>
    n.metadata?.message || n.type || 'notification'

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={HEADER_NAV_ICON_BUTTON_CLASS}
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        title="Notifications"
      >
        <svg
          className={HEADER_NAV_ICON_SVG_CLASS}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex min-h-[1rem] min-w-[1rem] items-center justify-center rounded-full bg-yellow-400 px-0.5 text-small font-mono font-medium leading-none text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      <AnchoredGlassDropdownPanel
        open={open}
        onClose={() => setOpen(false)}
        align="right"
        ariaLabel="Notifications"
        className="flex w-80 max-h-[min(calc(100dvh-4.5rem),42rem)] flex-col overflow-hidden border border-white/20 floating-glass-panel shadow-xl"
      >
        <div className="sticky top-0 z-[1] flex shrink-0 items-center justify-between border-b border-white/15 bg-zinc-950/50 px-3 py-2 backdrop-blur-md">
          <span className="etch-float-caps">Notifications</span>
          <div className="flex gap-2">
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="etch-float-caps underline underline-offset-2"
              >
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="etch-float-caps hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {notes.length === 0 ? (
            <p className="etch-float-prose px-3 py-4 text-white/80">No notifications.</p>
          ) : (
            notes.map((n) => (
              <div
                key={n._id}
                className={`space-y-2 border-b border-grey-100 px-3 py-3 ${n.read ? 'opacity-60' : ''}`}
              >
                <p className="etch-float-prose leading-snug">{label(n)}</p>

                {n.type === 'veto_invite' && !n.read && (
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      disabled={busy === n._id}
                      onClick={() => vetoRespond(n, true, true)}
                      className="etch-float-caps border border-black bg-black px-2 py-0.5 text-yellow-400 transition hover:bg-yellow-400 hover:text-white disabled:opacity-60"
                    >
                      Join + Veto
                    </button>
                    <button
                      type="button"
                      disabled={busy === n._id}
                      onClick={() => vetoRespond(n, true, false)}
                      className="etch-float-caps border border-black px-2 py-0.5 transition hover:bg-black hover:text-yellow-400 disabled:opacity-60"
                    >
                      Join only
                    </button>
                    <button
                      type="button"
                      disabled={busy === n._id}
                      onClick={() => vetoRespond(n, false, false)}
                      className="etch-float-caps border border-grey-300 px-2 py-0.5 text-white transition hover:border-black disabled:opacity-60"
                    >
                      Decline
                    </button>
                  </div>
                )}

                {n.type === 'contributor_invite' && !n.read && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={busy === n._id}
                      onClick={() => contribRespond(n, true)}
                      className="etch-float-caps border border-black bg-black px-2 py-0.5 text-yellow-400 transition hover:bg-yellow-400 hover:text-white disabled:opacity-60"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={busy === n._id}
                      onClick={() => contribRespond(n, false)}
                      className="etch-float-caps border border-grey-300 px-2 py-0.5 text-white transition hover:border-black disabled:opacity-60"
                    >
                      Decline
                    </button>
                  </div>
                )}

                {n.type === 'collab_request' && !n.read && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={busy === n._id}
                      onClick={() => collabRequestRespond(n, true)}
                      className="etch-float-caps border border-black bg-black px-2 py-0.5 text-yellow-400 transition hover:bg-yellow-400 hover:text-white disabled:opacity-60"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      disabled={busy === n._id}
                      onClick={() => collabRequestRespond(n, false)}
                      className="etch-float-caps border border-grey-300 px-2 py-0.5 text-white transition hover:border-black disabled:opacity-60"
                    >
                      Decline
                    </button>
                  </div>
                )}

                {(n.relatedType === 'space' || n.relatedType === 'project') && (
                  <button
                    type="button"
                    onClick={() => openRelated(n)}
                    className="etch-float-prose underline text-white/90 hover:text-white"
                  >
                    Open {n.relatedType}
                  </button>
                )}

                <p className="etch-float-prose text-white/70">
                  {n.read ? 'read' : 'unread'}{n.createdAt ? ` · ${new Date(n.createdAt).toLocaleDateString()}` : ''}
                </p>
              </div>
            ))
          )}
        </div>
      </AnchoredGlassDropdownPanel>
    </div>
  )
}
