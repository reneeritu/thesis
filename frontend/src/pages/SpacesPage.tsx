import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { GenerativeAvatar } from '../components/GenerativeAvatar'
import { api } from '../lib/api'
import { getAlias } from '../lib/session'

/** Accent — aligns with shell / Hub lavender */
const MEMBER_ACCENT = '#e879f9'

type SpaceWithName = {
  id: string
  name: string
  status?: string
  description?: string
  memberCount?: number
}

type NodeProfile = {
  spacesWithNames?: SpaceWithName[]
}

function SpaceCard({
  space,
  isMember,
}: {
  space: SpaceWithName
  isMember: boolean
}) {
  const dormant = space.status === 'dormant'
  const desc = space.description?.trim()

  return (
    <Link
      to={`/spaces/${encodeURIComponent(space.id)}`}
      className={`etch-card-hover-border group flex min-h-[280px] flex-col overflow-hidden rounded-sm border border-white/12 bg-black/35 transition hover:border-white/26 ${
        dormant ? 'saturate-[0.72] opacity-[0.92]' : ''
      }`}
      style={
        isMember
          ? { borderLeftWidth: 3, borderLeftColor: `${MEMBER_ACCENT}aa`, borderLeftStyle: 'solid' }
          : undefined
      }
    >
      <div className="relative min-h-[168px] flex-[3] w-full overflow-hidden bg-neutral-950/60">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <GenerativeAvatar
            seed={space.id}
            size={320}
            monochrome={false}
            luminescent
            className="opacity-95 transition group-hover:opacity-100"
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-[2] flex-col gap-1.5 bg-black/82 px-3 py-3">
        <h2 className="m-0 font-mono text-md font-medium uppercase tracking-[0.12em] leading-snug text-white/92 line-clamp-2">
          {space.name}
        </h2>

        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em]">
          <span
            className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
              dormant ? 'bg-amber-300/90' : 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.45)]'
            }`}
            aria-hidden
          />
          <span className={dormant ? 'text-amber-200/85' : 'text-emerald-300/90'}>
            {dormant ? 'Dormant' : 'Active'}
          </span>
        </div>

        <p className="m-0 font-mono text-xs text-white/42">
          {typeof space.memberCount === 'number' ? `${space.memberCount} member${space.memberCount === 1 ? '' : 's'}` : '—'}
        </p>

        {desc ? (
          <p className="m-0 line-clamp-2 font-mono text-base italic leading-relaxed text-white/38">{desc}</p>
        ) : null}

        <p className="mt-auto pt-1 font-mono text-xs uppercase tracking-[0.2em] text-white/38 transition group-hover:text-white/55">
          Open →
        </p>
      </div>
    </Link>
  )
}

export default function SpacesPage() {
  const [spaces, setSpaces] = useState<SpaceWithName[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const alias = getAlias()
        const me = await api<NodeProfile>('/nodes/' + encodeURIComponent(alias))
        if (!cancelled) setSpaces(me.spacesWithNames ?? [])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load spaces')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <AppShell title="Spaces">
      <div className="flex w-full min-h-0 flex-1 flex-col gap-0 pb-4">
        {error ? (
          <p className="mb-4 border border-white/15 bg-black/40 px-3 py-2 text-small font-mono text-white" role="alert">
            {error}
          </p>
        ) : null}

        <header className="flex w-full flex-wrap items-start justify-between gap-4">
          <h1 className="m-0 font-mono text-[clamp(1.5rem,4vw,2.25rem)] font-semibold uppercase tracking-[0.08em] text-white">
            Spaces
          </h1>
          <nav className="flex flex-wrap items-center justify-end gap-2 font-mono text-base uppercase tracking-[0.16em]">
            <Link
              to="/spaces/new"
              className="border border-white/22 bg-black/30 px-3 py-2 text-white/88 transition hover:border-white/45 hover:text-white"
            >
              + Create
            </Link>
            <Link
              to="/spaces/join"
              className="border border-white/22 bg-black/30 px-3 py-2 text-white/88 transition hover:border-white/45 hover:text-white"
            >
              + Join
            </Link>
            <Link
              to="/spaces/search"
              className="border border-white/22 bg-black/30 px-3 py-2 text-white/88 transition hover:border-white/45 hover:text-white"
            >
              Search
            </Link>
          </nav>
        </header>

        <div className="mt-4 h-px w-full bg-white/14" aria-hidden />

        {spaces.length === 0 ? (
          <div className="flex flex-1 flex-col py-12">
            <div className="max-w-xl space-y-5 text-left">
              <p className="m-0 font-mono text-small leading-relaxed text-white/45">
                spaces are studios, classes, or collectives. projects live inside spaces. you need to be in a
                space to start documenting work.
              </p>
              <div className="flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-[0.12em]">
                <Link
                  to="/spaces/join"
                  className="etch-outlined-press inline-flex border border-[#333333] bg-black/25 px-3 py-1.5 text-white/88 transition hover:border-white/40 hover:bg-white/[0.05] hover:text-white"
                >
                  + join a space
                </Link>
                <Link
                  to="/spaces/new"
                  className="etch-outlined-press inline-flex border border-[#333333] bg-black/25 px-3 py-1.5 text-white/88 transition hover:border-white/40 hover:bg-white/[0.05] hover:text-white"
                >
                  + create a space
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <ul className="mt-8 grid list-none grid-cols-1 gap-5 p-0 md:grid-cols-2 lg:grid-cols-3">
            {spaces.map((s) => (
              <li key={s.id} className="min-w-0">
                <SpaceCard space={s} isMember />
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  )
}
