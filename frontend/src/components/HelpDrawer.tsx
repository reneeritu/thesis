import { useEffect, useState, useRef } from 'react'
import { useChromeBackdropWhileOpen } from '../context/ChromeBackdropContext'
import { GLOSSARY } from '../lib/glossary'
import { AnchoredGlassDropdownPanel } from './AnchoredGlassDropdownPanel'

/** Discover, notifications, glossary triggers in AppShell — same hit area, no boxed chrome. */
export const HEADER_NAV_ICON_BUTTON_CLASS =
  'etch-nav-icon-btn relative inline-flex h-9 w-9 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-white/90 transition-etch hover:text-yellow-400 [touch-action:manipulation] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400/50'

export const HEADER_NAV_ICON_SVG_CLASS = 'h-[18px] w-[18px]'

/**
 * Keys to surface in the 30-second glossary. Order matches how a first-timer
 * meets the concepts in the flow — identity first, context second, work third,
 * governance last.
 */
const HELP_KEYS: Array<{ term: string; label: string }> = [
  { term: 'node', label: 'Node' },
  { term: 'alias', label: 'Alias' },
  { term: 'space', label: 'Space' },
  { term: 'project', label: 'Project' },
  { term: 'trace', label: 'Trace' },
  { term: 'chain', label: 'Chain' },
  { term: 'endorsement', label: 'Endorsement' },
  { term: 'flag', label: 'Flag' },
  { term: 'provenance_certificate', label: 'Provenance certificate' },
  { term: 'seed_phrase', label: 'Seed phrase' },
  { term: 'trustees', label: 'Trustees' },
]

/** Small standalone button — opens glossary in an anchored dropdown under the icon (same motion as notifications). */
export function HelpButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  useChromeBackdropWhileOpen(open)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={className ?? HEADER_NAV_ICON_BUTTON_CLASS}
        aria-label={open ? 'Close quick glossary' : 'Open quick glossary'}
        title="Quick glossary"
        aria-expanded={open}
      >
        <svg
          viewBox="0 0 24 24"
          className={HEADER_NAV_ICON_SVG_CLASS}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect
            x="3.25"
            y="3.25"
            width="17.5"
            height="17.5"
            rx="4.75"
            ry="4.75"
            fill="currentColor"
            fillOpacity="0.08"
            stroke="currentColor"
            strokeOpacity="0.22"
            strokeWidth="1.5"
          />
          <path d="M12 5.5 5 6.75v10.5L12 18.5M12 5.5 19 6.75v10.5L12 18.5" />
          <line x1="12" y1="5.5" x2="12" y2="18.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      <AnchoredGlassDropdownPanel
        open={open}
        onClose={() => setOpen(false)}
        align="right"
        className="flex w-[min(22rem,calc(100vw-1rem))] max-h-[min(calc(100dvh-4.5rem),36rem)] flex-col overflow-hidden border border-white/20 floating-glass-panel shadow-xl"
        ariaLabelledBy="etch-quick-glossary-title"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-white/15 bg-zinc-950/40 px-3 py-2 backdrop-blur-md">
          <p id="etch-quick-glossary-title" className="etch-float-caps">
            30-second glossary
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="etch-float-caps border border-white/25 bg-zinc-900/55 px-2 py-0.5 transition hover:bg-black hover:text-yellow-400"
            aria-label="Close glossary"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <p className="etch-float-prose mb-3 text-white/90">
            Everything on Etch has a fingerprint. Here's the vocabulary.
          </p>
          <dl className="space-y-3">
            {HELP_KEYS.map(({ term, label }) =>
              GLOSSARY[term] ? (
                <div key={term} className="border-l-2 border-black pl-3">
                  <dt className="etch-float-caps">{label}</dt>
                  <dd className="etch-float-prose mt-1 text-white/90">{GLOSSARY[term]}</dd>
                </div>
              ) : null,
            )}
          </dl>
        </div>

        <footer className="etch-float-caps shrink-0 border-t border-white/15 px-4 py-2 text-white/85">
          Turn the "Hints: on" toggle off to hide these definitions inline.
        </footer>
      </AnchoredGlassDropdownPanel>
    </div>
  )
}
