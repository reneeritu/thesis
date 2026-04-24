import { useEffect, useState } from 'react'
import { GLOSSARY } from '../lib/glossary'

/** Discover, notifications, glossary triggers in AppShell — same hit area, no boxed chrome. */
export const HEADER_NAV_ICON_BUTTON_CLASS =
  'relative inline-flex h-9 w-9 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-white/90 transition-etch hover:text-yellow-400 [touch-action:manipulation] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400/50'

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

type Props = {
  open: boolean
  onClose: () => void
}

export function HelpDrawer({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quick glossary"
      className="floating-glass-scrim fixed inset-0 z-[200] flex items-stretch justify-end"
      onClick={onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="floating-glass-panel flex h-full w-full max-w-md flex-col border-l border-white/20 text-white shadow-xl"
      >
        <header className="flex items-center justify-between border-b border-white/15 px-4 py-3">
          <p className="etch-float-caps">30-second glossary</p>
          <button
            type="button"
            onClick={onClose}
            className="etch-float-caps border border-white/25 bg-zinc-900/55 px-2 py-0.5 transition hover:bg-black hover:text-yellow-400"
            aria-label="Close help"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <p className="etch-float-prose mb-4 text-white/90">
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

        <footer className="etch-float-caps border-t border-white/15 px-4 py-2 text-white/85">
          Turn the "Hints: on" toggle off to hide these definitions inline.
        </footer>
      </aside>
    </div>
  )
}

/** Small standalone button — renders the drawer when opened. */
export function HelpButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? HEADER_NAV_ICON_BUTTON_CLASS}
        aria-label="Open quick glossary"
        title="Quick glossary"
      >
        <svg
          viewBox="0 0 24 24"
          className={HEADER_NAV_ICON_SVG_CLASS}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          {/* Squircle tile + open book with spine (currentColor only) */}
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
            strokeWidth="1"
          />
          <path d="M12 5.5 5 6.75v10.5L12 18.5M12 5.5 19 6.75v10.5L12 18.5" />
          <line x1="12" y1="5.5" x2="12" y2="18.5" stroke="currentColor" strokeWidth="1.35" />
        </svg>
      </button>
      <HelpDrawer open={open} onClose={() => setOpen(false)} />
    </>
  )
}
