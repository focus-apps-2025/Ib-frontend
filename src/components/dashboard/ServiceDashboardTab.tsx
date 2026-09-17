import React, { useEffect, useState } from 'react'
import {
  Box, Card, CardContent, Typography, CircularProgress, Alert, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Button,
  Tabs, Tab, Divider
} from '@mui/material'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LabelList,
  PieChart, Pie, Cell
} from 'recharts'
import { Speed, AccessTime, BuildCircle, DownloadForOffline, Star, ThumbUp, Handyman, VerifiedUser } from '@mui/icons-material'
import { dashboardApi } from '../../lib/api'
import { useFilterStore, toParam } from '../../store'
import { useThemeColors } from '../../utils/colors'

const BRAND_COLORS = ['#3B82F6', '#4ECCA3', '#FF6584', '#FFD93D', '#9B51E0', '#F2994A', '#27AE60', '#E8903D']

const SPECIFIC_BRAND_COLORS: Record<string, string> = {
  'Apache RTR 160 4V CARB': '#00B4D8',
  'Suzuki Gixxer': '#7C3AED',
  'Yamaha FZ version 3': '#F59E0B',
}

const FALLBACK_BRAND_COLORS = ['#00B4D8', '#7C3AED', '#F59E0B', '#10B981', '#EC4899', '#3B82F6', '#6366F1', '#8B5CF6']
const getBrandColor = (brand: string, index: number): string => {
  if (SPECIFIC_BRAND_COLORS[brand]) {
    return SPECIFIC_BRAND_COLORS[brand]
  }
  const lower = brand.toLowerCase()
  if (lower.includes('apache')) return '#00B4D8'      // Light blue
  if (lower.includes('tvs')) return '#00B4D8'         // Light blue for TVS
  if (lower.includes('honda')) return '#7C3AED'       // Violet for Honda
  if (lower.includes('gixxer') || lower.includes('suzuki')) return '#7C3AED'
  if (lower.includes('yamaha') || lower.includes('fz')) return '#F59E0B'
  return FALLBACK_BRAND_COLORS[index % FALLBACK_BRAND_COLORS.length]
}

const PIE_RECOMMEND_COLORS = {
  Yes: '#10B981', // Emerald Green
  No: '#EF4444',  // Coral Red
}

const PIE_NPS_COLORS = {
  Promoters: '#10B981', // Green
  Passives: '#F59E0B',  // Amber
  Detractors: '#EF4444', // Red
}

interface ServiceDashboardTabProps {
  onDownloadPPT?: () => void
  pptGenerating?: boolean
}

const renderCustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (!percent || percent <= 0.03) return null
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  return (
    <text x={x} y={y} fill="#FFFFFF" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {`${(percent * 100).toFixed(1)}%`}
    </text>
  )
}

