import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { clearSession, getToken } from '../lib/session'
import { isSimMode } from '../lib/simApi'
import { layoutDebugZoneClass, useLayoutDebug } from '../lib/layoutDebug'
import { NotificationBell } from './NotificationBell'
import { MessagesNavLink } from './MessagesNavLink'
import { HelpButton, HEADER_NAV_ICON_BUTTON_CLASS, HEADER_NAV_ICON_SVG_CLASS } from './HelpDrawer'
import { StaggeredMenu, type StaggeredMenuItem } from './staggeredMenu/StaggeredMenu'
import { useTheme } from '../context/ThemeContext'
import { useDefinitions } from '../context/DefinitionsContext'

type Props = {
  children: ReactNode
  /** e.g. "Login" page title area */
  title?: string
  /** When false, the shell main column does not scroll; children must clip internally (e.g. dashboard). */
  scrollMain?: boolean
  /** When false, omit the 12-col grid line overlay on the main content wrapper (e.g. login). */
  gridOverlay?: boolean
}

const navBtn =
  'glassmorphic-light contour-border-neutral px-2 py-1 font-mono text-md font-medium sm:px-2.5 sm:py-1 hover:text-yellow-400 transition-etch [touch-action:manipulation]'

const siteNavMenuItems: StaggeredMenuItem[] = [
  { label: 'Home', ariaLabel: 'Go to home hub', link: '/dashboard' },
  { label: 'Spaces', ariaLabel: 'Go to spaces', link: '/spaces' },
  { label: 'Projects', ariaLabel: 'Go to projects', link: '/projects' },
  { label: 'Discover', ariaLabel: 'Go to discover', link: '/discover' },
  { label: 'Messages', ariaLabel: 'Go to messages', link: '/messages' },
  { label: 'Governance', ariaLabel: 'Go to governance', link: '/governance' },
  { label: 'Sim', ariaLabel: 'Go to simulation', link: '/simulation' },
  { label: 'Archive', ariaLabel: 'Go to archive', link: '/archive/new' },
  {
    label: 'Legacy',
    ariaLabel: 'Open legacy app (new window)',
    link: '/legacy/index.html#/dashboard',
  },
]

/** Dark: neon lavender open accent — light: neutral secondary (see theme-modes.css) */
const ACCENT_NAV_OPEN_DARK = '#e879f9'
/** Open-state accent — aligned with light theme secondary ink */
const ACCENT_NAV_OPEN_LIGHT = '#4a4a46'

function AuthSiteNavDropdown({
  label,
  layoutDebug,
}: {
  label: string
  layoutDebug: boolean
}) {
  const { theme } = useTheme()
  const accentOpen = theme === 'dark' ? ACCENT_NAV_OPEN_DARK : ACCENT_NAV_OPEN_LIGHT
  return (
    <div
      className={`relative inline-block min-w-0 max-w-none align-middle ${layoutDebugZoneClass(5, layoutDebug)}`.trim()}
      data-layout-n={layoutDebug ? '5' : undefined}
      data-layout-name={layoutDebug ? 'Page title + site nav' : undefined}
    >
      <StaggeredMenu
        variant="dropdown"
        className="sm-etch-shell"
        position="left"
        items={siteNavMenuItems}
        displaySocials={false}
        displayItemNumbering={false}
        showLogo={false}
        shuffleToggleText={false}
        toggleLabels={{ closed: label, open: '' }}
        toggleClassName={`${navBtn} pr-5 font-semibold [touch-action:manipulation]`}
        accentColor={accentOpen}
        menuButtonColor={theme === 'dark' ? 'rgba(255,255,255,0.9)' : 'rgba(26,26,24,0.92)'}
        openMenuButtonColor={accentOpen}
        panelClassName="shadow-none"
      />
    </div>
  )
}

function ThemeTogglePill() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const track = isDark
    ? 'border-[1.5px] border-white bg-black hover:border-white'
    : 'border-[1.5px] border-orange-500 bg-white hover:border-orange-600'
  const thumbPos = isDark ? 'left-[calc(100%-18px)]' : 'left-[2px]'
  const thumbFill = isDark ? 'bg-white' : 'bg-orange-500'
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      title={`Theme: ${theme}`}
      className={`relative inline-flex h-[20px] w-[calc(3.75rem-10px)] shrink-0 items-center overflow-hidden rounded-none p-0 transition-etch [touch-action:manipulation] ${track}`}
    >
      <span
        className={`pointer-events-none absolute top-[2px] bottom-[2px] flex w-[16px] items-center justify-center rounded-none transition-[left] duration-300 ease-out ${thumbFill} ${thumbPos}`}
        aria-hidden
      >
        {isDark ? (
          <svg viewBox="0 0 16 16" className="h-[10px] w-[10px] text-black" fill="currentColor" aria-hidden>
            <path d="M13.5 10.5A6 6 0 0 1 5.5 2.5a6 6 0 1 0 8 8z" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" className="h-[10px] w-[10px] text-white" aria-hidden>
            <circle cx="8" cy="8" r="3.25" fill="currentColor" />
            <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="8" y1="1" x2="8" y2="2.6" />
              <line x1="8" y1="13.4" x2="8" y2="15" />
              <line x1="1" y1="8" x2="2.6" y2="8" />
              <line x1="13.4" y1="8" x2="15" y2="8" />
              <line x1="3.05" y1="3.05" x2="4.15" y2="4.15" />
              <line x1="11.85" y1="11.85" x2="12.95" y2="12.95" />
              <line x1="3.05" y1="12.95" x2="4.15" y2="11.85" />
              <line x1="11.85" y1="4.15" x2="12.95" y2="3.05" />
            </g>
          </svg>
        )}
      </span>
    </button>
  )
}

