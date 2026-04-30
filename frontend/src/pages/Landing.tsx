import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import DecryptedText from '../components/landing/DecryptedText'

const FaultyTerminal = lazy(() => import('../components/landing/FaultyTerminal'))

// ─── Colours ─────────────────────────────────────────────────────────────────
const PURPLE = '#a78bfa'
const CYAN = '#67e8f9'
const GREEN = '#4ade80'
const BORDER = 'rgba(26,26,46,0.8)'

const CONNECTOR_COLORS = [PURPLE, CYAN, GREEN, 'var(--text-muted)']

const MARQUEE_TEXT =
  'BRAINSTORM · RESEARCH · FABRICATION · SKILLWORK · PEDAGOGY · REVIEW · ITERATE · AI_TOOL · REFERENCE · FORK · ARCHIVE · VETO · CREDIT · PIVOT · '

export default function Landing() {
  const [reducedMotion, setReducedMotion] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeSection, setActiveSection] = useState(0)

  useLayoutEffect(() => {
    const html = document.documentElement
    const body = document.body
    html.classList.add('landing-scroll')
    body.classList.add('landing-scroll')
    return () => {
      html.classList.remove('landing-scroll')
      body.classList.remove('landing-scroll')
    }
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const sections = Array.from(container.querySelectorAll<HTMLElement>('[data-section]'))
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setActiveSection(Number((e.target as HTMLElement).dataset.section ?? 0))
          }
        }
      },
      { threshold: 0.6 },
    )
    sections.forEach((s) => obs.observe(s))
    return () => obs.disconnect()
  }, [])

  return (
    <>
      <style>{`
        html.landing-scroll,
        html.landing-scroll body {
          max-height: none !important;
          height: 100% !important;
          overflow: hidden;
        }
        html.landing-scroll body { overflow: hidden; }

        .landing-root {
          height: 100vh;
          overflow-y: scroll;
          scroll-snap-type: y mandatory;
          scroll-behavior: smooth;
        }
        .landing-section {
          scroll-snap-align: start;
          height: 100vh;
          overflow: hidden;
          position: relative;
        }

        @keyframes landingBounce {
          0%,100% { transform: translateX(-50%) translateY(0); }
          50%      { transform: translateX(-50%) translateY(6px); }
        }
        @keyframes scrollBlink {
          0%,100% { opacity: 0.4; }
          50%      { opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>

      <div ref={containerRef} className="landing-root bg-[#0a0a0f] font-mono text-[var(--text-primary)]">

        {/* ── SECTION 1 — HERO ── */}
        <section
          className="landing-section"
          data-section={0}
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {/* Mini nav */}
          <div className="absolute left-6 top-5 z-20 flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-ghost)]">ETCH</span>
            <span className="text-[var(--text-ghost)] opacity-40">·</span>
            <Link to="/discover" className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-ghost)] hover:text-[var(--text-primary)]">EXPLORE</Link>
            <Link to="/login" className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-ghost)] hover:text-[var(--text-primary)]">LOGIN</Link>
          </div>

          {/* FaultyTerminal — full-section background */}
          {!reducedMotion && (
            <Suspense fallback={null}>
              <div className="pointer-events-none absolute inset-0" style={{ zIndex: 0 }}>
                <FaultyTerminal
                  scale={1.5}
                  gridMul={[2, 1]}
                  digitSize={1.2}
                  timeScale={0.4}
                  scanlineIntensity={0.5}
                  glitchAmount={1}
                  flickerAmount={0.6}
                  noiseAmp={0.4}
                  chromaticAberration={0}
                  dither={0}
                  curvature={0}
                  tint="#3d1e5b"
                  mouseReact
                  mouseStrength={0.5}
                  brightness={0.6}
                  pageLoadAnimation={false}
                />
              </div>
            </Suspense>
          )}

          {/* Vignette overlay */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              zIndex: 1,
              background:
                'radial-gradient(ellipse at center, rgba(10,10,15,0.3) 0%, rgba(10,10,15,0.75) 100%)',
            }}
          />

          {/* Centered content */}
          <div
            style={{
              position: 'relative',
              zIndex: 2,
              maxWidth: 680,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: 0,
            }}
          >
            {/* Top label */}
            <DecryptedText
              text="A CHAIN FOR DOCUMENTING MAKING"
              animateOn="view"
              sequential
              revealDirection="start"
              speed={50}
              maxIterations={2}
              characters="ABCDEFGHIJKLMNOPQRSTUVWXYZ_/·"
              className="font-mono uppercase text-[var(--text-ghost)]"
              style={{ fontSize: 11, letterSpacing: '0.22em' }}
            />

            {/* ETCH wordmark — instant, large */}
            <h1
              className="font-mono font-bold leading-none text-[var(--text-primary)]"
              style={{ fontSize: 'clamp(100px, 14vw, 180px)', marginTop: 16, letterSpacing: '-0.02em' }}
            >
              ETCH
            </h1>

            {/* Subheading — DecryptedText, fast */}
            <p
              className="font-mono font-normal leading-[1.3] text-[var(--text-secondary)]"
              style={{ fontSize: 'clamp(18px, 2.2vw, 28px)', marginTop: 12 }}
            >
              <DecryptedText
                text="Document what making actually looks like."
                animateOn="view"
                sequential
                revealDirection="start"
                speed={50}
                maxIterations={2}
                characters="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz. "
              />
            </p>

            {/* Body — fade in after 600ms */}
            <p
              className="font-mono text-[length:var(--text-sm)] text-[var(--text-muted)]"
              style={{
                marginTop: 24,
                animation: 'fadeIn 400ms ease both',
                animationDelay: '600ms',
                opacity: 0,
              }}
            >
              No coins. No hype. No algorithms.
            </p>

            {/* Buttons — fade in after 900ms */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                marginTop: 32,
                animation: 'fadeInUp 400ms ease both',
                animationDelay: '900ms',
                opacity: 0,
              }}
            >
              <Link
                to="/register"
                className="border border-[var(--text-primary)] bg-transparent px-6 py-2.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-primary)] transition-colors hover:bg-[var(--text-primary)] hover:text-[#0a0a0f]"
              >
                ENTER THE CHAIN
              </Link>
              <Link
                to="/login"
                className="border border-[rgba(255,255,255,0.2)] bg-transparent px-6 py-2.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-ghost)] transition-colors hover:border-[var(--text-primary)] hover:text-[var(--text-primary)]"
              >
                ALREADY A NODE? LOGIN
              </Link>
            </div>

            {/* Stats — fade in after 1200ms */}
            <p
              className="font-mono text-[10px] uppercase text-[var(--text-ghost)]"
              style={{
                marginTop: 40,
                letterSpacing: '0.18em',
                animation: 'fadeIn 400ms ease both',
                animationDelay: '1200ms',
                opacity: 0,
              }}
            >
              156 BLOCKS ON CHAIN · 14 TRACES TODAY · OPEN PROTOCOL
            </p>
          </div>

          {activeSection === 0 && (
            <div
              className="absolute font-mono text-xl text-[var(--text-ghost)]"
              style={{ bottom: 24, left: '50%', animation: 'landingBounce 2s ease-in-out infinite' }}
            >
              ↓
            </div>
          )}
        </section>

        {/* ── SECTION 2 — WHAT IT IS ── */}
        <section className="landing-section flex flex-col" data-section={1}>
          <div className="flex h-full flex-col px-10 py-16 lg:px-16">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-ghost)]">
              01 / WHAT IS ETCH
            </p>

            <div className="mt-12 grid flex-1 grid-cols-1 gap-10 lg:grid-cols-3" style={{ alignItems: 'start' }}>
              {/* Col 1 */}
              <div>
                <p className="font-mono font-bold leading-[1.3] text-[var(--text-primary)]" style={{ fontSize: 'clamp(20px, 2.5vw, 32px)' }}>
                  Work happens. Most of it disappears.
                </p>
                <p className="mt-6 font-mono text-[length:var(--text-sm)] leading-[1.8] text-[var(--text-muted)]">
                  Etch is an art process documentation chain. It records who did
                  what, when, with what evidence, and in relation to what other work.
                </p>
                <p className="mt-6 font-mono text-[length:var(--text-sm)] leading-[1.8] text-[var(--text-muted)]">
                  The system is not a marketplace, a token economy, or a social
                  network. It is infrastructure for making creative labor legible.
                </p>
              </div>

              {/* Col 2 — IS / IS NOT */}
              <div
                className="flex flex-col gap-0"
                style={{ border: `1px solid ${BORDER}`, background: 'rgba(10,10,20,0.6)', padding: 28 }}
              >
                <div className="grid grid-cols-2 gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-ghost)]">IS</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-ghost)]">IS NOT</span>
                </div>
                <div className="my-3 h-px bg-[rgba(26,26,46,0.8)]" />
                {([
                  ['a process record', 'a marketplace'],
                  ['an attribution chain', 'a token economy'],
                  ['a governance system', 'a credit score'],
                  ['a provenance certificate', 'a social network'],
                  ['a dispute resolver', 'a financial product'],
                ] as [string, string][]).map(([is, isNot]) => (
                  <div
                    key={is}
                    className="grid grid-cols-2 gap-2 border-b py-2 font-mono text-[10px]"
                    style={{ borderColor: 'rgba(26,26,46,0.5)' }}
                  >
                    <span className="text-[var(--text-secondary)]">{is}</span>
                    <span className="text-[var(--text-ghost)] line-through">{isNot}</span>
                  </div>
                ))}
              </div>

              {/* Col 3 — stats */}
              <div className="flex flex-col gap-5">
                {([
                  { num: '50.1%', color: 'var(--text-primary)', label: 'of labor in collaborative creative work is invisible or uncompensated' },
                  { num: '0', color: CYAN, label: 'financial instruments. no tokens, no trading, no speculation.' },
                  { num: '3', color: GREEN, label: 'things that change with documentation: consent, credit, compensation.' },
                ] as const).map(({ num, color, label }) => (
                  <div key={num} className="flex flex-col gap-1 border-l-2 pl-4" style={{ borderColor: PURPLE }}>
                    <span className="font-mono text-4xl font-bold leading-none" style={{ color }}>{num}</span>
                    <span className="font-mono text-[10px] leading-relaxed text-[var(--text-muted)]">{label}</span>
                  </div>
                ))}
                <a
                  href="/simulation"
                  className="mt-4 inline-block font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--text-ghost)] no-underline hover:text-[var(--text-primary)]"
                >
                  READ THE RESEARCH →
                </a>
              </div>
            </div>

            {/* Marquee activity-type strip */}
            <div
              className="mt-auto overflow-hidden"
              style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 20 }}
            >
              <div style={{ overflow: 'hidden' }}>
                <span
                  className="inline-block whitespace-nowrap font-mono text-[10px] text-[var(--text-ghost)]"
                  style={{
                    letterSpacing: '0.15em',
                    animation: 'marquee 20s linear infinite',
                  }}
                >
                  {MARQUEE_TEXT}{MARQUEE_TEXT}
                </span>
              </div>
            </div>
          </div>

          {activeSection === 1 && (
            <div
              className="absolute font-mono text-xl text-[var(--text-ghost)]"
              style={{ bottom: 24, left: '50%', animation: 'landingBounce 2s ease-in-out infinite' }}
            >
              ↓
            </div>
          )}
        </section>

        {/* ── SECTION 3 — HOW IT WORKS ── */}
        <section
          className="landing-section"
          data-section={2}
          style={{
            backgroundImage:
              'linear-gradient(rgba(26,26,46,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(26,26,46,0.3) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            paddingBottom: 48,
          }}
        >
          <div className="flex flex-col px-10 pt-16 lg:px-16">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-ghost)]">
              02 / THE SYSTEM
            </p>
            <p
              className="mt-3 font-mono font-bold text-[var(--text-primary)]"
              style={{ fontSize: 'clamp(22px, 2.8vw, 36px)' }}
            >
              How a trace becomes a record.
            </p>

            {/* Flow diagram — centered */}
            <div className="mt-10 flex items-center justify-center overflow-x-auto">
              {([
                { icon: '[ ]', label: 'SPACE', sub: 'studio, class, collective', active: true, connector: 'member joins' },
                { icon: '◇', label: 'PROJECT', sub: 'single work thread', active: true, connector: 'work begins' },
                { icon: '⬡', label: 'TRACE', sub: 'timestamped unit of work', active: true, connector: 'project closes' },
                { icon: '✦', label: 'CREDIT', sub: 'all contributors sign', active: false, connector: 'immutably recorded' },
                { icon: '◈', label: 'PROVENANCE', sub: 'hash-linked certificate', active: false, connector: null },
              ] as { icon: string; label: string; sub: string; active: boolean; connector: string | null }[]).map(
                ({ icon, label, sub, active, connector }, idx) => (
                  <div key={label} className="flex items-center">
                    <div className="flex w-[120px] flex-col items-center gap-2">
                      <div
                        className="flex items-center justify-center rounded-full font-mono text-[var(--text-ghost)]"
                        style={{
                          width: 64,
                          height: 64,
                          fontSize: 14,
                          border: `1px solid ${active ? PURPLE : BORDER}`,
                          background: 'rgba(10,10,20,0.8)',
                          boxShadow: active ? `0 0 12px rgba(167,139,250,0.2)` : 'none',
                        }}
                      >
                        {icon}
                      </div>
                      <span className="text-center font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-ghost)]">
                        {label}
                      </span>
                      <span className="max-w-[100px] text-center font-mono text-[10px] text-[var(--text-ghost)] opacity-60">
                        {sub}
                      </span>
                    </div>

                    {connector && (
                      <div className="relative mx-1 flex flex-col items-center" style={{ width: 80 }}>
                        <div
                          className="h-px w-full"
                          style={{ background: CONNECTOR_COLORS[idx] ?? BORDER }}
                        />
                        <span
                          className="absolute font-mono text-[9px] text-[var(--text-ghost)]"
                          style={{
                            top: -9,
                            background: '#0a0a0f',
                            padding: '0 4px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {connector}
                        </span>
                      </div>
                    )}
                  </div>
                ),
              )}
            </div>
          </div>

          {/* Three explanation cards — pushed to bottom */}
          <div className="grid grid-cols-1 gap-8 px-10 lg:grid-cols-3 lg:px-16">
            {([
              {
                heading: 'TRACE',
                accent: PURPLE,
                body: 'One timestamped unit of work. Activity type, optional media proof, optional AI declaration. Logged by the contributor. Hash-linked to the chain.',
                tags: 'brainstorm · research · fabrication · skillwork · pedagogy · review · iterate · ai_tool',
              },
              {
                heading: 'GOVERNANCE',
                accent: CYAN,
                body: 'Three tiers: space-level, cross-space, protocol. Disputes go to mediation. Evidence from traces. Rulings recorded on-chain. No single moderator has unchecked power.',
                tags: null,
              },
              {
                heading: 'REPUTATION',
                accent: GREEN,
                body: 'Six axes: craft, research, collaboration, pedagogy, consistency, community. Displayed as a 3D crystalline form. Not a number. Not a ranking. Cannot be directly compared or sorted.',
                tags: null,
              },
            ] as const).map(({ heading, accent, body, tags }) => (
              <div key={heading} className="flex flex-col gap-2 pt-5" style={{ borderTop: `2px solid ${accent}` }}>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                  {heading}
                </span>
                <p className="font-mono text-[10px] leading-[1.7] text-[var(--text-muted)]">{body}</p>
                {tags && (
                  <p className="mt-3 font-mono text-[9px] text-[var(--text-ghost)]">{tags}</p>
                )}
              </div>
            ))}
          </div>

          {activeSection === 2 && (
            <div
              className="absolute font-mono text-xl text-[var(--text-ghost)]"
              style={{ bottom: 24, left: '50%', animation: 'landingBounce 2s ease-in-out infinite' }}
            >
              ↓
            </div>
          )}
        </section>

        {/* ── SECTION 4 — ENTER (unchanged) ── */}
        <section className="landing-section flex flex-col" data-section={3}>
          <div className="flex h-full flex-col items-center justify-center px-8 py-16 text-center">
            <div className="flex w-full max-w-[600px] flex-col items-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-ghost)]">
                03 / JOIN THE CHAIN
              </p>

              <div className="mt-8">
                <p className="font-mono font-bold leading-[1.2] text-[var(--text-primary)]" style={{ fontSize: 'clamp(24px, 3vw, 40px)' }}>
                  Your alias is permanent.
                </p>
                <p className="font-mono font-bold leading-[1.2]" style={{ fontSize: 'clamp(24px, 3vw, 40px)', color: PURPLE }}>
                  Your traces are yours.
                </p>
                <p className="font-mono font-bold leading-[1.2]" style={{ fontSize: 'clamp(24px, 3vw, 40px)', color: CYAN }}>
                  The record doesn't lie.
                </p>
              </div>

              <p className="mt-8 max-w-[480px] font-mono text-[length:var(--text-sm)] leading-[1.8] text-[var(--text-muted)]">
                Etch uses a 12-word seed phrase, not an email. No legal name
                required. Pseudonymous by design. Your alias appears on every
                credit, every provenance certificate, forever.
              </p>

              <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-ghost)]">
                NO EMAIL REQUIRED · PSEUDONYMOUS · SEED PHRASE RECOVERY
              </p>

              <div className="mt-10 flex flex-wrap justify-center gap-4">
                <Link
                  to="/register"
                  className="border bg-transparent px-8 py-3 font-mono text-[10px] uppercase tracking-[0.22em] transition-colors hover:bg-[var(--text-primary)] hover:text-[#0a0a0f]"
                  style={{ borderColor: 'var(--text-primary)', color: 'var(--text-primary)' }}
                >
                  REGISTER AS A NODE →
                </Link>
                <Link
                  to="/discover"
                  className="border bg-transparent px-8 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-ghost)] transition-colors hover:border-[var(--text-primary)] hover:text-[var(--text-primary)]"
                  style={{ borderColor: BORDER }}
                >
                  EXPLORE WITHOUT ACCOUNT
                </Link>
              </div>

              <p className="mt-12 font-mono text-[10px] text-[var(--text-ghost)] opacity-50">
                ALREADY RUNNING — 1588 nodes · 47 spaces · 203 projects
              </p>
            </div>
          </div>

          <p className="absolute bottom-6 left-0 right-0 text-center font-mono text-[10px] text-[var(--text-ghost)] opacity-40">
            etch / aura on the ledger · srishti manipal 2025–26 · thesis project · renee dua
          </p>

          {activeSection === 3 && (
            <div
              className="absolute font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-ghost)]"
              style={{ bottom: 24, left: '50%', transform: 'translateX(-50%)' }}
            >
              ↑ SCROLL UP
            </div>
          )}
        </section>

      </div>
    </>
  )
}
