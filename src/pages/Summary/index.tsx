import React, { useState, useEffect } from 'react'
import {
  Box, Typography, Paper, Grid, Card, CardContent, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, TextField, InputAdornment, Button,
  IconButton, Collapse, Tooltip, CircularProgress, Alert, Divider
} from '@mui/material'
import {
  Search, Assessment, FilterList, Refresh, Download, Layers,
  KeyboardArrowDown, KeyboardArrowUp, CheckCircle, DirectionsCar,
  AssignmentTurnedIn, RateReview, ThumbUp, BuildCircle
} from '@mui/icons-material'
import { useThemeColors } from '../../utils/colors'
import { dashboardApi, regionsApi, countriesApi, ibVersionsApi } from '../../lib/api'

interface IBSummaryRow {
  ib_version_id: string
  ib_version_name: string
  regions: string[]
  countries: string[]
  file_count: number
  total_responses: number
  brand_count: number
  brands: string[]
  promoters: number
  promoters_pct: number
  passives: number
  passives_pct: number
  detractors: number
  detractors_pct: number
  nps_score: number
  total_issues: number
  total_benefits: number
  status: string
}

// Reusable field styling so every control in the filter bar looks consistent
// and never collapses below a usable width, regardless of container size.
const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 2,
    fontSize: 13.5,
    backgroundColor: '#fff',
  },
  '& .MuiInputLabel-root': {
    fontSize: 13.5,
  },
}

