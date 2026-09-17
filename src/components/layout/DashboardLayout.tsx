import React, { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  Box, Drawer, AppBar, Toolbar, Typography, IconButton, List,
  ListItem, ListItemButton, ListItemIcon, ListItemText, Avatar,
  Menu, MenuItem, Divider, Tooltip, Badge, Chip, useMediaQuery, useTheme,
} from '@mui/material'
import {
  Dashboard, CloudUpload, People, Public, Language, Layers,
  History, Settings, Person, ExitToApp, Menu as MenuIcon,
  ChevronLeft, Notifications, DirectionsCar, Analytics,
  Brightness4, Brightness7, Assessment,
} from '@mui/icons-material'
import { useThemeStore } from '../../store/themeStore'
import { useThemeColors } from '../../utils/colors'
import { useAuthStore } from '../../store'
import { authApi } from '../../lib/api'

const DRAWER_WIDTH = 260

interface NavItem {
  label: string
  icon: React.ReactNode
  path: string
  roles?: string[]
  badge?: string
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
  { label: 'Summary', icon: <Assessment />, path: '/summary' },
  { label: 'Upload Data', icon: <CloudUpload />, path: '/upload' },
  { label: 'User Management', icon: <People />, path: '/users', roles: ['super_admin'] },
  { label: 'Regions', icon: <Public />, path: '/regions', roles: ['super_admin'] },
  { label: 'Countries', icon: <Language />, path: '/countries', roles: ['super_admin'] },
  { label: 'IB Versions', icon: <Layers />, path: '/ib-versions', roles: ['super_admin'] },
  { label: 'Activity Logs', icon: <History />, path: '/activity-logs', roles: ['super_admin'] },
  { label: 'Settings', icon: <Settings />, path: '/settings', roles: ['super_admin'] },
]

