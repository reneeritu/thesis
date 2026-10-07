const LS_TOKEN = 'aura2_token'
const LS_ALIAS = 'aura2_alias'

/** Session lives in an httpOnly cookie. Alias is only a UI hint. */
export function getAlias(): string {
  try {
    return sessionStorage.getItem(LS_ALIAS) || ''
  } catch {
    return ''
  }
}

/** True when this tab believes a cookie session exists. Not a JWT. */
export function getToken(): string {
  return getAlias() ? '1' : ''
}

export function setSession(alias: string): void {
  try {
    sessionStorage.removeItem(LS_TOKEN)
    localStorage.removeItem(LS_TOKEN)
    localStorage.removeItem(LS_ALIAS)
    if (alias) sessionStorage.setItem(LS_ALIAS, alias)
    else sessionStorage.removeItem(LS_ALIAS)
  } catch {
    // private mode / quota
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(LS_TOKEN)
    sessionStorage.removeItem(LS_ALIAS)
    localStorage.removeItem(LS_TOKEN)
    localStorage.removeItem(LS_ALIAS)
  } catch {
    // ignore
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch('/auth/logout', { method: 'POST', credentials: 'include' })
  } catch {
    // still drop the local hint
  }
  clearSession()
}

/** Reject protocol-relative and backslash paths that browsers treat as off-site. */
export function safeReturnPath(raw: string | null): string | null {
  if (!raw) return null
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || raw.includes('://')) {
    return null
  }
  return raw
}

export function redirectToDashboard(): void {
  window.location.href = '/dashboard'
}

/** After login/register: honor ?return= safe internal path, else dashboard */
export function redirectAfterAuth(): void {
  try {
    const params = new URLSearchParams(window.location.search)
    const ret = safeReturnPath(params.get('return'))
    if (ret) {
      window.location.assign(ret)
      return
    }
  } catch {
    /* ignore */
  }
  window.location.href = '/dashboard'
}
