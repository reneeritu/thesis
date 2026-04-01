import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  /** e.g. "Login" page title area */
  title?: string
}

export function AppShell({ children, title }: Props) {
  return (
    <div className="flex min-h-[80vh] flex-1 flex-col">
      <header className="border-b border-grey-200 shrink-0">
        <div className="mx-auto max-w-shell shell-px py-4 flex flex-wrap items-center justify-between gap-4">
          <Link
            to="/"
            className="text-small font-mono tracking-[0.18em] uppercase text-grey-400 hover:text-black transition"
          >
            untitled
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-2 text-small font-mono uppercase tracking-[0.18em]">
            <Link
              to="/login"
              className="border border-black px-2.5 py-1.5 sm:px-3 sm:py-1 hover:bg-black hover:text-yellow-400 transition [touch-action:manipulation]"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="border border-black px-2.5 py-1.5 sm:px-3 sm:py-1 hover:bg-black hover:text-yellow-400 transition [touch-action:manipulation]"
            >
              Register
            </Link>
            <Link
              to="/recover"
              className="border border-black px-2.5 py-1.5 sm:px-3 sm:py-1 hover:bg-black hover:text-yellow-400 transition [touch-action:manipulation]"
            >
              Recover
            </Link>
          </nav>
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
