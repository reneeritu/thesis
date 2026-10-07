import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'
import { THEME_STORAGE_KEY, applyThemeToDocument, type ThemeMode } from '../lib/themePreference'

type ThemeContextValue = {
  theme: ThemeMode
  setTheme: (mode: ThemeMode) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    applyThemeToDocument('dark')
    try {
      localStorage.removeItem(THEME_STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const setTheme = useCallback((_mode: ThemeMode) => {
    applyThemeToDocument('dark')
  }, [])

  const toggleTheme = useCallback(() => {
    applyThemeToDocument('dark')
  }, [])

  const value = useMemo(
    () => ({
      theme: 'dark' as const,
      setTheme,
      toggleTheme,
    }),
    [setTheme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return ctx
}
