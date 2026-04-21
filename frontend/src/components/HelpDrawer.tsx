import { useEffect, useState } from 'react'
import { GLOSSARY } from '../lib/glossary'

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
      className="fixed inset-0 z-[200] flex items-stretch justify-end bg-black/30"
      onClick={onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col border-l border-black bg-[#faf7ef] shadow-xl"
      >
        <header className="flex items-center justify-between border-b border-black px-4 py-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em]">
            30-second glossary
          </p>
          <button
            type="button"
            onClick={onClose}
            className="border border-black bg-white px-2 py-0.5 font-mono text-[11px] hover:bg-black hover:text-yellow-400 transition"
            aria-label="Close help"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <p className="mb-4 font-serif text-[14px] leading-snug text-grey-700">
            Everything on Etch has a fingerprint. Here's the vocabulary.
          </p>
          <dl className="space-y-3 text-[13px]">
            {HELP_KEYS.map(({ term, label }) =>
              GLOSSARY[term] ? (
                <div key={term} className="border-l-2 border-black pl-3">
                  <dt className="font-mono text-[11px] uppercase tracking-[0.18em]">
                    {label}
                  </dt>
                  <dd className="mt-1 text-grey-700">{GLOSSARY[term]}</dd>
                </div>
              ) : null,
            )}
          </dl>
        </div>

        <footer className="border-t border-black px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-grey-500">
          Turn the "Hints: on" toggle off to hide these definitions inline.
        </footer>
      </aside>
    </div>
  )
}

/** Small standalone button — renders the drawer when opened. */
export function HelpButton({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`h-8 w-8 shrink-0 border border-black bg-white font-mono text-[12px] font-bold hover:bg-black hover:text-yellow-400 transition [touch-action:manipulation] ${className}`}
        aria-label="Open quick glossary"
        title="Quick glossary"
      >
        ?
      </button>
      <HelpDrawer open={open} onClose={() => setOpen(false)} />
    </>
  )
}
