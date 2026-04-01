import { useState, useEffect, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { Button } from '../Button'

type Contributor = { alias: string; role?: string; isPrimary?: boolean }

type NftBundle = {
  nft: { _id: string; title?: string }
  contributorTokens?: unknown[]
}

type Props = {
  projectId: string
  contributors: Contributor[]
  onDone: () => void
}

export function CreditForm({ projectId, contributors, onDone }: Props) {
  const [weights, setWeights] = useState<Record<string, string>>({})
  const [medium, setMedium] = useState('')
  const [offChain, setOffChain] = useState('')
  const [dispute, setDispute] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [existingNft, setExistingNft] = useState<NftBundle | null>(null)
  const [signAccepted, setSignAccepted] = useState(false)
  const [signBusy, setSignBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    api<NftBundle>('/credits/project/' + encodeURIComponent(projectId))
      .then((b) => { if (!cancelled) setExistingNft(b) })
      .catch(() => { /* no existing credit */ })
    return () => { cancelled = true }
  }, [projectId])

  function setWeight(alias: string, val: string) {
    setWeights((prev) => ({ ...prev, [alias]: val }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const contribs = contributors.map((c) => {
        const w = weights[c.alias]
        const o: Record<string, unknown> = { alias: c.alias, role: c.role }
        if (w !== undefined && w !== '') o.weight = Number(w)
        return o
      })
      const body: Record<string, unknown> = {
        projectId,
        contributors: contribs,
        disputeFlag: dispute,
      }
      if (medium.trim()) body.medium = medium.trim()
      if (offChain.trim()) {
        try {
          body.offChainContributors = JSON.parse(offChain)
        } catch {
          setError('Off-chain JSON invalid')
          setBusy(false)
          return
        }
      }
      await api('/credits', { method: 'POST', body })
      setResult('Credit initiated.')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  async function onSign(e: FormEvent) {
    e.preventDefault()
    if (!existingNft) return
    setSignBusy(true)
    setError(null)
    try {
      await api('/credits/' + encodeURIComponent(existingNft.nft._id) + '/sign', {
        method: 'POST',
        body: { accepted: signAccepted },
      })
      setResult('Signature recorded.')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSignBusy(false)
    }
  }

  return (
    <div className="border border-black bg-white p-4 space-y-4">
      <h3 className="text-small font-mono uppercase tracking-[0.18em]">Credit Split / End Project</h3>

      {existingNft && (
        <div className="border border-black bg-grey-100 p-3 space-y-2">
          <p className="text-small font-mono">Existing credit found. NFT: {existingNft.nft._id}</p>
          <Link
            to={`/nfts/${encodeURIComponent(existingNft.nft._id)}`}
            className="text-small font-mono underline underline-offset-4"
          >
            View Provenance Record
          </Link>
          <form onSubmit={onSign} className="space-y-2 pt-2">
            <label className="flex items-center gap-2 font-mono text-small">
              <input type="checkbox" checked={signAccepted} onChange={(e) => setSignAccepted(e.target.checked)} />
              I accept this credit split
            </label>
            <Button type="submit" variant="primary" loading={signBusy}>Sign</Button>
          </form>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-3 text-small">
        <table className="w-full text-small font-mono">
          <thead>
            <tr className="text-left text-grey-400 uppercase tracking-[0.18em]">
              <th className="pb-1">Alias</th>
              <th className="pb-1">Role</th>
              <th className="pb-1">Weight</th>
            </tr>
          </thead>
          <tbody>
            {contributors.map((c) => (
              <tr key={c.alias} className="border-t border-grey-200">
                <td className="py-1">{c.alias}</td>
                <td className="py-1">{c.role || ''}</td>
                <td className="py-1">
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={1}
                    placeholder="equal"
                    value={weights[c.alias] ?? ''}
                    onChange={(e) => setWeight(c.alias, e.target.value)}
                    className="w-20 border border-black bg-white px-2 py-1 font-mono text-small"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[11px] text-grey-400">Leave weights blank for equal split. Weights must sum to 1.0 if specified.</p>

        <div>
          <label className="block font-mono uppercase tracking-[0.18em] text-grey-400 mb-1">Medium (optional)</label>
          <input
            value={medium}
            onChange={(e) => setMedium(e.target.value)}
            className="w-full border border-black bg-white px-3 py-2 font-sans text-body"
          />
        </div>

        <details className="text-small">
          <summary className="cursor-pointer font-mono uppercase tracking-[0.18em] text-grey-400">Off-chain contributors</summary>
          <textarea
            value={offChain}
            onChange={(e) => setOffChain(e.target.value)}
            placeholder='[{"name":"x","portfolio":"","role":""}]'
            rows={3}
            className="mt-2 w-full border border-black bg-white px-3 py-2 font-mono text-small"
          />
        </details>

        <label className="flex items-center gap-2 font-mono text-small">
          <input type="checkbox" checked={dispute} onChange={(e) => setDispute(e.target.checked)} />
          Flag as disputed
        </label>

        {error && <p className="border border-black bg-grey-100 px-3 py-2 font-mono" role="alert">{error}</p>}
        {result ? (
          <div className="border border-black bg-white px-3 py-2 font-mono space-y-2">
            <p>{result}</p>
            <Link
              to={`/governance?category=dispute&type=credit_dispute&targetType=project&targetId=${encodeURIComponent(projectId)}`}
              className="underline underline-offset-4"
            >
              Raise dispute flag for this project
            </Link>
          </div>
        ) : null}

        <Button type="submit" variant="primary" loading={busy}>Initiate Credit</Button>
      </form>
    </div>
  )
}
