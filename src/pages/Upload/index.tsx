import { useState, useEffect } from 'react'
import {
  Box, Card, CardContent, Stepper, Step, StepLabel, StepContent,
  Button, Typography, FormControl, InputLabel, Select, MenuItem,
  LinearProgress, Alert, Chip, Table, TableBody, TableCell,
  TableHead, TableRow, CircularProgress, IconButton, Tooltip,
} from '@mui/material'
import {
  CloudUpload, CheckCircle, Cancel, HourglassEmpty, Delete,
  Refresh, FolderOpen, FileDownload,
} from '@mui/icons-material'
import { useDropzone } from 'react-dropzone'
import { regionsApi, countriesApi, ibVersionsApi, uploadApi, usersApi } from '../../lib/api'
import { useThemeColors } from '../../utils/colors'
import { useAuthStore } from '../../store'
import * as XLSX from 'xlsx-js-style'
import { UPLOAD_TEMPLATE_HEADERS } from '../../utils/templateHeaders'

interface Region { id: string; name: string }
interface Country { id: string; name: string }
interface IBVersion { id: string; name: string }
interface UploadRecord {
  id: string; file_name: string; region_name: string; country_name: string
  ib_version_name: string; total_records: number; processed_records: number
  status: string; upload_started_at: string; uploader_name: string
  uploaded_by?: string
  assigned_admin_id?: string | null
  assigned_admin_name?: string
  assigned_admin_username?: string
  assigned_admin_email?: string
}

interface AdminScope {
  all_regions: boolean
  region_ids: string[]
  all_countries: boolean
  country_ids: string[]
  all_ib_versions: boolean
  ib_version_ids: string[]
}

