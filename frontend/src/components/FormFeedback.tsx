import type { ReactNode } from 'react'

/** Brief confirmation strip after a successful write — chain-record tone. */
export function FormSuccessBanner({ children }: { children: ReactNode }) {
  return (
    <div className="etch-form-success mb-3" role="status">
      {children}
    </div>
  )
}
