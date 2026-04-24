import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'

export default function LandingLayout() {
  return (
    <AppShell>
      <section className="flex min-h-[calc(100vh-9rem)] w-full items-center supports-[min-height:100dvh]:min-h-[calc(100dvh-9rem)]">
        <div className="grid w-full grid-cols-12 gap-y-8 md:gap-x-5 lg:gap-x-8">
          <div className="col-span-12 space-y-4 md:col-span-7 md:max-w-[min(100%,38rem)] md:pl-[min(5vw,4rem)] sm:space-y-6">
            <p className="text-small font-mono uppercase tracking-[0.24em] text-white">
              A chain for documenting making
            </p>
            <h1 className="text-h1">Document what making actually looks like.</h1>
            <p className="text-body text-white max-w-none">
              No coins. No hype. Just work and the people who make it.
            </p>
            <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:flex-wrap">
              <Link
                to="/register"
                className="inline-flex justify-center border border-black bg-yellow-400 px-6 py-2.5 font-mono text-small uppercase tracking-[0.2em] text-white transition hover:bg-black hover:text-yellow-400 active:scale-[0.98] [touch-action:manipulation] sm:text-center"
              >
                Enter the chain
              </Link>
              <Link
                to="/login"
                className="inline-flex justify-center border border-white/25 bg-zinc-900/55 px-6 py-2.5 font-mono text-small uppercase tracking-[0.2em] text-white transition hover:bg-black hover:text-yellow-400 active:scale-[0.98] [touch-action:manipulation] sm:text-center"
              >
                Already a node? Login
              </Link>
            </div>
            <p className="border-t border-white/10 pt-6 text-small text-white">
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
          <div className="relative col-span-12 hidden md:col-span-5 md:block">
            <div className="aspect-[1.618/1] border border-dashed border-white/20 bg-zinc-950/35">
              <div
                aria-hidden
                className="h-full w-full bg-[radial-gradient(circle_at_center,rgba(250,204,21,0.16)_0%,rgba(250,204,21,0.08)_18%,transparent_19%),radial-gradient(circle_at_center,rgba(59,130,246,0.12)_0%,rgba(59,130,246,0.06)_30%,transparent_31%),radial-gradient(circle_at_center,rgba(236,72,153,0.1)_0%,rgba(236,72,153,0.05)_42%,transparent_43%)]"
              />
              <p className="absolute bottom-2 left-2 font-mono text-[9px] uppercase tracking-[0.2em] text-white/50">
                Wireframe / preview
              </p>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  )
}
