import { useState, useEffect, type CSSProperties, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { CertificateArtEditor } from '../CertificateArtEditor'
import type { GenInput } from '../../lib/provenanceArt'

type Contributor = { alias: string; role?: string; isPrimary?: boolean }

type NftBundle = {
  nft: { _id: string; title?: string; artwork?: { type?: string } | null }
  contributorTokens?: unknown[]
}

type Props = {
  projectId: string
  contributors: Contributor[]
  onDone: () => void
  /** Project facts used to drive the generative artwork engine. */
  genInput?: GenInput
  /** True when the logged-in user is a primary contributor. Controls whether the artwork editor shows. */
  isPrimary?: boolean
  /** Notify parent layout when the certificate art editor becomes visible. */
  onArtEditorOpen?: () => void
  /** Notify parent layout when the certificate art editor is hidden. */
  onArtEditorClose?: () => void
}

/* ─── Shared styling atoms ───────────────────────────────────────────── */

const sectionLabel =
  'font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-ghost)]'

const inputClass =
  'w-full border border-[var(--border)] bg-transparent px-3 py-2 font-mono text-[12px] text-[var(--text-primary)] outline-none transition focus:border-[var(--text-primary)]'

const outlinedBtn =
  'cursor-target font-mono text-[12px] uppercase tracking-[0.22em] transition border border-[var(--text-primary)] bg-transparent text-[var(--text-primary)] px-4 py-2 hover:bg-[var(--text-primary)] hover:text-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-40'

const PANEL_SHELL: CSSProperties = {
  height: 'min(820px, calc(100vh - 160px))',
  minHeight: '560px',
}

export function CreditForm({
  projectId,
  contributors,
  onDone,
  genInput,
  isPrimary,
  onArtEditorOpen,
  onArtEditorClose,
}: Props) {
  const [weights, setWeights] = useState<Record<string, string>>({})
  const [medium, setMedium] = useState('')
  const [offChain, setOffChain] = useState('')
  const [offChainOpen, setOffChainOpen] = useState(false)
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

  const editorOpen = Boolean(existingNft && isPrimary && genInput)

  useEffect(() => {
    if (editorOpen) onArtEditorOpen?.()
    else onArtEditorClose?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorOpen])

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
      try {
        const b = await api<NftBundle>('/credits/project/' + encodeURIComponent(projectId))
        setExistingNft(b)
      } catch {
        /* bundle may lag briefly; parent reload still refreshes project */
      }
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
    <div className="flex w-full flex-col gap-4">
      <div
        className="flex w-full flex-col overflow-hidden border border-[var(--border)] bg-zinc-900/45"
        style={PANEL_SHELL}
      >
        {/* ─── Region 1 — header (no existing) / sign card (existing) ─── */}
        {existingNft ? (
          <form
            onSubmit={onSign}
            className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--border)]"
            style={{ padding: '16px 24px', maxHeight: 200 }}
          >
            <div className="min-w-0">
              <p className={`${sectionLabel} mb-1`}>Provenance certificate</p>
              <p className="m-0 break-all font-mono text-[12px] text-[var(--text-primary)]">
                {existingNft.nft._id}{' '}
                <Link
                  to={`/nfts/${encodeURIComponent(existingNft.nft._id)}`}
                  className="ml-1 underline decoration-[var(--border)] underline-offset-2 hover:text-[var(--text-primary)]"
                >
                  view →
                </Link>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex cursor-target items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                <input
                  type="checkbox"
                  checked={signAccepted}
                  onChange={(e) => setSignAccepted(e.target.checked)}
                  className="accent-current"
                />
                I accept this split
              </label>
              <button type="submit" disabled={signBusy} className={outlinedBtn}>
                {signBusy ? '…' : 'Sign'}
              </button>
            </div>
          </form>
        ) : (
          <div
            className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)]"
            style={{ padding: '12px 24px', maxHeight: 48 }}
          >
            <p className={`${sectionLabel} m-0`}>Credit split</p>
            <p className="m-0 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--text-ghost)]">
              {contributors.length} contributors · leave blank for equal split
            </p>
          </div>
        )}

        {/* ─── Body: table (left) + design column (right) ─── */}
        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 overflow-hidden"
        >
          {/* Left — ALIAS / ROLE / WEIGHT table + off-chain */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <table className="w-full border-collapse font-mono text-[11px]">
                <thead className="sticky top-0 bg-zinc-900/80 backdrop-blur">
                  <tr className="text-left uppercase tracking-[0.14em] text-[var(--text-ghost)]">
                    <th className="px-4 py-2 font-normal">Alias</th>
                    <th className="px-4 py-2 font-normal">Role</th>
                    <th className="px-4 py-2 text-right font-normal">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {contributors.map((c) => (
                    <tr key={c.alias} className="border-t border-[var(--border)]">
                      <td className="px-4 py-2 text-[var(--text-primary)]">{c.alias}</td>
                      <td className="px-4 py-2 text-[var(--text-muted)]">{c.role || '—'}</td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          max={1}
                          placeholder="equal"
                          value={weights[c.alias] ?? ''}
                          onChange={(e) => setWeight(c.alias, e.target.value)}
                          className="w-[60px] border border-[var(--border)] bg-transparent px-2 py-1 text-right font-mono text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* OFF-CHAIN CONTRIBUTORS — inside scrollable area */}
              <div
                className="border-t border-[var(--border)]"
                style={{ padding: '12px 16px' }}
              >
                <button
                  type="button"
                  onClick={() => setOffChainOpen((v) => !v)}
                  className={`${sectionLabel} cursor-target hover:text-[var(--text-primary)]`}
                >
                  Off-chain contributors {offChainOpen ? '▾' : '▸'}
                </button>
                {offChainOpen ? (
                  <textarea
                    value={offChain}
                    onChange={(e) => setOffChain(e.target.value)}
                    placeholder='[{"name":"x","portfolio":"","role":""}]'
                    rows={3}
                    className={`${inputClass} mt-2 resize-none`}
                    style={{ maxHeight: 80 }}
                  />
                ) : null}
              </div>
            </div>
          </div>

          {/* Right — design, dispute, initiate */}
          <aside
            className="flex shrink-0 flex-col gap-3 overflow-hidden border-l border-[var(--border)]"
            style={{ width: 280, padding: 16 }}
          >
            <div>
              <p className={`${sectionLabel} mb-2`}>Medium (optional)</p>
              <input
                value={medium}
                onChange={(e) => setMedium(e.target.value)}
                className={inputClass}
                placeholder="e.g. mixed media"
              />
            </div>

            <label className="flex cursor-target items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
              <input
                type="checkbox"
                checked={dispute}
                onChange={(e) => setDispute(e.target.checked)}
                className="accent-current"
              />
              Flag as disputed
            </label>

            {error ? (
              <p
                className="m-0 font-mono text-[10.5px] text-[var(--accent-red,#ef4444)]"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            {result ? (
              <div className="flex flex-col gap-1 font-mono text-[10.5px] text-[var(--text-muted)]">
                <p className="m-0 uppercase tracking-[0.14em]">{result}</p>
                <Link
                  to={`/governance?category=dispute&type=credit_dispute&targetType=project&targetId=${encodeURIComponent(projectId)}`}
                  className="underline decoration-[var(--border)] underline-offset-2 hover:text-[var(--text-primary)]"
                >
                  Raise dispute flag
                </Link>
              </div>
            ) : null}

            <div className="mt-auto">
              <button
                type="submit"
                disabled={busy}
                className={`${outlinedBtn} w-full`}
              >
                {busy ? '…' : existingNft ? 'Re-initiate credit' : 'Initiate credit'}
              </button>
            </div>
          </aside>
        </form>
      </div>

      {/* ─── Embedded artwork editor (primaries only) ─── */}
      {isPrimary && genInput && existingNft ? (
        <CertificateArtEditor
          nftId={existingNft.nft._id}
          input={genInput}
          onSaved={onDone}
        />
      ) : null}
    </div>
  )
}
