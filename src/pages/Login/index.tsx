import { useState } from 'react'
import {
  Box, Card, CardContent, TextField, Button, Typography,
  InputAdornment, IconButton, Alert, CircularProgress, Chip,
  Divider, Stack, alpha,
} from '@mui/material'
import {
  Visibility, VisibilityOff, DirectionsCar, Lock, Person,
  Shield, VerifiedUser, WorkspacePremium,
} from '@mui/icons-material'
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
        minHeight: '125vh',
        display: 'flex',
        background: c.loginRightBg,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ─── AMBIENT BACKGROUND ORBS ─── */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          '&::before': {
            content: '""',
            position: 'absolute',
            width: 700,
            height: 700,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${alpha(c.goldAccent || '#C9A961', 0.08)} 0%, transparent 60%)`,
            top: -300,
            right: -200,
            animation: 'float 20s ease-in-out infinite',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${alpha(c.primary, 0.1)} 0%, transparent 70%)`,
            bottom: -200,
            left: '30%',
            animation: 'float 25s ease-in-out infinite reverse',
          },
          '@keyframes float': {
            '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
            '50%': { transform: 'translate(40px, -40px) scale(1.05)' },
          },
        }}
      />

      {/* ─── LEFT HERO PANEL ─── */}
      <Box
        sx={{
          display: { xs: 'none', lg: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '48%',
          background: c.loginHeroBg,
          position: 'relative',
          overflow: 'hidden',
          p: 6,
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle at 30% 20%, ${alpha(c.goldAccent || '#C9A961', 0.15)} 0%, transparent 50%)`,
            pointerEvents: 'none',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            backgroundImage: `linear-gradient(${alpha('#FFFFFF', 0.02)} 1px, transparent 1px), linear-gradient(90deg, ${alpha('#FFFFFF', 0.02)} 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
            pointerEvents: 'none',
          },
        }}
      >
        {/* Hero Top: Logo + Brand */}
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box
              sx={{
                display: 'inline-flex',
                p: 1.5,
                borderRadius: 2,
                background: `linear-gradient(135deg, ${c.goldAccent || '#C9A961'}, ${c.goldAccentLight || '#E8D5A0'})`,
                boxShadow: `0 8px 24px ${alpha(c.goldAccent || '#C9A961', 0.35)}`,
              }}
            >
              <DirectionsCar sx={{ fontSize: 26, color: '#1A1A2E' }} />
            </Box>
            <Box>
              <Typography
                sx={{
                  fontWeight: 800,
                  color: '#FFFFFF',
                  letterSpacing: '0.18em',
                  fontSize: '1.05rem',
                  lineHeight: 1,
                }}
              >
                V Q S
              </Typography>
              <Typography
                sx={{
                  color: alpha('#FFFFFF', 0.55),
                  fontSize: '0.7rem',
                  letterSpacing: '0.15em',
                  mt: 0.5,
                }}
              >
                VEHICLE QUALITY SURVEY
              </Typography>
            </Box>
          </Stack>
        </Box>

        {/* Hero Center: Big Statement */}
        <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 480 }}>
          <Chip
            icon={<WorkspacePremium sx={{ fontSize: 14, color: `${c.goldAccent} !important` }} />}
            label="ENTERPRISE EDITION"
            size="small"
            sx={{
              mb: 3,
              background: alpha(c.goldAccent || '#C9A961', 0.12),
              color: c.goldAccentLight || '#E8D5A0',
              border: `1px solid ${alpha(c.goldAccent || '#C9A961', 0.3)}`,
              fontWeight: 600,
              letterSpacing: '0.1em',
              fontSize: '0.65rem',
            }}
          />

          <Typography
            sx={{
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: { lg: '2.6rem', xl: '3rem' },
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              mb: 2.5,
              fontFamily: '"Playfair Display", "Georgia", serif',
            }}
          >
            Precision Insights.
            <br />
            <Box
              component="span"
              sx={{
                background: `linear-gradient(135deg, ${c.goldAccent || '#C9A961'}, ${c.goldAccentLight || '#E8D5A0'})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Refined Decisions.
            </Box>
          </Typography>

          <Typography
            sx={{
              color: alpha('#FFFFFF', 0.7),
              fontSize: '1rem',
              lineHeight: 1.7,
              mb: 4,
              maxWidth: 420,
            }}
          >
            Analyze customer feedback, NPS metrics, and quality trends across your entire vehicle portfolio — all in one refined platform.
          </Typography>

          {/* Feature bullets */}
          <Stack spacing={1.5}>
            {[
              'Real-time NPS & satisfaction analytics',
              'Brand-wise issue & benefit intelligence',
              'Executive-grade reporting & exports',
            ].map((feat) => (
              <Stack key={feat} direction="row" alignItems="center" spacing={1.5}>
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: c.goldAccent || '#C9A961',
                    boxShadow: `0 0 12px ${c.goldAccent || '#C9A961'}`,
                  }}
                />
                <Typography sx={{ color: alpha('#FFFFFF', 0.8), fontSize: '0.85rem' }}>
                  {feat}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        {/* Hero Bottom: Trust Footer */}
        <Stack direction="row" spacing={3} sx={{ position: 'relative', zIndex: 1 }}>
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <Shield sx={{ fontSize: 14, color: alpha('#FFFFFF', 0.4) }} />
            <Typography sx={{ color: alpha('#FFFFFF', 0.4), fontSize: '0.7rem', letterSpacing: '0.05em' }}>
              SECURE ACCESS
            </Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <VerifiedUser sx={{ fontSize: 14, color: alpha('#FFFFFF', 0.4) }} />
            <Typography sx={{ color: alpha('#FFFFFF', 0.4), fontSize: '0.7rem', letterSpacing: '0.05em' }}>
              ISO CERTIFIED
            </Typography>
          </Stack>
        </Stack>
      </Box>

      {/* ─── RIGHT LOGIN PANEL ─── */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          zIndex: 1,
          px: { xs: 2, sm: 4, md: 6 },
          py: 4,
        }}
      >
        {/* Theme toggle (top-right) */}
        <IconButton
          id="login-theme-toggle-btn"
          onClick={toggleTheme}
          sx={{
            position: 'absolute',
            top: { xs: 16, md: 24 },
            right: { xs: 16, md: 24 },
            color: c.textSecondary,
            border: `1px solid ${c.border}`,
            borderRadius: 2,
            px: 1.5,
            py: 0.75,
            fontSize: '0.7rem',
            fontWeight: 600,
            letterSpacing: '0.05em',
            '&:hover': {
              background: c.primaryBg,
              borderColor: c.borderStrong,
            },
          }}
        >
          {mode === 'dark' ? '☀️ LIGHT' : '🌙 DARK'}
        </IconButton>

        <Box sx={{ width: '100%', maxWidth: 420 }}>
          {/* Mobile Logo (shown only on small screens) */}
          <Box sx={{ textAlign: 'center', mb: 4, display: { lg: 'none' } }}>
            <Box
              sx={{
                display: 'inline-flex',
                p: 1.5,
                borderRadius: 2,
                background: `linear-gradient(135deg, ${c.goldAccent || '#C9A961'}, ${c.goldAccentLight || '#E8D5A0'})`,
                mb: 2,
                boxShadow: `0 8px 24px ${alpha(c.goldAccent || '#C9A961', 0.35)}`,
              }}
            >
              <DirectionsCar sx={{ fontSize: 28, color: '#1A1A2E' }} />
            </Box>
            <Typography sx={{ fontWeight: 800, color: c.textPrimary, letterSpacing: '0.18em', fontSize: '1rem' }}>
              V Q S
            </Typography>
          </Box>

          {/* Welcome Heading */}
          <Box sx={{ mb: 4 }}>
            <Typography
              sx={{
                fontWeight: 700,
                color: c.textPrimary,
                fontSize: '1.75rem',
                letterSpacing: '-0.02em',
                mb: 1,
              }}
            >
              Welcome back
            </Typography>
            <Typography sx={{ color: c.textSecondary, fontSize: '0.9rem' }}>
              Sign in to continue to your dashboard
            </Typography>
          </Box>

          {/* Premium Card */}
          <Card
            sx={{
              background: c.loginCardBgPremium || c.loginCardBg,
              backdropFilter: 'blur(24px)',
              border: `1px solid ${c.borderStrong}`,
              borderRadius: 3,
              boxShadow: c.loginShadowPremium || c.loginShadow,
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                background: `linear-gradient(90deg, ${c.goldAccent || '#C9A961'}, ${c.primary}, ${c.goldAccent || '#C9A961'})`,
              },
            }}
          >
            <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
              {error && (
                <Alert
                  severity="error"
                  sx={{
                    mb: 3,
                    borderRadius: 2,
                    border: `1px solid ${alpha(c.error, 0.3)}`,
                    background: alpha(c.error, 0.08),
                  }}
                >
                  {error}
                </Alert>
              )}

              <form onSubmit={handleSubmit(onSubmit)}>
                {/* Username Field */}
                <Typography
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: c.textMuted,
                    letterSpacing: '0.1em',
                    mb: 1,
                  }}
                >
                  USERNAME OR EMAIL
                </Typography>
                <TextField
                  {...register('username')}
                  fullWidth
                  placeholder="Enter your username"
                  variant="outlined"
                  error={!!errors.username}
                  helperText={errors.username?.message}
                  sx={{
                    mb: 2.5,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      background: alpha(c.textPrimary, 0.02),
                      transition: 'all 0.2s ease',
                      '& fieldset': {
                        borderColor: c.border,
                      },
                      '&:hover fieldset': {
                        borderColor: c.borderStrong,
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: c.primary,
                        borderWidth: 2,
                      },
                    },
                    '& .MuiInputBase-input': {
                      py: 1.5,
                      fontSize: '0.9rem',
                    },
                  }}
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

                {/* Password Field */}
                <Typography
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: c.textMuted,
                    letterSpacing: '0.1em',
                    mb: 1,
                  }}
                >
                  PASSWORD
                </Typography>
                <TextField
                  {...register('password')}
                  fullWidth
                  placeholder="Enter your password"
                  type={showPassword ? 'text' : 'password'}
                  variant="outlined"
                  error={!!errors.password}
                  helperText={errors.password?.message}
                  sx={{
                    mb: 3,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      background: alpha(c.textPrimary, 0.02),
                      transition: 'all 0.2s ease',
                      '& fieldset': {
                        borderColor: c.border,
                      },
                      '&:hover fieldset': {
                        borderColor: c.borderStrong,
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: c.primary,
                        borderWidth: 2,
                      },
                    },
                    '& .MuiInputBase-input': {
                      py: 1.5,
                      fontSize: '0.9rem',
                    },
                  }}
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
                            size="small"
                            sx={{ color: c.textMuted }}
                          >
                            {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                    htmlInput: { id: 'login-password' },
                  }}
                />

                {/* Submit Button */}
                <Button
                  id="login-submit-btn"
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={loading}
                  sx={{
                    background: `linear-gradient(135deg, ${c.goldAccent || '#C9A961'}, ${c.goldAccentDark || '#A8894A'})`,
                    color: '#1A1A2E',
                    py: 1.75,
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    letterSpacing: '0.1em',
                    borderRadius: 2,
                    textTransform: 'uppercase',
                    boxShadow: `0 8px 24px ${alpha(c.goldAccent || '#C9A961', 0.35)}`,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      background: `linear-gradient(135deg, ${c.goldAccentLight || '#E8D5A0'}, ${c.goldAccent || '#C9A961'})`,
                      boxShadow: `0 12px 32px ${alpha(c.goldAccent || '#C9A961', 0.5)}`,
                      transform: 'translateY(-1px)',
                    },
                    '&:active': {
                      transform: 'translateY(0)',
                    },
                    '&.Mui-disabled': {
                      background: alpha(c.textMuted, 0.3),
                      color: alpha('#FFFFFF', 0.6),
                    },
                  }}
                >
                  {loading ? <CircularProgress size={22} sx={{ color: '#1A1A2E' }} /> : 'Sign In'}
                </Button>
              </form>

            </CardContent>
          </Card>

          {/* Footer */}
          <Typography
            sx={{
              textAlign: 'center',
              mt: 3,
              fontSize: '0.7rem',
              color: c.textMuted,
              letterSpacing: '0.05em',
            }}
          >
            © {new Date().getFullYear()} VQS Platform · v2.0 Enterprise
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}