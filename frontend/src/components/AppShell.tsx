import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { clearSession, getToken } from '../lib/session'
import { NotificationBell } from './NotificationBell'
import { HelpButton } from './HelpDrawer'

type Props = {
  children: ReactNode
  /** e.g. "Login" page title area */
  title?: string
}

const navBtn =
  'glassmorphic-light contour-border-neutral px-2 py-1 text-[10px] sm:px-2.5 sm:py-1 hover:text-yellow-600 transition-etch [touch-action:manipulation]'

const menuItem =
  'block px-3 py-2 text-[11px] font-mono uppercase tracking-[0.14em] hover:bg-white/10 hover:text-yellow-600 border-b border-grey-100/20 last:border-b-0'

export function AppShell({ children, title }: Props) {
  const token = getToken()

  return (
    <div className="flex min-h-[80vh] flex-1 flex-col">
      <header className="border-b border-grey-200/30 shrink-0">
        <div className="mx-auto max-w-shell shell-px py-2 flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/"
            className="text-[11px] font-mono tracking-[0.18em] uppercase text-grey-400 hover:text-black transition-etch"
          >
            Etch
          </Link>
          {token ? (
            <nav className="flex flex-wrap items-center justify-end gap-2 text-[11px] font-mono uppercase tracking-[0.18em]">
              <div className="relative">
                <details className="group">
                  <summary
                    className={`${navBtn} list-none cursor-pointer pr-6 relative after:content-['▾'] after:absolute after:right-2 after:top-1/2 after:-translate-y-1/2 after:text-[10px] after:opacity-60`}
                    aria-label="Open navigation menu"
                  >
                    Menu
                  </summary>
                  <div className="absolute right-0 mt-1 min-w-[200px] glassmorphic-light contour-border-cool z-50">
                    <Link to="/dashboard" className={menuItem}>
                      Dashboard
                    </Link>
                    <Link to="/me" className={menuItem}>
                      Profile
                    </Link>
                    <Link to="/spaces" className={menuItem}>
                      Spaces
                    </Link>
                    <Link to="/projects" className={menuItem}>
                      Projects
                    </Link>
                    <Link to="/discover" className={menuItem}>
                      Discover
                    </Link>
                    <Link to="/governance" className={menuItem}>
                      Governance
                    </Link>
                    <Link to="/archive/new" className={menuItem}>
                      Archive
                    </Link>
                    <a href="/legacy/index.html#/dashboard" className={`${menuItem} text-grey-500 hover:text-yellow-400`}>
                      Legacy
                    </a>
                  </div>
                </details>
              </div>
              <NotificationBell />
              <HelpButton />
              <button
                type="button"
                className={navBtn}
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
              <HelpButton />
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
