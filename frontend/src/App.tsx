import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import DashboardPage from './pages/DashboardPage'
import ProfilePage from './pages/ProfilePage'
import SpacesPage from './pages/SpacesPage'
import SpaceJoinPage from './pages/SpaceJoinPage'
import SpaceDetailPage from './pages/SpaceDetailPage'
import ProjectsBoardPage from './pages/ProjectsBoardPage'
import ProjectNewPage from './pages/ProjectNewPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import ArchiveNewPage from './pages/ArchiveNewPage'
import DiscoverPage from './pages/DiscoverPage'
import PublicNodePage from './pages/PublicNodePage'
import NftPage from './pages/NftPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import RecoverPage from './pages/RecoverPage'
import { getToken } from './lib/session'

function RequireAuth() {
  const token = getToken()
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/recover" element={<RecoverPage />} />
      <Route path="/nodes/:alias" element={<PublicNodePage />} />
      <Route element={<RequireAuth />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/me" element={<ProfilePage />} />
        <Route path="/spaces" element={<SpacesPage />} />
        <Route path="/spaces/join" element={<SpaceJoinPage />} />
        <Route path="/spaces/:id" element={<SpaceDetailPage />} />
        <Route path="/projects" element={<ProjectsBoardPage />} />
        <Route path="/projects/new" element={<ProjectNewPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/archive/new" element={<ArchiveNewPage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/nfts/:id" element={<NftPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
