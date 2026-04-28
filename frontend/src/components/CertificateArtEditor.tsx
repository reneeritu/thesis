/**
 * Editor for attaching artwork to a provenance certificate.
 *
 * Two modes:
 *   - Auto-generate (default): drive the built-in engine with 6 knobs + reroll.
 *   - Upload your own: pick a file from disk (PNG/JPEG/WebP/GIF/SVG/MP4/WebM).
 *
 * When the user clicks Save, we either:
 *   - POST the generated SVG + params JSON to /nfts/:id/artwork, or
 *   - POST the file to /upload/cert-artwork, then PUT the mediaId to /nfts/:id/artwork.
 */

import { useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'
import { uploadCertArtwork } from '../lib/upload'
import { Button } from './Button'
import { CertificateArt, CertificateCustomiser } from './CertificateArt'
import {
  DEFAULT_OPTIONS,
  RENDERER_VERSION,
  renderSvg,
  type GenInput,
  type GenOptions,
} from '../lib/provenanceArt'

const ACCEPT =
  'image/png,image/jpeg,image/webp,image/gif,image/svg+xml,video/mp4,video/webm'

type Tab = 'generate' | 'upload'

type Props = {
  nftId: string
  input: GenInput
  onSaved?: () => void
}

export function CertificateArtEditor({ nftId, input, onSaved }: Props) {
  const [tab, setTab] = useState<Tab>('generate')
  const [options, setOptions] = useState<GenOptions>(DEFAULT_OPTIONS)
  const [rerollsUsed, setRerollsUsed] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const generatedSvg = useMemo(() => renderSvg(input, options), [input, options])

  function onReroll() {
    setOptions((o) => ({ ...o, rerollIndex: o.rerollIndex + 1 }))
    setRerollsUsed((n) => n + 1)
  }

  function onPickFile(f: File | null) {
    setFile(f)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(f ? URL.createObjectURL(f) : null)
  }

  async function onSaveGenerated() {
    setBusy(true)
    setError(null)
    setSaved(null)
    try {
      const paramsJson = JSON.stringify({
        version: RENDERER_VERSION,
        input,
        options,
      })
      await api(`/nfts/${encodeURIComponent(nftId)}/artwork`, {
        method: 'PUT',
        body: {
          type: 'generated',
          svg: generatedSvg,
          paramsJson,
          rendererVersion: RENDERER_VERSION,
        },
      })
      setSaved('Generated artwork saved to certificate.')
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save artwork')
    } finally {
      setBusy(false)
    }
  }

  async function onSaveUploaded() {
    if (!file) {
      setError('Pick a file first')
      return
    }
    setBusy(true)
    setError(null)
    setSaved(null)
    try {
      const up = await uploadCertArtwork(nftId, file)
      await api(`/nfts/${encodeURIComponent(nftId)}/artwork`, {
        method: 'PUT',
        body: { type: 'uploaded', mediaId: up.mediaId },
      })
      setSaved('Uploaded artwork saved to certificate.')
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to upload artwork')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border border-white/25 bg-zinc-900/55 p-4 space-y-4">
      <div className="space-y-1">
        <h3 className="text-small font-heading uppercase tracking-[0.18em]">
          Certificate artwork
        </h3>
        <p className="text-small text-white">
          The piece minted with this project's credit. Auto-generated from project
          facts by default — or upload your own if you already made one.
        </p>
      </div>

      <div className="flex border border-black">
        <button
          type="button"
          onClick={() => setTab('generate')}
          className={`flex-1 px-3 py-2 font-mono text-small uppercase tracking-[0.14em] transition ${
            tab === 'generate'
              ? 'bg-black text-yellow-400'
              : 'bg-zinc-800/60 hover:bg-white/10'
          }`}
        >
          Auto-generate
        </button>
        <button
          type="button"
          onClick={() => setTab('upload')}
          className={`flex-1 px-3 py-2 font-mono text-small uppercase tracking-[0.14em] transition border-l border-black ${
            tab === 'upload'
              ? 'bg-black text-yellow-400'
              : 'bg-zinc-800/60 hover:bg-white/10'
          }`}
        >
          Upload your own
        </button>
      </div>

      {tab === 'generate' ? (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-4">
          <div>
            <CertificateArt input={input} options={options} />
          </div>
          <div className="space-y-3">
            <CertificateCustomiser
              value={options}
              onChange={setOptions}
              rerollsUsed={rerollsUsed}
              onReroll={onReroll}
            />
            <Button
              type="button"
              variant="primary"
              onClick={onSaveGenerated}
              loading={busy}
              className="w-full"
            >
              Save generated artwork
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="border border-dashed border-black bg-grey-100 p-3 space-y-2">
            <p className="text-small font-mono uppercase tracking-[0.14em] text-white">
              File requirements
            </p>
            <ul className="text-small text-white space-y-0.5 pl-4 list-disc">
              <li>PNG, JPEG, WebP, GIF or SVG — images ≤ 5 MB</li>
              <li>MP4 or WebM — video ≤ 25 MB</li>
              <li>Images must be 256–4096 px per side</li>
              <li>SVG is sanitised (scripts &amp; foreign content stripped)</li>
            </ul>
          </div>

          <div>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              className="block w-full text-small font-mono file:mr-3 file:border file:border-black file:bg-zinc-800/60 file:px-3 file:py-1 file:font-mono file:text-small file:uppercase file:tracking-[0.14em] hover:file:bg-zinc-800/60/10"
            />
            {file ? (
              <p className="mt-2 text-small font-mono text-white">
                {file.name} · {(file.size / 1024).toFixed(1)} KB · {file.type || '?'}
              </p>
            ) : null}
          </div>

          {previewUrl && file ? (
            <div className="border border-black bg-grey-100 p-2">
              {file.type.startsWith('video/') ? (
                <video
                  src={previewUrl}
                  controls
                  className="mx-auto max-h-[320px] w-auto"
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="mx-auto max-h-[320px] w-auto"
                />
              )}
            </div>
          ) : null}

          <Button
            type="button"
            variant="primary"
            onClick={onSaveUploaded}
            loading={busy}
            disabled={!file}
            className="w-full"
          >
            Upload &amp; save
          </Button>
        </div>
      )}

      {error ? (
        <p className="border border-black bg-grey-100 px-3 py-2 font-mono text-small" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="border border-white/25 bg-zinc-900/55 px-3 py-2 font-mono text-small">
          {saved}
        </p>
      ) : null}
    </div>
  )
}
