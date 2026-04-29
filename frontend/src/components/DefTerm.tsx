import type { ReactNode } from 'react'
import { useDefinitions } from '../context/DefinitionsContext'
import { GLOSSARY } from '../lib/glossary'

type Props = {
  /** Key in {@link GLOSSARY} */
  term: string
  children: ReactNode
  className?: string
}

export function DefTerm({ term, children, className = '' }: Props) {
  const { definitionsOn } = useDefinitions()
  const def = GLOSSARY[term]
  if (!definitionsOn || !def) {
    return <span className={className}>{children}</span>
  }
  return (
    <span className={`cursor-help ${className}`} data-etch-def-term="" title={def}>
      {children}
    </span>
  )
}
