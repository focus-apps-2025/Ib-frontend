import { useState } from 'react'
import {
  Box, Card, CardContent, TextField, Button, Typography,
  InputAdornment, IconButton, Alert, CircularProgress, Chip,
} from '@mui/material'
import { Visibility, VisibilityOff, DirectionsCar, Lock, Person } from '@mui/icons-material'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../../lib/api'
import { useAuthStore } from '../../store'
import { useThemeStore } from '../../store/themeStore'
import { useThemeColors } from '../../utils/colors'

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const { mode, toggleTheme } = useThemeStore()
  const c = useThemeColors()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    setError('')
    try {
      const res = await authApi.login(data)
      const { access_token, refresh_token, user } = res.data
      setAuth(user, access_token, refresh_token)
      navigate('/dashboard')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setError(e.response?.data?.detail || 'Invalid credentials. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: c.loginBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(108,99,255,0.15) 0%, transparent 70%)',
          top: -200,
          right: -100,
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,101,132,0.1) 0%, transparent 70%)',
          bottom: -100,
          left: -100,
        },
      }}
    >
      <Box sx={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 440, px: 2 }}>
        {/* Logo */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box
            sx={{
              display: 'inline-flex',
              p: 2,
              borderRadius: 3,
              background: 'linear-gradient(135deg, #6C63FF, #FF6584)',
              mb: 2,
              boxShadow: '0 8px 32px rgba(108,99,255,0.4)',
            }}
          >
            <DirectionsCar sx={{ fontSize: 36, color: '#fff' }} />
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: c.textPrimary, letterSpacing: '-0.02em' }}>
            VehicleIQ
          </Typography>
          <Typography variant="body2" sx={{ color: c.textMuted, mt: 0.5 }}>
            Complaint Analysis & Dashboard Platform
          </Typography>

          {/* Theme toggle on login */}
          <IconButton
            id="login-theme-toggle-btn"
            onClick={toggleTheme}
            sx={{
              mt: 1.5,
              color: c.textSecondary,
              border: `1px solid ${c.border}`,
              borderRadius: 2,
              '&:hover': { background: 'rgba(108,99,255,0.08)' },
            }}
          >
            {mode === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </IconButton>
        </Box>

        <Card
          sx={{
            background: c.loginCardBg,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${c.borderStrong}`,
            boxShadow: c.loginShadow,
          }}
        >
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h6" sx={{ mb: 3, color: c.textPrimary, fontWeight: 600 }}>
              Sign in to your account
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)}>
              <TextField
                {...register('username')}
                fullWidth
                label="Username or Email"
                variant="outlined"
                error={!!errors.username}
                helperText={errors.username?.message}
                sx={{ mb: 2.5 }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Person sx={{ color: c.textMuted, fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  },
                  htmlInput: { id: 'login-username' },
                }}
              />
              <TextField
                {...register('password')}
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                variant="outlined"
                error={!!errors.password}
                helperText={errors.password?.message}
                sx={{ mb: 3 }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock sx={{ color: c.textMuted, fontSize: 20 }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          id="toggle-password-visibility"
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                  htmlInput: { id: 'login-password' },
                }}
              />

              <Button
                id="login-submit-btn"
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading}
                sx={{
                  background: 'linear-gradient(135deg, #6C63FF, #9A94FF)',
                  py: 1.5,
                  fontSize: '1rem',
                  fontWeight: 700,
                  boxShadow: '0 4px 20px rgba(108,99,255,0.4)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5A52DD, #8880EE)',
                    boxShadow: '0 6px 28px rgba(108,99,255,0.6)',
                  },
                }}
              >
                {loading ? <CircularProgress size={22} color="inherit" /> : 'Sign In'}
              </Button>
            </form>

            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Chip
                size="small"
                label="Default: superadmin / SuperAdmin@123"
                sx={{ fontSize: '0.7rem', color: c.textMuted, borderColor: c.borderStrong }}
                variant="outlined"
              />
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  )
}