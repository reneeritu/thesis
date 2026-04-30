import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

type ChromeBackdropCtx = {
  acquire: () => () => void
}

const ChromeBackdropContext = createContext<ChromeBackdropCtx | null>(null)

/**
 * When any shell “floater” (nav menu, notifications, glossary) is open, a full-viewport
 * frosted layer sits above page content but below the header + dropdown panels + theme/hints rail.
 */
export function ChromeBackdropProvider({ children }: { children: ReactNode }) {
  const countRef = useRef(0)
  const [visible, setVisible] = useState(false)

  const acquire = useCallback(() => {
    countRef.current += 1
    if (countRef.current === 1) setVisible(true)
    let released = false
    return () => {
      if (released) return
      released = true
      countRef.current = Math.max(0, countRef.current - 1)
      if (countRef.current === 0) setVisible(false)
    }
  }, [])

  const value = useMemo(() => ({ acquire }), [acquire])

  return (
    <ChromeBackdropContext.Provider value={value}>
      {visible ? <div className="etch-chrome-backdrop" aria-hidden /> : null}
      {children}
    </ChromeBackdropContext.Provider>
  )
}

/** While `open` is true, contributes one holder to the shared chrome backdrop ref-count. */
export function useChromeBackdropWhileOpen(open: boolean) {
  const ctx = useContext(ChromeBackdropContext)
  useEffect(() => {
    if (!open || !ctx) return
    return ctx.acquire()
  }, [open, ctx])
}
