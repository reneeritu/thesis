import { Link } from 'react-router-dom'
import { loginUrl, registerUrl } from '../lib/authNavigate'

/**
 * Slim fixed footer for logged-out visitors on public browse routes.
 */
export function GuestBrowseBanner() {
  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-[190] flex h-9 shrink-0 items-center justify-between border-t border-[#2a2a2a] bg-[#0f0f0d] px-6 font-mono text-[length:var(--text-sm)] text-[#777]"
      role="contentinfo"
    >
      <p className="m-0 max-w-[min(100%,42rem)] truncate">
        you are browsing as a guest. traces and credits are public record.
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          to={registerUrl()}
          className="border border-[#333333] px-3 py-1 font-mono text-[length:var(--text-sm)] uppercase tracking-[0.12em] text-[#aaa] transition hover:border-[#555555] hover:text-white"
        >
          Register
        </Link>
        <Link
          to={loginUrl()}
          className="border border-[#333333] px-3 py-1 font-mono text-[length:var(--text-sm)] uppercase tracking-[0.12em] text-[#aaa] transition hover:border-[#555555] hover:text-white"
        >
          Login
        </Link>
      </div>
    </footer>
  )
}
