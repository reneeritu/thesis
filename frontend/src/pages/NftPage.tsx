import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { DefTerm } from '../components/DefTerm'
import { CertificateArtEditor } from '../components/CertificateArtEditor'
import { api } from '../lib/api'
import { getAlias } from '../lib/session'
import type { GenInput } from '../lib/provenanceArt'

type Artwork = {
  type?: 'none' | 'generated' | 'uploaded'
  svg?: string | null
  mediaId?: string | null
  mimeType?: string | null
  width?: number | null
  height?: number | null
  updatedAt?: string | null
  updatedBy?: string | null
}

type Contributor = {
  alias: string
  isPrimary?: boolean
  accepted?: boolean | null
}

type Project = {
  _id: string
  title?: string
  contributors?: Contributor[]
}

type NftBundle = {
  nft: {
    _id: string
    title?: string
    medium?: string
    artwork?: Artwork | null
  }
  project: Project
  archive: unknown
  counts?: { traceCount: number; pivotCount: number; referenceCount: number }
}

function ArtworkDisplay({
  nftId,
  artwork,
}: {
  nftId: string
  artwork?: Artwork | null
}) {
  if (!artwork || !artwork.type || artwork.type === 'none') {
    return (
      <div className="flex aspect-square items-center justify-center border border-dashed border-[var(--border)] bg-black/35 p-6 text-center">
        <p className="m-0 max-w-[30ch] font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-ghost)]">
          No artwork yet — use the generator below to create one.
        </p>
      </div>
    )
  }

  if (artwork.type === 'generated' && artwork.svg) {
    return (
      <div
        className="aspect-square overflow-hidden border border-[var(--border)] bg-black/40"
        // trusted: server re-sanitises every SVG via the strict allowlist before storing
        dangerouslySetInnerHTML={{ __html: artwork.svg }}
      />
    )
  }

  if (artwork.type === 'uploaded' && artwork.mediaId) {
    const mime = artwork.mimeType || ''
    const src = `/media/${encodeURIComponent(artwork.mediaId)}`
    if (mime.startsWith('video/')) {
      return (
        <div className="border border-[var(--border)] bg-black">
          <video src={src} controls className="block w-full" />
        </div>
      )
    }
    return (
      <div className="border border-[var(--border)] bg-black/40">
        <img
          src={src}
          alt={`Artwork for certificate ${nftId}`}
          className="block h-auto w-full"
        />
      </div>
    )
  }

  return null
}

