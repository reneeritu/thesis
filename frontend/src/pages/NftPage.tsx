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
      <div className="aspect-square border border-dashed border-black bg-grey-100 flex items-center justify-center text-center p-6">
        <p className="text-small font-mono text-white max-w-[30ch]">
          No artwork yet — use the generator below to create one.
        </p>
      </div>
    )
  }

  if (artwork.type === 'generated' && artwork.svg) {
    return (
      <div
        className="aspect-square overflow-hidden border border-white/25 bg-zinc-900/55"
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
        <div className="border border-black bg-black">
          <video src={src} controls className="block w-full" />
        </div>
      )
    }
    return (
      <div className="border border-white/25 bg-zinc-900/55">
        <img
          src={src}
          alt={`Artwork for certificate ${nftId}`}
          className="block w-full h-auto"
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
            <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,0.78fr)]">
              {/* Artwork */}
              <div className="space-y-2">
                <ArtworkDisplay nftId={bundle.nft._id} artwork={bundle.nft.artwork} />
                {bundle.nft.artwork?.updatedBy ? (
                  <p className="font-mono text-[10px] text-white uppercase tracking-[0.12em]">
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
                    className="border border-white/25 bg-zinc-900/55 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] w-full hover:bg-black hover:text-yellow-400 transition"
                  >
                    {editorOpen
                      ? 'Close editor'
                      : hasArtwork
                      ? 'Replace artwork'
                      : 'Generate / attach artwork'}
                  </button>
                ) : (
                  !hasArtwork && (
                    <p className="font-mono text-[10px] text-white">
                      {meAlias
                        ? 'Only accepted primary contributors can attach artwork.'
                        : 'Log in as a primary contributor to attach artwork.'}
                    </p>
                  )
                )}
              </div>

              {/* Certificate metadata */}
              <div className="space-y-3">
                <h2 className="text-h3 font-heading">
                  {bundle.nft.title || 'Certificate'}
                </h2>
                {bundle.archive ? (
                  <span className="inline-block border border-black bg-grey-100 px-2 py-1 text-[11px] font-mono uppercase">
                    Archive
                  </span>
                ) : null}
                <div className="border border-white/25 bg-zinc-900/55 px-3 py-2 text-small font-mono space-y-1">
                  <p>Medium: {bundle.nft.medium || '—'}</p>
                  <p className="break-all">
                    Project:{' '}
                    <Link
                      to={`/projects/${encodeURIComponent(bundle.project._id)}`}
                      className="underline"
                    >
                      {bundle.project.title || bundle.project._id}
                    </Link>
                  </p>
                  {counts.traceCount > 0 || counts.pivotCount > 0 ? (
                    <p className="text-white">
                      {counts.traceCount} trace{counts.traceCount !== 1 ? 's' : ''}
                      {counts.pivotCount > 0 ? ` · ${counts.pivotCount} pivot${counts.pivotCount !== 1 ? 's' : ''}` : ''}
                      {counts.referenceCount > 0 ? ` · ${counts.referenceCount} ref${counts.referenceCount !== 1 ? 's' : ''}` : ''}
                    </p>
                  ) : null}
                </div>

                {/* Contributors */}
                {contributors.length > 0 ? (
                  <div className="border border-white/25 bg-zinc-900/55 px-3 py-2 space-y-1">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white">
                      Contributors
                    </p>
                    <ul className="space-y-0.5">
                      {contributors.map((c) => (
                        <li key={c.alias} className="flex items-center gap-2 font-mono text-[12px]">
                          <Link to={`/nodes/${encodeURIComponent(c.alias)}`} className="underline">
                            {c.alias}
                          </Link>
                          {c.isPrimary ? (
                            <span className="border border-black px-1 py-[1px] text-[9px] uppercase tracking-[0.14em]">
                              primary
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>

            {/* ── Inline artwork editor (primaries only, togglable) ── */}
            {amPrimary && editorOpen && genInput ? (
              <div className="border-t border-grey-200 pt-6">
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
