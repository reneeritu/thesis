import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { getToken } from '../lib/session'

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
    [k: string]: unknown
  }
}

export function NotificationBell() {
  const [notes, setNotes] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const token = getToken()
  const navigate = useNavigate()

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
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-8 w-8 shrink-0 items-center justify-center border border-black bg-white hover:bg-black hover:text-yellow-400 transition [touch-action:manipulation]"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        title="Notifications"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex min-h-[1rem] min-w-[1rem] items-center justify-center rounded-full bg-yellow-400 px-0.5 text-[9px] font-mono font-medium leading-none text-black">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 max-h-[80vh] overflow-y-auto border border-black bg-white shadow-lg">
          <div className="flex items-center justify-between px-3 py-2 border-b border-grey-200 sticky top-0 bg-white">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-grey-400">
              Notifications
            </span>
            <div className="flex gap-2">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="font-mono text-[10px] uppercase tracking-[0.16em] underline underline-offset-2"
                >
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="font-mono text-[10px] text-grey-400 hover:text-black"
              >
                ✕
              </button>
            </div>
          </div>

          {notes.length === 0 ? (
            <p className="px-3 py-4 text-small text-grey-400 font-mono">No notifications.</p>
          ) : (
            notes.map((n) => (
              <div
                key={n._id}
                className={`px-3 py-3 border-b border-grey-100 space-y-2 ${n.read ? 'opacity-60' : ''}`}
              >
                <p className="font-mono text-[11px] leading-snug">{label(n)}</p>

                {/* Veto invite — action buttons */}
                {n.type === 'veto_invite' && !n.read && (
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      disabled={busy === n._id}
                      onClick={() => vetoRespond(n, true, true)}
                      className="border border-black bg-black text-yellow-400 px-2 py-0.5 font-mono text-[10px] uppercase hover:bg-yellow-400 hover:text-black transition disabled:opacity-60"
                    >
                      Join + Veto
                    </button>
                    <button
                      type="button"
                      disabled={busy === n._id}
                      onClick={() => vetoRespond(n, true, false)}
                      className="border border-black px-2 py-0.5 font-mono text-[10px] uppercase hover:bg-black hover:text-yellow-400 transition disabled:opacity-60"
                    >
                      Join only
                    </button>
                    <button
                      type="button"
                      disabled={busy === n._id}
                      onClick={() => vetoRespond(n, false, false)}
                      className="border border-grey-300 px-2 py-0.5 font-mono text-[10px] uppercase text-grey-500 hover:border-black transition disabled:opacity-60"
                    >
                      Decline
                    </button>
                  </div>
                )}

                {/* Contributor invite — action buttons */}
                {n.type === 'contributor_invite' && !n.read && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={busy === n._id}
                      onClick={() => contribRespond(n, true)}
                      className="border border-black bg-black text-yellow-400 px-2 py-0.5 font-mono text-[10px] uppercase hover:bg-yellow-400 hover:text-black transition disabled:opacity-60"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={busy === n._id}
                      onClick={() => contribRespond(n, false)}
                      className="border border-grey-300 px-2 py-0.5 font-mono text-[10px] uppercase text-grey-500 hover:border-black transition disabled:opacity-60"
                    >
                      Decline
                    </button>
                  </div>
                )}

                {/* Open related page link */}
                {(n.relatedType === 'space' || n.relatedType === 'project') && (
                  <button
                    type="button"
                    onClick={() => openRelated(n)}
                    className="font-mono text-[10px] underline text-grey-400 hover:text-black"
                  >
                    Open {n.relatedType}
                  </button>
                )}

                <p className="font-mono text-[9px] text-grey-400">
                  {n.read ? 'read' : 'unread'}{n.createdAt ? ` · ${new Date(n.createdAt).toLocaleDateString()}` : ''}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
