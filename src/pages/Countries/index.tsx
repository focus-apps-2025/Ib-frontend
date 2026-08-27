import { useState, useEffect } from 'react'
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableHead, TableRow, Button, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem, FormControl,
  InputLabel, Tooltip, CircularProgress, Chip,
} from '@mui/material'
import { Add, Edit, Delete } from '@mui/icons-material'
import { countriesApi, regionsApi } from '../../lib/api'
import { useThemeColors } from '../../utils/colors'

interface Country { id: string; name: string; region_id: string; region_name: string; created_at: string }
interface Region { id: string; name: string }

export default function CountriesPage() {
  const c = useThemeColors()
  const [countries, setCountries] = useState<Country[]>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [loading, setLoading] = useState(true)
  const [filterRegion, setFilterRegion] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editCountry, setEditCountry] = useState<Country | null>(null)
  const [formName, setFormName] = useState('')
  const [formRegion, setFormRegion] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [cr, rr] = await Promise.all([countriesApi.list(filterRegion || undefined), regionsApi.list()])
      setCountries(cr.data.data || [])
      setRegions(rr.data.data || [])
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [filterRegion])

  const openCreate = () => { setEditCountry(null); setFormName(''); setFormRegion(''); setDialogOpen(true) }
  const openEdit = (c: Country) => { setEditCountry(c); setFormName(c.name); setFormRegion(c.region_id); setDialogOpen(true) }

  const save = async () => {
    try {
      if (editCountry) await countriesApi.update(editCountry.id, { name: formName, region_id: formRegion })
      else await countriesApi.create({ name: formName, region_id: formRegion })
      setDialogOpen(false); load()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      alert(err.response?.data?.detail || 'Error')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete country?')) return
    await countriesApi.delete(id); load()
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: c.textPrimary }}>🗺️ Country Management</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Filter by Region</InputLabel>
            <Select value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)} label="Filter by Region" id="filter-region-countries">
              <MenuItem value="">All Regions</MenuItem>
              {regions.map((r) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
            </Select>
          </FormControl>
          <Button id="create-country-btn" variant="contained" startIcon={<Add />} onClick={openCreate}
            sx={{ background: 'linear-gradient(135deg, #6C63FF, #9A94FF)' }}>Add Country</Button>
        </Box>
      </Box>
      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress sx={{ color: c.primary }} /></Box> : (
            <Table>
              <TableHead><TableRow>
                <TableCell>#</TableCell><TableCell>Country Name</TableCell><TableCell>Region</TableCell><TableCell>Added</TableCell><TableCell>Actions</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {countries.map((country, idx) => (
                  <TableRow key={country.id} sx={{ '&:hover': { background: c.tableHover } }}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: c.textPrimary }}>{country.name}</TableCell>
                    <TableCell><Chip label={country.region_name} size="small" sx={{ background: 'rgba(78,204,163,0.15)', color: '#4ECCA3', fontSize: '0.7rem' }} /></TableCell>
                    <TableCell sx={{ color: c.textMuted, fontSize: '0.8rem' }}>{new Date(country.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Tooltip title="Edit"><IconButton id={`edit-country-${country.id}`} size="small" onClick={() => openEdit(country)} sx={{ color: c.primaryLight }}><Edit fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Delete"><IconButton id={`delete-country-${country.id}`} size="small" onClick={() => handleDelete(country.id)} sx={{ color: c.error }}><Delete fontSize="small" /></IconButton></Tooltip>
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
        <DialogTitle sx={{ color: c.textPrimary, fontWeight: 700 }}>{editCountry ? 'Edit Country' : 'Add Country'}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1, mb: 2 }}>
            <InputLabel>Region</InputLabel>
            <Select value={formRegion} onChange={(e) => setFormRegion(e.target.value)} label="Region" id="country-region">
              {regions.map((r) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField fullWidth label="Country Name" value={formName} onChange={(e) => setFormName(e.target.value)} slotProps={{ htmlInput: { id: 'country-name' } }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: c.textSecondary }}>Cancel</Button>
          <Button id="save-country-btn" variant="contained" onClick={save} sx={{ background: 'linear-gradient(135deg, #6C63FF, #9A94FF)' }}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
