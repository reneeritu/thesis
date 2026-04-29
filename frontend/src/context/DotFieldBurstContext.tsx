import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type DotFieldBurstContextValue = {
  burstSignal: number
  bumpDotField: () => void
}

const DotFieldBurstContext = createContext<DotFieldBurstContextValue | null>(null)

export function DotFieldBurstProvider({ children }: { children: ReactNode }) {
  const [burstSignal, setBurstSignal] = useState(0)
  const bumpDotField = useCallback(() => setBurstSignal((n) => n + 1), [])
  const value = useMemo(
    () => ({ burstSignal, bumpDotField }),
    [burstSignal, bumpDotField],
  )
  return (
    <DotFieldBurstContext.Provider value={value}>{children}</DotFieldBurstContext.Provider>
  )
}

export function useBumpDotField(): () => void {
  const ctx = useContext(DotFieldBurstContext)
  return ctx?.bumpDotField ?? (() => undefined)
}

export function useDotFieldBurstContext(): DotFieldBurstContextValue | null {
  return useContext(DotFieldBurstContext)
}
