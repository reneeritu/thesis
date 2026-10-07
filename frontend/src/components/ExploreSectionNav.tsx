import { Link } from 'react-router-dom'

const itemClass = (active: boolean) =>
  `rounded-sm px-2.5 py-1.5 font-mono text-small uppercase tracking-[0.16em] transition ${
    active
      ? 'bg-black text-yellow-400 [html.light-mode_&]:bg-[var(--text-primary)] [html.light-mode_&]:text-[var(--bg-primary)]'
      : 'bg-white/5 text-white/80 hover:bg-white/10 hover:text-yellow-200 [html.light-mode_&]:bg-black/[0.04] [html.light-mode_&]:text-[var(--text-secondary)] [html.light-mode_&]:hover:text-[var(--text-primary)]'
  }`

/** Explore has two views: the public browse feed, and the reputation crystal. */
export function ExploreSectionNav({ current }: { current: 'browse' | 'crystal' }) {
  return (
    <nav aria-label="Explore" className="flex flex-wrap items-center gap-1.5">
      <Link
        to="/discover"
        className={itemClass(current === 'browse')}
        aria-current={current === 'browse' ? 'page' : undefined}
      >
        Browse
      </Link>
      <Link
        to="/discover/crystal"
        className={itemClass(current === 'crystal')}
        aria-current={current === 'crystal' ? 'page' : undefined}
      >
        Reputation crystal
      </Link>
    </nav>
  )
}
