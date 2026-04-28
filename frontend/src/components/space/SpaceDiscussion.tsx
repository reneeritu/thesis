import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { getToken } from '../../lib/session'

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
}

export function SpaceDiscussion({ spaceId, isMember, isAdmin, meAlias }: Props) {
  const isLoggedIn = Boolean(getToken())
  const canPost = isLoggedIn && isMember
  const [data, setData] = useState<LoadRes | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

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

  async function pin(id: string) {
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

  return (
    <section className="space-y-3 border border-white/20 p-3">
      <h2 className="text-h3 font-heading uppercase tracking-[0.18em] text-white">Discussion</h2>
      {err ? (
        <p className="border border-black bg-grey-100 px-3 py-2 text-small font-mono text-white" role="alert">
          {err}
        </p>
      ) : null}

      {pinned.length > 0 ? (
        <div className="space-y-2 border border-yellow-400/40 bg-zinc-900/50 p-2">
          <p className="font-mono text-small uppercase tracking-[0.16em] text-yellow-400">Pinned</p>
          <ul className="space-y-2 max-h-32 overflow-y-auto">
            {pinned.map((m) => (
              <li key={m._id} className="text-small font-mono text-white border-b border-white/10 pb-2">
                <span className="text-small text-white">@{m.senderAlias}</span>
                <p className="whitespace-pre-wrap">{m.body}</p>
                {isAdmin ? (
                  <button
                    type="button"
                    className="mt-1 text-small uppercase tracking-[0.14em] underline"
                    onClick={() => void pin(m._id)}
                  >
                    Unpin
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="max-h-[min(50vh,400px)] space-y-2 overflow-y-auto border border-white/10 p-2">
        {messages.length === 0 ? (
          <p className="text-small text-white font-mono">No messages yet.</p>
        ) : (
          messages.map((m) => (
            <div
              key={m._id}
              className={`rounded border px-2 py-1.5 ${
                m.senderAlias === meAlias ? 'border-yellow-400/40 bg-yellow-400/5' : 'border-white/15 bg-zinc-900/40'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-small font-mono text-white">@{m.senderAlias}</span>
                <span className="text-small text-white whitespace-nowrap">
                  {new Date(m.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-small font-mono text-white whitespace-pre-wrap">{m.body}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {(m.senderAlias === meAlias || isAdmin) && (
                  <button
                    type="button"
                    className="text-small font-mono uppercase tracking-[0.12em] text-white underline"
                    onClick={() => void del(m._id)}
                  >
                    Delete
                  </button>
                )}
                {isAdmin ? (
                  <button
                    type="button"
                    className="text-small font-mono uppercase tracking-[0.12em] text-yellow-400 underline"
                    onClick={() => void pin(m._id)}
                  >
                    Pin
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      {canPost ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a message…"
            rows={2}
            className="min-h-[3rem] flex-1 border border-white/25 bg-zinc-900/55 px-2 py-1.5 font-mono text-small text-white"
          />
          <button
            type="button"
            disabled={busy || !body.trim()}
            onClick={() => void send()}
            className="shrink-0 self-end border border-black bg-yellow-400 px-4 py-2 font-mono text-small uppercase tracking-[0.14em] text-black disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Post'}
          </button>
        </div>
      ) : (
        <p className="text-small font-mono text-white">
          {!isLoggedIn ? (
            <>
              <Link to="/login" className="underline text-yellow-400">
                Log in
              </Link>{' '}
              to post {isMember ? '' : '(join this space to participate).'}
            </>
          ) : !isMember ? (
            <>Join this space to post in the discussion.</>
          ) : (
            <>You cannot post right now.</>
          )}
        </p>
      )}
    </section>
  )
}