export default function UploadPage() {
  const c = useThemeColors()
  const [activeStep, setActiveStep] = useState(0)
  const [regions, setRegions] = useState<Region[]>([])
  const [countries, setCountries] = useState<Country[]>([])
  const [ibVersions, setIbVersions] = useState<IBVersion[]>([])
  const [selectedRegion, setSelectedRegion] = useState('')
  const [selectedCountry, setSelectedCountry] = useState('')
  const [selectedIB, setSelectedIB] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<Record<string, string>>({})
  const [uploadError, setUploadError] = useState('')
  const [uploadHistory, setUploadHistory] = useState<UploadRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const user = useAuthStore((s) => s.user)
  const [admins, setAdmins] = useState<{ id: string, full_name: string, username: string }[]>([])
  const [selectedAdminId, setSelectedAdminId] = useState('')
  const [adminScope, setAdminScope] = useState<AdminScope | null>(null)

  const stepOffset = user?.role === 'super_admin' ? 1 : 0

  useEffect(() => {
    regionsApi.list().then((r) => setRegions(r.data.data || []))
    ibVersionsApi.list().then((r) => setIbVersions(r.data.data || []))
    loadHistory()
    if (user?.role === 'super_admin') {
      usersApi.list({ role: 'admin' }).then((r) => setAdmins(r.data.data || []))
    }
  }, [user?.role])

  useEffect(() => {
    if (selectedRegion) {
      countriesApi.byRegion(selectedRegion).then((r) => setCountries(r.data.data || []))
      setSelectedCountry('')
    }
  }, [selectedRegion])

  useEffect(() => {
    if (selectedAdminId) {
      usersApi.getScope(selectedAdminId).then((r) => setAdminScope(r.data)).catch(() => setAdminScope(null))
    } else {
      setAdminScope(null)
    }
  }, [selectedAdminId])

  const filteredRegions = adminScope && !adminScope.all_regions
    ? regions.filter(r => adminScope.region_ids.includes(r.id))
    : regions;

  const filteredCountries = adminScope && !adminScope.all_countries
    ? countries.filter(c => adminScope.country_ids.includes(c.id))
    : countries;

  const filteredIBVersions = adminScope && !adminScope.all_ib_versions
    ? ibVersions.filter(v => adminScope.ib_version_ids.includes(v.id))
    : ibVersions;

  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const res = await uploadApi.list({ page_size: 25 })
      setUploadHistory(res.data.data || [])
    } catch { /* ignore */ }
    setHistoryLoading(false)
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    onDrop: (accepted) => {
      if (accepted.length > 0) setUploadedFile(accepted[0])
    },
  })

  const handleUpload = async () => {
    if (!uploadedFile || !selectedRegion || !selectedCountry || !selectedIB) return
    setUploading(true)
    setUploadError('')
    try {
      const form = new FormData()
      form.append('region_id', selectedRegion)
      form.append('country_id', selectedCountry)
      form.append('ib_version_id', selectedIB)
      if (selectedAdminId) {
        form.append('assigned_admin_id', selectedAdminId)
      }
      form.append('file', uploadedFile)

      const res = await uploadApi.upload(form)
      const fileId = res.data.file_id
      setActiveStep(stepOffset + 4)

      // SSE Progress tracking
      const token = localStorage.getItem('access_token')
      const eventSource = new EventSource(`/api/upload/${fileId}/progress?token=${token || ''}`)
      eventSource.onmessage = (e) => {
        const data = JSON.parse(e.data)
        setUploadProgress(data)
        if (['completed', 'failed', 'partial'].includes(data.status)) {
          eventSource.close()
          loadHistory()
        }
      }
      eventSource.onerror = () => { eventSource.close(); loadHistory() }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setUploadError(e.response?.data?.detail || 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this upload and all associated data?')) return
    try {
      await uploadApi.delete(id)
      loadHistory()
    } catch { /* ignore */ }
  }

  const handleDownloadTemplate = () => {
    try {
      console.log('xlsx module =', XLSX)
      console.log('headers =', UPLOAD_TEMPLATE_HEADERS.length)

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet([UPLOAD_TEMPLATE_HEADERS])

      // Style header cells
      UPLOAD_TEMPLATE_HEADERS.forEach((header, idx) => {
        if (!header) return
        const ref = XLSX.utils.encode_cell({ r: 0, c: idx })
        const cell = (ws as any)[ref]
        if (!cell) {
          console.warn('missing cell for', header)
          return
        }

        cell.s = {
          fill: { patternType: 'solid', fgColor: { rgb: 'FF7C3AED' } },

          font: { name: 'Arial', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          border: {
            top: { style: 'thin', color: { rgb: '4B4B8F' } },
            bottom: { style: 'thin', color: { rgb: '4B4B8F' } },
            left: { style: 'thin', color: { rgb: '4B4B8F' } },
            right: { style: 'thin', color: { rgb: '4B4B8F' } },
          },
        }
      })

        ; (ws as any)['!cols'] = UPLOAD_TEMPLATE_HEADERS.map((h) => ({
          wch: Math.min(40, Math.max(14, (h || '').length + 2)),
        }))
        ; (ws as any)['!rows'] = [{ hpt: 45 }]

      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
      XLSX.writeFile(
        wb,
        `Template_${new Date().toISOString().split('T')[0]}.xlsx`
      )

      console.log('template written')
    } catch (err) {
      console.error('Failed to generate template:', err)
      setUploadError('Could not generate the Excel template. Please try again.')
    }
  }


  const canProceed = (stepIndex: number) => {
    if (user?.role === 'super_admin' && stepIndex === 0) return true
    if (stepIndex === stepOffset + 0) return !!selectedRegion
    if (stepIndex === stepOffset + 1) return !!selectedCountry
    if (stepIndex === stepOffset + 2) return !!selectedIB
    if (stepIndex === stepOffset + 3) return !!uploadedFile
    return false
  }

  const statusIcon = (status: string) => {
    if (status === 'completed') return <CheckCircle sx={{ color: '#4ECCA3', fontSize: 18 }} />
    if (status === 'failed') return <Cancel sx={{ color: '#FF6B6B', fontSize: 18 }} />
    return <HourglassEmpty sx={{ color: '#FFD93D', fontSize: 18 }} />
  }

  // ─── Superadmin: resolve the admin associated with an uploaded file ────────
  const historyAdminName = (u: UploadRecord): string => {
    if (user?.role === 'super_admin' && u.assigned_admin_name) return u.assigned_admin_name
    return u.uploader_name || '—'
  }

  const historyAdminUsername = (u: UploadRecord): string => {
    if (user?.role !== 'super_admin') return ''
    if (u.assigned_admin_username) return `@${u.assigned_admin_username}`
    const matched = admins.find((a) => a.id === u.uploaded_by)
    return matched ? `@${matched.username}` : ''
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: c.textPrimary }}>
        Upload Excel Data
      </Typography>

      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {/* Upload Wizard */}
        <Card sx={{ flex: '1 1 400px', minWidth: 0 }}>
          <CardContent>
            <Stepper activeStep={activeStep} orientation="vertical">
              {user?.role === 'super_admin' && (
                <Step>
                  <StepLabel>Select Admin</StepLabel>
                  <StepContent>
                    <FormControl fullWidth sx={{ mt: 1, mb: 2 }}>
                      <InputLabel>Assign to Admin (Optional)</InputLabel>
                      <Select
                        value={selectedAdminId}
                        onChange={(e) => {
                          setSelectedAdminId(e.target.value)
                          setSelectedRegion('')
                          setSelectedCountry('')
                          setSelectedIB('')
                        }}
                        label="Assign to Admin (Optional)"
                      >
                        <MenuItem value=""><em>None / Self</em></MenuItem>
                        {admins.map((a) => (
                          <MenuItem key={a.id} value={a.id}>{a.full_name} ({a.username})</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Button
                      variant="contained"
                      size="small"
                      disabled={!canProceed(0)}
                      onClick={() => setActiveStep(activeStep + 1)}
                      sx={{ background: 'linear-gradient(135deg, #6C63FF, #9A94FF)' }}
                    >
                      Next
                    </Button>
                  </StepContent>
                </Step>
              )}

              {/* Step 1: Region */}
              <Step>
                <StepLabel>Select Region</StepLabel>
                <StepContent>
                  <FormControl fullWidth sx={{ mt: 1, mb: 2 }}>
                    <InputLabel>Region</InputLabel>
                    <Select
                      id="upload-region-select"
                      value={selectedRegion}
                      onChange={(e) => setSelectedRegion(e.target.value)}
                      label="Region"
                    >
                      {filteredRegions.map((r) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {user?.role === 'super_admin' && (
                      <Button size="small" onClick={() => setActiveStep(activeStep - 1)}>Back</Button>
                    )}
                    <Button
                      id="step1-next"
                      variant="contained"
                      size="small"
                      disabled={!canProceed(stepOffset + 0)}
                      onClick={() => setActiveStep(activeStep + 1)}
                      sx={{ background: 'linear-gradient(135deg, #6C63FF, #9A94FF)' }}
                    >
                      Next
                    </Button>
                  </Box>
                </StepContent>
              </Step>

              {/* Step 2: Country */}
              <Step>
                <StepLabel>Select Country</StepLabel>
                <StepContent>
                  <FormControl fullWidth sx={{ mt: 1, mb: 2 }}>
                    <InputLabel>Country</InputLabel>
                    <Select
                      id="upload-country-select"
                      value={selectedCountry}
                      onChange={(e) => setSelectedCountry(e.target.value)}
                      label="Country"
                    >
                      {filteredCountries.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button size="small" onClick={() => setActiveStep(activeStep - 1)}>Back</Button>
                    <Button
                      id="step2-next"
                      variant="contained"
                      size="small"
                      disabled={!canProceed(stepOffset + 1)}
                      onClick={() => setActiveStep(activeStep + 1)}
                      sx={{ background: 'linear-gradient(135deg, #6C63FF, #9A94FF)' }}
                    >
                      Next
                    </Button>
                  </Box>
                </StepContent>
              </Step>

              {/* Step 3: IB Version */}
              <Step>
                <StepLabel>Select IB Version</StepLabel>
                <StepContent>
                  <FormControl fullWidth sx={{ mt: 1, mb: 2 }}>
                    <InputLabel>IB Version</InputLabel>
                    <Select
                      id="upload-ib-select"
                      value={selectedIB}
                      onChange={(e) => setSelectedIB(e.target.value)}
                      label="IB Version"
                    >
                      {filteredIBVersions.map((v) => <MenuItem key={v.id} value={v.id}>{v.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button size="small" onClick={() => setActiveStep(activeStep - 1)}>Back</Button>
                    <Button
                      id="step3-next"
                      variant="contained"
                      size="small"
                      disabled={!canProceed(stepOffset + 2)}
                      onClick={() => setActiveStep(activeStep + 1)}
                      sx={{ background: 'linear-gradient(135deg, #6C63FF, #9A94FF)' }}
                    >
                      Next
                    </Button>
                  </Box>
                </StepContent>
              </Step>

              {/* Step 4: Upload File */}
              <Step>
                <StepLabel>Upload Excel File</StepLabel>
                <StepContent>
                  <Box
                    {...getRootProps()}
                    id="file-dropzone"
                    sx={{
                      mt: 1, mb: 2, p: 4,
                      border: `2px dashed ${isDragActive ? c.primary : c.borderStrong}`,
                      borderRadius: 2,
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: isDragActive ? 'rgba(108,99,255,0.08)' : 'rgba(108,99,255,0.03)',
                      transition: 'all 0.2s',
                      '&:hover': { borderColor: '#6C63FF', background: 'rgba(108,99,255,0.06)' },
                    }}
                  >
                    <input {...getInputProps()} id="file-input" />
                    <CloudUpload sx={{ fontSize: 48, color: '#6C63FF', mb: 1 }} />
                    <Typography sx={{ color: c.textPrimary, fontWeight: 600 }}>
                      {uploadedFile ? uploadedFile.name : 'Drop .xlsx / .xls file here'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: c.textMuted }}>
                      {uploadedFile
                        ? `${(uploadedFile.size / 1024 / 1024).toFixed(2)} MB`
                        : `Max 100MB • Must have exactly ${UPLOAD_TEMPLATE_HEADERS.length} columns`}

                    </Typography>
                  </Box>

                  {uploadError && (
                    <Alert severity="error" sx={{ mb: 2 }}>{uploadError}</Alert>
                  )}

                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button size="small" onClick={() => setActiveStep(activeStep - 1)}>
                      Back
                    </Button>

                    <Button
                      id="download-template-btn"
                      size="small"
                      variant="outlined"
                      onClick={handleDownloadTemplate}
                      startIcon={<FileDownload />}
                      sx={{
                        borderColor: '#4ECCA3',
                        color: '#4ECCA3',
                        '&:hover': {
                          borderColor: '#26C6DA',
                          background: 'rgba(78,204,163,0.06)',
                        },
                      }}
                    >
                      Download Template
                    </Button>

                    <Button
                      id="upload-submit-btn"
                      variant="contained"
                      color="primary"
                      disabled={!canProceed(stepOffset + 3) || uploading}
                      onClick={handleUpload}
                      startIcon={uploading ? <CircularProgress size={14} color="inherit" /> : <CloudUpload />}
                      sx={{ background: 'linear-gradient(135deg, #FF6584, #FF8A65)' }}
                    >
                      {uploading ? 'Uploading...' : 'Upload & Process'}
                    </Button>
                  </Box>
                </StepContent>
              </Step>

              {/* Step 5: Progress */}
              <Step>
                <StepLabel>Processing</StepLabel>
                <StepContent>
                  <Box sx={{ mt: 1, mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" sx={{ color: c.textSecondary }}>
                        {uploadProgress.message || 'Processing...'}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#6C63FF', fontWeight: 700 }}>
                        {uploadProgress.progress || 0}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={parseFloat(uploadProgress.progress || '0')}
                      sx={{
                        height: 8, borderRadius: 4,
                        background: 'rgba(108,99,255,0.1)',
                        '& .MuiLinearProgress-bar': {
                          background: uploadProgress.status === 'completed'
                            ? 'linear-gradient(90deg, #4ECCA3, #26C6DA)'
                            : uploadProgress.status === 'failed'
                              ? 'linear-gradient(90deg, #FF6B6B, #FF6584)'
                              : 'linear-gradient(90deg, #6C63FF, #9A94FF)',
                        },
                      }}
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                      <Typography variant="caption" sx={{ color: c.textMuted }}>
                        {uploadProgress.processed_records || 0} / {uploadProgress.total_records || 0} records
                      </Typography>
                      <Chip
                        label={uploadProgress.status || 'processing'}
                        size="small"
                        sx={{
                          fontSize: '0.65rem',
                          background: uploadProgress.status === 'completed' ? 'rgba(78,204,163,0.2)' :
                            uploadProgress.status === 'failed' ? 'rgba(255,107,107,0.2)' :
                              'rgba(108,99,255,0.2)',
                          color: uploadProgress.status === 'completed' ? '#4ECCA3' :
                            uploadProgress.status === 'failed' ? '#FF6B6B' : '#9A94FF',
                        }}
                      />
                    </Box>

                    {uploadProgress.status === 'completed' && (
                      <Alert severity="success" sx={{ mt: 2 }}>
                        ✅ Processing complete! {uploadProgress.processed_records} records imported successfully.
                      </Alert>
                    )}
                    {uploadProgress.status === 'failed' && (
                      <Alert severity="error" sx={{ mt: 2 }}>
                        ❌ Processing failed. {uploadProgress.error_message || 'Please check the file format.'}
                      </Alert>
                    )}
                    <Button
                      size="small"
                      onClick={() => { setActiveStep(0); setUploadedFile(null); setUploadProgress({}) }}
                      sx={{ mt: 2, color: '#9A94FF' }}
                    >
                      Upload Another File
                    </Button>
                  </Box>
                </StepContent>
              </Step>
            </Stepper>
          </CardContent>
        </Card>

        {/* Upload History */}
        <Box sx={{ flex: '2 1 500px', minWidth: 0 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: c.textPrimary, flex: 1 }}>
                  Upload History
                </Typography>
                <Tooltip title="Refresh">
                  <IconButton size="small" onClick={loadHistory} sx={{ color: c.textSecondary }}>
                    <Refresh />
                  </IconButton>
                </Tooltip>
              </Box>

              {historyLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={28} sx={{ color: '#6C63FF' }} />
                </Box>
              ) : uploadHistory.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <FolderOpen sx={{ fontSize: 48, color: c.textMuted, mb: 1 }} />
                  <Typography sx={{ color: c.textMuted }}>No uploads yet</Typography>
                </Box>
              ) : (
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>#</TableCell>
                        <TableCell>File</TableCell>
                        {user?.role === 'super_admin' && <TableCell>Admin</TableCell>}
                        <TableCell>Region / Country</TableCell>
                        <TableCell>IB</TableCell>
                        <TableCell>Records</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {uploadHistory.map((u, idx) => (
                        <TableRow key={u.id} sx={{ '&:hover': { background: c.tableHover } }}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell sx={{ maxWidth: 150 }}>
                            <Tooltip title={u.file_name}>
                              <Typography variant="caption" sx={{ color: c.textPrimary }} noWrap>
                                {u.file_name}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          {user?.role === 'super_admin' && (
                            <TableCell sx={{ maxWidth: 140 }}>
                              <Tooltip title={u.assigned_admin_email || historyAdminUsername(u) || historyAdminName(u)}>
                                <span>
                                  <Typography variant="caption" sx={{ color: c.textPrimary, display: 'block', fontWeight: 600 }} noWrap>
                                    {historyAdminName(u)}
                                  </Typography>
                                  {historyAdminUsername(u) && (
                                    <Typography variant="caption" sx={{ color: c.textSecondary }}>
                                      {historyAdminUsername(u)}
                                    </Typography>
                                  )}
                                </span>
                              </Tooltip>
                            </TableCell>
                          )}
                          <TableCell>
                            <Typography variant="caption" sx={{ color: c.textSecondary, display: 'block' }}>
                              {u.region_name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: c.textPrimary }}>
                              {u.country_name}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={u.ib_version_name} size="small" sx={{ fontSize: '0.65rem', background: 'rgba(108,99,255,0.2)', color: c.primaryLight }} />
                          </TableCell>
                          <TableCell sx={{ color: c.textSecondary, fontSize: '0.8rem' }}>
                            {u.processed_records?.toLocaleString()} / {u.total_records?.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {statusIcon(u.status)}
                              <Typography variant="caption" sx={{ textTransform: 'capitalize' }}>
                                {u.status}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ color: c.textMuted, fontSize: '0.75rem' }}>
                            {u.upload_started_at ? new Date(u.upload_started_at).toLocaleDateString() : '—'}
                          </TableCell>
                          <TableCell>
                            <Tooltip title="Delete">
                              <IconButton
                                id={`delete-upload-${u.id}`}
                                size="small"
                                onClick={() => handleDelete(u.id)}
                                sx={{ color: c.error }}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  )
}
