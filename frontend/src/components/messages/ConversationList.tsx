import { Link } from 'react-router-dom'
import type { ConversationListItem } from '../../lib/messagesApi'

type Props = {
  items: ConversationListItem[]
  selectedId: string | null
  meAlias: string
}

/**
 * Sort: incoming pending requests first, then by unread, then last activity.
 */
function sortItems(items: ConversationListItem[], me: string): ConversationListItem[] {
  return [...items].sort((a, b) => {
    const pendingYou = (x: ConversationListItem) =>
      x.status === 'pending' && x.initiatorAlias !== me ? 1 : 0
    const d = pendingYou(b) - pendingYou(a)
    if (d !== 0) return d
    const u = b.unreadCount - a.unreadCount
    if (u !== 0) return u
    const ta = a.lastMessageAt || a.updatedAt
    const tb = b.lastMessageAt || b.updatedAt
    return new Date(tb).getTime() - new Date(ta).getTime()
  })
}

export function ConversationList({ items, selectedId, meAlias }: Props) {
  const sorted = sortItems(items, meAlias)

  if (!sorted.length) {
    return (
      <p className="font-mono text-small text-white px-2 py-4">No conversations yet.</p>
    )
  }

  return (
    <ul className="divide-y divide-white/10 border border-white/15">
      {sorted.map((c) => {
        const isSel = c._id === selectedId
        const pendingIn = c.status === 'pending' && c.initiatorAlias !== meAlias
        return (
          <li key={c._id}>
            <Link
              to={'/messages/' + encodeURIComponent(c._id)}
              className={`block px-3 py-2.5 text-left font-mono transition ${
                isSel
                  ? 'bg-yellow-400/15 border-l-2 border-yellow-400'
                  : 'hover:bg-zinc-900/55 border-l-2 border-transparent'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-small text-white truncate">@{c.otherAlias}</span>
                {c.unreadCount > 0 ? (
                  <span className="shrink-0 rounded-full bg-yellow-400 px-1.5 py-0.5 text-small text-black">
                    {c.unreadCount > 99 ? '99+' : c.unreadCount}
                  </span>
                ) : null}
              </div>
              {pendingIn ? (
                <span className="text-small uppercase tracking-[0.14em] text-yellow-400">Request</span>
              ) : (
                <p className="text-small text-white truncate mt-0.5">{c.preview}</p>
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
