import { useRef, useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { Button } from '../Button'
import { getToken } from '../../lib/session'

const ACTIVITY_TYPES = [
  'brainstorm',
  'primary_research',
  'secondary_research',
  'iterate',
  'skillwork',
  'fabrication',
  'pedagogy',
  'admin',
  'review',
  'ai_tool',
  'other',
] as const

const MODE_LABELS: Record<string, string> = {
  micro: 'MICRO',
  memo: 'MEMO',
  reflection: 'REFLECTION',
}

type MediaResult = {
  mediaId: string
  hash: string
  filename: string
  originalName: string
  mimeType: string
  size: number
}

type Props = {
  projectId: string
  onDone: () => void
}

function apiBase() {
  const m = document.querySelector('meta[name="aura-api-base"]')
  const b = m?.getAttribute('content')
  if (b?.trim()) return b.replace(/\/$/, '')
  return window.location.origin.replace(/\/$/, '')
}

export function TraceForm({ projectId, onDone }: Props) {
  const [activityType, setActivityType] = useState<(typeof ACTIVITY_TYPES)[number]>(ACTIVITY_TYPES[0])
  const [otherDescription, setOtherDescription] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState('')
  const [toolSoftware, setToolSoftware] = useState('')
  const [mode, setMode] = useState<'micro' | 'memo' | 'reflection'>('micro')
  const [proxy, setProxy] = useState(false)
  const [proxyForAlias, setProxyForAlias] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Media proof upload
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadedMedia, setUploadedMedia] = useState<MediaResult | null>(null)

  async function uploadProof(file: File) {
    setUploadBusy(true)
    setUploadError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('projectId', projectId)
      const tok = getToken()
      const res = await fetch(apiBase() + '/upload', {
        method: 'POST',
        headers: tok ? { Authorization: 'Bearer ' + tok } : undefined,
        body: fd,
      })
      const text = await res.text()
      let data: unknown
      try { data = JSON.parse(text) } catch { data = { raw: text } }
      if (!res.ok) {
        const d = data as { error?: string; message?: string } | null
        throw new Error(String(d?.error ?? d?.message ?? text ?? res.statusText))
      }
      const r = data as MediaResult & { mediaId?: string }
      setUploadedMedia({
        mediaId: String(r.mediaId),
        hash: r.hash,
        filename: r.filename,
        originalName: r.originalName,
        mimeType: r.mimeType,
        size: r.size,
      })
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploadBusy(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const body: Record<string, unknown> = {
        projectId,
        activityType,
        mode: proxy ? 'proxy' : mode,
        description: description || undefined,
        duration: duration ? Number(duration) : undefined,
        toolSoftware: toolSoftware || undefined,
      }
      if (activityType === 'other') body.otherDescription = otherDescription
      if (proxy) body.proxyForAlias = proxyForAlias
      if (uploadedMedia?.mediaId) body.mediaId = uploadedMedia.mediaId
      await api('/traces', { method: 'POST', body })
      setResult('Trace logged.')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border border-black bg-white p-4 space-y-3">
      <h3 className="text-small font-mono uppercase tracking-[0.18em]">Log Work</h3>

      <div className="flex gap-1">
        {(['micro', 'memo', 'reflection'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-3 py-1 text-[11px] font-mono uppercase tracking-[0.16em] border border-black transition ${mode === m ? 'bg-black text-yellow-400' : 'bg-white hover:bg-grey-100'}`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="space-y-3 text-small">
        <div>
          <label className="block font-mono uppercase tracking-[0.18em] text-grey-400 mb-1">Activity</label>
          <select
            value={activityType}
            onChange={(e) => setActivityType(e.target.value as typeof activityType)}
            className="w-full border border-black bg-white px-3 py-2 font-mono text-small"
          >
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {activityType === 'other' && (
          <div>
            <label className="block font-mono uppercase tracking-[0.18em] text-grey-400 mb-1">Other description</label>
            <input
              value={otherDescription}
              onChange={(e) => setOtherDescription(e.target.value)}
              required
              className="w-full border border-black bg-white px-3 py-2 font-sans text-body"
            />
          </div>
        )}

        <div>
          <label className="block font-mono uppercase tracking-[0.18em] text-grey-400 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border border-black bg-white px-3 py-2 font-sans text-body"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-mono uppercase tracking-[0.18em] text-grey-400 mb-1">Duration (min)</label>
            <input
              type="number"
              min={0}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full border border-black bg-white px-3 py-2 font-mono text-small"
            />
          </div>
          <div>
            <label className="block font-mono uppercase tracking-[0.18em] text-grey-400 mb-1">Tool / Software</label>
            <input
              value={toolSoftware}
              onChange={(e) => setToolSoftware(e.target.value)}
              className="w-full border border-black bg-white px-3 py-2 font-sans text-body"
            />
          </div>
        </div>

        {/* ── Proof (image / video / audio) ── */}
        <div className="border border-grey-200 p-3 space-y-2">
          <p className="font-mono uppercase tracking-[0.18em] text-grey-400 text-[10px]">
            Attach proof (image / video / audio) — optional
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*,audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void uploadProof(f)
            }}
          />
          {!uploadedMedia && (
            <button
              type="button"
              disabled={uploadBusy}
              onClick={() => fileRef.current?.click()}
              className="border border-black px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] bg-white hover:bg-black hover:text-yellow-400 transition disabled:opacity-60"
            >
              {uploadBusy ? 'Uploading…' : 'Choose file'}
            </button>
          )}
          {uploadError && (
            <p className="font-mono text-[11px] text-red-600">{uploadError}</p>
          )}
          {uploadedMedia && (
            <div className="space-y-1 font-mono text-[11px]">
              <p className="text-grey-400 uppercase tracking-[0.12em]">Proof attached ✓</p>
              <p><span className="text-grey-400">File: </span>{uploadedMedia.originalName}</p>
              <p><span className="text-grey-400">Type: </span>{uploadedMedia.mimeType}</p>
              <p className="break-all">
                <span className="text-grey-400">Media ID: </span>
                <span className="tracking-wider">{uploadedMedia.mediaId}</span>
              </p>
              <p className="break-all">
                <span className="text-grey-400">SHA-256 hash: </span>
                <span className="text-[10px]">{uploadedMedia.hash}</span>
              </p>
              <p className="text-grey-400 text-[10px]">
                Anyone can verify this file hasn't changed by computing its SHA-256 and comparing to this hash.
                Retrieve it via: <span className="font-mono">/media/{uploadedMedia.mediaId}</span>
              </p>
              <button
                type="button"
                onClick={() => { setUploadedMedia(null); if (fileRef.current) fileRef.current.value = '' }}
                className="text-grey-400 underline text-[10px] hover:text-black"
              >
                Remove
              </button>
            </div>
          )}
        </div>

        <details className="text-small">
          <summary className="cursor-pointer font-mono uppercase tracking-[0.18em] text-grey-400">Proxy log</summary>
          <div className="mt-2 space-y-2 pl-2">
            <label className="flex items-center gap-2 font-mono">
              <input type="checkbox" checked={proxy} onChange={(e) => setProxy(e.target.checked)} />
              Enable proxy for another alias
            </label>
            {proxy && (
              <input
                value={proxyForAlias}
                onChange={(e) => setProxyForAlias(e.target.value)}
                placeholder="target alias"
                required
                className="w-full border border-black bg-white px-3 py-2 font-mono text-small"
              />
            )}
          </div>
        </details>

        {error && <p className="border border-black bg-grey-100 px-3 py-2 font-mono" role="alert">{error}</p>}
        {result && <p className="border border-black bg-white px-3 py-2 font-mono">{result}</p>}

        <Button type="submit" variant="primary" loading={busy}>Log Work</Button>
      </form>
    </div>
  )
}
