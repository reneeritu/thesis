import { beginLoading, endLoading } from './cursor'
import { getToken } from './session'

function apiBase(): string {
  const m = document.querySelector('meta[name="aura-api-base"]')
  const b = m?.getAttribute('content')
  if (b?.trim()) return b.replace(/\/$/, '')
  return window.location.origin.replace(/\/$/, '')
}

export type ArchiveEvidenceUploadResult = {
  mediaId: string
  hash: string
  filename: string
  originalName: string
  mimeType: string
  size: number
}

/** Upload file bytes; server stores file on disk and a Media row in MongoDB. */
export async function uploadArchiveEvidence(
  spaceId: string,
  file: File,
): Promise<ArchiveEvidenceUploadResult> {
  beginLoading()
  try {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('spaceId', spaceId)
    const tok = getToken()
    const res = await fetch(apiBase() + '/upload/archive-evidence', {
      method: 'POST',
      headers: tok ? { Authorization: 'Bearer ' + tok } : undefined,
      body: fd,
    })
    const text = await res.text()
    let data: unknown = null
    if (text) {
      try {
        data = JSON.parse(text) as unknown
      } catch {
        data = { raw: text }
      }
    }
    if (!res.ok) {
      const d = data as { error?: unknown; message?: unknown } | null
      const msg = (d && (d.error ?? d.message)) || text || res.statusText
      throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
    }
    const out = data as ArchiveEvidenceUploadResult & { mediaId?: string }
    return {
      mediaId: String(out.mediaId),
      hash: out.hash,
      filename: out.filename,
      originalName: out.originalName,
      mimeType: out.mimeType,
      size: out.size,
    }
  } finally {
    endLoading()
  }
}
