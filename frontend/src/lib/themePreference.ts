export type ThemeMode = 'dark' | 'light'

export const THEME_STORAGE_KEY = 'etch_theme'

export function readTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    /* ignore */
  }
  return 'dark'
}

export function persistTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    /* ignore */
  }
}

/** Apply theme to `<html>`: dark = no attribute (default CSS), light = `data-theme="light"` + `.light-mode`. */
export function applyThemeToDocument(mode: ThemeMode): void {
  if (mode === 'light') {
    document.documentElement.setAttribute('data-theme', 'light')
    document.documentElement.classList.add('light-mode')
    document.documentElement.style.colorScheme = 'light'
  } else {
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.classList.remove('light-mode')
    document.documentElement.style.colorScheme = 'dark'
  }
}
