import { useEffect, useState } from 'react'

type Props = {
  onStart: () => void
}

export function SimEntryScreen({ onStart }: Props) {
  const [showSecond, setShowSecond] = useState(false)
  const [showButton, setShowButton] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setShowSecond(true), 1800)
    const t2 = setTimeout(() => setShowButton(true), 3200)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center justify-center bg-black px-8">
      <div className="flex max-w-lg flex-col gap-8 text-center">
        <div className="space-y-3">
          <p
            className="font-mono text-md uppercase tracking-[0.28em] text-white/80 transition-opacity duration-700"
            style={{ opacity: 1 }}
          >
            In any creative system, half the labor is invisible.
          </p>
          <p
            className="font-mono text-md uppercase tracking-[0.28em] text-white/45 transition-opacity duration-700"
            style={{ opacity: showSecond ? 1 : 0 }}
          >
            This is not a bug.
          </p>
        </div>

        <div
          className="transition-opacity duration-500"
          style={{ opacity: showButton ? 1 : 0 }}
        >
          <button
            type="button"
            onClick={onStart}
            className="border border-white/30 bg-transparent px-6 py-2.5 font-mono text-small uppercase tracking-[0.22em] text-white/70 transition hover:border-white/60 hover:text-white"
          >
            Watch what that looks like →
          </button>
        </div>
      </div>
    </div>
  )
}
