import { beginLoading, endLoading } from './cursor'
import { clearSession, safeReturnPath } from './session'

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
    const res = await fetch(apiBase() + path, {
      method: opts.method || 'GET',
      headers,
      credentials: 'include',
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
      if (res.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/recover') && !path.startsWith('/auth/register')) {
        clearSession()
        const here = window.location.pathname
        if (here !== '/login' && here !== '/register' && here !== '/recover') {
          const ret = encodeURIComponent(safeReturnPath(here + window.location.search) || '/dashboard')
          window.location.assign('/login?reason=expired&return=' + ret)
        }
      }
      if (res.status === 502 || res.status === 503) {
        throw new Error(
          'The server is starting or temporarily unavailable. Wait a moment and try again.',
        )
      }
      const d = data as { error?: unknown; message?: unknown } | null
      const msg = (d && (d.error ?? d.message)) || text || res.statusText
      throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
    }

    return data as T
  } finally {
    endLoading()
  }
}
