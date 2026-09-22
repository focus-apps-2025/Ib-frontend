import { useState, useEffect, useMemo } from 'react'
import {
    Box, Card, CardContent, Typography, CircularProgress, Alert, Grid,
    FormControl, InputLabel, Select, MenuItem, LinearProgress, Divider
} from '@mui/material'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Legend, Cell,
} from 'recharts'
import { dashboardApi } from '../../lib/api'
import { useThemeColors } from '../../utils/colors'
import { toParam } from '../../store'
import EmptyState from './EmptyState'

// Permissive filter shape: the Dashboard store provides string[] values, while
// the standalone Comparison page passes plain strings. `toParam` handles both.
interface FilterState {
    regionId?: string | string[]
    countryId?: string | string[]
    ibVersionId?: string | string[]
    brandModel?: string | string[]
    surveyLocation?: string | string[]
    dateFrom?: string
    dateTo?: string
    search?: string
}

interface BrandComparisonData {
    brand: string
    passive_count: number
    issues_count: number
    total_responses: number
}

interface BrandTopicsData {
    brand: string
    passive_topics: Record<string, number>
    issues_topics: Record<string, number>
}

interface IssueItem {
    issue: string
    count: number
    percentage: number
}

interface TopicItem {
    topic: string
    count: number
    percentage: number
}

interface TopIssuesByNpsData {
    promoters: { issues: IssueItem[] }
    passives: { issues: IssueItem[] }
    detractors: { issues: IssueItem[] }
}

interface TopPassiveByNpsData {
    promoters: { topics: TopicItem[] }
    passives: { topics: TopicItem[] }
    detractors: { topics: TopicItem[] }
}

const PASSIVE_COLOR = '#4ECCA3'
const ISSUES_COLOR = '#FF6584'

const NPS_COLORS = {
    promoters: '#4ECCA3', // Green
    passives: '#FFD93D',  // Amber/Yellow
    detractors: '#FF6584',// Red
}

const TOPIC_COLORS = [
    '#6C63FF', '#FF6584', '#4ECCA3', '#FFD93D', '#FF8A65',
    '#AB47BC', '#26C6DA', '#EC407A', '#66BB6A', '#FFA726',
    '#42A5F5', '#EF5350', '#8D6E63', '#78909C', '#00BCD4',
    '#9CCC65', '#FF7043', '#7E57C2', '#29B6F6',
]

