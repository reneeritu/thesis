import { beginLoading, endLoading } from './cursor'
import { getToken } from './session'

function apiBase(): string {
  const m = document.querySelector('meta[name="aura-api-base"]')
  const b = m?.getAttribute('content')
  if (b?.trim()) return b.replace(/\/$/, '')
  return window.location.origin.replace(/\/$/, '')
}

export type ApiOptions = {
  method?: string
  body?: unknown
  token?: string | null
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  beginLoading()
  try {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (opts.body != null) {
      headers['Content-Type'] = 'application/json'
    }
    const tok = opts.token !== undefined ? opts.token : getToken()
    if (tok) headers['Authorization'] = 'Bearer ' + tok

    const res = await fetch(apiBase() + path, {
      method: opts.method || 'GET',
      headers,
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
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

    return data as T
  } finally {
    endLoading()
  }
}
