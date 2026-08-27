import { useState, useEffect } from 'react'
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableHead, TableRow, Chip, CircularProgress, TextField, FormControl,
  InputLabel, Select, MenuItem, Button, Pagination,
} from '@mui/material'
import { activityLogsApi } from '../../lib/api'
import { useThemeColors } from '../../utils/colors'

interface Log { id: string; username?: string; action: string; details?: Record<string, unknown>; ip_address?: string; created_at: string }

const ACTION_COLORS: Record<string, string> = {
  login: '#4ECCA3', logout: '#9090C0', upload: '#6C63FF',
  export: '#FFD93D', delete: '#FF6B6B', create: '#4ECCA3', update: '#FF8A65', view: '#26C6DA',
}

export default function ActivityLogsPage() {
  const c = useThemeColors()
  const [logs, setLogs] = useState<Log[]>([])
  const [total, setTotal] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await activityLogsApi.list({
        page, page_size: 50,
        action: actionFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      })
      setLogs(res.data.data || [])
      setTotal(res.data.total_pages || 1)
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [page, actionFilter, dateFrom, dateTo])

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: c.textPrimary }}>
        📜 Activity Logs
      </Typography>

      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Action</InputLabel>
              <Select id="filter-action" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} label="Action">
                <MenuItem value="">All Actions</MenuItem>
                {['login', 'logout', 'upload', 'export', 'delete', 'create', 'update'].map((a) =>
                  <MenuItem key={a} value={a}>{a}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField size="small" id="log-date-from" label="From Date" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 150 }} />
            <TextField size="small" id="log-date-to" label="To Date" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 150 }} />
            <Button size="small" onClick={() => { setActionFilter(''); setDateFrom(''); setDateTo(''); setPage(1) }} sx={{ color: c.secondary }}>Reset</Button>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress sx={{ color: c.primary }} /></Box> : (
            <>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead><TableRow>
                    <TableCell>#</TableCell><TableCell>User</TableCell><TableCell>Action</TableCell>
                    <TableCell>Details</TableCell><TableCell>IP</TableCell><TableCell>Time</TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {logs.map((log, idx) => (
                      <TableRow key={log.id} sx={{ '&:hover': { background: c.tableHover } }}>
                        <TableCell sx={{ color: c.textMuted, fontSize: '0.8rem' }}>{(page - 1) * 50 + idx + 1}</TableCell>
                        <TableCell sx={{ color: c.textPrimary, fontWeight: 500, fontSize: '0.85rem' }}>
                          {log.username || 'System'}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={log.action}
                            size="small"
                            sx={{
                              fontSize: '0.7rem',
                              background: `${ACTION_COLORS[log.action] || '#9090C0'}20`,
                              color: ACTION_COLORS[log.action] || '#9090C0',
                              textTransform: 'capitalize',
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ color: c.textSecondary, fontSize: '0.8rem', maxWidth: 300 }}>
                          {log.details?.description as string || JSON.stringify(log.details || {}).substring(0, 80)}
                        </TableCell>
                        <TableCell sx={{ color: c.textMuted, fontSize: '0.8rem' }}>{log.ip_address || '—'}</TableCell>
                        <TableCell sx={{ color: c.textMuted, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                          {new Date(log.created_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                <Pagination count={total} page={page} onChange={(_, v) => setPage(v)} color="primary" />
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}
