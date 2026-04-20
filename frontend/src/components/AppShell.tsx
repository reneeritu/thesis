import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { clearSession, getToken } from '../lib/session'
import { NotificationBell } from './NotificationBell'

type Props = {
  children: ReactNode
  /** e.g. "Login" page title area */
  title?: string
}

const navBtn =
  'border border-black px-2 py-1 text-[10px] sm:px-2.5 sm:py-1 hover:bg-black hover:text-yellow-400 transition [touch-action:manipulation]'

export function AppShell({ children, title }: Props) {
  const token = getToken()

  return (
    <div className="flex min-h-[80vh] flex-1 flex-col">
      <header className="border-b border-grey-200 shrink-0">
        <div className="mx-auto max-w-shell shell-px py-2 flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/"
            className="text-[11px] font-mono tracking-[0.18em] uppercase text-grey-400 hover:text-black transition"
          >
            untitled
          </Link>
          {token ? (
            <nav className="flex flex-wrap items-center justify-end gap-1 text-[11px] font-mono uppercase tracking-[0.18em] max-w-[min(100%,520px)]">
              <div className="relative">
                <details className="group">
                  <summary className={`${navBtn} list-none cursor-pointer`}>
                    Menu
                  </summary>
                  <div className="absolute right-0 mt-1 min-w-[160px] border border-black bg-white shadow-sm z-50">
                    <Link to="/dashboard" className="block px-3 py-1 text-[11px] hover:bg-black hover:text-yellow-400">
                      Home
                    </Link>
                    <Link to="/me" className="block px-3 py-1 text-[11px] hover:bg-black hover:text-yellow-400">
                      Profile
                    </Link>
                    <Link to="/spaces" className="block px-3 py-1 text-[11px] hover:bg-black hover:text-yellow-400">
                      Spaces
                    </Link>
                    <Link to="/projects" className="block px-3 py-1 text-[11px] hover:bg-black hover:text-yellow-400">
                      Projects
                    </Link>
                    <Link to="/archive/new" className="block px-3 py-1 text-[11px] hover:bg-black hover:text-yellow-400">
                      Archive
                    </Link>
                    <Link to="/governance" className="block px-3 py-1 text-[11px] hover:bg-black hover:text-yellow-400">
                      Governance
                    </Link>
                  </div>
                </details>
              </div>
              <Link to="/discover" className={navBtn}>
                Discover
              </Link>
              <NotificationBell />
              <a href="/legacy/index.html#/dashboard" className={`${navBtn} text-grey-400`}>
                Old site
              </a>
              <button
                type="button"
                className={`${navBtn} bg-white`}
                onClick={() => {
                  clearSession()
                  window.location.href = '/'
                }}
              >
                Sign out
              </button>
            </nav>
          ) : (
            <nav className="flex flex-wrap items-center justify-end gap-2 text-small font-mono uppercase tracking-[0.18em]">
              <Link to="/login" className={navBtn}>
                Login
              </Link>
              <Link to="/register" className={navBtn}>
                Register
              </Link>
              <Link to="/recover" className={navBtn}>
                Recover
              </Link>
            </nav>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-shell shell-px py-6 sm:py-10 w-full flex-1 min-h-0 overflow-y-auto grid-overlay grid grid-cols-12 gap-x-2 sm:gap-x-3 gap-y-6 content-start">
        {title ? (
          <div className="col-span-12">
            <h1 className="text-h2">{title}</h1>
          </div>
        ) : null}
        <div className="col-span-12 w-full min-w-0">{children}</div>
      </main>
    </div>
  )
}
