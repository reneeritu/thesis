import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import LandingLayout from './pages/LandingLayout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import RecoverPage from './pages/RecoverPage'
import { getToken } from './lib/session'
import { LayoutDebugRoot } from './lib/layoutDebug'
import { DefinitionsProvider } from './context/DefinitionsContext'
import { ThemeProvider } from './context/ThemeContext'
import './styles/theme-modes.css'
import { AppAtmosphere } from './components/AppAtmosphere'
import { initFontInspect } from './lib/fontInspect'

// Everything below ships as its own JS chunk and is only downloaded when the
// user navigates to that route. WelcomeLanding in particular carries Theatre +
// R3F + Three (~1 MB gzipped) — splitting it out keeps the initial shell tiny.
const WelcomeLanding = lazy(() => import('./pages/WelcomeLandingLayout'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
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
const PublicNodePage = lazy(() => import('./pages/PublicNodePage'))
const NftPage = lazy(() => import('./pages/NftPage'))
const SpaceSearchPage = lazy(() => import('./pages/SpaceSearchPage'))
const ProjectSearchPage = lazy(() => import('./pages/ProjectSearchPage'))

function RequireAuth() {
  const token = getToken()
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white">
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
      <DefinitionsProvider>
        <AppAtmosphere />
        <div className="relative z-[1] flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-x-visible">
          <LayoutDebugRoot />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
            <Route path="/" element={<LandingLayout />} />
            <Route path="/welcome" element={<WelcomeLanding />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/recover" element={<RecoverPage />} />
            <Route path="/nodes/:alias" element={<PublicNodePage />} />
            <Route element={<RequireAuth />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/me" element={<ProfilePage />} />
              <Route path="/spaces" element={<SpacesPage />} />
              <Route path="/spaces/search" element={<SpaceSearchPage />} />
              <Route path="/spaces/new" element={<SpaceNewPage />} />
              <Route path="/spaces/join" element={<SpaceJoinPage />} />
              <Route path="/spaces/:id/settings" element={<SpaceSettingsPage />} />
              <Route path="/spaces/:id" element={<SpaceDetailPage />} />
              <Route path="/projects" element={<ProjectsBoardPage />} />
              <Route path="/projects/search" element={<ProjectSearchPage />} />
              <Route path="/projects/new" element={<ProjectNewPage />} />
              <Route path="/projects/:id" element={<ProjectDetailPage />} />
              <Route path="/archive/new" element={<ArchiveNewPage />} />
              <Route path="/discover" element={<DiscoverPage />} />
              <Route path="/governance" element={<GovernancePage />} />
              <Route path="/nfts/:id" element={<NftPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </DefinitionsProvider>
    </ThemeProvider>
  )
}