export default function DashboardLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, clearAuth } = useAuthStore()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const { mode, toggleTheme } = useThemeStore()
  const c = useThemeColors()

  const [drawerOpen, setDrawerOpen] = useState(!isMobile)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const filteredNav = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(user?.role || '')
  )

  const handleLogout = async () => {
    try { await authApi.logout() } catch { /* ignore */ }
    clearAuth()
    navigate('/login')
  }

  const sidebarContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo */}
      <Box
        sx={{
          p: 1.6,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          background: c.sidebarLogoBg,
          borderBottom: `1px solid ${c.border}`,
        }}
      >
        <Box
          sx={{
            p: 1,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #6C63FF, #FF6584)',
            display: 'flex',
          }}
        >
          <DirectionsCar sx={{ color: '#fff', fontSize: 22 }} />
        </Box>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: c.textPrimary, lineHeight: 0.6 }}>
            VQS
          </Typography>
          <Typography variant="caption" sx={{ color: c.textMuted, fontSize: '0.65rem' }}>
            Vehicle Quality Survey
          </Typography>
        </Box>
        {!isMobile && (
          <IconButton
            size="small"
            onClick={() => setDrawerOpen(false)}
            sx={{ ml: 'auto', color: c.textMuted }}
          >
            <ChevronLeft fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* User Badge */}
      <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${c.borderMuted}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar
            sx={{
              width: 36,
              height: 36,
              background: 'linear-gradient(135deg, #6C63FF, #9A94FF)',
              fontSize: '0.85rem',
              fontWeight: 700,
            }}
          >
            {user?.full_name?.charAt(0) || 'U'}
          </Avatar>
          <Box sx={{ overflow: 'hidden' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: c.textPrimary }}>
              {user?.full_name}
            </Typography>
            <Chip
              label={user?.role === 'super_admin' ? 'Super Admin' : 'Admin'}
              size="small"
              sx={{
                height: 16,
                fontSize: '0.6rem',
                background: user?.role === 'super_admin'
                  ? 'rgba(255,101,132,0.2)' : 'rgba(108,99,255,0.2)',
                color: user?.role === 'super_admin' ? '#FF6584' : c.primaryLight,
                border: 'none',
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* Navigation */}
      <List sx={{ px: 1, py: 1, flex: 1, overflowY: 'auto' }}>
        {filteredNav.map((item) => {
          const active = location.pathname === item.path
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                id={`nav-${item.path.replace('/', '')}`}
                onClick={() => { navigate(item.path); if (isMobile) setDrawerOpen(false) }}
                sx={{
                  borderRadius: 2,
                  py: 1,
                  background: active
                    ? 'linear-gradient(135deg, rgba(108,99,255,0.25), rgba(108,99,255,0.1))'
                    : 'transparent',
                  border: active ? `1px solid ${c.borderStrong}` : '1px solid transparent',
                  '&:hover': {
                    background: 'rgba(108,99,255,0.1)',
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 36,
                    color: active ? c.primaryLight : c.textMuted,
                    '& .MuiSvgIcon-root': { fontSize: 20 },
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  slotProps={{
                    primary: {
                      sx: {
                        fontSize: '0.85rem',
                        fontWeight: active ? 600 : 400,
                        color: active ? c.textPrimary : c.textSecondary,
                      },
                    },
                  }}
                />
              </ListItemButton>
            </ListItem>
          )
        })}
      </List>

      {/* Profile Link */}
      <Box sx={{ p: 1, borderTop: `1px solid ${c.borderMuted}` }}>
        <ListItemButton
          onClick={() => { navigate('/profile'); if (isMobile) setDrawerOpen(false) }}
          sx={{ borderRadius: 2, py: 1 }}
        >
          <ListItemIcon sx={{ minWidth: 36, color: c.textMuted }}>
            <Person sx={{ fontSize: 20 }} />
          </ListItemIcon>
          <ListItemText
            primary="Profile"
            slotProps={{ primary: { sx: { fontSize: '0.85rem', color: c.textSecondary } } }}
          />
        </ListItemButton>
        <ListItemButton
          id="logout-btn"
          onClick={handleLogout}
          sx={{ borderRadius: 2, py: 1 }}
        >
          <ListItemIcon sx={{ minWidth: 36, color: c.error }}>
            <ExitToApp sx={{ fontSize: 20 }} />
          </ListItemIcon>
          <ListItemText
            primary="Logout"
            slotProps={{ primary: { sx: { fontSize: '0.85rem', color: c.error } } }}
          />
        </ListItemButton>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: 'calc(100vh / var(--zoom-scale, 0.8))', background: c.background }}>
      {/* Sidebar */}
      <Drawer
        variant={isMobile ? 'temporary' : 'persistent'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          width: drawerOpen ? DRAWER_WIDTH : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            background: c.sidebar,
            borderRight: `1px solid ${c.borderMuted}`,
          },
        }}
      >
        {sidebarContent}
      </Drawer>

      {/* Main content */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          transition: 'all 0.3s ease',
        }}
      >
        {/* Top AppBar */}
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            background: c.appBarBg,
            backdropFilter: 'blur(10px)',
            borderBottom: `1px solid ${c.borderMuted}`,
          }}
        >
          <Toolbar sx={{ gap: 1 }}>
            {(!drawerOpen || isMobile) && (
              <IconButton
                id="toggle-sidebar-btn"
                onClick={() => setDrawerOpen(true)}
                sx={{ color: c.textSecondary }}
              >
                <MenuIcon />
              </IconButton>
            )}
            <Analytics sx={{ color: c.primary, mr: 0.5 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: c.textPrimary, flex: 1 }}>
              {filteredNav.find((n) => n.path === location.pathname)?.label || 'Dashboard'}
            </Typography>

            {/* Theme Toggle */}
            <Tooltip title={mode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
              <IconButton
                id="theme-toggle-btn"
                onClick={toggleTheme}
                sx={{ color: c.textSecondary }}
              >
                {mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
              </IconButton>
            </Tooltip>

            <Tooltip title="Notifications">
              <IconButton sx={{ color: c.textSecondary }}>
                <Badge badgeContent={0} color="error">
                  <Notifications />
                </Badge>
              </IconButton>
            </Tooltip>
            <Tooltip title="Account">
              <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    background: 'linear-gradient(135deg, #6C63FF, #FF6584)',
                    fontSize: '0.8rem',
                  }}
                >
                  {user?.full_name?.charAt(0)}
                </Avatar>
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>

        {/* User menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          slotProps={{
            paper: { sx: { background: c.menuBg, border: `1px solid ${c.borderStrong}`, mt: 1 } },
          }}
        >
          <MenuItem onClick={() => { navigate('/profile'); setAnchorEl(null) }}>
            <Person fontSize="small" sx={{ mr: 1, color: c.textSecondary }} /> Profile
          </MenuItem>
          <Divider sx={{ borderColor: c.borderMuted }} />
          <MenuItem onClick={handleLogout} sx={{ color: c.error }}>
            <ExitToApp fontSize="small" sx={{ mr: 1 }} /> Logout
          </MenuItem>
        </Menu>

        {/* Page content */}
        <Box sx={{ flex: 1, p: { xs: 2, md: 3 }, overflowX: 'hidden' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}