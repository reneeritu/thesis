import { useState } from 'react'
import { respondConversation } from '../../lib/messagesApi'

type Props = {
  conversationId: string
  initiatorAlias: string
  intro: string
  onDone: () => void
}

export function ConversationRequestCard({ conversationId, initiatorAlias, intro, onDone }: Props) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function respond(decision: 'accept' | 'decline') {
    setBusy(true)
    setErr(null)
    try {
      await respondConversation(conversationId, decision)
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border border-yellow-400/60 bg-zinc-900/70 p-4 space-y-2">
      <p className="font-mono text-small uppercase tracking-[0.18em] text-yellow-400">
        Connection request from @{initiatorAlias}
      </p>
      <p className="text-small text-white whitespace-pre-wrap">{intro}</p>
      {err ? (
        <p className="text-small font-mono text-white border border-black bg-grey-100 px-2 py-1">{err}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void respond('accept')}
          className="border border-black bg-black px-3 py-1 font-mono text-small uppercase tracking-[0.14em] text-yellow-400 hover:bg-yellow-400 hover:text-white transition disabled:opacity-60"
        >
          Accept
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void respond('decline')}
          className="border border-white/25 bg-zinc-900/55 px-3 py-1 font-mono text-small uppercase tracking-[0.14em] text-white hover:bg-black hover:text-yellow-400 transition disabled:opacity-60"
        >
          Decline
        </button>
      </div>
    </div>
  )
}
