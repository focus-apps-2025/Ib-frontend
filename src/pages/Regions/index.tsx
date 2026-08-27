import { useState, useEffect } from 'react'
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableHead, TableRow, Button, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Tooltip, CircularProgress, Chip,
} from '@mui/material'
import { Add, Edit, Delete } from '@mui/icons-material'
import { regionsApi } from '../../lib/api'
import { useThemeColors } from '../../utils/colors'

interface Region { id: string; name: string; display_order: number; country_count: number; created_at: string }

export default function RegionsPage() {
  const c = useThemeColors()
  const [regions, setRegions] = useState<Region[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editRegion, setEditRegion] = useState<Region | null>(null)
  const [name, setName] = useState('')

  const load = async () => {
    setLoading(true)
    try { const r = await regionsApi.list(); setRegions(r.data.data || []) } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = () => { setEditRegion(null); setName(''); setDialogOpen(true) }
  const openEdit = (r: Region) => { setEditRegion(r); setName(r.name); setDialogOpen(true) }

  const save = async () => {
    try {
      if (editRegion) await regionsApi.update(editRegion.id, { name })
      else await regionsApi.create({ name })
      setDialogOpen(false); load()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      alert(err.response?.data?.detail || 'Error')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete region?')) return
    try { await regionsApi.delete(id); load() }
    catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      alert(err.response?.data?.detail || 'Cannot delete')
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: c.textPrimary }}>🌍 Region Management</Typography>
        <Button id="create-region-btn" variant="contained" startIcon={<Add />} onClick={openCreate}
          sx={{ background: 'linear-gradient(135deg, #6C63FF, #9A94FF)' }}>Add Region</Button>
      </Box>
      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress sx={{ color: c.primary }} /></Box> : (
            <Table>
              <TableHead><TableRow>
                <TableCell>#</TableCell><TableCell>Region Name</TableCell>
                <TableCell>Countries</TableCell><TableCell>Created</TableCell><TableCell>Actions</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {regions.map((r, idx) => (
                  <TableRow key={r.id} sx={{ '&:hover': { background: c.tableHover } }}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: c.textPrimary }}>{r.name}</TableCell>
                    <TableCell><Chip label={`${r.country_count} countries`} size="small" sx={{ background: 'rgba(108,99,255,0.2)', color: c.primaryLight, fontSize: '0.7rem' }} /></TableCell>
                    <TableCell sx={{ color: c.textMuted, fontSize: '0.8rem' }}>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Tooltip title="Edit"><IconButton id={`edit-region-${r.id}`} size="small" onClick={() => openEdit(r)} sx={{ color: c.primaryLight }}><Edit fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Delete"><IconButton id={`delete-region-${r.id}`} size="small" onClick={() => handleDelete(r.id)} sx={{ color: c.error }}><Delete fontSize="small" /></IconButton></Tooltip>
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
        <DialogTitle sx={{ color: c.textPrimary, fontWeight: 700 }}>{editRegion ? 'Edit Region' : 'Add Region'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Region Name" value={name} onChange={(e) => setName(e.target.value)} sx={{ mt: 1 }} slotProps={{ htmlInput: { id: 'region-name' } }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: c.textSecondary }}>Cancel</Button>
          <Button id="save-region-btn" variant="contained" onClick={save} sx={{ background: 'linear-gradient(135deg, #6C63FF, #9A94FF)' }}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
