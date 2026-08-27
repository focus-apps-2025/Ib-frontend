import {
  Box, Card, CardContent, Typography, Grid, Switch, FormControlLabel,
  TextField, Button, Divider, Chip,
} from '@mui/material'
import { useThemeStore } from '../../store/themeStore'
import { useThemeColors } from '../../utils/colors'

export default function SettingsPage() {
  const { mode, setMode } = useThemeStore()
  const c = useThemeColors()

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: c.textPrimary }}>⚙️ System Settings</Typography>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: c.textPrimary }}>📧 Email Configuration</Typography>
              <TextField fullWidth label="SMTP Server" defaultValue="smtp.gmail.com" size="small" sx={{ mb: 2 }} slotProps={{ htmlInput: { id: 'smtp-server' } }} />
              <TextField fullWidth label="SMTP Port" defaultValue="587" size="small" sx={{ mb: 2 }} slotProps={{ htmlInput: { id: 'smtp-port' } }} />
              <TextField fullWidth label="Email Username" size="small" sx={{ mb: 2 }} slotProps={{ htmlInput: { id: 'smtp-user' } }} />
              <TextField fullWidth label="Email Password" type="password" size="small" sx={{ mb: 2 }} slotProps={{ htmlInput: { id: 'smtp-pass' } }} />
              <Button variant="contained" id="save-email-btn" sx={{ background: 'linear-gradient(135deg, #6C63FF, #9A94FF)' }}>Save Email Config</Button>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: c.textPrimary }}>📁 Upload Settings</Typography>
              <TextField fullWidth label="Max File Size (MB)" defaultValue="100" size="small" sx={{ mb: 2 }} slotProps={{ htmlInput: { id: 'max-file-size' } }} />
              <TextField fullWidth label="Max Records per Upload" defaultValue="200000" size="small" sx={{ mb: 2 }} slotProps={{ htmlInput: { id: 'max-records' } }} />
              <TextField fullWidth label="Chunk Size (rows)" defaultValue="1000" size="small" sx={{ mb: 2 }} slotProps={{ htmlInput: { id: 'chunk-size' } }} />
              <Divider sx={{ my: 2, borderColor: c.border }} />
              <FormControlLabel control={<Switch defaultChecked id="maintenance-mode" />} label="Maintenance Mode" sx={{ color: c.textSecondary }} />
              <Button variant="contained" id="save-upload-settings-btn" sx={{ mt: 2, display: 'block', background: 'linear-gradient(135deg, #6C63FF, #9A94FF)' }}>Save Settings</Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Appearance / Theme Settings */}
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 3, color: c.textPrimary }}>🎨 Appearance</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <Chip
                  id="theme-dark-option"
                  label="🌙 Dark Mode"
                  onClick={() => setMode('dark')}
                  clickable
                  sx={{
                    background: mode === 'dark' ? 'linear-gradient(135deg, #6C63FF, #9A94FF)' : 'transparent',
                    color: mode === 'dark' ? '#fff' : c.textSecondary,
                    border: `1px solid ${mode === 'dark' ? 'transparent' : c.border}`,
                    fontWeight: 600,
                    px: 1,
                  }}
                />
                <Chip
                  id="theme-light-option"
                  label="☀️ Light Mode"
                  onClick={() => setMode('light')}
                  clickable
                  sx={{
                    background: mode === 'light' ? 'linear-gradient(135deg, #6C63FF, #9A94FF)' : 'transparent',
                    color: mode === 'light' ? '#fff' : c.textSecondary,
                    border: `1px solid ${mode === 'light' ? 'transparent' : c.border}`,
                    fontWeight: 600,
                    px: 1,
                  }}
                />
                <Typography variant="caption" sx={{ color: c.textMuted, ml: 'auto' }}>
                  Current: {mode === 'dark' ? 'Dark Mode' : 'Light Mode'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
