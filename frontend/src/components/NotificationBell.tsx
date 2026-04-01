import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { getToken } from '../lib/session'

type Notification = {
  _id: string
  message?: string
  type?: string
  read?: boolean
  createdAt?: string
}

export function NotificationBell() {
  const [notes, setNotes] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const token = getToken()

  useEffect(() => {
    if (!token) return
    let cancelled = false
    api<Notification[]>('/notifications')
      .then((n) => { if (!cancelled) setNotes(n) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [token])

  if (!token) return null

  const unread = notes.filter((n) => !n.read).length

  async function markAllRead() {
    try {
      await api('/notifications/read-all', { method: 'PATCH' })
      setNotes((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch { /* ignore */ }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative border border-black bg-white px-2 py-1 font-mono text-[11px] uppercase tracking-[0.16em] hover:bg-black hover:text-yellow-400 transition"
        aria-label="Notifications"
      >
        NOTIF
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 text-[9px] font-mono text-black">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 max-h-80 overflow-y-auto border border-black bg-white shadow-lg">
          <div className="flex items-center justify-between px-3 py-2 border-b border-grey-200">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-grey-400">
              Notifications
            </span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="font-mono text-[10px] uppercase tracking-[0.16em] underline underline-offset-2"
              >
                Mark all read
              </button>
            )}
          </div>
          {notes.length === 0 ? (
            <p className="px-3 py-4 text-small text-grey-400 font-mono">No notifications.</p>
          ) : (
            notes.map((n) => (
              <div
                key={n._id}
                className={`px-3 py-2 border-b border-grey-100 text-[11px] ${n.read ? 'text-grey-400' : 'text-black'}`}
              >
                <p className="font-mono">{n.message || n.type || 'notification'}</p>
                <p className="mt-0.5 font-mono text-[9px] text-grey-400">
                  {n.read ? 'read' : 'unread'}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
