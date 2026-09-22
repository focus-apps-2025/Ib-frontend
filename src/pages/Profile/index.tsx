import { useState } from 'react'
import {
  Box, Card, CardContent, Typography, TextField, Button,
  Avatar, Grid, Alert, CircularProgress,
} from '@mui/material'
import { useAuthStore } from '../../store'
import { authApi } from '../../lib/api'
import { useThemeColors } from '../../utils/colors'

export default function ProfilePage() {
  const { user } = useAuthStore()
  const c = useThemeColors()
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChangePassword = async () => {
    if (newPwd.length < 8) { setError('New password must be at least 8 characters'); return }
    setLoading(true); setError(''); setSuccess('')
    try {
      await authApi.changePassword({ current_password: currentPwd, new_password: newPwd })
      setSuccess('Password changed successfully!'); setCurrentPwd(''); setNewPwd('')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setError(err.response?.data?.detail || 'Error changing password')
    }
    setLoading(false)
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: c.textPrimary }}>👤 My Profile</Typography>
      <Grid container spacing={3}>
        <Grid size={{xs: 12, md: 5}}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Avatar sx={{ width: 80, height: 80, mx: 'auto', mb: 2, background: 'linear-gradient(135deg, #6C63FF, #FF6584)', fontSize: '2rem' }}>
                {user?.full_name?.charAt(0)}
              </Avatar>
              <Typography variant="h6" sx={{ fontWeight: 700, color: c.textPrimary }}>{user?.full_name}</Typography>
              <Typography variant="body2" sx={{ color: c.textSecondary }}>{user?.email}</Typography>
              <Typography variant="caption" sx={{ color: '#6C63FF', display: 'block', mt: 0.5 }}>
                @{user?.username} · {user?.role === 'super_admin' ? 'Super Admin' : 'Admin'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{xs: 12, md: 7}}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: c.textPrimary }}>🔒 Change Password</Typography>
              {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              <TextField fullWidth label="Current Password" type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} sx={{ mb: 2 }} slotProps={{ htmlInput: { id: 'current-password' } }} />
              <TextField fullWidth label="New Password" type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} sx={{ mb: 3 }} slotProps={{ htmlInput: { id: 'new-password' } }} />
              <Button id="change-password-btn" variant="contained" onClick={handleChangePassword} disabled={loading}
                sx={{ background: 'linear-gradient(135deg, #6C63FF, #9A94FF)' }}>
                {loading ? <CircularProgress size={18} color="inherit" /> : 'Update Password'}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
