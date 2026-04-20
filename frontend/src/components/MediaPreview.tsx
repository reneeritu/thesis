import { useEffect, useState } from 'react'

type Props = {
  mediaId: string
  mimeType?: string
  hash?: string
  originalName?: string
}

function apiBase(): string {
  const m = document.querySelector('meta[name="aura-api-base"]')
  const b = m?.getAttribute('content')
  if (b?.trim()) return b.replace(/\/$/, '')
  return window.location.origin.replace(/\/$/, '')
}

async function copy(text: string, onDone: () => void): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    onDone()
  } catch {
    // ignore
  }
}

/**
 * Renders an inline preview of uploaded media (served by `GET /media/:id`)
 * with quick actions: Open, Copy hash, Copy ID.
 *
 * MIME type is used to decide between image / video / audio / generic file.
 */
export function MediaPreview({ mediaId, mimeType = '', hash, originalName }: Props) {
  const [copiedHash, setCopiedHash] = useState(false)
  const [copiedId, setCopiedId] = useState(false)
  const [probed, setProbed] = useState<string>('')

  const src = `${apiBase()}/media/${mediaId}`
  const effectiveMime = mimeType || probed

  useEffect(() => {
    if (mimeType) return
    let cancelled = false
    void fetch(src, { method: 'HEAD' })
      .then((r) => {
        const ct = r.headers.get('content-type') || ''
        if (!cancelled) setProbed(ct.split(';')[0].trim())
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [src, mimeType])

  const isImage = effectiveMime.startsWith('image/')
  const isVideo = effectiveMime.startsWith('video/')
  const isAudio = effectiveMime.startsWith('audio/')

  return (
    <div className="space-y-2">
      {isImage ? (
        <a href={src} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={src}
            alt={originalName || `media ${mediaId}`}
            className="max-h-64 w-auto border border-grey-200 bg-grey-50 object-contain"
            loading="lazy"
          />
        </a>
      ) : isVideo ? (
        <video
          controls
          preload="metadata"
          className="max-h-64 w-full border border-grey-200 bg-black"
        >
          <source src={src} type={effectiveMime} />
          Your browser doesn't support embedded video.
        </video>
      ) : isAudio ? (
        <audio controls preload="metadata" className="w-full">
          <source src={src} type={effectiveMime} />
          Your browser doesn't support embedded audio.
        </audio>
      ) : (
        <div className="border border-dashed border-grey-300 bg-grey-50 px-3 py-3 font-mono text-[11px] text-grey-500">
          Preview not available for this file type ({effectiveMime || 'checking…'}).
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em]">
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="border border-black bg-black px-2 py-0.5 text-yellow-400 transition hover:bg-yellow-400 hover:text-black"
          title="Open the stored file served from the database"
        >
          Open →
        </a>
        {hash ? (
          <button
            type="button"
            onClick={() => void copy(hash, () => {
              setCopiedHash(true)
              window.setTimeout(() => setCopiedHash(false), 1200)
            })}
            className="border border-black bg-white px-2 py-0.5 transition hover:bg-black hover:text-yellow-400"
            title="Copy SHA-256 hash to clipboard"
          >
            {copiedHash ? 'Copied' : 'Copy hash'}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void copy(mediaId, () => {
            setCopiedId(true)
            window.setTimeout(() => setCopiedId(false), 1200)
          })}
          className="border border-black bg-white px-2 py-0.5 transition hover:bg-black hover:text-yellow-400"
          title="Copy MongoDB media id"
        >
          {copiedId ? 'Copied' : 'Copy ID'}
        </button>
      </div>
    </div>
  )
}
