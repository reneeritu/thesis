function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-grey-200">
        <div className="mx-auto max-w-shell px-[60px] py-4 flex items-center justify-between">
          <span className="text-small font-mono tracking-[0.18em] uppercase text-grey-400">
            untitled
          </span>
          <nav className="flex items-center gap-3 text-small font-mono uppercase tracking-[0.18em]">
            <a
              href="/legacy/index.html#/login"
              className="border border-black px-3 py-1 hover:bg-black hover:text-yellow-400 transition"
            >
              Login
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-shell px-[60px] py-10 grid-overlay">
        <section className="min-h-screen flex items-center">
          <div className="w-full grid grid-cols-12 gap-x-3 gap-y-6">
            <div className="col-span-12 space-y-6">
              <p className="text-small font-mono uppercase tracking-[0.24em] text-grey-400">
                A chain for documenting making
              </p>
              <h1 className="text-h1">
                Document what making actually looks like.
              </h1>
              <p className="text-body text-grey-400 max-w-none">
                No coins. No hype. Just work and the people who make it.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <a
                  href="/legacy/index.html#/register"
                  className="border border-black bg-yellow-400 text-black font-mono text-small uppercase tracking-[0.2em] px-6 py-2 hover:bg-black hover:text-yellow-400 transition"
                >
                  Enter the chain
                </a>
                <a
                  href="/legacy/index.html#/login"
                  className="border border-black bg-white text-black font-mono text-small uppercase tracking-[0.2em] px-6 py-2 hover:bg-black hover:text-yellow-400 transition"
                >
                  Already a node? Login
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
