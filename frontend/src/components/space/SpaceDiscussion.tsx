import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { getToken } from '../../lib/session'

const ACCENT = '#e879f9'

type Msg = {
  _id: string
  senderAlias: string
  body: string
  pinned?: boolean
  createdAt: string
}

type LoadRes = { messages: Msg[]; pinned: Msg[]; nextBefore: string | null }

type Props = {
  spaceId: string
  isMember: boolean
  isAdmin: boolean
  meAlias: string
  className?: string
}

function formatMsgTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function PinGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M12 17v5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 0-1-1v0a1 1 0 0 0-1 1v3.76"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function SpaceDiscussion({ spaceId, isMember, isAdmin, meAlias, className = '' }: Props) {
  const isLoggedIn = Boolean(getToken())
  const canPost = isLoggedIn && isMember
  const [data, setData] = useState<LoadRes | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await api<LoadRes>('/spaces/' + encodeURIComponent(spaceId) + '/messages')
      setData(r)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load discussion')
      setData(null)
    }
  }, [spaceId])

  useEffect(() => {
    const raf = requestAnimationFrame(() => void load())
    const t = window.setInterval(() => void load(), 5000)
    return () => {
      cancelAnimationFrame(raf)
      window.clearInterval(t)
    }
  }, [load])

  useEffect(() => {
    if (!actionMenuId) return
    const onDoc = (e: MouseEvent) => {
      const wrap = document.querySelector(`[data-msg-menu="${actionMenuId}"]`)
      if (wrap && !wrap.contains(e.target as Node)) setActionMenuId(null)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [actionMenuId])

  useEffect(() => {
    if (!actionMenuId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActionMenuId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [actionMenuId])

  async function send() {
    const t = body.trim()
    if (!t) return
    setBusy(true)
    try {
      await api('/spaces/' + encodeURIComponent(spaceId) + '/messages', {
        method: 'POST',
        body: { body: t },
      })
      setBody('')
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to post')
    } finally {
      setBusy(false)
    }
  }

  async function del(id: string) {
    setActionMenuId(null)
    if (!window.confirm('Delete this message?')) return
    try {
      await api('/spaces/' + encodeURIComponent(spaceId) + '/messages/' + encodeURIComponent(id), {
        method: 'DELETE',
      })
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  async function togglePin(id: string) {
    setActionMenuId(null)
    try {
      await api('/spaces/' + encodeURIComponent(spaceId) + '/messages/' + encodeURIComponent(id) + '/pin', {
        method: 'POST',
      })
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Pin failed')
    }
  }

  const pinned = data?.pinned ?? []
  const messages = data?.messages ?? []

  const showActionsColumn = (m: Msg) =>
    isAdmin || m.senderAlias === meAlias

  return (
    <section
      className={`flex max-h-[min(520px,65vh)] w-full flex-col overflow-hidden rounded-sm border border-white/12 bg-black/22 font-mono ${className}`.trim()}
    >
      {err ? (
        <p className="shrink-0 border-b border-white/10 bg-black/35 px-3 py-2 text-base text-white/85" role="alert">
          {err}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-3 pb-2">
        {pinned.length === 0 && messages.length === 0 ? (
          <p className="text-xs text-white/38">No messages yet.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col divide-y divide-white/[0.08] p-0">
            {pinned.map((m) => (
              <li key={m._id} className="group/msg py-3 first:pt-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                      <span className="inline-flex shrink-0 items-center text-fuchsia-400/88" title="Pinned message">
                        <PinGlyph className="translate-y-[1px]" aria-hidden />
                      </span>
                      <span className="text-xs font-medium" style={{ color: ACCENT }}>
                        {m.senderAlias}
                      </span>
                      <span className="text-xs text-white/32">{formatMsgTime(m.createdAt)}</span>
                    </div>
                    <p className="mt-1.5 mb-0 whitespace-pre-wrap text-xs leading-relaxed text-white/78">{m.body}</p>
                  </div>
                  {isAdmin ? (
                    <div
                      className="relative shrink-0 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/msg:opacity-100 [@media(hover:hover)]:group-focus-within/msg:opacity-100"
                      data-msg-menu={m._id}
                    >
                      <button
                        type="button"
                        aria-expanded={actionMenuId === m._id}
                        aria-haspopup="menu"
                        aria-label="Message actions"
                        className="msg-actions-btn rounded px-1.5 py-0.5 text-lg leading-none text-white/42 transition hover:bg-white/[0.06] hover:text-white/78 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400/50"
                        onClick={(e) => {
                          e.stopPropagation()
                          setActionMenuId((id) => (id === m._id ? null : m._id))
                        }}
                      >
                        ···
                      </button>
                      {actionMenuId === m._id ? (
                        <div
                          role="menu"
                          className="absolute right-0 top-[calc(100%+4px)] z-20 min-w-[7rem] rounded border border-white/15 bg-black/95 py-1 shadow-lg backdrop-blur-sm"
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            role="menuitem"
                            className="block w-full px-3 py-2 text-left text-base uppercase tracking-[0.12em] text-white/72 transition hover:bg-white/[0.06] hover:text-white"
                            onClick={() => void togglePin(m._id)}
                          >
                            Unpin
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
            {messages.map((m) => (
              <li key={m._id} className="group/msg py-3 first:pt-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                      <span className="text-xs font-medium" style={{ color: ACCENT }}>
                        {m.senderAlias}
                      </span>
                      <span className="text-xs text-white/32">{formatMsgTime(m.createdAt)}</span>
                    </div>
                    <p className="mt-1.5 mb-0 whitespace-pre-wrap text-xs leading-relaxed text-white/78">{m.body}</p>
                  </div>
                  {showActionsColumn(m) ? (
                    <div
                      className="relative shrink-0 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/msg:opacity-100 [@media(hover:hover)]:group-focus-within/msg:opacity-100"
                      data-msg-menu={m._id}
                    >
                      <button
                        type="button"
                        aria-expanded={actionMenuId === m._id}
                        aria-haspopup="menu"
                        aria-label="Message actions"
                        className="msg-actions-btn rounded px-1.5 py-0.5 text-lg leading-none text-white/42 transition hover:bg-white/[0.06] hover:text-white/78 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400/50"
                        onClick={(e) => {
                          e.stopPropagation()
                          setActionMenuId((id) => (id === m._id ? null : m._id))
                        }}
                      >
                        ···
                      </button>
                      {actionMenuId === m._id ? (
                        <div
                          role="menu"
                          className="absolute right-0 top-[calc(100%+4px)] z-20 min-w-[7rem] rounded border border-white/15 bg-black/95 py-1 shadow-lg backdrop-blur-sm"
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          {isAdmin ? (
                            <button
                              type="button"
                              role="menuitem"
                              className="block w-full px-3 py-2 text-left text-base uppercase tracking-[0.12em] text-white/72 transition hover:bg-white/[0.06] hover:text-white"
                              onClick={() => void togglePin(m._id)}
                            >
                              Pin
                            </button>
                          ) : null}
                          {(m.senderAlias === meAlias || isAdmin) && (
                            <button
                              type="button"
                              role="menuitem"
                              className="block w-full px-3 py-2 text-left text-base uppercase tracking-[0.12em] text-white/72 transition hover:bg-white/[0.06] hover:text-white"
                              onClick={() => void del(m._id)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t border-white/12 bg-black/35 px-3 py-3">
        {canPost ? (
          <div className="flex items-stretch gap-2">
            <input
              type="text"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
              placeholder="write something..."
              className="min-w-0 flex-1 rounded-sm border border-white/14 bg-black/45 px-3 py-2.5 text-sm text-white/88 outline-none transition placeholder:text-white/32 focus:border-white/28"
            />
            <button
              type="button"
              disabled={busy || !body.trim()}
              onClick={() => void send()}
              className="shrink-0 rounded-sm border border-white/18 px-4 py-2 font-mono text-base uppercase tracking-[0.16em] text-white/78 transition hover:border-white/35 hover:text-white disabled:opacity-40"
            >
              {busy ? '…' : 'Send'}
            </button>
          </div>
        ) : (
          <p className="m-0 text-base text-white/42">
            {!isLoggedIn ? (
              <>
                <Link to="/login" className="text-white/65 underline decoration-white/25 hover:text-white">
                  Log in
                </Link>{' '}
                to post
                {isMember ? '' : '.'}
              </>
            ) : !isMember ? (
              <>Join this space to post.</>
            ) : (
              <>You cannot post right now.</>
            )}
          </p>
        )}
      </div>
    </section>
  )
}
