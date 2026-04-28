import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listConversations } from '../lib/messagesApi'
import { HEADER_NAV_ICON_BUTTON_CLASS, HEADER_NAV_ICON_SVG_CLASS } from './HelpDrawer'

/**
 * Header link to /messages with unread count; polls every 5s when mounted.
 */
export function MessagesNavLink() {
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    async function poll() {
      try {
        const list = await listConversations()
        setUnread(list.reduce((s, c) => s + (c.unreadCount || 0), 0))
      } catch {
        setUnread(0)
      }
    }
    void poll()
    const t = window.setInterval(() => void poll(), 5000)
    return () => window.clearInterval(t)
  }, [])

  return (
    <Link
      to="/messages"
      className={`relative ${HEADER_NAV_ICON_BUTTON_CLASS}`}
      aria-label="Messages"
      title="Messages"
    >
      <svg
        viewBox="0 0 24 24"
        className={HEADER_NAV_ICON_SVG_CLASS}
        fill="none"
        aria-hidden
      >
        <path
          d="M4 5h16v11H8l-4 3V5z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      {unread > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 min-w-[1rem] rounded-full bg-yellow-400 px-1 text-center text-small font-mono leading-tight text-black">
          {unread > 99 ? '99+' : unread}
        </span>
      ) : null}
    </Link>
  )
}