function HintsTogglePill() {
  const { definitionsOn, setDefinitionsOn } = useDefinitions()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const track = isDark
    ? 'border-[1.5px] border-white bg-black hover:border-white'
    : 'border-[1.5px] border-black bg-white hover:border-black'
  const thumbPos = definitionsOn ? 'left-[calc(100%-18px)]' : 'left-[2px]'
  const thumbFill = isDark ? 'bg-white' : 'bg-black'
  return (
    <button
      type="button"
      onClick={() => setDefinitionsOn(!definitionsOn)}
      aria-label="Toggle inline hints"
      aria-pressed={definitionsOn}
      title={`Hints: ${definitionsOn ? 'on' : 'off'}`}
      className={`relative inline-flex h-[20px] w-[calc(3.75rem-10px)] shrink-0 items-center overflow-hidden rounded-none p-0 transition-etch [touch-action:manipulation] ${track}`}
    >
      <span
        className={`pointer-events-none absolute top-[2px] bottom-[2px] w-[16px] rounded-none transition-[left] duration-300 ease-out ${thumbFill} ${thumbPos}`}
        aria-hidden
      />
    </button>
  )
}

export function AppShell({ children, title, scrollMain = true, gridOverlay = true }: Props) {
  const token = getToken()
  const layoutDebug = useLayoutDebug()

  return (
    <div
      className={`relative z-[1] flex h-screen max-h-screen min-h-0 w-full max-w-[100vw] flex-1 flex-col overflow-x-hidden overflow-y-hidden bg-transparent ${layoutDebugZoneClass(1, layoutDebug)}`.trim()}
      data-layout-n={layoutDebug ? '1' : undefined}
      data-layout-name={layoutDebug ? 'App shell (root column, h-screen)' : undefined}
    >
      <header
        className={`relative z-[50] overflow-visible border-b border-grey-200/30 shrink-0 ${layoutDebugZoneClass(2, layoutDebug)}`.trim()}
        data-layout-n={layoutDebug ? '2' : undefined}
        data-layout-name={layoutDebug ? 'Header' : undefined}
      >
        <div className="flex w-full flex-wrap items-center justify-between gap-2 py-2 pl-2 pr-2 sm:pl-3 sm:pr-3 md:pl-4 md:pr-4">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <div className="flex min-w-0 items-center gap-0.5 sm:gap-1">
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
          </div>
          <div className="flex min-w-0 flex-shrink-0 flex-wrap items-center justify-end gap-2">
            {token ? (
              <nav className="etch-float-caps flex flex-wrap items-center justify-end gap-x-2 gap-y-1.5 sm:gap-x-3">
                <HelpButton />
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
              <nav className="etch-float-caps flex flex-wrap items-center justify-end gap-x-2 gap-y-1.5 sm:gap-x-3">
                <HelpButton />
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
        </div>
      </header>

      {/* Hints + theme: fixed bottom-right on every shell page — header stays for route + comms */}
      <div
        className="pointer-events-none fixed z-[180] flex flex-col items-end gap-2 bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))]"
        aria-label="Display controls"
      >
        <div className="pointer-events-auto flex flex-col items-end gap-2 rounded px-2 py-2 floating-glass-panel contour-border-cool shadow-lg">
          <HintsTogglePill />
          <ThemeTogglePill />
        </div>
      </div>

      {/* Main fills the column below the header: together they use one viewport (h-screen on root). */}
      <main
        className={`flex w-full min-h-0 min-w-0 max-w-[100vw] flex-1 flex-col overflow-x-hidden ${scrollMain ? 'overflow-y-auto' : 'overflow-y-hidden'} ${layoutDebugZoneClass(3, layoutDebug)}`.trim()}
        data-layout-n={layoutDebug ? '3' : undefined}
        data-layout-name={layoutDebug ? 'Main (scroll + flex-1, height below header only)' : undefined}
      >
        <div
          className={`grid min-h-0 w-full flex-1 grid-cols-12 content-start gap-x-2 gap-y-4 self-stretch py-3 px-2 sm:gap-x-3 sm:py-5 sm:px-3 md:px-4 ${gridOverlay ? 'grid-overlay' : ''} ${layoutDebugZoneClass(4, layoutDebug)}`.trim()}
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
