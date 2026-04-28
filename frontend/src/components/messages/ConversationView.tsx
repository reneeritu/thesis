import { useCallback, useEffect, useRef, useState } from 'react'
import {
  blockConversation,
  getConversation,
  markConversationRead,
  sendDm,
  type ConversationDetail,
  type DmMessageRow,
} from '../../lib/messagesApi'
import { ConversationRequestCard } from './ConversationRequestCard'

type Props = {
  conversationId: string
  meAlias: string
  onRefreshList: () => void
}

export function ConversationView({ conversationId, meAlias, onRefreshList }: Props) {
  const [detail, setDetail] = useState<ConversationDetail | null>(null)
  const [messages, setMessages] = useState<DmMessageRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [composer, setComposer] = useState('')
  const [sendBusy, setSendBusy] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const r = await getConversation(conversationId)
      setDetail(r.conversation)
      setMessages(r.messages)
      setError(null)
      if (r.messages.some((m) => m.senderAlias !== meAlias && !m.readByRecipientAt)) {
        await markConversationRead(conversationId).catch(() => {})
        onRefreshList()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    }
  }, [conversationId, meAlias, onRefreshList])

  useEffect(() => {
    void load()
    const t = window.setInterval(() => void load(), 5000)
    return () => window.clearInterval(t)
  }, [load])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const other =
    detail?.participants[0] === meAlias ? detail.participants[1] : detail?.participants[0]

  async function onSend() {
    const body = composer.trim()
    if (!body || !conversationId) return
    setSendBusy(true)
    try {
      await sendDm(conversationId, body)
      setComposer('')
      await load()
      onRefreshList()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed')
    } finally {
      setSendBusy(false)
    }
  }

  async function toggleBlock(block: boolean) {
    try {
      await blockConversation(conversationId, block)
      await load()
      onRefreshList()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Block failed')
    }
  }

  const showRequest =
    detail?.status === 'pending' && detail.initiatorAlias !== meAlias

  const canMessage = detail?.status === 'accepted'
  const isBlocked = detail?.status === 'blocked'

  return (
    <div className="flex min-h-[320px] flex-col border border-white/15 bg-zinc-950/40">
      {error ? (
        <p className="border-b border-black bg-grey-100 px-3 py-2 text-small font-mono text-white">{error}</p>
      ) : null}

      <div className="border-b border-white/10 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-small uppercase tracking-[0.16em] text-white">
          @{other || '…'}
        </p>
        {detail?.status === 'accepted' ? (
          <button
            type="button"
            onClick={() => void toggleBlock(true)}
            className="font-mono text-small uppercase tracking-[0.14em] text-white border border-white/25 px-2 py-0.5 hover:bg-black hover:text-yellow-400"
          >
            Block
          </button>
        ) : null}
        {detail?.status === 'blocked' && detail.blockedByAlias === meAlias ? (
          <button
            type="button"
            onClick={() => void toggleBlock(false)}
            className="font-mono text-small uppercase tracking-[0.14em] text-yellow-400 border border-yellow-400/50 px-2 py-0.5"
          >
            Unblock
          </button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 max-h-[min(60vh,420px)]">
        {showRequest && detail ? (
          <ConversationRequestCard
            conversationId={conversationId}
            initiatorAlias={detail.initiatorAlias}
            intro={detail.introMessage}
            onDone={() => {
              void load()
              onRefreshList()
            }}
          />
        ) : null}

        {detail?.status === 'pending' && detail.initiatorAlias === meAlias ? (
          <p className="font-mono text-small text-white">Waiting for @{other} to accept your request.</p>
        ) : null}

        {detail?.status === 'declined' ? (
          <p className="font-mono text-small text-white">This request was declined.</p>
        ) : null}

        {isBlocked ? (
          <p className="font-mono text-small text-white">
            Messaging is paused (blocked).
          </p>
        ) : null}

        <div className="space-y-2">
          {messages.map((m) => {
            const mine = m.senderAlias === meAlias
            return (
              <div
                key={m._id}
                className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-md px-3 py-2 text-small font-mono ${
                    mine
                      ? 'bg-yellow-400/20 border border-yellow-400/40 text-white'
                      : 'bg-zinc-900/80 border border-white/15 text-white'
                  }`}
                >
                  {!mine ? (
                    <p className="text-small uppercase tracking-[0.12em] text-white mb-1">@{m.senderAlias}</p>
                  ) : null}
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className="text-small text-white mt-1 opacity-70">
                    {new Date(m.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {canMessage && !isBlocked ? (
        <div className="border-t border-white/10 p-2 flex gap-2">
          <textarea
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            placeholder="Message…"
            rows={2}
            className="flex-1 min-w-0 border border-white/25 bg-zinc-900/55 px-2 py-1.5 font-mono text-small text-white placeholder:text-white/40"
          />
          <button
            type="button"
            disabled={sendBusy || !composer.trim()}
            onClick={() => void onSend()}
            className="self-end shrink-0 border border-black bg-yellow-400 px-3 py-2 font-mono text-small uppercase tracking-[0.14em] text-black hover:bg-black hover:text-yellow-400 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      ) : null}
    </div>
  )
}
