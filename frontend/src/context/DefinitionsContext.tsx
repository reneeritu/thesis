import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { readDefinitionsOn, writeDefinitionsOn } from '../lib/definitionsPreference'

const STORAGE_KEY = 'aura2_definitions_on'

type Ctx = {
  definitionsOn: boolean
  setDefinitionsOn: (on: boolean) => void
}

const DefinitionsContext = createContext<Ctx | null>(null)

export function DefinitionsProvider({ children }: { children: ReactNode }) {
  const [definitionsOn, setDefinitionsOnState] = useState(readDefinitionsOn)

  const setDefinitionsOn = useCallback((on: boolean) => {
    setDefinitionsOnState(on)
    writeDefinitionsOn(on)
  }, [])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) {
        setDefinitionsOnState(readDefinitionsOn())
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo(
    () => ({ definitionsOn, setDefinitionsOn }),
    [definitionsOn, setDefinitionsOn],
  )

  return <DefinitionsContext.Provider value={value}>{children}</DefinitionsContext.Provider>
}

export function useDefinitions(): Ctx {
  const ctx = useContext(DefinitionsContext)
  if (!ctx) {
    return {
      definitionsOn: readDefinitionsOn(),
      setDefinitionsOn: writeDefinitionsOn,
    }
  }
  return ctx
}
