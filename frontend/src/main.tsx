import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './styles/micro-ui.css'
import './styles/hints.css'
import './styles/layout-debug.css'
import './black-page.css'
import './styles/app-atmosphere.css'
import App from './App.tsx'

/** Dev-only: keep Theatre and Three out of the production homepage graph. */
if (import.meta.env.DEV) {
  void import('./theatre/initEtchStudio').then((m) => m.initEtchStudio())
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
