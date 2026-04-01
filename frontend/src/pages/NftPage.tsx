import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { api } from '../lib/api'

type NftBundle = {
  nft: {
    _id: string
    title?: string
    medium?: string
  }
  project: { _id: string }
  archive: unknown
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
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load NFT')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  return (
    <AppShell title="Provenance">
      <div className="space-y-4">
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
          <>
            <h2 className="text-h3 font-mono">{bundle.nft.title || 'NFT'}</h2>
            {bundle.archive ? (
              <span className="inline-block border border-black bg-grey-100 px-2 py-1 text-[11px] font-mono uppercase">
                Archive
              </span>
            ) : null}
            <div className="border border-black bg-white px-3 py-2 text-small font-mono">
              <p>Medium: {bundle.nft.medium || '—'}</p>
              <p className="mt-2 break-all">
                Project:{' '}
                <Link to={`/projects/${encodeURIComponent(bundle.project._id)}`} className="underline">
                  {bundle.project._id}
                </Link>
              </p>
            </div>
          </>
        ) : !error ? (
          <p className="text-small font-mono text-grey-400">Loading…</p>
        ) : null}
      </div>
    </AppShell>
  )
}
