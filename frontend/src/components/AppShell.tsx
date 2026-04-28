import { useEffect, useRef, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { clearSession, getToken } from '../lib/session'
import { isSimMode } from '../lib/simApi'
import { layoutDebugZoneClass, useLayoutDebug } from '../lib/layoutDebug'
import { NotificationBell } from './NotificationBell'
import { MessagesNavLink } from './MessagesNavLink'
import { HelpButton, HEADER_NAV_ICON_BUTTON_CLASS, HEADER_NAV_ICON_SVG_CLASS } from './HelpDrawer'

type Props = {
  children: ReactNode
  /** e.g. "Login" page title area */
  title?: string
}

const navBtn =
  'glassmorphic-light contour-border-neutral px-2 py-1 text-small sm:px-2.5 sm:py-1 hover:text-yellow-400 transition-etch [touch-action:manipulation]'

function AuthSiteNavDropdown({
  label,
  layoutDebug,
}: {
  label: string
  layoutDebug: boolean
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const detailsRef = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const details = detailsRef.current
      if (!details?.open) return
      if (wrapRef.current?.contains(e.target as Node)) return
      details.open = false
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  /** Close after link click so the anchor still receives `click` (pointerdown-close was cancelling navigation). */
  function closeMenuAfterLinkClick(e: ReactMouseEvent<HTMLDivElement>) {
    if (!(e.target as HTMLElement).closest('a[href]')) return
    window.setTimeout(() => {
      const d = detailsRef.current
      if (d) d.open = false
    }, 0)
  }

  return (
    <div
      ref={wrapRef}
      className={`relative min-w-0 max-w-[min(14rem,42vw)] ${layoutDebugZoneClass(5, layoutDebug)}`.trim()}
      data-layout-n={layoutDebug ? '5' : undefined}
      data-layout-name={layoutDebug ? 'Page title + site nav' : undefined}
    >
      <details ref={detailsRef} className="group">
        <summary
          className={`${navBtn} flex list-none cursor-pointer items-center gap-1.5 pr-5 [&::-webkit-details-marker]:hidden`}
          aria-label={`${label}. Open site navigation menu.`}
        >
          <span className="min-w-0 truncate font-semibold">{label}</span>
          <span className="shrink-0 text-small opacity-60" aria-hidden>
            ▾
          </span>
        </summary>
        {/* Outer: positioning only. Inner uses contour-* which sets position:relative and would cancel `absolute` if applied on one element. */}
        <div className="absolute left-0 top-full z-[200] mt-1 min-w-[200px]">
          <div
            className="floating-glass-panel contour-border-cool"
            onClick={closeMenuAfterLinkClick}
          >
            <Link to="/dashboard" className="etch-float-menu-item">
              Dashboard
            </Link>
            <Link to="/me" className="etch-float-menu-item">
              Profile
            </Link>
            <Link to="/spaces" className="etch-float-menu-item">
              Spaces
            </Link>
            <Link to="/projects" className="etch-float-menu-item">
              Projects
            </Link>
            <Link to="/discover" className="etch-float-menu-item">
              Discover
            </Link>
            <Link to="/messages" className="etch-float-menu-item">
              Messages
            </Link>
            <Link to="/governance" className="etch-float-menu-item">
              Governance
            </Link>
            <Link to="/archive/new" className="etch-float-menu-item">
              Archive
            </Link>
            <a
              href="/legacy/index.html#/dashboard"
              className="etch-float-menu-item text-white hover:text-yellow-400"
            >
              Legacy
            </a>
          </div>
        </div>
      </details>
    </div>
  )
}

export function AppShell({ children, title }: Props) {
  const token = getToken()
  const layoutDebug = useLayoutDebug()

  return (
    <div
      className={`relative z-[1] flex h-screen max-h-screen min-h-0 w-full flex-1 flex-col overflow-x-visible overflow-y-hidden bg-transparent ${layoutDebugZoneClass(1, layoutDebug)}`.trim()}
      data-layout-n={layoutDebug ? '1' : undefined}
      data-layout-name={layoutDebug ? 'App shell (root column, h-screen)' : undefined}
    >
      <header
        className={`relative z-[50] overflow-visible border-b border-grey-200/30 shrink-0 ${layoutDebugZoneClass(2, layoutDebug)}`.trim()}
        data-layout-n={layoutDebug ? '2' : undefined}
        data-layout-name={layoutDebug ? 'Header' : undefined}
      >
        <div className="flex w-full flex-wrap items-center justify-between gap-2 py-2 px-2 sm:gap-3 sm:px-3 md:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <Link
              to="/"
              className="etch-float-caps shrink-0 transition-etch hover:text-white"
            >
              Etch
            </Link>
            {token ? (
              <AuthSiteNavDropdown label={title?.trim() ? title : 'Navigate'} layoutDebug={layoutDebug} />
            ) : title?.trim() ? (
              <h1 className="etch-float-caps my-0 min-w-0 max-w-[min(14rem,42vw)] truncate text-white/80">
                {title}
              </h1>
            ) : null}
            {token && title?.trim() ? <h1 className="sr-only">{title}</h1> : null}
          </div>
          <div className="flex min-w-0 flex-shrink-0 flex-wrap items-center justify-end gap-2">
            {token ? (
              <nav className="etch-float-caps flex flex-wrap items-center justify-end gap-2">
                <Link
                  to="/discover"
                  className={HEADER_NAV_ICON_BUTTON_CLASS}
                  aria-label="Discover"
                  title="Discover"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className={HEADER_NAV_ICON_SVG_CLASS}
                    fill="none"
                    aria-hidden
                  >
                    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
                    <path
                      d="m20 20-4.3-4.3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </Link>
                {isSimMode() ? (
                  <Link to="/simulation" className={navBtn} aria-label="Simulation" title="Simulation">
                    SIM
                  </Link>
                ) : null}
                <MessagesNavLink />
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
              <nav className="etch-float-caps flex flex-wrap items-center justify-end gap-2">
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
        </div>
      </header>

      {/* Main fills the column below the header: together they use one viewport (h-screen on root). */}
      <main
        className={`flex w-full min-h-0 min-w-0 flex-1 flex-col overflow-x-visible overflow-y-auto ${layoutDebugZoneClass(3, layoutDebug)}`.trim()}
        data-layout-n={layoutDebug ? '3' : undefined}
        data-layout-name={layoutDebug ? 'Main (scroll + flex-1, height below header only)' : undefined}
      >
        <div
          className={`grid min-h-0 w-full flex-1 grid-cols-12 content-start gap-x-2 gap-y-4 self-stretch py-3 px-2 sm:gap-x-3 sm:py-5 sm:px-3 md:px-4 grid-overlay ${layoutDebugZoneClass(4, layoutDebug)}`.trim()}
          data-layout-n={layoutDebug ? '4' : undefined}
          data-layout-name={layoutDebug ? '12-col grid + padding' : undefined}
        >
          <div
            className={`col-span-12 flex h-full min-h-0 min-w-0 flex-col ${layoutDebugZoneClass(6, layoutDebug)}`.trim()}
            data-layout-n={layoutDebug ? '6' : undefined}
            data-layout-name={layoutDebug ? 'Page content (children)' : undefined}
          >
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