export default function BrandComparisonChart({ filters }: { filters: FilterState }) {
    const c = useThemeColors()
    const [data, setData] = useState<BrandComparisonData[]>([])
    const [brandTopics, setBrandTopics] = useState<BrandTopicsData[]>([])
    const [globalBrand, setGlobalBrand] = useState('')
    const [selectedBrand, setSelectedBrand] = useState('')

    const [topIssuesByNps, setTopIssuesByNps] = useState<TopIssuesByNpsData | null>(null)
    const [topPassiveByNps, setTopPassiveByNps] = useState<TopPassiveByNpsData | null>(null)

    const [loading, setLoading] = useState(true)
    const [npsLoading, setNpsLoading] = useState(true)
    const [topicsLoading, setTopicsLoading] = useState(true)

    const [error, setError] = useState('')
    const [npsError, setNpsError] = useState('')
    const [topicsError, setTopicsError] = useState('')

    // Unique brand list derived from brandTopics and data
    const availableBrands = useMemo(() => {
        const set = new Set<string>()
        data.forEach((d) => d.brand && d.brand !== 'Blank' && set.add(d.brand))
        brandTopics.forEach((b) => b.brand && b.brand !== 'Blank' && set.add(b.brand))
        return Array.from(set).sort()
    }, [data, brandTopics])

    const getFilterParams = () => {
        // `globalBrand` (the chart's own single-select dropdown) wins when set;
        // otherwise send the multi-selected brand_model values comma-joined.
        const activeBrand = globalBrand || toParam(filters.brandModel)
        return {
            region_id: toParam(filters.regionId),
            country_id: toParam(filters.countryId),
            ib_version_id: toParam(filters.ibVersionId),
            brand_model: activeBrand,
            survey_location: toParam(filters.surveyLocation),
            date_from: filters.dateFrom || undefined,
            date_to: filters.dateTo || undefined,
            search: filters.search || undefined,
        }
    }

    const loadData = async () => {
        setLoading(true)
        setError('')
        try {
            const res = await dashboardApi.brandComparison(getFilterParams())
            setData(res.data.data || [])
        } catch (err) {
            console.error('Error loading brand comparison:', err)
            setError('Failed to load brand comparison data.')
        }
        setLoading(false)
    }

    const loadNPSData = async () => {
        setNpsLoading(true)
        setNpsError('')
        try {
            const params = getFilterParams()
            const [issuesRes, passiveRes] = await Promise.all([
                dashboardApi.topIssuesByNps(params),
                dashboardApi.topPassiveTopicsByNps(params),
            ])
            setTopIssuesByNps(issuesRes.data)
            setTopPassiveByNps(passiveRes.data)
        } catch (err) {
            console.error('Error loading NPS segmented analysis data:', err)
            setNpsError('Failed to load NPS segmented analysis data.')
        }
        setNpsLoading(false)
    }

    const loadBrandTopics = async () => {
        setTopicsLoading(true)
        setTopicsError('')
        try {
            const res = await dashboardApi.brandTopics(getFilterParams())
            setBrandTopics(res.data.data || [])
        } catch (err) {
            console.error('Error loading brand topics:', err)
            setTopicsError('Failed to load brand topic data.')
        }
        setTopicsLoading(false)
    }

    useEffect(() => {
        loadData()
        loadNPSData()
        loadBrandTopics()
    }, [
        filters.regionId,
        filters.countryId,
        filters.ibVersionId,
        filters.brandModel,
        filters.surveyLocation,
        filters.dateFrom,
        filters.dateTo,
        filters.search,
        globalBrand,
    ])

    // Reset inner topic selector when global filters change
    useEffect(() => {
        if (globalBrand) {
            setSelectedBrand(globalBrand)
        } else {
            setSelectedBrand('')
        }
    }, [globalBrand])

    const isJunkTopic = (topic: string) => {
        if (!topic) return true
        const s = topic.trim().toLowerCase()
        if (['blank', 'nil', 'none', 'n/a', 'na', 'null', 'nan', '-', '.', '..'].includes(s)) return true
        if (!isNaN(Number(s))) return true
        const junkWords = [
            'average', 'avg', 'best', 'good', 'very good', 'poor', 'very poor',
            'fair', 'excellent', 'satisfied', 'unsatisfied', 'dissatisfied',
            'very satisfied', 'neutral', 'medium', 'high', 'low', 'ok', 'okay',
            'normal', 'strongly agree', 'agree', 'disagree', 'strongly disagree'
        ]
        if (junkWords.includes(s)) return true
        if (s.startsWith('submitform')) return true
        return false
    }

    // Selected brand topic data
    const selectedBrandData = brandTopics.find((b) => b.brand === selectedBrand)

    const passiveTopicsData = selectedBrandData
        ? Object.entries(selectedBrandData.passive_topics)
            .filter(([topic]) => !isJunkTopic(topic))
            .map(([topic, count]) => ({ topic, count }))
            .sort((a, b) => b.count - a.count)
        : []

    const issuesTopicsData = selectedBrandData
        ? Object.entries(selectedBrandData.issues_topics)
            .filter(([topic]) => !isJunkTopic(topic))
            .map(([topic, count]) => ({ topic, count }))
            .sort((a, b) => b.count - a.count)
        : []

    // Tooltips
    const StackedTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const item = payload[0].payload as BrandComparisonData
            return (
                <Box sx={{
                    background: c.chartTooltipBg,
                    border: `1px solid ${c.borderStrong}`,
                    borderRadius: 2,
                    p: 1.5,
                    minWidth: 180,
                }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: c.textPrimary, mb: 0.5 }}>
                        {item.brand}
                    </Typography>
                    <Typography variant="body2" sx={{ color: PASSIVE_COLOR, fontWeight: 600 }}>
                        Passive: {item.passive_count.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" sx={{ color: ISSUES_COLOR, fontWeight: 600 }}>
                        Issues: {item.issues_count.toLocaleString()}
                    </Typography>
                    <Typography variant="caption" sx={{ color: c.textMuted }}>
                        Total responses: {item.total_responses.toLocaleString()}
                    </Typography>
                </Box>
            )
        }
        return null
    }

    const TopicTooltip = ({ active, payload, color, metricName }: any) => {
        if (active && payload && payload.length) {
            const item = payload[0].payload
            return (
                <Box sx={{
                    background: c.chartTooltipBg,
                    border: `1px solid ${c.borderStrong}`,
                    borderRadius: 2,
                    p: 1.5,
                    minWidth: 160,
                }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: c.textPrimary, mb: 0.5 }}>
                        {item.topic}
                    </Typography>
                    <Typography variant="body2" sx={{ color: color || c.textSecondary, fontWeight: 600 }}>
                        {metricName}: {item.count.toLocaleString()}
                    </Typography>
                </Box>
            )
        }
        return null
    }

    const chartHeight = Math.max(300, data.length * 40)
    const topicChartHeight = Math.max(250, Math.max(passiveTopicsData.length, issuesTopicsData.length) * 35)

    // Helper component to render NPS Category Cards for Top Issues or Passive Topics
    const renderNpsCategoryCard = (
        title: string,
        items: { name: string; count: number; percentage: number }[],
        color: string
    ) => {
        return (
            <Card
                sx={{
                    height: '100%',
                    background: `${color}14`,
                    border: `2px solid ${color}4D`,
                    borderRadius: 2,
                    boxShadow: 'none',
                }}
            >
                <CardContent sx={{ p: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: c.textPrimary, fontSize: '0.95rem' }}>
                            {title}
                        </Typography>
                    </Box>
                    <Divider sx={{ mb: 2, borderColor: `${color}30` }} />

                    {items.length === 0 ? (
                        <Box sx={{ py: 4, textAlign: 'center' }}>
                            <Typography variant="body2" sx={{ color: c.textMuted, fontStyle: 'italic' }}>
                                No data available
                            </Typography>
                        </Box>
                    ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {items.map((item, idx) => (
                                <Box key={`${item.name}-${idx}`}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600, color: c.textPrimary, fontSize: '0.85rem' }}>
                                            {item.name}
                                        </Typography>
                                        <Typography variant="caption" sx={{ fontWeight: 700, color, fontSize: '0.8rem' }}>
                                            {item.count} ({item.percentage}%)
                                        </Typography>
                                    </Box>
                                    <LinearProgress
                                        variant="determinate"
                                        value={Math.min(100, item.percentage)}
                                        sx={{
                                            height: 7,
                                            borderRadius: 4,
                                            bgcolor: `${color}33`,
                                            '& .MuiLinearProgress-bar': {
                                                bgcolor: color,
                                                borderRadius: 4,
                                            },
                                        }}
                                    />
                                </Box>
                            ))}
                        </Box>
                    )}
                </CardContent>
            </Card>
        )
    }

    if (!loading && !npsLoading && !topicsLoading && data.length === 0) {
        return <EmptyState title="No Brand Comparison Data" message="Try adjusting your filters or uploading new survey data." />
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Top Global Brand Filter Bar */}
            <Card sx={{ border: `1px solid ${c.border}` }}>
                <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: c.textPrimary, fontSize: '1.05rem' }}>
                            Brand & NPS Segmented Feedback Analysis
                        </Typography>
                        <FormControl size="small" sx={{ minWidth: 240 }}>
                            <InputLabel id="global-brand-filter-label">Brand Filter</InputLabel>
                            <Select
                                labelId="global-brand-filter-label"
                                id="global-brand-filter"
                                value={globalBrand}
                                onChange={(e) => setGlobalBrand(e.target.value)}
                                label="Brand Filter"
                            >
                                <MenuItem value="">All Brands</MenuItem>
                                {availableBrands.map((b) => (
                                    <MenuItem key={b} value={b}>{b}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>
                </CardContent>
            </Card>

            {/* Stacked Comparison Chart */}
            <Card sx={{ border: `1px solid ${c.border}` }}>
                <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: c.textPrimary }}>
                        Brand-wise Comparison: Passive vs Issues (Stacked)
                    </Typography>

                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                            <CircularProgress sx={{ color: c.primary }} />
                        </Box>
                    ) : error ? (
                        <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>
                    ) : data.length === 0 ? (
                        <Alert severity="info" sx={{ borderRadius: 2 }}>
                            No brand comparison data found. Upload an Excel file first.
                        </Alert>
                    ) : (
                        <ResponsiveContainer width="100%" height={chartHeight}>
                            <BarChart
                                data={data}
                                layout="vertical"
                                margin={{ left: 120, right: 20 }}
                                barGap={2}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke={c.chartGrid} />
                                <XAxis type="number" tick={{ fill: c.chartTick, fontSize: 11 }} />
                                <YAxis
                                    type="category"
                                    dataKey="brand"
                                    tick={{ fill: c.chartTick, fontSize: 11 }}
                                    width={120}
                                />
                                <Tooltip content={<StackedTooltip />} />
                                <Legend
                                    wrapperStyle={{ fontSize: '12px', color: c.textSecondary }}
                                    formatter={(value: string) => (
                                        <span style={{ color: c.textSecondary }}>
                                            {value === 'passive_count' ? 'Passive (Good)' : 'Issues (Complaints)'}
                                        </span>
                                    )}
                                />
                                <Bar dataKey="passive_count" stackId="a" fill={PASSIVE_COLOR} radius={[0, 0, 0, 0]} />
                                <Bar dataKey="issues_count" stackId="a" fill={ISSUES_COLOR} radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>

            {/* Top 10 Issues by NPS Category */}
            <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: c.textPrimary, mb: 2 }}>
                    Top 10 Issues by NPS Category
                </Typography>
                {npsLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                        <CircularProgress sx={{ color: c.primary }} />
                    </Box>
                ) : npsError ? (
                    <Alert severity="error" sx={{ borderRadius: 2 }}>{npsError}</Alert>
                ) : (
                    <Grid container spacing={2.5}>
                        <Grid size={{xs: 12, md: 4}}>
                            {renderNpsCategoryCard(
                                'Promoters - Top 10 Issues',
                                (topIssuesByNps?.promoters.issues || []).map((i) => ({ name: i.issue, count: i.count, percentage: i.percentage })),
                                NPS_COLORS.promoters
                            )}
                        </Grid>
                        <Grid size={{xs: 12, md: 4}}>
                            {renderNpsCategoryCard(
                                'Passives - Top 10 Issues',
                                (topIssuesByNps?.passives.issues || []).map((i) => ({ name: i.issue, count: i.count, percentage: i.percentage })),
                                NPS_COLORS.passives
                            )}
                        </Grid>
                        <Grid size={{xs: 12, md: 4}}>
                            {renderNpsCategoryCard(
                                'Detractors - Top 10 Issues',
                                (topIssuesByNps?.detractors.issues || []).map((i) => ({ name: i.issue, count: i.count, percentage: i.percentage })),
                                NPS_COLORS.detractors
                            )}
                        </Grid>
                    </Grid>
                )}
            </Box>

            {/* Top 10 Passive/Good Feedback by NPS Category */}
            <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: c.textPrimary, mb: 2 }}>
                    Top 10 Passive/Good Feedback by NPS Category
                </Typography>
                {npsLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                        <CircularProgress sx={{ color: c.primary }} />
                    </Box>
                ) : npsError ? (
                    <Alert severity="error" sx={{ borderRadius: 2 }}>{npsError}</Alert>
                ) : (
                    <Grid container spacing={2.5}>
                        <Grid size={{xs: 12, md: 4}}>
                            {renderNpsCategoryCard(
                                'Promoters - Top 10 Passive Topics',
                                (topPassiveByNps?.promoters.topics || []).map((t) => ({ name: t.topic, count: t.count, percentage: t.percentage })),
                                NPS_COLORS.promoters
                            )}
                        </Grid>
                        <Grid size={{xs: 12, md: 4}}>
                            {renderNpsCategoryCard(
                                'Passives - Top 10 Passive Topics',
                                (topPassiveByNps?.passives.topics || []).map((t) => ({ name: t.topic, count: t.count, percentage: t.percentage })),
                                NPS_COLORS.passives
                            )}
                        </Grid>
                        <Grid size={{xs: 12, md: 4}}>
                            {renderNpsCategoryCard(
                                'Detractors - Top 10 Passive Topics',
                                (topPassiveByNps?.detractors.topics || []).map((t) => ({ name: t.topic, count: t.count, percentage: t.percentage })),
                                NPS_COLORS.detractors
                            )}
                        </Grid>
                    </Grid>
                )}
            </Box>

            {/* Per-Brand Topic Breakdown */}
            <Card>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: c.textPrimary }}>
                            Per-Brand Topic Breakdown
                        </Typography>
                        <FormControl size="small" sx={{ minWidth: 200 }}>
                            <InputLabel>Select Brand</InputLabel>
                            <Select
                                id="brand-topic-selector"
                                value={selectedBrand}
                                onChange={(e) => setSelectedBrand(e.target.value)}
                                label="Select Brand"
                            >
                                <MenuItem value="">All Brands</MenuItem>
                                {brandTopics.map((b) => (
                                    <MenuItem key={b.brand} value={b.brand}>{b.brand}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>

                    {topicsLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                            <CircularProgress sx={{ color: c.primary }} />
                        </Box>
                    ) : topicsError ? (
                        <Alert severity="error" sx={{ borderRadius: 2 }}>{topicsError}</Alert>
                    ) : !selectedBrand ? (
                        <Alert severity="info" sx={{ borderRadius: 2 }}>
                            Select a brand above to see its passive and issues topic breakdown.
                        </Alert>
                    ) : (
                        <Grid container spacing={2}>
                            {/* Passive Topics for selected brand */}
                            <Grid size={{xs: 12, md: 6}}>
                                <Card sx={{ background: `${PASSIVE_COLOR}08`, border: `1px solid ${PASSIVE_COLOR}30` }}>
                                    <CardContent>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: PASSIVE_COLOR }}>
                                            {selectedBrand} — Passive Topics
                                        </Typography>
                                        {passiveTopicsData.length === 0 ? (
                                            <Alert severity="info" sx={{ borderRadius: 2 }}>
                                                No passive topic data for this brand.
                                            </Alert>
                                        ) : (
                                            <ResponsiveContainer width="100%" height={topicChartHeight}>
                                                <BarChart
                                                    data={passiveTopicsData}
                                                    layout="vertical"
                                                    margin={{ left: 100, right: 20 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" stroke={c.chartGrid} />
                                                    <XAxis type="number" tick={{ fill: c.chartTick, fontSize: 11 }} />
                                                    <YAxis
                                                        type="category"
                                                        dataKey="topic"
                                                        tick={{ fill: c.chartTick, fontSize: 10 }}
                                                        width={100}
                                                    />
                                                    <Tooltip content={<TopicTooltip color={PASSIVE_COLOR} metricName="Passive" />} />
                                                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                                        {passiveTopicsData.map((_, i) => (
                                                            <Cell key={`p-${i}`} fill={TOPIC_COLORS[i % TOPIC_COLORS.length]} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        )}
                                    </CardContent>
                                </Card>
                            </Grid>

                            {/* Issues Topics for selected brand */}
                            <Grid size={{xs: 12, md: 6}}>
                                <Card sx={{ background: `${ISSUES_COLOR}08`, border: `1px solid ${ISSUES_COLOR}30` }}>
                                    <CardContent>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: ISSUES_COLOR }}>
                                            {selectedBrand} — Issues Topics
                                        </Typography>
                                        {issuesTopicsData.length === 0 ? (
                                            <Alert severity="info" sx={{ borderRadius: 2 }}>
                                                No issues topic data for this brand.
                                            </Alert>
                                        ) : (
                                            <ResponsiveContainer width="100%" height={topicChartHeight}>
                                                <BarChart
                                                    data={issuesTopicsData}
                                                    layout="vertical"
                                                    margin={{ left: 100, right: 20 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" stroke={c.chartGrid} />
                                                    <XAxis type="number" tick={{ fill: c.chartTick, fontSize: 11 }} />
                                                    <YAxis
                                                        type="category"
                                                        dataKey="topic"
                                                        tick={{ fill: c.chartTick, fontSize: 10 }}
                                                        width={100}
                                                    />
                                                    <Tooltip content={<TopicTooltip color={ISSUES_COLOR} metricName="Issues" />} />
                                                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                                        {issuesTopicsData.map((_, i) => (
                                                            <Cell key={`i-${i}`} fill={TOPIC_COLORS[i % TOPIC_COLORS.length]} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        )}
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>
                    )}
                </CardContent>
            </Card>
        </Box>
    )
}