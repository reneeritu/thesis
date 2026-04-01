import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'

export default function Landing() {
  return (
    <AppShell>
      <section className="min-h-[calc(100vh-120px)] flex items-center">
        <div className="w-full grid grid-cols-12 gap-x-3 gap-y-6">
          <div className="col-span-12 space-y-6">
            <p className="text-small font-mono uppercase tracking-[0.24em] text-grey-400">
              A chain for documenting making
            </p>
            <h1 className="text-h1">Document what making actually looks like.</h1>
            <p className="text-body text-grey-400 max-w-none">
              No coins. No hype. Just work and the people who make it.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                to="/register"
                className="border border-black bg-yellow-400 text-black font-mono text-small uppercase tracking-[0.2em] px-6 py-2 hover:bg-black hover:text-yellow-400 transition active:scale-[0.98]"
              >
                Enter the chain
              </Link>
              <Link
                to="/login"
                className="border border-black bg-white text-black font-mono text-small uppercase tracking-[0.2em] px-6 py-2 hover:bg-black hover:text-yellow-400 transition active:scale-[0.98]"
              >
                Already a node? Login
              </Link>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  )
}
