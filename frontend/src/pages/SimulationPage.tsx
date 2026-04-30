import { useLayoutEffect } from 'react'
import { Link } from 'react-router-dom'
import { SimControls } from '../components/sim/SimControls'
import { SimWhoGetsPaidSection } from '../components/sim/SimWhoGetsPaid'
import { SimDisputeSection } from '../components/sim/SimDisputeSection'
import { SimClassroomSection } from '../components/sim/SimClassroomSection'
import { SimNarratorCard } from '../components/sim/SimNarratorCard'
import { useAgentSim } from '../sim/useAgentSim'

function SectionDivider({ text }: { text: string }) {
  return (
    <div className="relative z-[2] mx-auto w-full max-w-[1600px] px-4">
      <div className="border-t border-[#1a1a2e]" />
      <p className="py-12 text-center font-mono text-[length:var(--text-xs)] tracking-[0.08em] text-[var(--text-ghost)]">
        {text}
      </p>
      <div className="border-t border-[#1a1a2e]" />
    </div>
  )
}

export default function SimulationPage() {
  const {
    leftState,
    rightState,
    params,
    setParams,
    paused,
    pause,
    resume,
    reset,
    narrator,
    dismissNarrator,
    tickMs,
  } = useAgentSim()

  const week = leftState.tick

  useLayoutEffect(() => {
    const html = document.documentElement
    const body = document.body
    html.classList.add('welcome-full-page-scroll')
    body.classList.add('welcome-full-page-scroll')
    return () => {
      html.classList.remove('welcome-full-page-scroll')
      body.classList.remove('welcome-full-page-scroll')
    }
  }, [])

  return (
    <div className="relative flex min-h-[100vh] flex-col bg-[#06060f] font-mono text-[length:var(--text-sm)]">
      {/* Background layers */}
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,#0d0d1f_0%,#06060f_100%)]"
        aria-hidden
      />
      <div
        className="welcome-global-grain pointer-events-none absolute inset-0 z-[1] opacity-[0.14]"
        aria-hidden
      />

      {/* Nav */}
      <div className="relative z-[2] flex justify-end px-4 pt-4">
        <Link
          to="/dashboard"
          className="cursor-target font-mono text-[length:var(--text-xs)] uppercase tracking-[0.14em] text-[var(--text-ghost)] hover:text-[var(--text-primary)]"
        >
          ← dashboard
        </Link>
      </div>

      {/* ── SIM 01 ── */}
      <div className="relative z-[2]">
        <SimWhoGetsPaidSection
          leftNodes={leftState.nodes}
          rightNodes={rightState.nodes}
          week={week}
        />

        <div className="px-4 pb-3">
          <p className="text-center font-mono text-[length:var(--text-xs)] uppercase tracking-[0.14em] text-[var(--text-muted)]">
            tick interval {tickMs}ms
            {paused ? <span className="ml-2 text-[#f97316]">· paused</span> : null}
          </p>
        </div>

        <div className="mx-auto w-full max-w-[1600px] shrink-0 px-4 pb-4">
          <SimControls
            params={params}
            setParams={setParams}
            paused={paused}
            onPause={pause}
            onResume={resume}
            onReset={reset}
          />
        </div>
      </div>

      {/* ── Bridge 1→2 ── */}
      <SectionDivider text="But inequality isn't just about averages. Here's what happens when one person fights back." />

      {/* ── SIM 02 ── */}
      <div className="relative z-[2]">
        <SimDisputeSection />
      </div>

      {/* ── Bridge 2→3 ── */}
      <SectionDivider text="Disputes are visible. But some erasure is so quiet no one even notices it's happening." />

      {/* ── SIM 03 ── */}
      <div className="relative z-[2]">
        <SimClassroomSection />
      </div>

      {/* ── Closing statement ── */}
      <div className="relative z-[2] mx-auto w-full max-w-[1600px] px-4 pb-24 pt-8">
        <div className="border-t border-[#1a1a2e] pt-16 text-center">
          <div
            className="mx-auto mb-8 font-mono text-[length:var(--text-xs)] uppercase tracking-[0.2em] text-[var(--text-ghost)]"
            style={{ letterSpacing: '0.05em' }}
          >
            {'━'.repeat(40)}
          </div>

          <p className="font-mono text-[length:var(--text-lg)] uppercase leading-[2.2] tracking-[0.22em] text-[var(--text-primary)]">
            THREE SIMULATIONS. ONE ARGUMENT.
          </p>

          <p className="mt-8 font-mono text-[length:var(--text-base)] uppercase leading-[2.4] tracking-[0.2em] text-[var(--text-secondary)]">
            DOCUMENTATION IS NOT BUREAUCRACY.
            <br />
            IT IS THE DIFFERENCE BETWEEN
            <br />A RECORD THAT LIES
            <br />
            AND A RECORD THAT DOESN'T.
          </p>

          <p className="mt-8 font-mono text-[length:var(--text-base)] uppercase tracking-[0.28em] text-[var(--text-primary)]">
            THIS IS WHAT ETCH BUILDS.
          </p>

          <div
            className="mx-auto mt-8 font-mono text-[length:var(--text-xs)] uppercase tracking-[0.2em] text-[var(--text-ghost)]"
            style={{ letterSpacing: '0.05em' }}
          >
            {'━'.repeat(40)}
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              to="/discover"
              className="cursor-target rounded border border-white/30 bg-transparent px-8 py-3 font-mono text-[length:var(--text-xs)] uppercase tracking-[0.22em] text-[var(--text-primary)] hover:bg-white/5"
            >
              EXPLORE ETCH →
            </Link>
            <Link
              to="/about"
              className="cursor-target rounded border border-white/15 bg-transparent px-8 py-3 font-mono text-[length:var(--text-xs)] uppercase tracking-[0.22em] text-[var(--text-ghost)] hover:bg-white/5"
            >
              READ THE THESIS →
            </Link>
          </div>
        </div>
      </div>

      <SimNarratorCard
        message={narrator?.text ?? null}
        messageKey={narrator?.id ?? 0}
        onDismiss={dismissNarrator}
      />
    </div>
  )
}
