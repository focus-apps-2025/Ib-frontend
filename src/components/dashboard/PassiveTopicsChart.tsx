import { useState, useEffect } from 'react'
import {
    Box, Card, CardContent, Typography, CircularProgress, Alert,
} from '@mui/material'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Cell,
} from 'recharts'
import { dashboardApi } from '../../lib/api'
import { useThemeColors } from '../../utils/colors'
import { toParam } from '../../store'

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

interface PassiveTopicData {
    topic: string
    count: number
}

const TOPIC_COLORS = [
    '#6C63FF', '#FF6584', '#4ECCA3', '#FFD93D', '#FF8A65',
    '#AB47BC', '#26C6DA', '#EC407A', '#66BB6A', '#FFA726',
    '#42A5F5', '#EF5350', '#8D6E63', '#78909C', '#00BCD4',
    '#9CCC65', '#FF7043', '#7E57C2', '#29B6F6',
]

export default function PassiveTopicsChart({ filters }: { filters: FilterState }) {
    const c = useThemeColors()
    const [data, setData] = useState<PassiveTopicData[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const loadData = async () => {
        setLoading(true)
        setError('')
        try {
            const params: Record<string, string | undefined> = {
                region_id: toParam(filters.regionId),
                country_id: toParam(filters.countryId),
                ib_version_id: toParam(filters.ibVersionId),
                brand_model: toParam(filters.brandModel),
                survey_location: toParam(filters.surveyLocation),
                date_from: filters.dateFrom || undefined,
                date_to: filters.dateTo || undefined,
                search: filters.search || undefined,
            }
            const res = await dashboardApi.passiveTopics(params)
            setData(res.data.data || [])
        } catch (err) {
            console.error('Error loading passive topics:', err)
            setError('Failed to load passive topic data.')
        }
        setLoading(false)
    }

    // Update useEffect dependencies
    useEffect(() => {
        loadData()
    }, [filters.regionId, filters.countryId, filters.ibVersionId, filters.brandModel, filters.surveyLocation, filters.dateFrom, filters.dateTo, filters.search])

    // Custom tooltip showing exact counts
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const item = payload[0].payload as PassiveTopicData
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
                    <Typography variant="body2" sx={{ color: payload[0].color || c.textSecondary, fontWeight: 600 }}>
                        Positive feedback: {item.count.toLocaleString()}
                    </Typography>
                </Box>
            )
        }
        return null
    }

    return (
        <Card>
            <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: c.textPrimary }}>
                    Passive Topics: Positive Feedback by Topic
                </Typography>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                        <CircularProgress sx={{ color: c.primary }} />
                    </Box>
                ) : error ? (
                    <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>
                ) : data.length === 0 ? (
                    <Alert severity="info" sx={{ borderRadius: 2 }}>
                        No passive topic data found. Upload an Excel file first.
                    </Alert>
                ) : (
                    <ResponsiveContainer width="100%" height={Math.max(300, data.length * 40)}>
                        <BarChart
                            data={data}
                            layout="vertical"
                            margin={{ left: 100, right: 20 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke={c.chartGrid} />
                            <XAxis type="number" tick={{ fill: c.chartTick, fontSize: 11 }} />
                            <YAxis
                                type="category"
                                dataKey="topic"
                                tick={{ fill: c.chartTick, fontSize: 11 }}
                                width={100}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                {data.map((_, i) => (
                                    <Cell key={`cell-${i}`} fill={TOPIC_COLORS[i % TOPIC_COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    )
}