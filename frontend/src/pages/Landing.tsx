import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'

export default function Landing() {
  return (
    <AppShell>
      <section className="flex min-h-[calc(100vh-9rem)] w-full items-center supports-[min-height:100dvh]:min-h-[calc(100dvh-9rem)]">
        <div className="w-full grid grid-cols-12 gap-x-2 sm:gap-x-3 gap-y-6">
          <div className="col-span-12 space-y-4 sm:space-y-6">
            <p className="text-small font-mono uppercase tracking-[0.24em] text-white">
              A chain for documenting making
            </p>
            <h1 className="text-h1">Document what making actually looks like.</h1>
            <p className="text-body text-white max-w-none">
              No coins. No hype. Just work and the people who make it.
            </p>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
              <Link
                to="/register"
                className="etch-outlined-press inline-flex justify-center border border-white bg-[#0a0a0a] px-6 py-2.5 font-mono text-small uppercase tracking-[0.2em] text-white transition hover:bg-white hover:text-[#0a0a0a] [touch-action:manipulation] sm:text-center"
              >
                Enter the chain
              </Link>
              <Link
                to="/login"
                className="etch-outlined-press inline-flex justify-center border border-[#444444] bg-[#0a0a0a] px-6 py-2.5 font-mono text-small uppercase tracking-[0.2em] text-white transition hover:border-white hover:text-white [touch-action:manipulation] sm:text-center"
              >
                Already a node? Login
              </Link>
            </div>
            <p className="pt-6 font-mono text-[10px] uppercase tracking-[0.14em] text-[#333333]">
              <span className="opacity-90">Dev</span>
              {' · '}
              <Link to="/welcome" className="text-[#333333] underline-offset-2 hover:text-[#555555]">
                open /welcome
              </Link>
              <span className="mx-1.5">·</span>
              <a href="/legacy/index.html" className="text-[#333333] underline-offset-2 hover:text-[#555555]">
                open legacy app
              </a>
            </p>
          </div>
        </div>
      </section>
    </AppShell>
  )
}
