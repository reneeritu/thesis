const STORAGE_KEY = 'aura2_definitions_on'

export function readDefinitionsOn(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === null) return true
    return v !== '0'
  } catch {
    return true
  }
}

export function writeDefinitionsOn(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? '1' : '0')
  } catch {
    // ignore
  }
}
