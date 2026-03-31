function App() {
  return (
    <div className="min-h-screen bg-white text-black">
      <header className="border-b border-neutral-200">
        <div className="mx-auto max-w-[1280px] px-5 lg:px-20 py-4 flex items-center justify-between">
          <span className="text-xs tracking-[0.18em] uppercase text-neutral-500">
            untitled
          </span>
          <nav className="flex items-center gap-4 text-xs uppercase tracking-[0.16em]">
            <button className="px-3 py-1 rounded-full border border-black bg-white hover:bg-black hover:text-[var(--color-skyblue)] transition">
              Login
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-5 lg:px-20 py-10 lg:py-16 grid-overlay">
        <section className="min-h-screen flex items-center">
          <div className="w-full grid grid-cols-12 gap-6">
            <div className="col-span-12 md:col-span-7 space-y-4 md:space-y-6">
              <p className="text-xs uppercase tracking-[0.24em] text-neutral-500">
                A chain for documenting making
              </p>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                Document what{" "}
                <span className="bg-[var(--color-orangered)] px-2">
                  making
                </span>{" "}
                actually looks like.
              </h1>
              <p className="text-sm md:text-base max-w-[36rem] text-neutral-700">
                A Swiss-grid inspired notebook for process, provenance, and all
                the messy in-between. No coins, no hype — just work.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <a
                  href="/legacy/index.html#/register"
                  className="px-6 py-2 text-xs font-semibold uppercase tracking-[0.2em] border border-black bg-orangered text-black hover:bg-black hover:text-skyblue transition"
                >
                  Enter the chain
                </a>
                <a
                  href="/legacy/index.html#/login"
                  className="px-6 py-2 text-xs font-semibold uppercase tracking-[0.2em] border border-black bg-white hover:bg-black hover:text-skyblue transition"
                >
                  Already a node? Login
                </a>
              </div>
            </div>

            <div className="col-span-12 md:col-span-5 flex flex-col gap-3 md:gap-4">
              <div className="h-40 md:h-56 bg-[var(--color-grey)] border border-dashed border-neutral-300 flex items-center justify-center text-xs uppercase tracking-[0.2em] text-neutral-500">
                Grid-aligned poster space
              </div>
              <div className="grid grid-cols-2 gap-3 text-[10px] uppercase tracking-[0.18em]">
                <div className="border border-black bg-[var(--color-pink)] text-black px-3 py-2">
                  <p>Non-financial</p>
                </div>
                <div className="border border-black bg-[var(--color-ultramarine)] text-white px-3 py-2">
                  <p>Trust-based</p>
                </div>
                <div className="border border-black bg-white text-black px-3 py-2">
                  <p>Open ledger</p>
                </div>
                <div className="border border-black bg-[var(--color-skyblue)] text-black px-3 py-2">
                  <p>Process first</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-10 md:py-12 border-t border-neutral-200">
          <div className="grid grid-cols-12 gap-6 text-xs md:text-sm text-neutral-700">
            <div className="col-span-12 md:col-span-4 space-y-2">
              <h2 className="text-base md:text-lg font-semibold uppercase tracking-[0.18em]">
                For artists
              </h2>
              <p>
                Capture research, false starts, and in-progress work as they
                happen. Credits follow the work, not the pitch deck.
              </p>
            </div>
            <div className="col-span-12 md:col-span-4 space-y-2">
              <h2 className="text-base md:text-lg font-semibold uppercase tracking-[0.18em]">
                For collaborators
              </h2>
              <p>
                Surface who held the camera, who fixed the script, who built the
                toolchain. No more invisible labor.
              </p>
            </div>
            <div className="col-span-12 md:col-span-4 space-y-2">
              <h2 className="text-base md:text-lg font-semibold uppercase tracking-[0.18em]">
                For institutions
              </h2>
              <p>
                A shared record of how work came to be — proof of process,
                without asking makers to sanitize it.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
