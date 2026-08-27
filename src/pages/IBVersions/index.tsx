import { useState, useEffect } from 'react'
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableHead, TableRow, Button, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Tooltip, CircularProgress, Chip,
} from '@mui/material'
import { Add, Edit, Delete } from '@mui/icons-material'
import { ibVersionsApi } from '../../lib/api'
import { useThemeColors } from '../../utils/colors'

interface IBVersion { id: string; name: string; display_order: number; created_at: string }

export default function IBVersionsPage() {
  const c = useThemeColors()
  const [versions, setVersions] = useState<IBVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editVersion, setEditVersion] = useState<IBVersion | null>(null)
  const [name, setName] = useState('')

  const load = async () => {
    setLoading(true)
    try { const r = await ibVersionsApi.list(); setVersions(r.data.data || []) } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    try {
      if (editVersion) await ibVersionsApi.update(editVersion.id, { name })
      else await ibVersionsApi.create({ name })
      setDialogOpen(false); load()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      alert(err.response?.data?.detail || 'Error')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete IB Version?')) return
    await ibVersionsApi.delete(id); load()
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: c.textPrimary }}>📋 IB Version Management</Typography>
        <Button id="create-ib-btn" variant="contained" startIcon={<Add />}
          onClick={() => { setEditVersion(null); setName(''); setDialogOpen(true) }}
          sx={{ background: 'linear-gradient(135deg, #6C63FF, #9A94FF)' }}>Add IB Version</Button>
      </Box>
      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress sx={{ color: c.primary }} /></Box> : (
            <Table>
              <TableHead><TableRow>
                <TableCell>#</TableCell><TableCell>Name</TableCell><TableCell>Order</TableCell><TableCell>Created</TableCell><TableCell>Actions</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {versions.map((v, idx) => (
                  <TableRow key={v.id} sx={{ '&:hover': { background: c.tableHover } }}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell><Chip label={v.name} sx={{ background: 'linear-gradient(135deg, rgba(108,99,255,0.3), rgba(154,148,255,0.2))', color: c.primaryLight, fontWeight: 700 }} /></TableCell>
                    <TableCell sx={{ color: c.textMuted }}>{v.display_order}</TableCell>
                    <TableCell sx={{ color: c.textMuted, fontSize: '0.8rem' }}>{new Date(v.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Tooltip title="Edit"><IconButton id={`edit-ib-${v.id}`} size="small" onClick={() => { setEditVersion(v); setName(v.name); setDialogOpen(true) }} sx={{ color: c.primaryLight }}><Edit fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Delete"><IconButton id={`delete-ib-${v.id}`} size="small" onClick={() => handleDelete(v.id)} sx={{ color: c.error }}><Delete fontSize="small" /></IconButton></Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth
        slotProps={{ paper: { sx: { background: c.dialogBg, border: `1px solid ${c.borderStrong}` } } }}>
        <DialogTitle sx={{ color: c.textPrimary, fontWeight: 700 }}>{editVersion ? 'Edit IB Version' : 'Add IB Version'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Name (e.g. IB1)" value={name} onChange={(e) => setName(e.target.value)} sx={{ mt: 1 }} slotProps={{ htmlInput: { id: 'ib-name' } }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: c.textSecondary }}>Cancel</Button>
          <Button id="save-ib-btn" variant="contained" onClick={save} sx={{ background: 'linear-gradient(135deg, #6C63FF, #9A94FF)' }}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