export default function SummaryPage() {
  const c = useThemeColors()

  // Filters State
  const [regionId, setRegionId] = useState<string>('')
  const [countryId, setCountryId] = useState<string>('')
  const [ibVersionId, setIbVersionId] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')

  // Filter Dropdown Options
  const [regions, setRegions] = useState<any[]>([])
  const [countries, setCountries] = useState<any[]>([])
  const [ibVersions, setIbVersions] = useState<any[]>([])

  // Data State
  const [loading, setLoading] = useState<boolean>(true)
  const [summaryData, setSummaryData] = useState<IBSummaryRow[]>([])
  const [totals, setTotals] = useState({
    total_ib_versions: 0,
    total_responses: 0,
    total_issues: 0,
    total_benefits: 0,
  })
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchOptions()
  }, [])

  useEffect(() => {
    fetchSummary()
  }, [regionId, countryId, ibVersionId, dateFrom, dateTo])

  const fetchOptions = async () => {
    try {
      const [regRes, cntRes, ibRes] = await Promise.all([
        regionsApi.list(),
        countriesApi.list(),
        ibVersionsApi.list(),
      ])
      const regList = Array.isArray(regRes.data) ? regRes.data : (regRes.data?.data || [])
      const cntList = Array.isArray(cntRes.data) ? cntRes.data : (cntRes.data?.data || [])
      const ibList = Array.isArray(ibRes.data) ? ibRes.data : (ibRes.data?.data || [])
      setRegions(Array.isArray(regList) ? regList : [])
      setCountries(Array.isArray(cntList) ? cntList : [])
      setIbVersions(Array.isArray(ibList) ? ibList : [])
    } catch (err) {
      console.error('Failed to load filter options:', err)
      setRegions([])
      setCountries([])
      setIbVersions([])
    }
  }

  const fetchSummary = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {
        region_id: regionId || undefined,
        country_id: countryId || undefined,
        ib_version_id: ibVersionId || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        search: searchTerm || undefined,
      }
      const res = await dashboardApi.ibSummaryTable(params)
      const data = res.data || {}
      setSummaryData(data.summary || [])
      setTotals({
        total_ib_versions: data.total_ib_versions || 0,
        total_responses: data.total_responses || 0,
        total_issues: data.total_issues || 0,
        total_benefits: data.total_benefits || 0,
      })
    } catch (err: any) {
      console.error('Error fetching summary table:', err)
      setError('Failed to load summary data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetFilters = () => {
    setRegionId('')
    setCountryId('')
    setIbVersionId('')
    setSearchTerm('')
    setDateFrom('')
    setDateTo('')
  }

  const activeFilterCount = [regionId, countryId, ibVersionId, dateFrom, dateTo].filter(Boolean).length

  // Filtered rows by search term
  const filteredRows = summaryData.filter((row) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      row.ib_version_name.toLowerCase().includes(term) ||
      row.regions.some((r) => r.toLowerCase().includes(term)) ||
      row.countries.some((c) => c.toLowerCase().includes(term)) ||
      row.brands.some((b) => b.toLowerCase().includes(term))
    )
  })

  // Export Summary to CSV
  const handleExportCSV = () => {
    if (filteredRows.length === 0) return
    const headers = [
      'IB Version', 'Regions', 'Countries', 'Files Count', 'Total Respondents',
      'Brand Count', 'Brands', 'Promoters (Yes)', 'Passives (Maybe)', 'Detractors (No)',
      'NPS Score', 'Total Issues', 'Total Benefits', 'Status'
    ]

    const csvRows = filteredRows.map((r) => [
      `"${r.ib_version_name}"`,
      `"${r.regions.join(', ')}"`,
      `"${r.countries.join(', ')}"`,
      r.file_count,
      r.total_responses,
      r.brand_count,
      `"${r.brands.join(', ')}"`,
      `${r.promoters} (${r.promoters_pct}%)`,
      `${r.passives} (${r.passives_pct}%)`,
      `${r.detractors} (${r.detractors_pct}%)`,
      r.nps_score,
      r.total_issues,
      r.total_benefits,
      r.status,
    ])

    const csvContent = [headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `IB_Wise_Overall_Summary_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Calculate Overall Averages for KPI Header
  const grandRespondents = filteredRows.reduce((acc, r) => acc + r.total_responses, 0)
  const grandIssues = filteredRows.reduce((acc, r) => acc + r.total_issues, 0)
  const grandBenefits = filteredRows.reduce((acc, r) => acc + r.total_benefits, 0)
  const avgNps = filteredRows.length > 0
    ? Math.round(filteredRows.reduce((acc, r) => acc + r.nps_score, 0) / filteredRows.length)
    : 0

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1680, margin: '0 auto' }}>
      {/* Page Header */}
      <Box sx={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 2, mb: 3,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
          <Box sx={{
            p: 1.4, borderRadius: 2.5, background: 'linear-gradient(135deg, #6C63FF, #FF6584)',
            display: 'flex', color: '#fff', boxShadow: '0 6px 16px rgba(108, 99, 255, 0.28)',
          }}>
            <Assessment sx={{ fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: c.textPrimary, lineHeight: 1.25 }}>
              Overall IB Summary
            </Typography>
            <Typography variant="body2" sx={{ color: c.textSecondary, mt: 0.25 }}>
              IB-wise survey analytics, respondent sample sizes, NPS breakdown, and complaint metrics
            </Typography>
          </Box>
        </Box>

        <Button
          variant="contained"
          startIcon={<Download />}
          onClick={handleExportCSV}
          disabled={filteredRows.length === 0}
          sx={{
            background: 'linear-gradient(135deg, #6C63FF, #4ECCA3)',
            fontWeight: 700,
            textTransform: 'none',
            borderRadius: 2,
            px: 3,
            py: 1,
            boxShadow: '0 6px 16px rgba(78, 204, 163, 0.25)',
            '&:hover': { boxShadow: '0 8px 20px rgba(78, 204, 163, 0.35)' },
          }}
        >
          Export Summary CSV
        </Button>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
        {[
          { label: 'IB Versions', value: filteredRows.length.toLocaleString(), icon: <Layers sx={{ fontSize: 26 }} />, color: '#6C63FF' },
          { label: 'Total Respondents', value: grandRespondents.toLocaleString(), icon: <AssignmentTurnedIn sx={{ fontSize: 26 }} />, color: '#4ECCA3' },
          { label: 'Total Issues / Complaints', value: grandIssues.toLocaleString(), icon: <BuildCircle sx={{ fontSize: 26 }} />, color: '#FF6584' },
          { label: 'Average NPS Score', value: avgNps, icon: <RateReview sx={{ fontSize: 26 }} />, color: '#3B82F6' },
        ].map((kpi) => (
          <Grid size={{xs: 12, sm: 6, md: 3}} key={kpi.label}>
            <Card
              elevation={0}
              sx={{
                border: `1px solid ${c.border}`,
                borderRadius: 3,
                backgroundColor: c.cardBg,
                height: '100%',
                transition: 'box-shadow 0.15s ease, transform 0.15s ease',
                '&:hover': { boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)', transform: 'translateY(-1px)' },
              }}
            >
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2.75, px: 2.5, '&:last-child': { pb: 2.75 } }}>
                <Box sx={{
                  p: 1.5, borderRadius: 2.5, backgroundColor: `${kpi.color}26`, color: kpi.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {kpi.icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: c.textSecondary, fontWeight: 600, letterSpacing: 0.2 }}>
                    {kpi.label}
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: c.textPrimary, lineHeight: 1.3 }}>
                    {kpi.value}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Filter Controls Bar */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 2.75 }, mb: 3.5, border: `1px solid ${c.border}`,
          borderRadius: 3, backgroundColor: c.cardBg,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.25, flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterList sx={{ color: c.primaryLight, fontSize: 20 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: c.textPrimary }}>
              Filter Options
            </Typography>
            {activeFilterCount > 0 && (
              <Chip
                label={`${activeFilterCount} active`}
                size="small"
                sx={{
                  height: 22, fontWeight: 700, fontSize: '0.7rem',
                  backgroundColor: 'rgba(108, 99, 255, 0.15)', color: '#6C63FF',
                }}
              />
            )}
          </Box>
        </Box>

        {/* Flex layout with generous, fixed minimum widths keeps every control
            comfortably readable and prevents the dropdowns from being squeezed
            into unusably narrow columns on wide screens. */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 2 }}>
          <Box sx={{ flex: '1 1 280px', minWidth: 240 }}>
            <TextField
              fullWidth
              size="small"
              label="Search"
              placeholder="IB version, region, country, brand..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={fieldSx}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" sx={{ color: c.textMuted }} />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          <Box sx={{ flex: '1 1 200px', minWidth: 200 }}>
            <TextField
              fullWidth
              select
              size="small"
              label="Region"
              value={regionId}
              onChange={(e) => setRegionId(e.target.value)}
              SelectProps={{ native: true }}
              sx={fieldSx}
            >
              <option value="">All Regions</option>
              {(Array.isArray(regions) ? regions : []).map((r) => (
                <option key={r.id || r._id} value={r.id || r._id}>
                  {r.name}
                </option>
              ))}
            </TextField>
          </Box>

          <Box sx={{ flex: '1 1 200px', minWidth: 200 }}>
            <TextField
              fullWidth
              select
              size="small"
              label="Country"
              value={countryId}
              onChange={(e) => setCountryId(e.target.value)}
              SelectProps={{ native: true }}
              sx={fieldSx}
            >
              <option value="">All Countries</option>
              {(Array.isArray(countries) ? countries : []).map((cnt) => (
                <option key={cnt.id || cnt._id} value={cnt.id || cnt._id}>
                  {cnt.name}
                </option>
              ))}
            </TextField>
          </Box>

          <Box sx={{ flex: '1 1 220px', minWidth: 220 }}>
            <TextField
              fullWidth
              select
              size="small"
              label="IB Version"
              value={ibVersionId}
              onChange={(e) => setIbVersionId(e.target.value)}
              SelectProps={{ native: true }}
              sx={fieldSx}
            >
              <option value="">All IB Versions</option>
              {(Array.isArray(ibVersions) ? ibVersions : []).map((ib) => (
                <option key={ib.id || ib._id} value={ib.id || ib._id}>
                  {ib.name}
                </option>
              ))}
            </TextField>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flex: '0 0 auto', ml: { md: 'auto' } }}>
            <Button
              variant="outlined"
              size="small"
              onClick={fetchSummary}
              startIcon={<Refresh sx={{ fontSize: 18 }} />}
              sx={{
                textTransform: 'none', borderRadius: 2, fontWeight: 600,
                px: 2, height: 40, whiteSpace: 'nowrap', borderColor: c.border, color: c.textPrimary,
              }}
            >
              Refresh
            </Button>
            <Button
              variant="text"
              size="small"
              onClick={handleResetFilters}
              disabled={activeFilterCount === 0 && !searchTerm}
              sx={{ color: c.textMuted, textTransform: 'none', fontWeight: 600, height: 40, px: 1.5 }}
            >
              Clear all
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Summary Table Section */}
      <Paper elevation={0} sx={{ border: `1px solid ${c.border}`, borderRadius: 3, backgroundColor: c.cardBg, overflow: 'hidden' }}>
        <Box sx={{
          p: 2.5, borderBottom: `1px solid ${c.border}`, display: 'flex',
          justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1,
        }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: c.textPrimary }}>
            IB-Wise Details Table
          </Typography>
          <Chip
            label={`${filteredRows.length} IB Versions Found`}
            size="small"
            sx={{ fontWeight: 700, backgroundColor: 'rgba(108, 99, 255, 0.15)', color: '#6C63FF' }}
          />
        </Box>

        {error && (
          <Alert severity="error" sx={{ m: 2, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
            <CircularProgress size={36} sx={{ color: c.primaryLight }} />
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 640 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ backgroundColor: c.tableHeaderBg }}>
                  <TableCell sx={{ width: 40, backgroundColor: c.tableHeaderBg }} />
                  <TableCell sx={{ fontWeight: 700, fontSize: 12, color: c.textPrimary, backgroundColor: c.tableHeaderBg }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12, color: c.textPrimary, backgroundColor: c.tableHeaderBg, minWidth: 180 }}>IB Version</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12, color: c.textPrimary, backgroundColor: c.tableHeaderBg, minWidth: 200 }}>Regions & Countries</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: 12, color: c.textPrimary, backgroundColor: c.tableHeaderBg }}>Files</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12, color: c.textPrimary, backgroundColor: c.tableHeaderBg }}>Respondents</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: 12, color: c.textPrimary, backgroundColor: c.tableHeaderBg }}>Brands</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12, color: '#10B981', backgroundColor: c.tableHeaderBg }}>Promoters (Yes)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12, color: '#F59E0B', backgroundColor: c.tableHeaderBg }}>Passives (Maybe)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12, color: '#EF4444', backgroundColor: c.tableHeaderBg }}>Detractors (No)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12, color: c.textPrimary, backgroundColor: c.tableHeaderBg }}>NPS Score</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12, color: '#EF4444', backgroundColor: c.tableHeaderBg }}>Total Issues</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12, color: '#10B981', backgroundColor: c.tableHeaderBg }}>Total Benefits</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: 12, color: c.textPrimary, backgroundColor: c.tableHeaderBg }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} align="center" sx={{ py: 6, color: c.textSecondary }}>
                      No summary records found matching your active filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row, idx) => {
                    const isExpanded = expandedRow === row.ib_version_id
                    return (
                      <React.Fragment key={row.ib_version_id}>
                        <TableRow
                          hover
                          sx={{
                            '&:last-child td, &:last-child th': { border: 0 },
                            backgroundColor: idx % 2 === 1 ? 'rgba(108, 99, 255, 0.025)' : 'transparent',
                          }}
                        >
                          <TableCell>
                            <IconButton
                              size="small"
                              onClick={() => setExpandedRow(isExpanded ? null : row.ib_version_id)}
                            >
                              {isExpanded ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
                            </IconButton>
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12, color: c.textMuted }}>{idx + 1}</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12, color: c.textPrimary }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Layers sx={{ fontSize: 18, color: c.primaryLight }} />
                              {row.ib_version_name}
                            </Box>
                          </TableCell>
                          <TableCell sx={{ fontSize: 11, color: c.textSecondary }}>
                            <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', color: c.textPrimary }}>
                              {row.regions.join(', ')}
                            </Typography>
                            <Typography variant="caption" sx={{ color: c.textMuted, fontSize: '0.65rem' }}>
                              {row.countries.join(', ')}
                            </Typography>
                          </TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600, fontSize: 12 }}>{row.file_count}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, fontSize: 12, color: c.textPrimary }}>
                            {row.total_responses.toLocaleString()}
                          </TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600, fontSize: 12 }}>{row.brand_count}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12, color: '#10B981' }}>
                            {row.promoters} ({row.promoters_pct}%)
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12, color: '#F59E0B' }}>
                            {row.passives} ({row.passives_pct}%)
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12, color: '#EF4444' }}>
                            {row.detractors} ({row.detractors_pct}%)
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, fontSize: 12 }}>{row.nps_score}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12, color: '#EF4444' }}>
                            {row.total_issues.toLocaleString()}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12, color: '#10B981' }}>
                            {row.total_benefits.toLocaleString()}
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              icon={<CheckCircle sx={{ fontSize: '14px !important', color: '#10B981 !important' }} />}
                              label={row.status}
                              size="small"
                              sx={{
                                fontWeight: 700,
                                fontSize: '0.65rem',
                                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                color: '#10B981',
                              }}
                            />
                          </TableCell>
                        </TableRow>

                        {/* Collapsible Row showing Brand Models breakdown */}
                        <TableRow>
                          <TableCell colSpan={14} sx={{ py: 0, borderBottom: isExpanded ? `1px solid ${c.border}` : 'none' }}>
                            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                              <Box sx={{ p: 2, m: 1, borderRadius: 2, backgroundColor: 'rgba(108, 99, 255, 0.05)', border: `1px dashed ${c.border}` }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: c.textPrimary, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <DirectionsCar sx={{ fontSize: 18, color: c.primaryLight }} /> Brand Models Covered ({row.brands.length}):
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                  {row.brands.length === 0 ? (
                                    <Typography variant="caption" sx={{ color: c.textMuted }}>No specific brands listed</Typography>
                                  ) : (
                                    row.brands.map((b) => (
                                      <Chip
                                        key={b}
                                        label={b}
                                        size="small"
                                        variant="outlined"
                                        sx={{ fontWeight: 600, fontSize: '0.7rem', borderColor: c.border }}
                                      />
                                    ))
                                  )}
                                </Box>
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  )
}