export default function ServiceDashboardTab({ onDownloadPPT, pptGenerating }: ServiceDashboardTabProps = {}) {
  const filters = useFilterStore()
  const c = useThemeColors()

  const [activeTab, setActiveTab] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [freqData, setFreqData] = useState<any>(null)
  const [npsData, setNpsData] = useState<any>(null)
  const [benefitsData, setBenefitsData] = useState<any>(null)
  const [satisfactionData, setSatisfactionData] = useState<any>(null)

  const [authSubSegment, setAuthSubSegment] = useState<string>('overall')
  const [pgmSubSegment, setPgmSubSegment] = useState<string>('overall')

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const filterParams = {
          file_id: filters.fileId || undefined,
          region_id: toParam(filters.regionId),
          country_id: toParam(filters.countryId),
          ib_version_id: toParam(filters.ibVersionId),
          brand_model: toParam(filters.brandModel),
          survey_location: toParam(filters.surveyLocation),
          date_from: filters.dateFrom || undefined,
          date_to: filters.dateTo || undefined,
          search: filters.search || undefined,
        }

        const [freqRes, npsRes, benefitsRes, satisfactionRes] = await Promise.all([
          dashboardApi.serviceFrequency(filterParams),
          dashboardApi.serviceNps(filterParams),
          dashboardApi.serviceBenefitsBetterments(filterParams),
          dashboardApi.serviceSatisfaction(filterParams),
        ])

        setFreqData(freqRes.data)
        setNpsData(npsRes.data)
        setBenefitsData(benefitsRes.data)
        setSatisfactionData(satisfactionRes.data)
      } catch (err: any) {
        console.error('Failed to fetch Service Dashboard data:', err)
        setError(err?.response?.data?.detail || err?.message || 'Failed to load Service Dashboard data.')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [
    filters.fileId,
    filters.regionId,
    filters.countryId,
    filters.ibVersionId,
    filters.brandModel,
    filters.surveyLocation,
    filters.dateFrom,
    filters.dateTo,
    filters.search,
  ])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress size={40} />
        <Typography variant="body2" sx={{ ml: 2, color: c.textSecondary }}>
          Loading Service Dashboard data...
        </Typography>
      </Box>
    )
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {error}
      </Alert>
    )
  }

  // ─── Service Frequency Data Extraction ─────────────────────────────────────
  const kmsDataAll = freqData?.kms_frequency || { total_responses: 0, categories: [], brand_breakdown: [] }
  const timeDataAll = freqData?.time_frequency || { total_responses: 0, categories: [], brand_breakdown: [] }

  const kmsCategories = kmsDataAll.categories || []
  const kmsBrandBreakdown = kmsDataAll.brand_breakdown || []
  const kmsBrands: string[] = kmsBrandBreakdown.map((b: any) => b.brand)

  const timeCategories = timeDataAll.categories || []
  const timeBrandBreakdown = timeDataAll.brand_breakdown || []
  const timeBrands: string[] = timeBrandBreakdown.map((b: any) => b.brand)

  const kmsChartData = kmsCategories.map((catItem: any) => {
    const entry: any = { category: catItem.category }
    kmsBrandBreakdown.forEach((b: any) => {
      const match = b.categories?.find((item: any) => item.category === catItem.category)
      entry[b.brand] = match ? match.percentage : 0
    })
    return entry
  })

  const timeChartData = timeCategories.map((catItem: any) => {
    const entry: any = { category: catItem.category }
    timeBrandBreakdown.forEach((b: any) => {
      const match = b.categories?.find((item: any) => item.category === catItem.category)
      entry[b.brand] = match ? match.percentage : 0
    })
    return entry
  })

  // ─── Service NPS Data Extraction ─────────────────────────────────────────
  const authNps = npsData?.authorized || {
    total_responses: 0,
    recommendation: { yes_count: 0, yes_pct: 0, no_count: 0, no_pct: 0 },
    nps_distribution: { promoters_count: 0, promoters_pct: 0, passives_count: 0, passives_pct: 0, detractors_count: 0, detractors_pct: 0, nps_score: 0, avg_score: 0 },
    brand_breakdown: []
  }

  const pgmNps = npsData?.pgm || {
    total_responses: 0,
    recommendation: { yes_count: 0, yes_pct: 0, no_count: 0, no_pct: 0 },
    nps_distribution: { promoters_count: 0, promoters_pct: 0, passives_count: 0, passives_pct: 0, detractors_count: 0, detractors_pct: 0, nps_score: 0, avg_score: 0 },
    brand_breakdown: []
  }

  // ─── Benefits & Betterments Data Extraction ──────────────────────────────
  const authBenefits = benefitsData?.data?.authorized || { sample_size: 0, overall: {}, promoter: {}, passive: {}, detractor: {} }
  const pgmBenefits = benefitsData?.data?.pgm || { sample_size: 0, overall: {}, promoter: {}, passive: {}, detractor: {} }

  const buildPieDataRecommend = (rec: any) => [
    { name: 'Yes', value: rec.yes_count || 0, pct: rec.yes_pct || 0 },
    { name: 'No', value: rec.no_count || 0, pct: rec.no_pct || 0 }
  ]

  const buildPieDataNps = (npsDist: any) => [
    { name: 'Promoters (9-10)', value: npsDist.promoters_count || 0, pct: npsDist.promoters_pct || 0 },
    { name: 'Passives (7-8)', value: npsDist.passives_count || 0, pct: npsDist.passives_pct || 0 },
    { name: 'Detractors (0-6)', value: npsDist.detractors_count || 0, pct: npsDist.detractors_pct || 0 }
  ]

  const renderSectionNps = (
    title: string,
    subtitle: string,
    icon: React.ReactNode,
    sectionData: any,
    accentColor: string
  ) => {
    const recPie = buildPieDataRecommend(sectionData.recommendation)
    const npsPie = buildPieDataNps(sectionData.nps_distribution)
    const brandData = sectionData.brand_breakdown || []

    return (
      <Card sx={{ border: `1px solid ${c.border}`, mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          {/* Section Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Box
              sx={{
                p: 1,
                borderRadius: 2,
                backgroundColor: `${accentColor}15`,
                color: accentColor,
                display: 'flex'
              }}
            >
              {icon}
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: c.textPrimary }}>
                {title}
              </Typography>
              <Typography variant="caption" sx={{ color: c.textSecondary }}>
                {subtitle}
              </Typography>
            </Box>
          </Box>

          {/* Key Metrics Cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={3}>
              <Paper elevation={0} sx={{ p: 2, border: `1px solid ${c.border}`, borderRadius: 2, backgroundColor: c.cardBg }}>
                <Typography variant="caption" sx={{ color: c.textSecondary, fontWeight: 600 }}>
                  Total Responses
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: c.textPrimary, mt: 0.5 }}>
                  {sectionData.total_responses}
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={6} sm={3}>
              <Paper elevation={0} sx={{ p: 2, border: `1px solid ${c.border}`, borderRadius: 2, backgroundColor: c.cardBg }}>
                <Typography variant="caption" sx={{ color: c.textSecondary, fontWeight: 600 }}>
                  Would Recommend
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#10B981', mt: 0.5 }}>
                  {sectionData.recommendation?.yes_pct}%
                </Typography>
                <Typography variant="caption" sx={{ color: c.textSecondary }}>
                  ({sectionData.recommendation?.yes_count} responses)
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={6} sm={3}>
              <Paper elevation={0} sx={{ p: 2, border: `1px solid ${c.border}`, borderRadius: 2, backgroundColor: c.cardBg }}>
                <Typography variant="caption" sx={{ color: c.textSecondary, fontWeight: 600 }}>
                  Promoters (9-10)
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: accentColor, mt: 0.5 }}>
                  {sectionData.nps_distribution?.promoters_pct}%
                </Typography>
                <Typography variant="caption" sx={{ color: c.textSecondary }}>
                  ({sectionData.nps_distribution?.promoters_count} responses)
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={6} sm={3}>
              <Paper elevation={0} sx={{ p: 2, border: `1px solid ${c.border}`, borderRadius: 2, backgroundColor: c.cardBg }}>
                <Typography variant="caption" sx={{ color: c.textSecondary, fontWeight: 600 }}>
                  Net NPS Score
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: sectionData.nps_distribution?.nps_score >= 0 ? '#10B981' : '#EF4444', mt: 0.5 }}>
                  {sectionData.nps_distribution?.nps_score > 0 ? `+${sectionData.nps_distribution?.nps_score}` : sectionData.nps_distribution?.nps_score}
                </Typography>
                <Typography variant="caption" sx={{ color: c.textSecondary }}>
                  (% Promoters - % Detractors)
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Overall Section Pie Charts Row */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {/* Pie Chart 1: Overall Recommend Distribution */}
            <Grid item xs={12} md={6}>
              <Paper elevation={0} sx={{ p: 2.5, border: `1px solid ${c.border}`, borderRadius: 2, backgroundColor: c.cardBg }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: c.textPrimary, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ThumbUp sx={{ fontSize: 18, color: '#10B981' }} /> Overall - Will You Recommend? (Column BR)
                </Typography>
                <Typography variant="caption" sx={{ color: c.textSecondary, display: 'block', mb: 2 }}>
                  Overall Yes vs No distribution for vehicle recommendation
                </Typography>

                <Box sx={{ height: 260, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={recPie}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="value"
                        label={renderCustomPieLabel}
                        labelLine={false}
                      >
                        <Cell key="cell-yes" fill={PIE_RECOMMEND_COLORS.Yes} />
                        <Cell key="cell-no" fill={PIE_RECOMMEND_COLORS.No} />
                      </Pie>
                      <RechartsTooltip
                        formatter={(val: number, name: string, entry: any) => [
                          `${val} (${entry.payload.pct}%)`,
                          name === 'Yes' ? 'Recommend (Yes)' : 'Not Recommend (No)'
                        ]}
                        contentStyle={{ backgroundColor: c.cardBg, borderColor: c.border, borderRadius: 8 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>

                {/* Model Base Table for Recommend (Column BR) */}
                <Divider sx={{ my: 2 }} />
                <Box sx={{ pt: 0.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: c.textPrimary, mb: 1, display: 'block' }}>
                    Model (All Models) Base Table
                  </Typography>
                  <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${c.border}`, borderRadius: 1.5 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ backgroundColor: c.tableHeaderBg }}>
                          <TableCell sx={{ fontWeight: 700, fontSize: 11, color: c.textPrimary, py: 0.75 }}>Model (All Models)</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, color: c.textPrimary, py: 0.75 }}>Base</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {brandData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={2} align="center" sx={{ py: 1.5, color: c.textSecondary, fontSize: 11 }}>
                              No base data available
                            </TableCell>
                          </TableRow>
                        ) : (
                          brandData.map((bRow: any) => (
                            <TableRow key={bRow.brand} hover>
                              <TableCell sx={{ fontWeight: 600, fontSize: 11, color: c.textPrimary, py: 0.5 }}>
                                {bRow.brand}
                              </TableCell>
                              <TableCell align="right" sx={{ fontSize: 11, fontWeight: 700, color: c.primary, py: 0.5 }}>
                                {bRow.total_responses}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              </Paper>
            </Grid>

            {/* Pie Chart 2: Overall NPS Distribution */}
            <Grid item xs={12} md={6}>
              <Paper elevation={0} sx={{ p: 2.5, border: `1px solid ${c.border}`, borderRadius: 2, backgroundColor: c.cardBg }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: c.textPrimary, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Star sx={{ fontSize: 18, color: '#F59E0B' }} /> Overall - NPS Score Distribution (Column BS)
                </Typography>
                <Typography variant="caption" sx={{ color: c.textSecondary, display: 'block', mb: 2 }}>
                  Overall Promoters (9-10), Passives (7-8), Detractors (0-6)
                </Typography>

                <Box sx={{ height: 260, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={npsPie}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="value"
                        label={renderCustomPieLabel}
                        labelLine={false}
                      >
                        <Cell key="cell-prom" fill={PIE_NPS_COLORS.Promoters} />
                        <Cell key="cell-pas" fill={PIE_NPS_COLORS.Passives} />
                        <Cell key="cell-det" fill={PIE_NPS_COLORS.Detractors} />
                      </Pie>
                      <RechartsTooltip
                        formatter={(val: number, name: string, entry: any) => [
                          `${val} (${entry.payload.pct}%)`,
                          name
                        ]}
                        contentStyle={{ backgroundColor: c.cardBg, borderColor: c.border, borderRadius: 8 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>

                {/* Model Base Table for NPS Distribution (Column BS) */}
                <Divider sx={{ my: 2 }} />
                <Box sx={{ pt: 0.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: c.textPrimary, mb: 1, display: 'block' }}>
                    Model (All Models) Base Table
                  </Typography>
                  <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${c.border}`, borderRadius: 1.5 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ backgroundColor: c.tableHeaderBg }}>
                          <TableCell sx={{ fontWeight: 700, fontSize: 11, color: c.textPrimary, py: 0.75 }}>Model (All Models)</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, color: c.textPrimary, py: 0.75 }}>Base</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {brandData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={2} align="center" sx={{ py: 1.5, color: c.textSecondary, fontSize: 11 }}>
                              No base data available
                            </TableCell>
                          </TableRow>
                        ) : (
                          brandData.map((bRow: any) => (
                            <TableRow key={bRow.brand} hover>
                              <TableCell sx={{ fontWeight: 600, fontSize: 11, color: c.textPrimary, py: 0.5 }}>
                                {bRow.brand}
                              </TableCell>
                              <TableCell align="right" sx={{ fontSize: 11, fontWeight: 700, color: c.primary, py: 0.5 }}>
                                {bRow.total_responses}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              </Paper>
            </Grid>
          </Grid>

          {/* Model Base Table */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: c.textPrimary }}>
              Model Base (Sample Size)
            </Typography>
            <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${c.border}`, borderRadius: 2, maxWidth: 500 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: c.tableHeaderBg }}>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, color: c.textPrimary }}>Model (All Models)</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, color: c.textPrimary }}>Base</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {brandData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} align="center" sx={{ py: 2, color: c.textSecondary, fontSize: 12 }}>
                        No model base data available.
                      </TableCell>
                    </TableRow>
                  ) : (
                    brandData.map((bRow: any) => (
                      <TableRow key={bRow.brand} hover>
                        <TableCell sx={{ fontWeight: 600, fontSize: 12, color: c.textPrimary }}>
                          {bRow.brand}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: 12, fontWeight: 700, color: c.primary }}>
                          {bRow.total_responses}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          {/* Brand-wise: Per-Brand "Will You Recommend?" Pies + All-Brands NPS Distribution Chart */}
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: c.textPrimary, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Star sx={{ color: accentColor }} /> Brand-wise Recommendation & NPS Distribution
          </Typography>

          <Grid container spacing={3} sx={{ alignItems: 'stretch', mb: 1 }}>
            {/* Left side: compact "Will You Recommend?" pie per brand */}
            <Grid item xs={12} lg={5}>
              {brandData.length === 0 ? (
                <Paper elevation={0} sx={{ p: 4, textAlign: 'center', border: `1px solid ${c.border}`, borderRadius: 2, height: '100%' }}>
                  <Typography variant="body2" sx={{ color: c.textSecondary }}>
                    No brand-wise recommendation data available.
                  </Typography>
                </Paper>
              ) : (
                <Grid container spacing={2}>
                  {brandData.map((bRow: any, idx: number) => {
                    const bRecPie = [
                      { name: 'Yes', value: bRow.recommend_yes || 0, pct: bRow.recommend_yes_pct || 0 },
                      { name: 'No', value: bRow.recommend_no || 0, pct: bRow.recommend_no_pct || 0 }
                    ]
                    const bColor = BRAND_COLORS[idx % BRAND_COLORS.length]

                    return (
                      <Grid item xs={12} key={bRow.brand}>
                        <Paper elevation={0} sx={{ p: 2, border: `1px solid ${c.border}`, borderRadius: 2, backgroundColor: c.cardBg }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: bColor }} />
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: c.textPrimary, fontSize: 13 }}>
                              {bRow.brand} - Will You Recommend? (Column BR)
                            </Typography>
                          </Box>
                          <Typography variant="caption" sx={{ color: c.textSecondary, display: 'block', mb: 1.5 }}>
                            Yes vs No recommendation percentage for {bRow.brand}
                          </Typography>
                          <Box sx={{ height: 210, width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={bRecPie}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={40}
                                  outerRadius={68}
                                  paddingAngle={4}
                                  dataKey="value"
                                  label={renderCustomPieLabel}
                                  labelLine={false}
                                >
                                  <Cell key="cell-yes" fill={PIE_RECOMMEND_COLORS.Yes} />
                                  <Cell key="cell-no" fill={PIE_RECOMMEND_COLORS.No} />
                                </Pie>
                                <RechartsTooltip
                                  formatter={(val: number, name: string, entry: any) => [
                                    `${val} (${entry.payload.pct}%)`,
                                    name === 'Yes' ? 'Recommend (Yes)' : 'Not Recommend (No)'
                                  ]}
                                  contentStyle={{ backgroundColor: c.cardBg, borderColor: c.border, borderRadius: 8 }}
                                />
                                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                              </PieChart>
                            </ResponsiveContainer>
                          </Box>
                        </Paper>
                      </Grid>
                    )
                  })}
                </Grid>
              )}
            </Grid>

            {/* Right side: Single Bar Chart Containing All Brands for NPS Score Distribution (Column BS) */}
            <Grid item xs={12} lg={7}>
              <Paper elevation={0} sx={{ p: 2.5, border: `1px solid ${c.border}`, borderRadius: 2, backgroundColor: c.cardBg }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, color: c.textPrimary, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Star sx={{ fontSize: 18, color: '#F59E0B' }} /> NPS Score Distribution across All Brands (Column BS)
                </Typography>
                <Typography variant="caption" sx={{ color: c.textSecondary, display: 'block', mb: 2 }}>
                  Comparison of Promoters (9-10), Passives (7-8), and Detractors (0-6) percentages for each brand
                </Typography>
                <Box sx={{ height: 320, width: '100%', pt: 1 }}>
                  {brandData.length === 0 ? (
                    <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="body2" sx={{ color: c.textSecondary }}>No data for chart rendering.</Typography>
                    </Box>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={brandData}
                        barCategoryGap="15%"
                        barGap={4}
                        margin={{ top: 25, right: 15, left: 5, bottom: 25 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.borderMuted} />
                        <XAxis
                          dataKey="brand"
                          tick={{ fill: c.textSecondary, fontSize: 11 }}
                          interval={0}
                        />
                        <YAxis
                          unit="%"
                          domain={[0, 100]}
                          tick={{ fill: c.textSecondary, fontSize: 10 }}
                        />
                        <RechartsTooltip
                          formatter={(val: number, name: string) => [`${val}%`, name]}
                          labelStyle={{ color: '#1E293B', fontWeight: 600 }}
                          contentStyle={{ backgroundColor: c.cardBg, borderColor: c.border, borderRadius: 8 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                        <Bar dataKey="promoters_pct" name="Promoters (9-10)" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={36}>
                          <LabelList
                            dataKey="promoters_pct"
                            position="top"
                            formatter={(val: number) => val > 0 ? `${val}%` : ''}
                            style={{ fill: c.textPrimary, fontSize: 9, fontWeight: 700 }}
                          />
                        </Bar>
                        <Bar dataKey="passives_pct" name="Passives (7-8)" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={36}>
                          <LabelList
                            dataKey="passives_pct"
                            position="top"
                            formatter={(val: number) => val > 0 ? `${val}%` : ''}
                            style={{ fill: c.textPrimary, fontSize: 9, fontWeight: 700 }}
                          />
                        </Bar>
                        <Bar dataKey="detractors_pct" name="Detractors (0-6)" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={36}>
                          <LabelList
                            dataKey="detractors_pct"
                            position="top"
                            formatter={(val: number) => val > 0 ? `${val}%` : ''}
                            style={{ fill: c.textPrimary, fontSize: 9, fontWeight: 700 }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    )
  }

  // ─── Benefits & Betterments Section Renderer ────────────────────────────────
  // ─── Benefits & Betterments Section Renderer ────────────────────────────────
  const renderSectionBenefitsBetterments = (
    sectionTitle: string,
    sectionSubtitle: string,
    icon: React.ReactNode,
    secData: any,
    themeColor: string,
    activeSegment: string,
    setActiveSegment: (seg: string) => void
  ) => {
    if (!secData) return null
    const sampleSize = secData.sample_size || 0
    const activeAnalysis = secData[activeSegment] || {
      top_benefits: [],
      top_issues: [],
      brand_benefits: {},
      brand_issues: {},
    }

    const isJunkTopicName = (name: string) => {
      if (!name) return true
      const s = String(name).trim().toLowerCase()
      if (['blank', 'nil', 'none', 'n/a', 'na', 'null', 'nan', '-', '.', '..'].includes(s)) return true
      if (!isNaN(Number(s))) return true
      const junkWords = [
        'average', 'avg', 'best', 'bad', 'good', 'very good', 'poor', 'very poor',
        'fair', 'excellent', 'satisfied', 'unsatisfied', 'dissatisfied',
        'very satisfied', 'neutral', 'medium', 'high', 'low', 'ok', 'okay',
        'normal', 'strongly agree', 'agree', 'disagree', 'strongly disagree'
      ]
      if (junkWords.includes(s)) return true
      if (s.startsWith('submitform')) return true
      return false
    }

    const topBenefits = (activeAnalysis.top_benefits || []).filter((b: any) => !isJunkTopicName(b.topic || b.name)).slice(0, 10)
    const topIssues = (activeAnalysis.top_issues || []).filter((i: any) => !isJunkTopicName(i.topic || i.issue || i.name)).slice(0, 10)
    const brandBenefits = activeAnalysis.brand_benefits || {}
    const brandIssues = activeAnalysis.brand_issues || {}

    const allBrands = Array.from(
      new Set([...Object.keys(brandBenefits), ...Object.keys(brandIssues)])
    ).sort()

    return (
      <Card elevation={0} sx={{ border: `1px solid ${c.border}`, borderRadius: 3, backgroundColor: c.cardBg, mb: 4 }}>
        <CardContent sx={{ p: 3 }}>
          {/* Section Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, pb: 2, borderBottom: `2px solid ${themeColor}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ p: 1, borderRadius: 2, backgroundColor: `${themeColor}15`, color: themeColor, display: 'flex' }}>
                {icon}
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: c.textPrimary }}>
                  {sectionTitle}
                </Typography>
                <Typography variant="caption" sx={{ color: c.textSecondary }}>
                  {sectionSubtitle}
                </Typography>
              </Box>
            </Box>
            <Chip
              label={`Base: ${sampleSize} responses`}
              size="small"
              sx={{ fontWeight: 700, backgroundColor: `${themeColor}20`, color: themeColor }}
            />
          </Box>

          {/* Sub-segment selector */}
          <Box sx={{ mb: 3, borderBottom: `1px solid ${c.border}` }}>
            <Tabs
              value={activeSegment}
              onChange={(_, val) => setActiveSegment(val)}
              textColor="primary"
              indicatorColor="primary"
              sx={{
                minHeight: 40,
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: 13,
                  minHeight: 40,
                  px: 2.5,
                }
              }}
            >
              <Tab label="Overall Brand-wise Analysis" value="overall" />
              <Tab label="Promoter-wise Analysis" value="promoter" />
              <Tab label="Passive-wise Analysis" value="passive" />
              <Tab label="Detractor-wise Analysis" value="detractor" />
            </Tabs>
          </Box>

          {/* Benefits & Issues Side by Side Layout */}
          <Grid container spacing={3}>
            {/* Left Side: Top 10 Benefits */}
            <Grid item xs={12} md={6}>
              <Paper elevation={0} sx={{ p: 2.5, border: `1px solid ${c.border}`, borderRadius: 2, backgroundColor: c.cardBg, height: '100%' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#10B981', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ThumbUp sx={{ fontSize: 20 }} /> Top 10 Benefits (Passive/Feedback) - Columns OI to OU
                </Typography>
                <Grid container spacing={2}>
                  {/* Left: Table */}
                  <Grid item xs={12} lg={6}>
                    <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${c.border}`, borderRadius: 1.5 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ backgroundColor: c.tableHeaderBg }}>
                            <TableCell sx={{ fontWeight: 700, fontSize: 11, color: c.textPrimary, width: 40 }}>#</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: 11, color: c.textPrimary }}>Benefit Topic</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, color: c.textPrimary }}>Count</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, color: c.textPrimary }}>% of Base</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {topBenefits.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} align="center" sx={{ py: 2, color: c.textSecondary }}>
                                No benefit mentions found
                              </TableCell>
                            </TableRow>
                          ) : (
                            topBenefits.map((item: any, idx: number) => {
                              const pct = sampleSize > 0 ? ((item.count / sampleSize) * 100).toFixed(1) : '0.0'
                              return (
                                <TableRow key={item.topic} hover>
                                  <TableCell sx={{ fontWeight: 700, fontSize: 11, color: c.textSecondary }}>{idx + 1}</TableCell>
                                  <TableCell sx={{ fontWeight: 600, fontSize: 11, color: c.textPrimary }}>{item.topic}</TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, color: '#10B981' }}>{item.count}</TableCell>
                                  <TableCell align="right" sx={{ fontSize: 11, color: c.textSecondary }}>{pct}%</TableCell>
                                </TableRow>
                              )
                            })
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Grid>

                  {/* Right: Bar Chart */}
                  <Grid item xs={12} lg={6}>
                    <Box sx={{ height: 300, width: '100%' }}>
                      {topBenefits.length === 0 ? (
                        <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                          <Typography variant="body2" sx={{ color: c.textSecondary }}>No data for chart</Typography>
                        </Box>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={topBenefits}
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={c.borderMuted} />
                            <XAxis type="number" tick={{ fill: c.textSecondary, fontSize: 10 }} />
                            <YAxis
                              type="category"
                              dataKey="topic"
                              tick={{ fill: c.textPrimary, fontSize: 9, fontWeight: 500 }}
                              width={115}
                            />
                            <RechartsTooltip
                              formatter={(val: number) => [val, 'Mentions']}
                              contentStyle={{ backgroundColor: c.cardBg, borderColor: c.border, borderRadius: 8 }}
                            />
                            <Bar dataKey="count" fill="#10B981" radius={[0, 4, 4, 0]}>
                              <LabelList
                                dataKey="count"
                                position="right"
                                style={{ fill: c.textPrimary, fontSize: 10, fontWeight: 700 }}
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </Box>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            {/* Right Side: Top 10 Issues */}
            <Grid item xs={12} md={6}>
              <Paper elevation={0} sx={{ p: 2.5, border: `1px solid ${c.border}`, borderRadius: 2, backgroundColor: c.cardBg, height: '100%' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#EF4444', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BuildCircle sx={{ fontSize: 20 }} /> Top 10 Issues (Betterments) - Columns OV to PJ
                </Typography>
                <Grid container spacing={2}>
                  {/* Left: Table */}
                  <Grid item xs={12} lg={6}>
                    <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${c.border}`, borderRadius: 1.5 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ backgroundColor: c.tableHeaderBg }}>
                            <TableCell sx={{ fontWeight: 700, fontSize: 11, color: c.textPrimary, width: 40 }}>#</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: 11, color: c.textPrimary }}>Issue Topic</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, color: c.textPrimary }}>Count</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, color: c.textPrimary }}>% of Base</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {topIssues.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} align="center" sx={{ py: 2, color: c.textSecondary }}>
                                No issue mentions found
                              </TableCell>
                            </TableRow>
                          ) : (
                            topIssues.map((item: any, idx: number) => {
                              const pct = sampleSize > 0 ? ((item.count / sampleSize) * 100).toFixed(1) : '0.0'
                              return (
                                <TableRow key={item.topic} hover>
                                  <TableCell sx={{ fontWeight: 700, fontSize: 11, color: c.textSecondary }}>{idx + 1}</TableCell>
                                  <TableCell sx={{ fontWeight: 600, fontSize: 11, color: c.textPrimary }}>{item.topic}</TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, color: '#EF4444' }}>{item.count}</TableCell>
                                  <TableCell align="right" sx={{ fontSize: 11, color: c.textSecondary }}>{pct}%</TableCell>
                                </TableRow>
                              )
                            })
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Grid>

                  {/* Right: Bar Chart */}
                  <Grid item xs={12} lg={6}>
                    <Box sx={{ height: 300, width: '100%' }}>
                      {topIssues.length === 0 ? (
                        <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                          <Typography variant="body2" sx={{ color: c.textSecondary }}>No data for chart</Typography>
                        </Box>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={topIssues}
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={c.borderMuted} />
                            <XAxis type="number" tick={{ fill: c.textSecondary, fontSize: 10 }} />
                            <YAxis
                              type="category"
                              dataKey="topic"
                              tick={{ fill: c.textPrimary, fontSize: 9, fontWeight: 500 }}
                              width={115}
                            />
                            <RechartsTooltip
                              formatter={(val: number) => [val, 'Mentions']}
                              contentStyle={{ backgroundColor: c.cardBg, borderColor: c.border, borderRadius: 8 }}
                            />
                            <Bar dataKey="count" fill="#EF4444" radius={[0, 4, 4, 0]}>
                              <LabelList
                                dataKey="count"
                                position="right"
                                style={{ fill: c.textPrimary, fontSize: 10, fontWeight: 700 }}
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </Box>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          </Grid>

          {/* Brand-wise Breakdown Table (Full Width) */}
          <Paper elevation={0} sx={{ p: 2.5, mt: 3, border: `1px solid ${c.border}`, borderRadius: 2, backgroundColor: c.cardBg }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: c.textPrimary, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              Brand-wise Breakdown ({activeSegment === 'overall' ? 'Overall' : activeSegment.charAt(0).toUpperCase() + activeSegment.slice(1)})
            </Typography>
            <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${c.border}`, borderRadius: 1.5 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: c.tableHeaderBg }}>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, color: c.textPrimary, width: '20%' }}>Brand / Model</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, color: '#10B981', width: '40%' }}>Top Benefits Mentioned</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, color: '#EF4444', width: '40%' }}>Top Issues Mentioned</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {allBrands.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ py: 2, color: c.textSecondary }}>
                        No brand breakdown available
                      </TableCell>
                    </TableRow>
                  ) : (
                    allBrands.map((brand: string) => {
                      const bBenefits = brandBenefits[brand] || []
                      const bIssues = brandIssues[brand] || []
                      return (
                        <TableRow key={brand} hover>
                          <TableCell sx={{ fontWeight: 700, fontSize: 11, color: c.textPrimary, verticalAlign: 'top' }}>
                            {brand}
                          </TableCell>
                          <TableCell sx={{ fontSize: 11, color: c.textPrimary, verticalAlign: 'top' }}>
                            {bBenefits.length === 0 ? (
                              <Typography variant="caption" sx={{ color: c.textSecondary }}>None</Typography>
                            ) : (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {bBenefits.slice(0, 4).map((bItem: any) => (
                                  <Chip
                                    key={bItem.topic}
                                    label={`${bItem.topic} (${bItem.count})`}
                                    size="small"
                                    sx={{ fontSize: 10, height: 22, backgroundColor: '#10B98115', color: '#059669', fontWeight: 600 }}
                                  />
                                ))}
                              </Box>
                            )}
                          </TableCell>
                          <TableCell sx={{ fontSize: 11, color: c.textPrimary, verticalAlign: 'top' }}>
                            {bIssues.length === 0 ? (
                              <Typography variant="caption" sx={{ color: c.textSecondary }}>None</Typography>
                            ) : (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {bIssues.slice(0, 4).map((iItem: any) => (
                                  <Chip
                                    key={iItem.topic}
                                    label={`${iItem.topic} (${iItem.count})`}
                                    size="small"
                                    sx={{ fontSize: 10, height: 22, backgroundColor: '#EF444415', color: '#DC2626', fontWeight: 600 }}
                                  />
                                ))}
                              </Box>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </CardContent>
      </Card>
    )
  }

  // ─── Service Satisfaction Rendering ─────────────────────────────────────
  const renderServiceSatisfactionTab = () => {
    if (!satisfactionData) return null

    const metrics: any[] = satisfactionData.metrics || []
    const sections: any = satisfactionData.sections || {}
    const brandBases: any[] = satisfactionData.brand_bases || []
    const brands: string[] = brandBases.map((b: any) => b.brand)

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Brand Color Legend Header */}
        <Card sx={{ border: `1px solid ${c.border}`, backgroundColor: c.cardBg }}>
          <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: c.textPrimary, mr: 1 }}>
                Brand Legend:
              </Typography>
              {brands.map((b: string, idx: number) => {
                const bColor = getBrandColor(b, idx)
                return (
                  <Chip
                    key={b}
                    label={b}
                    size="small"
                    sx={{
                      backgroundColor: `${bColor}18`,
                      color: bColor,
                      borderColor: bColor,
                      fontWeight: 700,
                      fontSize: 11,
                      border: `1px solid ${bColor}`,
                      '& .MuiChip-icon': { color: bColor }
                    }}
                    icon={
                      <Box
                        component="span"
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: '2px',
                          backgroundColor: bColor,
                          display: 'inline-block',
                          ml: 1
                        }}
                      />
                    }
                  />
                )
              })}
              <Chip
                label="Location: Authorized Workshop Only (BN)"
                variant="outlined"
                size="small"
                sx={{ ml: 'auto', fontWeight: 600, color: c.primary, borderColor: c.primary }}
              />
            </Box>
          </CardContent>
        </Card>

        {/* Metrics Header */}
        <Typography variant="h6" sx={{ fontWeight: 700, color: c.textPrimary, display: 'flex', alignItems: 'center', gap: 1 }}>
          <VerifiedUser sx={{ color: c.primary }} /> Metrics Section (5A - 5J): Service Experience Positive Points
        </Typography>

        {/* Merged Metrics Section (5A - 5J) Card */}
        {metrics.length > 0 && (() => {
          const mergedChartData = metrics.map((m: any) => {
            const entry: any = {
              metricKey: m.key,
              questionLabel: m.key,
              fullQuestion: m.question,
            }
            const brandData: any[] = m.brand_data || []
            brandData.forEach((bd: any) => {
              entry[bd.brand] = bd.yes_pct
              entry[`${bd.brand}_yes`] = bd.yes_count
              entry[`${bd.brand}_base`] = bd.base_count
            })
            return entry
          })

          return (
            <Card sx={{ border: `1px solid ${c.border}`, borderRadius: 2 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: c.textPrimary }}>
                    Metrics Section (5A - 5J): Service Experience Positive Points Summary
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                    {brands.map((b: string, idx: number) => (
                      <Box key={b} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 10, height: 10, backgroundColor: getBrandColor(b, idx), borderRadius: '2px' }} />
                        <Typography variant="caption" sx={{ fontSize: 10, color: c.textSecondary, fontWeight: 600 }}>
                          {b}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>

                <Grid container spacing={3}>
                  {/* Left Side Merged Main Table & Base Table */}
                  <Grid item xs={12} lg={6}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {/* Merged Main Table (5A to 5J) */}
                      <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${c.border}`, borderRadius: 1.5, overflow: 'hidden' }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell
                                sx={{
                                  fontWeight: 700,
                                  fontSize: 11,
                                  backgroundColor: '#64748B',
                                  color: '#FFFFFF',
                                  py: 1,
                                  width: '50%'
                                }}
                              >
                                Positive Points
                              </TableCell>
                              {brands.map((b: string, idx: number) => (
                                <TableCell
                                  key={b}
                                  align="center"
                                  sx={{
                                    fontWeight: 700,
                                    fontSize: 11,
                                    backgroundColor: getBrandColor(b, idx),
                                    color: '#FFFFFF',
                                    py: 1
                                  }}
                                >
                                  {b}
                                </TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {metrics.map((m: any) => {
                              const bMap: Record<string, { yes: number; filled: number; pct: number }> = {}
                                ; (m.brand_data || []).forEach((bd: any) => {
                                  bMap[bd.brand] = {
                                    yes: bd.yes_count,
                                    filled: bd.filled_count ?? bd.base_count,
                                    pct: bd.yes_pct
                                  }
                                })

                              return (
                                <TableRow key={m.key} hover>
                                  <TableCell sx={{ fontWeight: 600, fontSize: 11, color: c.textPrimary, py: 0.75 }}>
                                    {m.question}
                                  </TableCell>
                                  {brands.map((b: string) => {
                                    const item = bMap[b] || { yes: 0, filled: 0, pct: 0 }
                                    return (
                                      <TableCell key={b} align="center" sx={{ fontSize: 11, fontWeight: 600, color: c.textPrimary, py: 0.75 }}>
                                        {item.filled} ({item.yes} Yes)
                                      </TableCell>
                                    )
                                  })}
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>

                      {/* Merged Base / Row Label Table */}
                      <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${c.border}`, borderRadius: 1.5, overflow: 'hidden' }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell
                                sx={{
                                  fontWeight: 700,
                                  fontSize: 11,
                                  backgroundColor: '#64748B',
                                  color: '#FFFFFF',
                                  py: 1,
                                  width: '50%'
                                }}
                              >
                                Row label
                              </TableCell>
                              {brands.map((b: string, idx: number) => (
                                <TableCell
                                  key={b}
                                  align="center"
                                  sx={{
                                    fontWeight: 700,
                                    fontSize: 11,
                                    backgroundColor: getBrandColor(b, idx),
                                    color: '#FFFFFF',
                                    py: 1
                                  }}
                                >
                                  {b}
                                </TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            <TableRow hover>
                              <TableCell sx={{ fontWeight: 700, fontSize: 11, backgroundColor: '#E0F2FE', color: '#0369A1', py: 1 }}>
                                Authorized Workshop
                              </TableCell>
                              {brands.map((b: string) => {
                                const bObj = brandBases.find((item: any) => item.brand === b)
                                return (
                                  <TableCell key={b} align="center" sx={{ fontSize: 11, fontWeight: 700, color: c.textPrimary, py: 1 }}>
                                    {bObj?.base_count ?? 0}
                                  </TableCell>
                                )
                              })}
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  </Grid>

                  {/* Right Side Single Grouped Horizontal Bar Chart */}
                  <Grid item xs={12} lg={6}>
                    <Paper elevation={0} sx={{ p: 2, border: `1px solid ${c.border}`, borderRadius: 2, backgroundColor: c.cardBg, height: '100%', minHeight: 480 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: c.textSecondary, mb: 1, display: 'block' }}>
                        Brand-wise Positive Points Percentage Distribution (5A - 5J)
                      </Typography>
                      <Box sx={{ height: 440, width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            layout="vertical"
                            data={mergedChartData}
                            margin={{ top: 10, right: 40, left: 10, bottom: 10 }}
                            barCategoryGap="18%"
                            barGap={3}
                          >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={c.borderMuted} />
                            <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fill: c.textSecondary, fontSize: 10 }} />
                            <YAxis
                              type="category"
                              dataKey="questionLabel"
                              tick={{ fill: c.textPrimary, fontSize: 11, fontWeight: 700 }}
                              width={35}
                            />
                            <RechartsTooltip
                              formatter={(val: number, name: string, entry: any) => [
                                `${val}% (${entry.payload[`${name}_yes`]} / ${entry.payload[`${name}_base`]})`,
                                name
                              ]}
                              labelFormatter={(_, payload: any) => payload?.[0]?.payload?.fullQuestion || ''}
                              contentStyle={{ backgroundColor: c.cardBg, borderColor: c.border, borderRadius: 8 }}
                            />
                            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 5 }} />
                            {brands.map((b: string, idx: number) => (
                              <Bar
                                key={b}
                                dataKey={b}
                                name={b}
                                fill={getBrandColor(b, idx)}
                                radius={[0, 4, 4, 0]}
                                maxBarSize={16}
                              >
                                <LabelList
                                  dataKey={b}
                                  position="right"
                                  formatter={(v: number) => v > 0 ? `${v}%` : ''}
                                  style={{ fill: c.textPrimary, fontSize: 9, fontWeight: 'bold' }}
                                />
                              </Bar>
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </Box>
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )
        })()}

        {/* Additional Sections */}
        {/* Additional Sections */}
        <Typography variant="h6" sx={{ fontWeight: 700, color: c.textPrimary, display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
          <Star sx={{ color: c.primary }} /> Additional Service Metrics Sections
        </Typography>

        {/* Merged Section 7 & Section 8 Card */}
        {(() => {
          const sec7 = sections['7']
          const sec8 = sections['8']
          if (!sec7 && !sec8) return null

          // Build correct chart data: 2 categories (Section 7 / Section 8) with brand totals
          const merged78ChartData = [
            {
              category: 'Section 7',
              fullQuestion: sec7?.question || '',
              ...(sec7?.brand_data || []).reduce((acc: any, bd: any) => {
                acc[bd.brand] = bd.total_count
                return acc
              }, {})
            },
            {
              category: 'Section 8',
              fullQuestion: sec8?.question || '',
              ...(sec8?.brand_data || []).reduce((acc: any, bd: any) => {
                acc[bd.brand] = bd.total_count
                return acc
              }, {})
            }
          ]

          return (
            <Card sx={{ border: `1px solid ${c.border}`, borderRadius: 2 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: c.textPrimary, mb: 2 }}>
                  Section 7 & 8: Vehicle Issues & Reporting Summary
                </Typography>

                <Grid container spacing={2} alignItems="stretch">
                  {/* Left Side Merged Table (Section 7 & 8 Total Counts) */}
                  <Grid item xs={12} lg={6} sx={{ minWidth: 0 }}>
                    <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${c.border}`, borderRadius: 1.5, overflow: 'hidden' }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700, fontSize: 11, backgroundColor: '#64748B', color: '#FFFFFF', py: 1, width: '40%' }}>
                              Question / Metric
                            </TableCell>
                            {brands.map((b: string, idx: number) => (
                              <TableCell
                                key={b}
                                align="center"
                                sx={{
                                  fontWeight: 700,
                                  fontSize: 11,
                                  backgroundColor: getBrandColor(b, idx),
                                  color: '#FFFFFF',
                                  py: 1
                                }}
                              >
                                {b}
                              </TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {sec7 && (
                            <TableRow hover>
                              <TableCell sx={{ fontWeight: 600, fontSize: 11, color: c.textPrimary, py: 1 }}>
                                {sec7.question}
                              </TableCell>
                              {brands.map((b: string) => {
                                const bd = (sec7.brand_data || []).find((d: any) => d.brand === b)
                                return (
                                  <TableCell key={b} align="center" sx={{ fontSize: 12, fontWeight: 700, color: c.primary, py: 1 }}>
                                    {bd?.total_count ?? 0}
                                  </TableCell>
                                )
                              })}
                            </TableRow>
                          )}
                          {sec8 && (
                            <TableRow hover>
                              <TableCell sx={{ fontWeight: 600, fontSize: 11, color: c.textPrimary, py: 1 }}>
                                {sec8.question}
                              </TableCell>
                              {brands.map((b: string) => {
                                const bd = (sec8.brand_data || []).find((d: any) => d.brand === b)
                                return (
                                  <TableCell key={b} align="center" sx={{ fontSize: 12, fontWeight: 700, color: c.primary, py: 1 }}>
                                    {bd?.total_count ?? 0}
                                  </TableCell>
                                )
                              })}
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Grid>

                  {/* Right Side Merged Chart - Shows Total Counts per Brand */}
                  <Grid item xs={12} lg={6} sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Paper elevation={0} sx={{ p: 2, border: `1px solid ${c.border}`, borderRadius: 2, backgroundColor: c.cardBg }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: c.textSecondary, mb: 1, display: 'block' }}>
                        Total Responses Comparison (Section 7 vs Section 8)
                      </Typography>
                      <Box sx={{ height: 200, width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            layout="vertical"
                            data={merged78ChartData}
                            margin={{ top: 10, right: 50, left: 30, bottom: 10 }}
                            barCategoryGap="30%"
                            barGap={4}
                          >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={c.borderMuted} />
                            <XAxis type="number" tick={{ fill: c.textSecondary, fontSize: 10 }} />
                            <YAxis
                              type="category"
                              dataKey="category"
                              tick={{ fill: c.textPrimary, fontSize: 12, fontWeight: 700 }}
                              width={80}
                            />
                            <RechartsTooltip
                              formatter={(val: number, name: string) => [val, name]}
                              labelFormatter={(_, payload: any) => payload?.[0]?.payload?.fullQuestion || ''}
                              contentStyle={{ backgroundColor: c.cardBg, borderColor: c.border, borderRadius: 8 }}
                            />
                            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 5 }} />
                            {brands.map((b: string, idx: number) => (
                              <Bar
                                key={b}
                                dataKey={b}
                                name={b}
                                fill={getBrandColor(b, idx)}
                                radius={[0, 4, 4, 0]}
                                maxBarSize={20}
                              >
                                <LabelList
                                  dataKey={b}
                                  position="right"
                                  formatter={(v: number) => v > 0 ? v : ''}
                                  style={{ fill: c.textPrimary, fontSize: 10, fontWeight: 'bold' }}
                                />
                              </Bar>
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </Box>
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )
        })()}

        {/* Other Individual Sections (e.g. 6, 9, 10) */}
        {Object.entries(sections)
          .filter(([sKey]) => sKey !== '7' && sKey !== '8')
          .map(([sKey, secObj]: [string, any]) => {
            const secData: any[] = secObj.brand_data || []

            // Build correct chart data: 2 categories (Yes/No) with brand values
            const secChartData = [
              {
                category: 'Yes',
                ...secData.reduce((acc: any, bd: any) => {
                  acc[bd.brand] = bd.yes_pct
                  return acc
                }, {})
              },
              {
                category: 'No',
                ...secData.reduce((acc: any, bd: any) => {
                  acc[bd.brand] = bd.no_pct
                  return acc
                }, {})
              }
            ]

            return (
              <Card key={sKey} sx={{ border: `1px solid ${c.border}`, borderRadius: 2 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: c.textPrimary, mb: 2 }}>
                    {secObj.question}
                  </Typography>

                  <Grid container spacing={2} alignItems="stretch">
                    {/* Left Side Table (Yes, No, Grand Total) */}
                    <Grid item xs={12} md={4} sx={{ minWidth: 0 }}>
                      <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${c.border}`, borderRadius: 1.5, overflow: 'hidden' }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 700, fontSize: 11, backgroundColor: '#64748B', color: '#FFFFFF', py: 1 }}>
                                Response
                              </TableCell>
                              {secData.map((bd: any, idx: number) => (
                                <TableCell
                                  key={bd.brand}
                                  align="center"
                                  sx={{
                                    fontWeight: 700,
                                    fontSize: 11,
                                    backgroundColor: getBrandColor(bd.brand, idx),
                                    color: '#FFFFFF',
                                    py: 1
                                  }}
                                >
                                  {bd.brand}
                                </TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {/* Yes Row */}
                            <TableRow hover>
                              <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#10B981', py: 1 }}>
                                Yes
                              </TableCell>
                              {secData.map((bd: any) => (
                                <TableCell key={bd.brand} align="center" sx={{ fontSize: 12, fontWeight: 600, color: c.textPrimary, py: 1 }}>
                                  {bd.yes_count} ({bd.yes_pct}%)
                                </TableCell>
                              ))}
                            </TableRow>
                            {/* No Row */}
                            <TableRow hover>
                              <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#EF4444', py: 1 }}>
                                No
                              </TableCell>
                              {secData.map((bd: any) => (
                                <TableCell key={bd.brand} align="center" sx={{ fontSize: 12, fontWeight: 600, color: c.textPrimary, py: 1 }}>
                                  {bd.no_count} ({bd.no_pct}%)
                                </TableCell>
                              ))}
                            </TableRow>
                            {/* Grand Total Row */}
                            <TableRow hover sx={{ backgroundColor: c.tableHeaderBg }}>
                              <TableCell sx={{ fontWeight: 700, fontSize: 12, color: c.textPrimary, py: 1 }}>
                                Grand Total
                              </TableCell>
                              {secData.map((bd: any) => (
                                <TableCell key={bd.brand} align="center" sx={{ fontSize: 12, fontWeight: 700, color: c.primary, py: 1 }}>
                                  {bd.total_count}
                                </TableCell>
                              ))}
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Grid>

                    {/* Right Side Chart (Yes/No categories with brand bars) */}
                    <Grid item xs={12} md={8} sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Paper elevation={0} sx={{ p: 2, border: `1px solid ${c.border}`, borderRadius: 2, backgroundColor: c.cardBg }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: c.textSecondary, mb: 1, display: 'block' }}>
                          Percentage Distribution (Yes vs No)
                        </Typography>
                        <Box sx={{ height: Math.max(180, secData.length * 50), width: '100%' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              layout="vertical"
                              data={secChartData}
                              margin={{ top: 10, right: 50, left: 30, bottom: 10 }}
                              barCategoryGap="30%"
                              barGap={4}
                            >
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={c.borderMuted} />
                              <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fill: c.textSecondary, fontSize: 10 }} />
                              <YAxis type="category" dataKey="category" tick={{ fill: c.textPrimary, fontSize: 12, fontWeight: 700 }} width={60} />
                              <RechartsTooltip
                                formatter={(val: number, name: string) => [`${val}%`, name]}
                                contentStyle={{ backgroundColor: c.cardBg, borderColor: c.border, borderRadius: 8 }}
                              />
                              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 5 }} />
                              {secData.map((bd: any, idx: number) => (
                                <Bar
                                  key={bd.brand}
                                  dataKey={bd.brand}
                                  name={bd.brand}
                                  fill={getBrandColor(bd.brand, idx)}
                                  radius={[0, 4, 4, 0]}
                                  maxBarSize={20}
                                >
                                  <LabelList
                                    dataKey={bd.brand}
                                    position="right"
                                    formatter={(v: number) => v > 0 ? `${v}%` : ''}
                                    style={{ fill: c.textPrimary, fontSize: 10, fontWeight: 'bold' }}
                                  />
                                </Bar>
                              ))}
                            </BarChart>
                          </ResponsiveContainer>
                        </Box>
                      </Paper>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            )
          })}
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header Bar */}


      {/* Sub-Tab Navigation Switcher */}
      <Box sx={{ borderBottom: 1, borderColor: c.border }}>
        <Tabs
          value={activeTab}
          onChange={(_, newVal) => setActiveTab(newVal)}
          sx={{
            '& .MuiTab-root': {
              fontWeight: 600,
              fontSize: '0.9rem',
              textTransform: 'none',
              minHeight: 48,
              mr: 2,
            }
          }}
        >
          <Tab icon={<Speed sx={{ fontSize: 20 }} />} iconPosition="start" label="Service Frequency" />
          <Tab icon={<Star sx={{ fontSize: 20 }} />} iconPosition="start" label="Service NPS (Authorized & PGM)" />
          <Tab icon={<ThumbUp sx={{ fontSize: 20 }} />} iconPosition="start" label="Benefits & Betterments" />
          <Tab icon={<VerifiedUser sx={{ fontSize: 20 }} />} iconPosition="start" label="Service Satisfaction" />
        </Tabs>
      </Box>

      {/* Tab 0: Service Frequency (KMS & Time) */}
      {activeTab === 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Section 1: KMS Frequency */}
          <Card sx={{ border: `1px solid ${c.border}` }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <Box sx={{ p: 1, borderRadius: 2, backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6', display: 'flex' }}>
                  <Speed />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: c.textPrimary }}>
                    KMS Frequency Breakdown (Column BQ)
                  </Typography>
                  <Typography variant="caption" sx={{ color: c.textSecondary }}>
                    Analysis of vehicle service intervals by kilometer count
                  </Typography>
                </Box>
                <Chip
                  label={`Total Responses: ${kmsDataAll.total_responses}`}
                  variant="outlined"
                  size="small"
                  sx={{ ml: 'auto', fontWeight: 600, color: c.textSecondary, borderColor: c.border }}
                />
              </Box>

              <Grid container spacing={3} sx={{ alignItems: 'flex-start' }}>
                <Grid item xs={12} md={4} sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: c.textPrimary }}>
                    KMS Frequency by Brand (%)
                  </Typography>
                  <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${c.border}`, borderRadius: 2, maxWidth: '100%', overflowX: 'auto' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ backgroundColor: c.tableHeaderBg }}>
                          <TableCell sx={{ fontWeight: 700, fontSize: 11, color: c.textPrimary }}>KMS Interval</TableCell>
                          {kmsBrands.map((b) => (
                            <TableCell key={b} align="right" sx={{ fontWeight: 700, fontSize: 11, color: c.textPrimary }}>
                              {b}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {kmsCategories.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={kmsBrands.length + 1} align="center" sx={{ py: 3, color: c.textSecondary }}>
                              No data available
                            </TableCell>
                          </TableRow>
                        ) : (
                          kmsCategories.map((catItem: any) => (
                            <TableRow key={catItem.category} hover>
                              <TableCell sx={{ fontWeight: 600, fontSize: 12, color: c.textPrimary }}>
                                {catItem.category}
                              </TableCell>
                              {kmsBrands.map((b) => {
                                const bItem = kmsBrandBreakdown.find((item: any) => item.brand === b)
                                const catVal = bItem?.categories?.find((cVal: any) => cVal.category === catItem.category)
                                return (
                                  <TableCell key={b} align="right" sx={{ fontSize: 12, color: c.textSecondary }}>
                                    {catVal ? `${catVal.percentage}%` : '0%'}
                                  </TableCell>
                                )
                              })}
                            </TableRow>
                          ))
                        )}
                        {kmsCategories.length > 0 && (
                          <TableRow sx={{ backgroundColor: c.tableHeaderBg }}>
                            <TableCell sx={{ fontWeight: 700, fontSize: 12, color: c.textPrimary }}>Overall %</TableCell>
                            {kmsBrands.map((b) => (
                              <TableCell key={b} align="right" sx={{ fontWeight: 700, fontSize: 12, color: c.primary }}>
                                100%
                              </TableCell>
                            ))}
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>

                <Grid item xs={12} md={8} sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: c.textPrimary }}>
                    KMS Frequency Percentage by Brand
                  </Typography>
                  <Box sx={{ height: 380, width: '100%', pt: 1 }}>
                    {kmsCategories.length === 0 ? (
                      <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography variant="body2" sx={{ color: c.textSecondary }}>No data for chart rendering.</Typography>
                      </Box>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={kmsChartData}
                          barCategoryGap="12%"
                          barGap={6}
                          margin={{ top: 25, right: 10, left: 5, bottom: 35 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.borderMuted} />
                          <XAxis
                            dataKey="category"
                            tick={{ fill: c.textSecondary, fontSize: 10 }}
                            interval={0}
                            angle={-10}
                            textAnchor="end"
                            height={55}
                          />
                          <YAxis
                            unit="%"
                            domain={[0, (dataMax: number) => Math.min(100, Math.ceil(dataMax + 10))]}
                            tick={{ fill: c.textSecondary, fontSize: 10 }}
                          />
                          <RechartsTooltip
                            formatter={(val: number) => [`${val}%`, 'Percentage']}
                            labelStyle={{ color: '#1E293B', fontWeight: 600 }}
                            contentStyle={{ backgroundColor: c.cardBg, borderColor: c.border }}
                          />
                          <Legend wrapperStyle={{ paddingTop: 10, fontSize: 11 }} />
                          {kmsBrands.map((b: string, index: number) => (
                            <Bar key={b} dataKey={b} name={b} fill={BRAND_COLORS[index % BRAND_COLORS.length]} radius={[4, 4, 0, 0]} maxBarSize={36}>
                              <LabelList
                                dataKey={b}
                                position="top"
                                formatter={(val: number) => val > 0 ? `${val}%` : ''}
                                style={{ fill: c.textPrimary, fontSize: 9, fontWeight: 600 }}
                              />
                            </Bar>
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Section 2: Time Frequency */}
          <Card sx={{ border: `1px solid ${c.border}` }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <Box sx={{ p: 1, borderRadius: 2, backgroundColor: 'rgba(155, 81, 224, 0.1)', color: '#9B51E0', display: 'flex' }}>
                  <AccessTime />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: c.textPrimary }}>
                    Time Frequency Breakdown (Column BP)
                  </Typography>
                  <Typography variant="caption" sx={{ color: c.textSecondary }}>
                    Analysis of vehicle service intervals by time period
                  </Typography>
                </Box>
                <Chip
                  label={`Total Responses: ${timeDataAll.total_responses}`}
                  variant="outlined"
                  size="small"
                  sx={{ ml: 'auto', fontWeight: 600, color: c.textSecondary, borderColor: c.border }}
                />
              </Box>

              <Grid container spacing={3} sx={{ alignItems: 'flex-start' }}>
                <Grid item xs={12} md={4} sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: c.textPrimary }}>
                    Time Frequency by Brand (%)
                  </Typography>
                  <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${c.border}`, borderRadius: 2, maxWidth: '100%', overflowX: 'auto' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ backgroundColor: c.tableHeaderBg }}>
                          <TableCell sx={{ fontWeight: 700, fontSize: 11, color: c.textPrimary }}>Time Interval</TableCell>
                          {timeBrands.map((b) => (
                            <TableCell key={b} align="right" sx={{ fontWeight: 700, fontSize: 11, color: c.textPrimary }}>
                              {b}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {timeCategories.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={timeBrands.length + 1} align="center" sx={{ py: 3, color: c.textSecondary }}>
                              No data available
                            </TableCell>
                          </TableRow>
                        ) : (
                          timeCategories.map((catItem: any) => (
                            <TableRow key={catItem.category} hover>
                              <TableCell sx={{ fontWeight: 600, fontSize: 12, color: c.textPrimary }}>
                                {catItem.category}
                              </TableCell>
                              {timeBrands.map((b) => {
                                const bItem = timeBrandBreakdown.find((item: any) => item.brand === b)
                                const catVal = bItem?.categories?.find((cVal: any) => cVal.category === catItem.category)
                                return (
                                  <TableCell key={b} align="right" sx={{ fontSize: 12, color: c.textSecondary }}>
                                    {catVal ? `${catVal.percentage}%` : '0%'}
                                  </TableCell>
                                )
                              })}
                            </TableRow>
                          ))
                        )}
                        {timeCategories.length > 0 && (
                          <TableRow sx={{ backgroundColor: c.tableHeaderBg }}>
                            <TableCell sx={{ fontWeight: 700, fontSize: 12, color: c.textPrimary }}>Overall %</TableCell>
                            {timeBrands.map((b) => (
                              <TableCell key={b} align="right" sx={{ fontWeight: 700, fontSize: 12, color: c.primary }}>
                                100%
                              </TableCell>
                            ))}
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>

                <Grid item xs={12} md={8} sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: c.textPrimary }}>
                    Time Frequency Percentage by Brand
                  </Typography>
                  <Box sx={{ height: 380, width: '100%', pt: 1 }}>
                    {timeCategories.length === 0 ? (
                      <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography variant="body2" sx={{ color: c.textSecondary }}>No data for chart rendering.</Typography>
                      </Box>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={timeChartData}
                          barCategoryGap="12%"
                          barGap={6}
                          margin={{ top: 25, right: 10, left: 5, bottom: 35 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.borderMuted} />
                          <XAxis
                            dataKey="category"
                            tick={{ fill: c.textSecondary, fontSize: 10 }}
                            interval={0}
                            angle={-10}
                            textAnchor="end"
                            height={55}
                          />
                          <YAxis
                            unit="%"
                            domain={[0, (dataMax: number) => Math.min(100, Math.ceil(dataMax + 10))]}
                            tick={{ fill: c.textSecondary, fontSize: 10 }}
                          />
                          <RechartsTooltip
                            formatter={(val: number) => [`${val}%`, 'Percentage']}
                            labelStyle={{ color: '#1E293B', fontWeight: 600 }}
                            contentStyle={{ backgroundColor: c.cardBg, borderColor: c.border }}
                          />
                          <Legend wrapperStyle={{ paddingTop: 10, fontSize: 11 }} />
                          {timeBrands.map((b: string, index: number) => (
                            <Bar key={b} dataKey={b} name={b} fill={BRAND_COLORS[(index + 2) % BRAND_COLORS.length]} radius={[4, 4, 0, 0]} maxBarSize={36}>
                              <LabelList
                                dataKey={b}
                                position="top"
                                formatter={(val: number) => val > 0 ? `${val}%` : ''}
                                style={{ fill: c.textPrimary, fontSize: 9, fontWeight: 600 }}
                              />
                            </Bar>
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Tab 1: Service NPS (Authorized Workshop vs PGM Mechanics) */}
      {activeTab === 1 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Section 1: Authorized Service Workshop NPS */}
          {renderSectionNps(
            'Section 1: Authorized Service Workshop NPS',
            'NPS analysis and recommendation metrics for Authorized Workshops / Authorized Dealers',
            <VerifiedUser sx={{ fontSize: 24 }} />,
            authNps,
            '#08A9DD'
          )}

          {/* Section 2: PGM (Private Garage Mechanic) NPS */}
          {renderSectionNps(
            'Section 2: PGM (Private Garage Mechanic) NPS',
            'NPS analysis and recommendation metrics for Private Garage Mechanics',
            <Handyman sx={{ fontSize: 24 }} />,
            pgmNps,
            '#7030A0'
          )}
        </Box>
      )}

      {/* Tab 2: Benefits & Betterments (Authorized Workshop vs PGM Mechanics) */}
      {activeTab === 2 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Section 1: Authorized Service Workshop */}
          {renderSectionBenefitsBetterments(
            'Section 1: Authorized Service Workshop',
            'Passive/Feedback (OI-OU) & Issues/Betterments (OV-PJ) analysis for Authorized Service Workshops',
            <VerifiedUser sx={{ fontSize: 24 }} />,
            authBenefits,
            '#08A9DD',
            authSubSegment,
            setAuthSubSegment
          )}

          {/* Section 2: PGM (Private Garage Mechanic) */}
          {renderSectionBenefitsBetterments(
            'Section 2: PGM (Private Garage Mechanic)',
            'Passive/Feedback (OI-OU) & Issues/Betterments (OV-PJ) analysis for Private Garage Mechanics',
            <Handyman sx={{ fontSize: 24 }} />,
            pgmBenefits,
            '#7030A0',
            pgmSubSegment,
            setPgmSubSegment
          )}
        </Box>
      )}

      {/* Tab 3: Service Satisfaction (Authorized Service Workshop) */}
      {activeTab === 3 && renderServiceSatisfactionTab()}
    </Box>
  )
} 