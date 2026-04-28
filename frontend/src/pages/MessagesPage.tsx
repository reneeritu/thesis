import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { ConversationList } from '../components/messages/ConversationList'
import { ConversationView } from '../components/messages/ConversationView'
import { listConversations, type ConversationListItem } from '../lib/messagesApi'
import { getAlias } from '../lib/session'

export default function MessagesPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const meAlias = getAlias()
  const [items, setItems] = useState<ConversationListItem[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const list = await listConversations()
      setItems(list)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load conversations')
    }
  }, [])

  const onRefreshList = useCallback(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const raf = requestAnimationFrame(() => void refresh())
    const t = window.setInterval(() => void refresh(), 5000)
    return () => {
      cancelAnimationFrame(raf)
      window.clearInterval(t)
    }
  }, [refresh])

  const selectedId = id && id.length === 24 ? id : null

  return (
    <AppShell title="Messages">
      <div className="space-y-4">
        {error ? (
          <p className="border border-black bg-grey-100 px-3 py-2 text-small font-mono text-white" role="alert">
            {error}
          </p>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
          <div className="min-h-0">
            <h2 className="font-mono text-small uppercase tracking-[0.18em] text-white mb-2">
              Conversations
            </h2>
            <ConversationList items={items} selectedId={selectedId} meAlias={meAlias} />
          </div>
          <div className="min-w-0">
            {selectedId ? (
              <ConversationView
                conversationId={selectedId}
                meAlias={meAlias}
                onRefreshList={onRefreshList}
              />
            ) : (
              <div className="border border-dashed border-white/20 p-8 text-center">
                <p className="font-mono text-small text-white">
                  Select a conversation or open one from a profile.
                </p>
                {items[0] ? (
                  <button
                    type="button"
                    className="mt-4 border border-black bg-yellow-400 px-3 py-1 font-mono text-small uppercase text-black"
                    onClick={() => navigate('/messages/' + encodeURIComponent(items[0]._id))}
                  >
                    Open latest
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
