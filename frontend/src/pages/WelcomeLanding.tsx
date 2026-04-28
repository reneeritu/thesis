import { useCallback, useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { HeroSection } from '../components/HeroSection'
import { initWelcomeLenis } from '../lib/welcomeLenis'
import { applyScrollProgressToTheatreSequence } from '../theatre/etchTheatre'
import { logEtchTheatreSaveJson } from '../theatre/initEtchStudio'

gsap.registerPlugin(ScrollTrigger)

/**
 * Full-bleed landing with plum hero (scroll sequence + 3D logo) and cream continuation.
 *
 * Theatre: intro [0s–2s] plays after the hero GLB is loaded (see `WelcomeTheatreIntroWhenReady`), then pauses until the user scrolls; Lenis maps scroll to the sequence from 2s onward.
 */
export default function WelcomeLanding() {
  const scrollBridgeToTheatreRef = useRef(false)
  const introCompleteHandlerRef = useRef<(() => void) | null>(null)

  const onWelcomeTheatreIntroComplete = useCallback(() => {
    introCompleteHandlerRef.current?.()
  }, [])

  useLayoutEffect(() => {
    const html = document.documentElement
    const body = document.body
    html.classList.add('welcome-full-page-scroll')
    body.classList.add('welcome-full-page-scroll')

    scrollBridgeToTheatreRef.current = false

    const { dispose: disposeLenis, lenis } = initWelcomeLenis({
      onScroll: (l) => {
        if (!scrollBridgeToTheatreRef.current) return
        applyScrollProgressToTheatreSequence(l.progress)
      },
    })

    let cancelled = false
    introCompleteHandlerRef.current = () => {
      if (cancelled) return
      applyScrollProgressToTheatreSequence(lenis.progress)
      scrollBridgeToTheatreRef.current = true
    }

    requestAnimationFrame(() => {
      try {
        ScrollTrigger.refresh()
      } catch (e) {
        console.error('[WelcomeLanding] ScrollTrigger.refresh failed', e)
      }
    })
    return () => {
      cancelled = true
      introCompleteHandlerRef.current = null
      scrollBridgeToTheatreRef.current = false
      disposeLenis()
      html.classList.remove('welcome-full-page-scroll')
      body.classList.remove('welcome-full-page-scroll')
      requestAnimationFrame(() => {
        try {
          ScrollTrigger.refresh()
        } catch (e) {
          console.error('[WelcomeLanding] ScrollTrigger.refresh failed', e)
        }
      })
    }
  }, [])

  return (
    <div className="flex min-h-screen min-w-full flex-col">
      <div
        className="relative min-h-screen w-full bg-[#18101F]"
        style={{ minHeight: '100vh', backgroundColor: '#18101F' }}
      >
        <header className="pointer-events-none absolute left-0 right-0 top-0 z-[220] flex justify-end gap-2 p-4 sm:p-6">
          <Link
            to="/"
            className="pointer-events-auto border border-white/25 bg-[#18101F]/80 px-3 py-1.5 font-mono text-small uppercase tracking-[0.2em] text-white backdrop-blur-sm transition hover:border-white/50 hover:text-white [touch-action:manipulation]"
          >
            Main site
          </Link>
          <Link
            to="/login"
            className="pointer-events-auto border border-white/25 bg-[#18101F]/80 px-3 py-1.5 font-mono text-small uppercase tracking-[0.2em] text-white backdrop-blur-sm transition hover:border-white/50 hover:text-white [touch-action:manipulation]"
          >
            Login
          </Link>
        </header>

        <HeroSection onWelcomeTheatreIntroComplete={onWelcomeTheatreIntroComplete} />

        {import.meta.env.DEV ? (
          <button
            type="button"
            className="pointer-events-auto fixed bottom-4 left-4 z-[300] border border-white/30 bg-black/70 px-3 py-2 font-mono text-small uppercase tracking-[0.15em] text-white backdrop-blur-sm hover:border-white/50 hover:text-white"
            onClick={() => logEtchTheatreSaveJson()}
          >
            Log Theatre save (ETCH)
          </button>
        ) : null}
      </div>

      <section
        className="relative z-0 border-t border-[#2a1f35] bg-[#0a0712] text-white"
        aria-label="Introduction"
      >
        <div className="mx-auto max-w-shell shell-px py-20 sm:py-28">
          <p className="font-[Cormorant_Garamond,serif] text-[clamp(1.5rem,4vw,2.25rem)] font-medium leading-snug tracking-wide text-white">
            Document what making actually looks like — a tactile pause between the depth of the studio and
            the clarity of the page.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="flex flex-col">
              <Link
                to="/register"
                className="inline-flex justify-center border border-black bg-[#C8963E] px-6 py-2.5 font-mono text-small uppercase tracking-[0.2em] text-white transition hover:bg-black hover:text-[#C8963E] [touch-action:manipulation]"
              >
                Enter the chain
              </Link>
              <span className="mt-1 pl-1 font-mono text-small uppercase tracking-[0.2em] text-white/85">
                Create an account
              </span>
            </div>
            <div className="flex flex-col">
              <Link
                to="/discover"
                className="inline-flex justify-center border border-white/25 bg-zinc-900/55 px-6 py-2.5 font-mono text-small uppercase tracking-[0.2em] text-white transition hover:bg-black hover:text-[#C8963E] [touch-action:manipulation]"
              >
                Discover
              </Link>
              <span className="mt-1 pl-1 font-mono text-small uppercase tracking-[0.2em] text-white/85">
                Browse public spaces
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
