import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import LandingLayout from './pages/LandingLayout'
const Landing = lazy(() => import('./pages/Landing'))
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import RecoverPage from './pages/RecoverPage'
import { getToken } from './lib/session'
import { DefinitionsProvider } from './context/DefinitionsContext'
import { ThemeProvider } from './context/ThemeContext'
import './styles/theme-modes.css'
import { AppAtmosphere } from './components/AppAtmosphere'
import { AppAmbientDotField } from './components/AppAmbientDotField'
import { initFontInspect } from './lib/fontInspect'
import TargetCursor from './components/TargetCursor/TargetCursor'
import { PageTransitionLayout } from './components/PageTransitionLayout'
import { MicroChainFlash } from './components/MicroChainFlash'
import { DotFieldBurstProvider } from './context/DotFieldBurstContext'
import { ToastProvider } from './context/ToastContext'

// Everything below ships as its own JS chunk and is only downloaded when the
// user navigates to that route. WelcomeLanding in particular carries Theatre +
// R3F + Three (~1 MB gzipped) — splitting it out keeps the initial shell tiny.
const WelcomeLanding = lazy(() => import('./pages/WelcomeLandingLayout'))
const HubPage = lazy(() => import('./pages/HubPage'))
const SpacesPage = lazy(() => import('./pages/SpacesPage'))
const SpaceJoinPage = lazy(() => import('./pages/SpaceJoinPage'))
const SpaceNewPage = lazy(() => import('./pages/SpaceNewPage'))
const SpaceDetailPage = lazy(() => import('./pages/SpaceDetailPage'))
const SpaceSettingsPage = lazy(() => import('./pages/SpaceSettingsPage'))
const ProjectsBoardPage = lazy(() => import('./pages/ProjectsBoardPage'))
const ProjectNewPage = lazy(() => import('./pages/ProjectNewPage'))
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage'))
const ArchiveNewPage = lazy(() => import('./pages/ArchiveNewPage'))
const DiscoverPage = lazy(() => import('./pages/DiscoverPage'))
const GovernancePage = lazy(() => import('./pages/GovernancePage'))
const NftPage = lazy(() => import('./pages/NftPage'))
const SpaceSearchPage = lazy(() => import('./pages/SpaceSearchPage'))
const ProjectSearchPage = lazy(() => import('./pages/ProjectSearchPage'))
const SimulationPage = lazy(() => import('./pages/SimulationPage'))
const MessagesPage = lazy(() => import('./pages/MessagesPage'))
const NodeReputationPage = lazy(() => import('./pages/NodeReputationPage'))

function RequireAuth() {
  const token = getToken()
  const location = useLocation()
  if (!token) {
    const ret = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?return=${ret}`} replace />
  }
  return <Outlet />
}

function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <p className="font-mono text-small uppercase tracking-[0.18em] text-white">
        Loading…
      </p>
    </div>
  )
}

export default function App() {
  useEffect(() => {
    initFontInspect()
  }, [])

  return (
    <ThemeProvider>
      <ToastProvider>
        <DefinitionsProvider>
          <DotFieldBurstProvider>
            <TargetCursor spinDuration={2} hideDefaultCursor />
            <MicroChainFlash />
            <AppAtmosphere />
            <AppAmbientDotField />
            <div className="relative z-[1] flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-x-visible">
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route element={<PageTransitionLayout />}>
                    <Route path="/" element={<Landing />} />
                    <Route path="/legacy-landing" element={<LandingLayout />} />
                    <Route path="/welcome" element={<WelcomeLanding />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/recover" element={<RecoverPage />} />
                    <Route path="/nodes/:alias" element={<HubPage />} />
                    <Route path="/spaces/:id" element={<SpaceDetailPage />} />
                    <Route path="/projects/:id" element={<ProjectDetailPage />} />
                    <Route path="/nfts/:id" element={<NftPage />} />
                    <Route path="/provenance/:id" element={<NftPage />} />
                    <Route path="/discover" element={<DiscoverPage />} />
                    <Route path="/node/:alias/reputation" element={<NodeReputationPage />} />
                    <Route path="/nodes/:alias/reputation" element={<NodeReputationPage />} />
                    <Route element={<RequireAuth />}>
                      <Route path="/dashboard" element={<HubPage />} />
                      <Route path="/me" element={<HubPage />} />
                      <Route path="/spaces" element={<SpacesPage />} />
                      <Route path="/spaces/search" element={<SpaceSearchPage />} />
                      <Route path="/spaces/new" element={<SpaceNewPage />} />
                      <Route path="/spaces/join" element={<SpaceJoinPage />} />
                      <Route path="/spaces/:id/settings" element={<SpaceSettingsPage />} />
                      <Route path="/projects" element={<ProjectsBoardPage />} />
                      <Route path="/projects/search" element={<ProjectSearchPage />} />
                      <Route path="/projects/new" element={<ProjectNewPage />} />
                      <Route path="/archive/new" element={<ArchiveNewPage />} />
                      <Route path="/simulation" element={<SimulationPage />} />
                      <Route path="/governance" element={<GovernancePage />} />
                      <Route path="/messages" element={<MessagesPage />} />
                      <Route path="/messages/:id" element={<MessagesPage />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
              </Suspense>
            </div>
          </DotFieldBurstProvider>
        </DefinitionsProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
