import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export type InitWelcomeLenisOptions = {
  /** Called after Lenis advances each frame (use for Theatre scrub, analytics, etc.). */
  onScroll?: (lenis: Lenis) => void
}

/**
 * Smooth scroll for `/welcome` + GSAP ScrollTrigger + shared GSAP ticker with Three.js.
 *
 * - `autoRaf: false` — Lenis advances via `lenis.raf()` on `gsap.ticker` (same clock as Hero WebGL).
 * - `ScrollTrigger.update` runs on Lenis `scroll` so scrub/snap follow smoothed scroll.
 * - `scrollerProxy` keeps ScrollTrigger’s scroll math in sync with Lenis’s animated scroll.
 */
export function initWelcomeLenis(opts?: InitWelcomeLenisOptions): {
  dispose: () => void
  lenis: Lenis
} {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const lenis = new Lenis({
    autoRaf: false,
    lerp: reduceMotion ? 1 : 0.09,
    smoothWheel: !reduceMotion,
    wheelMultiplier: reduceMotion ? 1 : 0.85,
  })

  const onLenisScroll = () => {
    ScrollTrigger.update()
    opts?.onScroll?.(lenis)
  }
  lenis.on('scroll', onLenisScroll)

  ScrollTrigger.scrollerProxy(document.documentElement, {
    scrollTop(value) {
      if (typeof value === 'number') {
        lenis.scrollTo(value, { immediate: true })
      }
      return lenis.scroll
    },
    scrollHeight: () => document.documentElement.scrollHeight,
    getBoundingClientRect() {
      return {
        top: 0,
        left: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      }
    },
  })

  /** Same rAF lane as `HeroSection`’s `gsap.ticker.add(tickHero)` — Lenis runs first (parent effect registers before child). */
  const onGsapTick = () => {
    lenis.raf(performance.now())
  }
  gsap.ticker.add(onGsapTick)
  gsap.ticker.lagSmoothing(0)

  requestAnimationFrame(() => {
    try {
      lenis.resize()
      ScrollTrigger.refresh()
    } catch {
      /* ignore */
    }
  })

  const dispose = () => {
    gsap.ticker.remove(onGsapTick)
    lenis.off('scroll', onLenisScroll)
    lenis.destroy()
    try {
      ScrollTrigger.refresh()
    } catch {
      /* ignore */
    }
  }

  return { dispose, lenis }
}
