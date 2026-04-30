/** Build /login or /register URLs that return the user to the current page after auth. */

export function currentPathForReturn(): string {
  if (typeof window === 'undefined') return '/'
  const path = window.location.pathname + window.location.search
  return path.startsWith('/') ? path : '/' + path
}

export function loginUrl(opts?: { returnPath?: string; reason?: string }): string {
  const q = new URLSearchParams()
  q.set('return', opts?.returnPath ?? currentPathForReturn())
  if (opts?.reason?.trim()) q.set('reason', opts.reason.trim())
  return '/login?' + q.toString()
}

export function registerUrl(returnPath?: string): string {
  const q = new URLSearchParams()
  q.set('return', returnPath ?? currentPathForReturn())
  return '/register?' + q.toString()
}
