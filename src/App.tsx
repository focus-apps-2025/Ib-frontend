import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { useAuthStore } from './store'
import { useThemeStore } from './store/themeStore'
import { themes } from './theme'
import LoginPage from './pages/Login'
import DashboardLayout from './components/layout/DashboardLayout'
import DashboardPage from './pages/Dashboard'
import SummaryPage from './pages/Summary'
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

  useEffect(() => {
    const isDark = mode === 'dark'
    const bg = isDark ? '#0A0A1A' : '#F4F4FA'
    const text = isDark ? '#E8E8FF' : '#1A1A2E'
    const root = document.documentElement
    root.style.setProperty('--app-bg', bg)
    root.style.setProperty('--app-text', text)
    root.style.backgroundColor = bg
    document.body.style.backgroundColor = bg
    document.body.style.color = text
  }, [mode])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDayjs}>
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
            <Route path="summary" element={<SummaryPage />} />
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
      </LocalizationProvider>
    </ThemeProvider>
  )
}