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
                className="inline-flex justify-center border border-black bg-yellow-400 text-white font-mono text-small uppercase tracking-[0.2em] px-6 py-2.5 hover:bg-black hover:text-yellow-400 transition active:scale-[0.98] [touch-action:manipulation] sm:text-center"
              >
                Enter the chain
              </Link>
              <Link
                to="/login"
                className="inline-flex justify-center border border-white/25 bg-zinc-900/55 text-white font-mono text-small uppercase tracking-[0.2em] px-6 py-2.5 hover:bg-black hover:text-yellow-400 transition active:scale-[0.98] [touch-action:manipulation] sm:text-center"
              >
                Already a node? Login
              </Link>
            </div>
            <p className="text-small text-white pt-6">
              Etch welcome (scroll + 3D):{' '}
              <Link to="/welcome" className="underline underline-offset-4 hover:text-white">
                open /welcome
              </Link>
              <span className="mx-2 text-white">·</span>
              Previous UI:{' '}
              <a href="/legacy/index.html" className="underline underline-offset-4 hover:text-white">
                open legacy app
              </a>
              .
            </p>
          </div>
        </div>
      </section>
    </AppShell>
  )
}