export default function NftPage() {
  const { id } = useParams<{ id: string }>()
  const [bundle, setBundle] = useState<NftBundle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)

  const load = useCallback(async (cancelled: { v: boolean }) => {
    if (!id) return
    try {
      const b = await api<NftBundle>('/nfts/' + encodeURIComponent(id))
      if (!cancelled.v) setBundle(b)
    } catch (e) {
      if (!cancelled.v) setError(e instanceof Error ? e.message : 'Failed to load certificate')
    }
  }, [id])

  useEffect(() => {
    const c = { v: false }
    load(c)
    return () => { c.v = true }
  }, [load])

  const meAlias = getAlias()
  const contributors = bundle?.project?.contributors ?? []
  const myContrib = contributors.find((c) => c.alias === meAlias)
  const amPrimary = Boolean(myContrib?.isPrimary && myContrib?.accepted === true)

  const counts = bundle?.counts ?? { traceCount: 0, pivotCount: 0, referenceCount: 0 }

  const genInput: GenInput | null = bundle
    ? {
        projectId: bundle.project._id,
        title: bundle.project.title ?? bundle.nft.title ?? '',
        contributors: contributors.map((c) => ({ alias: c.alias })),
        traceCount: counts.traceCount,
        pivotCount: counts.pivotCount,
        referenceCount: counts.referenceCount,
      }
    : null

  const hasArtwork =
    bundle?.nft.artwork &&
    bundle.nft.artwork.type &&
    bundle.nft.artwork.type !== 'none'

  return (
    <AppShell title="Provenance certificate">
      <div className="space-y-6">
        <p className="text-small text-white max-w-xl">
          A{' '}
          <DefTerm term="provenance_certificate">provenance certificate</DefTerm> is the
          art piece minted at the end of a project — it proves who made what, when, with
          what evidence.
        </p>

        {error ? (
          <p className="border border-black bg-grey-100 px-3 py-2 text-small font-mono text-white" role="alert">
            {error}{' '}
            <Link to="/login" className="underline">
              Log in
            </Link>{' '}
            if required.
          </p>
        ) : null}

        {bundle ? (
          <div className="space-y-6">
            {/* ── Main layout: artwork + meta ── */}
            <div className="grid grid-cols-1 items-start gap-6">
              {/* Artwork */}
              <div className="space-y-2">
                <ArtworkDisplay nftId={bundle.nft._id} artwork={bundle.nft.artwork} />
                {bundle.nft.artwork?.updatedBy ? (
                  <p className="font-mono text-small text-white uppercase tracking-[0.12em]">
                    {bundle.nft.artwork.type} · by {bundle.nft.artwork.updatedBy}
                    {bundle.nft.artwork.updatedAt
                      ? ' · ' +
                        new Date(bundle.nft.artwork.updatedAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : null}
                  </p>
                ) : null}

                {/* Editor toggle — only for accepted primaries */}
                {amPrimary ? (
                  <button
                    type="button"
                    onClick={() => setEditorOpen((v) => !v)}
                    className="w-full cursor-target border border-[var(--text-primary)] bg-transparent px-3 py-2 font-mono text-[12px] uppercase tracking-[0.22em] text-[var(--text-primary)] transition hover:bg-[var(--text-primary)] hover:text-[var(--bg)]"
                  >
                    {editorOpen
                      ? 'Close editor'
                      : hasArtwork
                      ? 'Replace artwork'
                      : 'Generate / attach artwork'}
                  </button>
                ) : (
                  !hasArtwork && (
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-ghost)]">
                      {meAlias
                        ? 'Only accepted primary contributors can attach artwork.'
                        : 'Log in as a primary contributor to attach artwork.'}
                    </p>
                  )
                )}
              </div>

              {/* Certificate metadata */}
              <div className="border border-[var(--border)] bg-zinc-900/45">
                {/* Header — padding 20px 24px, border-bottom */}
                <div
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)]"
                  style={{ padding: '20px 24px' }}
                >
                  <h2 className="m-0 font-mono text-[16px] uppercase tracking-[0.2em] text-[var(--text-primary)]">
                    {bundle.nft.title || 'Certificate'}
                  </h2>
                  {bundle.archive ? (
                    <span className="border border-[var(--border)] px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      Archive
                    </span>
                  ) : null}
                </div>

                {/* Body */}
                <div className="space-y-3 px-6 py-4 font-mono text-[12px] text-[var(--text-muted)]">
                  <p className="m-0">
                    <span className="text-[var(--text-ghost)]">Medium · </span>
                    {bundle.nft.medium || '—'}
                  </p>
                  <p className="m-0 break-all">
                    <span className="text-[var(--text-ghost)]">Project · </span>
                    <Link
                      to={`/projects/${encodeURIComponent(bundle.project._id)}`}
                      className="text-[var(--text-primary)] underline decoration-[var(--border)] underline-offset-2 hover:decoration-[var(--text-primary)]"
                    >
                      {bundle.project.title || bundle.project._id}
                    </Link>
                  </p>
                  {counts.traceCount > 0 || counts.pivotCount > 0 ? (
                    <p className="m-0">
                      <span className="text-[var(--text-ghost)]">Activity · </span>
                      {counts.traceCount} trace{counts.traceCount !== 1 ? 's' : ''}
                      {counts.pivotCount > 0 ? ` · ${counts.pivotCount} pivot${counts.pivotCount !== 1 ? 's' : ''}` : ''}
                      {counts.referenceCount > 0 ? ` · ${counts.referenceCount} ref${counts.referenceCount !== 1 ? 's' : ''}` : ''}
                    </p>
                  ) : null}
                </div>

                {/* Contributors — compact rows */}
                {contributors.length > 0 ? (
                  <div className="border-t border-[var(--border)] px-6 py-4">
                    <p className="m-0 mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-ghost)]">
                      Contributors
                    </p>
                    <ul className="m-0 list-none p-0">
                      {contributors.map((c) => (
                        <li
                          key={c.alias}
                          className="flex items-center justify-between gap-2 border-b border-[var(--border)] font-mono text-[12px] last:border-b-0"
                          style={{ padding: '10px 0' }}
                        >
                          <Link
                            to={`/nodes/${encodeURIComponent(c.alias)}`}
                            className="lowercase text-[var(--text-primary)] underline decoration-[var(--border)] underline-offset-2 hover:decoration-[var(--text-primary)]"
                          >
                            {c.alias.toLowerCase()}
                          </Link>
                          {c.isPrimary ? (
                            <span className="border border-[var(--border)] px-1.5 py-px font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                              primary
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {/* Chain hash footer — truncate with ellipsis */}
                <div
                  className="border-t border-[var(--border)] px-6 py-3"
                  title={bundle.nft._id}
                >
                  <p className="m-0 mb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-ghost)]">
                    Chain hash
                  </p>
                  <p
                    className="m-0 overflow-hidden font-mono text-[11px] text-[var(--text-ghost)]"
                    style={{
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {bundle.nft._id}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Inline artwork editor (primaries only, togglable) ── */}
            {amPrimary && editorOpen && genInput ? (
              <div className="border-t border-grey-200 pt-6 max-w-full overflow-hidden">
                <CertificateArtEditor
                  nftId={bundle.nft._id}
                  input={genInput}
                  onSaved={() => {
                    setEditorOpen(false)
                    const c = { v: false }
                    load(c)
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : !error ? (
          <p className="text-small font-mono text-white">Loading…</p>
        ) : null}
      </div>
    </AppShell>
  )
}
