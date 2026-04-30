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
import { initEtchStudio } from './theatre/initEtchStudio'

/** Dev-only: single Studio bundle + R3F extension (see `initEtchStudio.ts`). */
initEtchStudio()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
