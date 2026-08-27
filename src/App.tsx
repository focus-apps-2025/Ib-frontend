import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { useAuthStore } from './store'
import { useThemeStore } from './store/themeStore'
import { themes } from './theme'
import LoginPage from './pages/Login'
import DashboardLayout from './components/layout/DashboardLayout'
import DashboardPage from './pages/Dashboard'
import UploadPage from './pages/Upload'
import UsersPage from './pages/Users'
import RegionsPage from './pages/Regions'
import CountriesPage from './pages/Countries'
import IBVersionsPage from './pages/IBVersions'
import ActivityLogsPage from './pages/ActivityLogs'
import SettingsPage from './pages/Settings'
import ProfilePage from './pages/Profile'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== 'super_admin') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  const { mode } = useThemeStore()
  const theme = themes[mode]

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <DashboardLayout />
              </PrivateRoute>
            }
          >
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="upload" element={<UploadPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route
              path="users"
              element={
                <SuperAdminRoute>
                  <UsersPage />
                </SuperAdminRoute>
              }
            />
            <Route
              path="regions"
              element={
                <SuperAdminRoute>
                  <RegionsPage />
                </SuperAdminRoute>
              }
            />
            <Route
              path="countries"
              element={
                <SuperAdminRoute>
                  <CountriesPage />
                </SuperAdminRoute>
              }
            />
            <Route
              path="ib-versions"
              element={
                <SuperAdminRoute>
                  <IBVersionsPage />
                </SuperAdminRoute>
              }
            />
            <Route
              path="activity-logs"
              element={
                <SuperAdminRoute>
                  <ActivityLogsPage />
                </SuperAdminRoute>
              }
            />
            <Route
              path="settings"
              element={
                <SuperAdminRoute>
                  <SettingsPage />
                </SuperAdminRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}