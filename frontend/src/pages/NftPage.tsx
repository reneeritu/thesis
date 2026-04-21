import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { DefTerm } from '../components/DefTerm'
import { api } from '../lib/api'

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

type NftBundle = {
  nft: {
    _id: string
    title?: string
    medium?: string
    artwork?: Artwork | null
  }
  project: { _id: string }
  archive: unknown
}

function ArtworkPanel({
  nftId,
  artwork,
  projectId,
}: {
  nftId: string
  artwork?: Artwork | null
  /** Lets us link straight to the project where the editor lives (not on this page). */
  projectId?: string
}) {
  if (!artwork || !artwork.type || artwork.type === 'none') {
    return (
      <div className="aspect-square border border-dashed border-black bg-grey-100 flex flex-col items-center justify-center text-center gap-3 p-6">
        <p className="text-small font-mono text-grey-400 max-w-[38ch] leading-relaxed">
          No artwork attached yet. The editor is not on this page — open the linked project, use End Project →
          Certificate artwork after credit is initiated. You must be a logged-in, accepted primary contributor;
          otherwise ask a primary to attach artwork from that same flow.
        </p>
        {projectId ? (
          <Link
            to={`/projects/${encodeURIComponent(projectId)}`}
            className="border border-black bg-white px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] hover:bg-black hover:text-yellow-400 transition"
          >
            Open project
          </Link>
        ) : null}
      </div>
    )
  }

  if (artwork.type === 'generated' && artwork.svg) {
    return (
      <div
        className="aspect-square overflow-hidden border border-black bg-white"
        // trusted: server re-sanitises every SVG via the strict allowlist before storing.
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
      <div className="border border-black bg-white">
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

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) return
      try {
        const b = await api<NftBundle>('/nfts/' + encodeURIComponent(id))
        if (!cancelled) setBundle(b)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load certificate')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  return (
    <AppShell title="Provenance certificate">
      <div className="space-y-4">
        <p className="text-small text-grey-600 max-w-xl">
          A <DefTerm term="provenance_certificate">provenance certificate</DefTerm> is the
          art piece minted at the end of a project — it proves who made what, when, with
          what evidence.
        </p>
        {error ? (
          <p className="border border-black bg-grey-100 px-3 py-2 text-small font-mono text-black" role="alert">
            {error}{' '}
            <Link to="/login" className="underline">
              Log in
            </Link>{' '}
            if required.
          </p>
        ) : null}
        {bundle ? (
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 items-start">
            <div>
              <ArtworkPanel nftId={bundle.nft._id} artwork={bundle.nft.artwork} projectId={bundle.project._id} />
            </div>
            <div className="space-y-3">
              <h2 className="text-h3 font-mono">{bundle.nft.title || 'Certificate'}</h2>
              {bundle.archive ? (
                <span className="inline-block border border-black bg-grey-100 px-2 py-1 text-[11px] font-mono uppercase">
                  Archive
                </span>
              ) : null}
              <div className="border border-black bg-white px-3 py-2 text-small font-mono space-y-1">
                <p>Medium: {bundle.nft.medium || '—'}</p>
                <p className="break-all">
                  Project:{' '}
                  <Link
                    to={`/projects/${encodeURIComponent(bundle.project._id)}`}
                    className="underline"
                  >
                    {bundle.project._id}
                  </Link>
                </p>
                {bundle.nft.artwork && bundle.nft.artwork.type !== 'none' ? (
                  <p className="text-[11px] text-grey-400">
                    Artwork: {bundle.nft.artwork.type}
                    {bundle.nft.artwork.updatedBy ? ` · by ${bundle.nft.artwork.updatedBy}` : ''}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : !error ? (
          <p className="text-small font-mono text-grey-400">Loading…</p>
        ) : null}
      </div>
    </AppShell>
  )
}
