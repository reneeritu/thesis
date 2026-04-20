const LS_TOKEN = 'aura2_token'
const LS_ALIAS = 'aura2_alias'

let didMigrate = false

/** sessionStorage is per browser tab; localStorage was shared across tabs. */
function migrateLegacyLocalStorage(): void {
  if (didMigrate) return
  didMigrate = true
  try {
    if (sessionStorage.getItem(LS_TOKEN)) return
    const t = localStorage.getItem(LS_TOKEN)
    if (!t) return
    const a = localStorage.getItem(LS_ALIAS) || ''
    sessionStorage.setItem(LS_TOKEN, t)
    if (a) sessionStorage.setItem(LS_ALIAS, a)
    localStorage.removeItem(LS_TOKEN)
    localStorage.removeItem(LS_ALIAS)
  } catch {
    // private mode / quota
  }
}

function clearLegacyLocalStorage(): void {
  try {
    localStorage.removeItem(LS_TOKEN)
    localStorage.removeItem(LS_ALIAS)
  } catch {
    // ignore
  }
}

export function getToken(): string {
  migrateLegacyLocalStorage()
  return sessionStorage.getItem(LS_TOKEN) || ''
}

export function getAlias(): string {
  migrateLegacyLocalStorage()
  return sessionStorage.getItem(LS_ALIAS) || ''
}

export function setSession(token: string, alias: string): void {
  clearLegacyLocalStorage()
  if (token) sessionStorage.setItem(LS_TOKEN, token)
  else sessionStorage.removeItem(LS_TOKEN)
  if (alias) sessionStorage.setItem(LS_ALIAS, alias)
  else sessionStorage.removeItem(LS_ALIAS)
}

export function redirectToDashboard(): void {
  window.location.href = '/dashboard'
}

export function clearSession(): void {
  clearLegacyLocalStorage()
  sessionStorage.removeItem(LS_TOKEN)
  sessionStorage.removeItem(LS_ALIAS)
}

