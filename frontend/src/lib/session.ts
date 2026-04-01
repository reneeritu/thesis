const LS_TOKEN = 'aura2_token'
const LS_ALIAS = 'aura2_alias'

export function getToken(): string {
  return localStorage.getItem(LS_TOKEN) || ''
}

export function getAlias(): string {
  return localStorage.getItem(LS_ALIAS) || ''
}

export function setSession(token: string, alias: string): void {
  if (token) localStorage.setItem(LS_TOKEN, token)
  else localStorage.removeItem(LS_TOKEN)
  if (alias) localStorage.setItem(LS_ALIAS, alias)
  else localStorage.removeItem(LS_ALIAS)
}

export function redirectToDashboard(): void {
  window.location.href = '/dashboard'
}

export function clearSession(): void {
  localStorage.removeItem(LS_TOKEN)
  localStorage.removeItem(LS_ALIAS)
}

