import { useState, useEffect } from 'react'
import {
    Box, Card, CardContent, Typography, Grid, Table, TableBody,
    TableCell, TableHead, TableRow, CircularProgress, Alert,
    Paper, Divider, Chip, useTheme, alpha,
} from '@mui/material'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Legend, LabelList, ReferenceLine,
} from 'recharts'
import { dashboardApi } from '../../lib/api'
import { useThemeColors } from '../../utils/colors'
import {
    TrendingUp, People, LocationCity, ShoppingBag, Home, Work, DirectionsBike,
    BarChart as BarChartIcon, PieChart as PieChartIcon,
} from '@mui/icons-material'

interface FilterState {
    regionId: string
    countryId: string
    ibVersionId: string
    brandModel?: string
    surveyLocation?: string
    dateFrom?: string
    dateTo?: string
    search?: string
}

interface AnalyticsData {
    age_group: MatrixData
    age_city: MatrixData
    mode_of_purchase: MatrixData
    ownership: MatrixData
    profession: MatrixData
    location_model_sample_size?: {
        cities: string[]
        brands: string[]
        tenures: string[]
        table: Record<string, any>[]
    }
    vehicle_usage?: MatrixData
}

interface MatrixData {
    categories: string[]
    category_header?: string
    brands: string[]
    table: Record<string, number | string>[]
    chart: Record<string, number | string>[]
}

const BRAND_COLOR_PALETTE = [
    '#1871c9ff', '#2ae886ff', '#e8903dff', '#a731abff', '#f59f1bff',
    '#0097a7ff', '#ed6433ff', '#5e35b0ff', '#d62929ff', '#6cb6ff',
]

const getBrandColor = (brand: string) => {
    if (brand.includes('TVS')) return '#1871c9ff'
    if (brand.includes('Bajaj')) return '#2ae886ff'
    // Dynamic hash-based colour for any brand coming from the DB
    let hash = 0
    for (let i = 0; i < brand.length; i++) hash = brand.charCodeAt(i) + ((hash << 5) - hash)
    return BRAND_COLOR_PALETTE[Math.abs(hash) % BRAND_COLOR_PALETTE.length]
}

const getBrandColorLight = (brand: string) => {
    if (brand.includes('TVS')) return 'rgba(24, 113, 201, 0.15)'
    if (brand.includes('Bajaj')) return 'rgba(42, 232, 134, 0.15)'
    // Dynamic hash-based light colour for any brand coming from the DB
    let hash = 0
    for (let i = 0; i < brand.length; i++) hash = brand.charCodeAt(i) + ((hash << 5) - hash)
    const idx = Math.abs(hash) % BRAND_COLOR_PALETTE.length
    const match = BRAND_COLOR_PALETTE[idx].match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/)
    if (match) {
        const r = parseInt(match[1], 16)
        const g = parseInt(match[2], 16)
        const b = parseInt(match[3], 16)
        return `rgba(${r}, ${g}, ${b}, 0.15)`
    }
    return 'rgba(232, 144, 61, 0.15)'
}

// ─── Custom Card Header ─────────────────────────────────────────────
const CardHeader = ({ title, icon, subtitle, color }: {
    title: string,
    icon?: React.ReactNode,
    subtitle?: string,
    color?: string
}) => {
    const c = useThemeColors()
    const brandColor = color || '#1871c9ff'

    return (
        <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {icon && (
                    <Box sx={{
                        p: 1,
                        borderRadius: 2,
                        background: alpha(brandColor, 0.12),
                        color: brandColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        {icon}
                    </Box>
                )}
                <Typography variant="h6" sx={{
                    fontWeight: 700,
                    color: c.textPrimary,
                    letterSpacing: '-0.01em',
                }}>
                    {title}
                </Typography>
            </Box>
            {subtitle && (
                <Typography variant="caption" sx={{
                    color: c.textMuted,
                    ml: icon ? 5.5 : 0,
                    display: 'block',
                    mt: 0.5,
                }}>
                    {subtitle}
                </Typography>
            )}
        </Box>
    )
}

export default function DashboardAnalytics({ filters }: { filters: FilterState }) {
    const c = useThemeColors()
    const [data, setData] = useState<AnalyticsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const loadData = async () => {
        setLoading(true)
        setError('')
        try {
            const params: Record<string, string | undefined> = {
                region_id: filters.regionId || undefined,
                country_id: filters.countryId || undefined,
                ib_version_id: filters.ibVersionId || undefined,
                brand_model: filters.brandModel || undefined,
                survey_location: filters.surveyLocation || undefined,
                date_from: filters.dateFrom || undefined,
                date_to: filters.dateTo || undefined,
                search: filters.search || undefined,
            }
            const res = await dashboardApi.analytics(params)
            setData(res.data)
        } catch (err) {
            console.error('Error loading analytics:', err)
            setError('Failed to load dashboard analytics.')
        }
        setLoading(false)
    }

    // Update useEffect dependencies
    useEffect(() => {
        loadData()
    }, [filters.regionId, filters.countryId, filters.ibVersionId, filters.brandModel, filters.surveyLocation, filters.dateFrom, filters.dateTo, filters.search])
    // ── Enhanced Visualization Card ──────────────────────────────────
    const VizCard = ({
        title,
        matrix,
        showMode = 'count',
        chartValueType = 'count',
        chartLabelType = 'count',
        isAgeCity = false,
        icon,
        subtitle,
        brandColor,
    }: {
        title: string
        matrix?: MatrixData
        showMode?: 'count' | 'percent' | 'both'
        chartValueType?: 'count' | 'percent'
        chartLabelType?: 'count' | 'percent'
        isAgeCity?: boolean
        icon?: React.ReactNode
        subtitle?: string
        brandColor?: string
    }) => {
        const showCityCol = title.includes('City')
        const accentColor = brandColor || '#1871c9ff'
        const accentLight = alpha(accentColor, 0.08)
        // Compute all brands present in either matrix.brands or table data
        const tableBrands = (matrix?.table && matrix.table.length > 0)
            ? Object.keys(matrix.table[0]).filter(k => {
                return k !== 'category' && k !== 'total' && !k.endsWith('_pct') && !k.endsWith('_count')
            })
            : []
        const allBrands = Array.from(new Set([...(matrix?.brands || []), ...tableBrands]))

        // Special rendering for Age Group by City & Brand
let sortedAgeGroups: string[] = [];
let cities: string[] = []
        if (isAgeCity && matrix) {
            const cityAgeMap: Record<string, Record<string, Record<string, number>>> = {}
            const allAgeGroups = new Set<string>()

            matrix.table.forEach(row => {
                const city = String(row.category).split('|')[0]
                const ageGroup = String(row.category).split('|')[1]
                if (city && ageGroup) {
                    allAgeGroups.add(ageGroup)
                    if (!cityAgeMap[city]) cityAgeMap[city] = {}
                    cityAgeMap[city][ageGroup] = {}
                    allBrands.forEach(brand => {
                        cityAgeMap[city][ageGroup][brand] = Number(row[brand]) || 0
                    })
                }
            })

            sortedAgeGroups = Array.from(allAgeGroups).sort()
            cities = Object.keys(cityAgeMap)

            return (
                <Card
                    sx={{
                        border: `1px solid ${alpha(accentColor, 0.15)}`,
                        borderRadius: 4,
                        boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: `0 12px 48px ${alpha(accentColor, 0.12)}`,
                        },
                        overflow: 'hidden',
                        position: 'relative',
                        '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '4px',
                            background: `linear-gradient(90deg, ${accentColor}, ${alpha(accentColor, 0.4)})`,
                        }
                    }}
                >
                    <CardContent sx={{ p: 3.5 }}>
                        <CardHeader title={title} icon={icon} subtitle={subtitle} color={accentColor} />

                        {/* Table */}
                        <Paper
                            elevation={0}
                            sx={{
                                overflowX: 'auto',
                                mb: 3,
                                borderRadius: 2,
                                border: `1px solid ${c.borderMuted}`,
                            }}
                        >
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell
                                            rowSpan={2}
                                            sx={{
                                                fontWeight: 700,
                                                background: alpha(accentColor, 0.06),
                                                color: c.textPrimary,
                                                fontSize: '0.7rem',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em',
                                                minWidth: '120px',
                                                borderBottom: `2px solid ${alpha(accentColor, 0.2)}`,
                                            }}
                                        >
                                            {matrix.category_header || 'City'}
                                        </TableCell>
                                        {allBrands.map((brand) => (
                                            <TableCell
                                                key={brand}
                                                colSpan={sortedAgeGroups.length + 1}
                                                align="center"
                                                sx={{
                                                    fontWeight: 700,
                                                    background: alpha(accentColor, 0.06),
                                                    color: c.textPrimary,
                                                    fontSize: '0.7rem',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.05em',
                                                    borderBottom: `2px solid ${alpha(accentColor, 0.2)}`,
                                                }}
                                            >
                                                <Chip
                                                    label={brand}
                                                    size="small"
                                                    sx={{
                                                        background: getBrandColorLight(brand),
                                                        color: getBrandColor(brand),
                                                        fontWeight: 600,
                                                        fontSize: '0.65rem',
                                                        height: 24,
                                                    }}
                                                />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                    <TableRow>
                                        {allBrands.map((brand) => (
                                            <>
                                                {sortedAgeGroups.map((ageGroup) => (
                                                    <TableCell
                                                        key={`${brand}-${ageGroup}`}
                                                        align="right"
                                                        sx={{
                                                            fontWeight: 600,
                                                            background: alpha(accentColor, 0.04),
                                                            color: c.textSecondary,
                                                            fontSize: '0.6rem',
                                                            minWidth: '65px',
                                                            padding: '4px 6px',
                                                            borderBottom: `1px solid ${c.borderMuted}`,
                                                        }}
                                                    >
                                                        {ageGroup}
                                                    </TableCell>
                                                ))}
                                                <TableCell
                                                    key={`${brand}-total`}
                                                    align="right"
                                                    sx={{
                                                        fontWeight: 700,
                                                        background: alpha(accentColor, 0.04),
                                                        color: accentColor,
                                                        fontSize: '0.65rem',
                                                        minWidth: '60px',
                                                        padding: '4px 6px',
                                                        borderLeft: `1px solid ${c.borderMuted}`,
                                                        borderBottom: `1px solid ${c.borderMuted}`,
                                                    }}
                                                >
                                                    Total
                                                </TableCell>
                                            </>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {cities.map((city) => {
                                        const brandTotals: Record<string, number> = {}
                                        allBrands.forEach(brand => {
                                            brandTotals[brand] = 0
                                            sortedAgeGroups.forEach(ageGroup => {
                                                brandTotals[brand] += (cityAgeMap[city]?.[ageGroup]?.[brand] || 0)
                                            })
                                        })

                                        return (
                                            <TableRow
                                                key={city}
                                                sx={{
                                                    '&:hover': { background: alpha(accentColor, 0.04) },
                                                    '&:nth-of-type(even)': { background: alpha(accentColor, 0.02) },
                                                }}
                                            >
                                                <TableCell sx={{
                                                    fontWeight: 600,
                                                    color: c.textPrimary,
                                                    fontSize: '0.75rem',
                                                }}>
                                                    {city}
                                                </TableCell>
                                                {allBrands.map((brand) => (
                                                    <>
                                                        {sortedAgeGroups.map((ageGroup) => {
                                                            const value = cityAgeMap[city]?.[ageGroup]?.[brand] || 0
                                                            const total = brandTotals[brand] || 1
                                                            const percentage = total > 0 ? (value / total) * 100 : 0
                                                            return (
                                                                <TableCell
                                                                    key={`${city}-${brand}-${ageGroup}`}
                                                                    align="right"
                                                                    sx={{
                                                                        color: c.textPrimary,
                                                                        fontSize: '0.7rem',
                                                                        fontWeight: value > 0 ? 500 : 400,
                                                                    }}
                                                                >
                                                                    {value > 0 ? `${value} (${percentage.toFixed(1)}%)` : '—'}
                                                                </TableCell>
                                                            )
                                                        })}
                                                        <TableCell
                                                            align="right"
                                                            sx={{
                                                                fontWeight: 700,
                                                                color: getBrandColor(brand),
                                                                borderLeft: `1px solid ${c.borderMuted}`,
                                                                fontSize: '0.7rem',
                                                            }}
                                                        >
                                                            {brandTotals[brand] > 0 ? '100%' : '—'}
                                                        </TableCell>
                                                    </>
                                                ))}
                                            </TableRow>
                                        )
                                    })}
                                    <TableRow
                                        sx={{
                                            background: alpha(accentColor, 0.06),
                                            '&:hover': { background: alpha(accentColor, 0.1) },
                                        }}
                                    >
                                        <TableCell sx={{
                                            fontWeight: 700,
                                            color: c.textPrimary,
                                            fontSize: '0.75rem',
                                        }}>
                                            Grand Total
                                        </TableCell>
                                        {allBrands.map((brand) => {
                                            let grandTotal = 0
                                            cities.forEach(city => {
                                                sortedAgeGroups.forEach(ageGroup => {
                                                    grandTotal += (cityAgeMap[city]?.[ageGroup]?.[brand] || 0)
                                                })
                                            })
                                            const totalPerBrand = grandTotal || 1

                                            return (
                                                <>
                                                    {sortedAgeGroups.map((ageGroup) => {
                                                        let total = 0
                                                        cities.forEach(city => {
                                                            total += (cityAgeMap[city]?.[ageGroup]?.[brand] || 0)
                                                        })
                                                        const percentage = totalPerBrand > 0 ? (total / totalPerBrand) * 100 : 0
                                                        return (
                                                            <TableCell
                                                                key={`grand-${brand}-${ageGroup}`}
                                                                align="right"
                                                                sx={{
                                                                    fontWeight: 700,
                                                                    color: c.textPrimary,
                                                                    fontSize: '0.7rem',
                                                                }}
                                                            >
                                                                {total > 0 ? `${total} (${percentage.toFixed(1)}%)` : '—'}
                                                            </TableCell>
                                                        )
                                                    })}
                                                    <TableCell
                                                        align="right"
                                                        sx={{
                                                            fontWeight: 700,
                                                            color: getBrandColor(brand),
                                                            borderLeft: `1px solid ${c.borderMuted}`,
                                                            fontSize: '0.7rem',
                                                        }}
                                                    >
                                                        100%
                                                    </TableCell>
                                                </>
                                            )
                                        })}
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </Paper>

                        {/* Chart */}
                        <Box sx={{ pt: 1 }}>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={matrix.chart} margin={{ top: 20, right: 10, bottom: 20, left: -15 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={c.chartGrid} vertical={false} />
                                    <XAxis
                                        dataKey="category"
                                        tick={{ fill: c.chartTick, fontSize: 9, fontWeight: 500 }}
                                        interval={0}
                                        angle={-90}
                                        textAnchor="end"
                                        height={80}
                                        tickFormatter={(val) => String(val).replace('|', ' / ')}
                                    />
                                    <YAxis
                                        tick={{ fill: c.chartTick, fontSize: 10, fontWeight: 500 }}
                                        tickFormatter={(val) => `${val}%`}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            background: c.chartTooltipBg,
                                            border: `1px solid ${alpha(accentColor, 0.2)}`,
                                            borderRadius: 12,
                                            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                                        }}
                                        labelStyle={{ color: c.textPrimary, fontWeight: 700, marginBottom: 4 }}
                                        labelFormatter={(label) => String(label).replace('|', ' / ')}
                                        formatter={(value, name) => {
                                            const key = String(name)
                                            const brandIdx = allBrands.findIndex((b) => key.includes(b))
                                            const brand = allBrands[brandIdx]
                                            return [`${Number(value).toFixed(1)}%`, brand || key]
                                        }}
                                    />
                                    <Legend
                                        wrapperStyle={{
                                            fontSize: '10px',
                                            color: c.textSecondary,
                                            paddingTop: 10,
                                        }}
                                        iconType="circle"
                                    />
                                    <ReferenceLine y={0} stroke={c.borderMuted} />
                                    {allBrands.map((b) => {
                                        const valueKey = `${b}_pct`
                                        const labelKey = `${b}_pct`
                                        const labelFormatter = (val: number) => `${Number(val).toFixed(1)}%`

                                        return (
                                            <Bar
                                                key={b}
                                                dataKey={valueKey}
                                                name={b}
                                                fill={getBrandColor(b)}
                                                radius={[4, 4, 0, 0]}
                                                maxBarSize={16}
                                            >
                                                <LabelList
                                                    dataKey={labelKey}
                                                    position="top"
                                                    formatter={labelFormatter}
                                                    style={{
                                                        fontSize: 7,
                                                        fill: c.textSecondary,
                                                        fontWeight: 600,
                                                    }}
                                                />
                                            </Bar>
                                        )
                                    })}
                                </BarChart>
                            </ResponsiveContainer>
                        </Box>
                    </CardContent>
                </Card>
            )
        }

        // Regular rendering for other cards
        return (
            <Card
                sx={{
                    border: `1px solid ${alpha(accentColor, 0.15)}`,
                    borderRadius: 4,
                    boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: `0 12px 48px ${alpha(accentColor, 0.12)}`,
                    },
                    overflow: 'hidden',
                    position: 'relative',
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '4px',
                        background: `linear-gradient(90deg, ${accentColor}, ${alpha(accentColor, 0.4)})`,
                    }
                }}
            >
                <CardContent sx={{ p: 3.5 }}>
                    <CardHeader title={title} icon={icon} subtitle={subtitle} color={accentColor} />

                    {!matrix || allBrands.length === 0 || matrix.categories.length === 0 ? (
                        <Alert severity="info" sx={{ borderRadius: 2 }}>
                            No data available.
                        </Alert>
                    ) : (
                        <>
                            {/* Table */}
                            <Paper
                                elevation={0}
                                sx={{
                                    overflowX: 'auto',
                                    mb: 3,
                                    borderRadius: 2,
                                    border: `1px solid ${c.borderMuted}`,
                                }}
                            >
                                <Table size="small" stickyHeader>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{
                                                fontWeight: 700,
                                                background: alpha(accentColor, 0.06),
                                                color: c.textPrimary,
                                                fontSize: '0.7rem',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em',
                                                borderBottom: `2px solid ${alpha(accentColor, 0.2)}`,
                                            }}>
                                                {matrix.category_header || 'Category'}
                                            </TableCell>
                                            {allBrands.map((brand) => (
                                                <TableCell
                                                    key={brand}
                                                    align="center"
                                                    sx={{
                                                        fontWeight: 700,
                                                        background: alpha(accentColor, 0.06),
                                                        color: c.textPrimary,
                                                        fontSize: '0.7rem',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.05em',
                                                        borderBottom: `2px solid ${alpha(accentColor, 0.2)}`,
                                                    }}
                                                >
                                                    <Chip
                                                        label={brand}
                                                        size="small"
                                                        sx={{
                                                            background: getBrandColorLight(brand),
                                                            color: getBrandColor(brand),
                                                            fontWeight: 600,
                                                            fontSize: '0.65rem',
                                                            height: 24,
                                                        }}
                                                    />
                                                </TableCell>
                                            ))}
                                            <TableCell
                                                align="right"
                                                sx={{
                                                    fontWeight: 700,
                                                    background: alpha(accentColor, 0.06),
                                                    color: c.textPrimary,
                                                    fontSize: '0.7rem',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.05em',
                                                    borderBottom: `2px solid ${alpha(accentColor, 0.2)}`,
                                                }}
                                            >
                                                {showMode === 'percent' ? 'Grand Total' : 'Total'}
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {matrix.table.map((row, idx) => {
                                            const isTotal = row.category === 'Grand Total'
                                            return (
                                                <TableRow
                                                    key={idx}
                                                    sx={{
                                                        background: isTotal
                                                            ? alpha(accentColor, 0.06)
                                                            : idx % 2 === 0
                                                                ? alpha(accentColor, 0.02)
                                                                : 'transparent',
                                                        '&:hover': { background: alpha(accentColor, 0.04) },
                                                    }}
                                                >
                                                    <TableCell sx={{
                                                        fontWeight: isTotal ? 700 : 400,
                                                        color: c.textPrimary,
                                                        fontSize: '0.75rem',
                                                    }}>
                                                        {String(row.category)}
                                                    </TableCell>
                                                    {allBrands.map((b) => {
                                                        const cnt = row[b]
                                                        const pct = row[`${b}_pct`]
                                                        let displayValue = ''
                                                        if (isTotal) {
                                                            if (showMode === 'percent') {
                                                                displayValue = '100.0%'
                                                            } else {
                                                                displayValue = typeof cnt === 'number' ? cnt.toLocaleString() : String(cnt ?? 0)
                                                            }
                                                        } else {
                                                            if (showMode === 'both') {
                                                                displayValue = `${typeof cnt === 'number' ? cnt.toLocaleString() : (cnt ?? 0)} (${typeof pct === 'number' ? pct.toFixed(1) : (pct ?? 0)}%)`
                                                            } else if (showMode === 'percent') {
                                                                const valToUse = typeof pct === 'number' ? pct : (typeof cnt === 'number' ? cnt : 0)
                                                                displayValue = `${typeof valToUse === 'number' ? valToUse.toFixed(1) : valToUse}%`
                                                            } else {
                                                                displayValue = typeof cnt === 'number' ? cnt.toLocaleString() : String(cnt ?? 0)
                                                            }
                                                        }

                                                        return (
                                                            <TableCell
                                                                key={b}
                                                                align="right"
                                                                sx={{
                                                                    fontWeight: isTotal ? 700 : 400,
                                                                    color: isTotal ? getBrandColor(b) : c.textPrimary,
                                                                    fontSize: '0.75rem',
                                                                }}
                                                            >
                                                                {displayValue}
                                                            </TableCell>
                                                        )
                                                    })}
                                                    <TableCell
                                                        align="right"
                                                        sx={{
                                                            fontWeight: 700,
                                                            color: accentColor,
                                                            fontSize: '0.75rem',
                                                        }}
                                                    >
                                                        {isTotal ? (
                                                            showMode === 'percent' ? '100.0%' : typeof row.total === 'number' ? (row.total as number).toLocaleString() : '0'
                                                        ) : (
                                                            showMode === 'percent' ? `${typeof row.total === 'number' ? (row.total as number).toFixed(1) : (row.total ?? 0)}%` : typeof row.total === 'number' ? (row.total as number).toLocaleString() : '0'
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </Paper>

                            {/* Chart */}
                            <Box sx={{ pt: 1 }}>
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={matrix.chart} margin={{ top: 20, right: 10, bottom: 20, left: -15 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={c.chartGrid} vertical={false} />
                                        <XAxis
                                            dataKey="category"
                                            tick={{ fill: c.chartTick, fontSize: 9, fontWeight: 500 }}
                                            interval={0}
                                            angle={-90}
                                            textAnchor="end"
                                            height={80}
                                            tickFormatter={(val) => String(val)}
                                        />
                                        <YAxis
                                            tick={{ fill: c.chartTick, fontSize: 10, fontWeight: 500 }}
                                            tickFormatter={(val) => chartValueType === 'percent' ? `${val}%` : String(val)}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                background: c.chartTooltipBg,
                                                border: `1px solid ${alpha(accentColor, 0.2)}`,
                                                borderRadius: 12,
                                                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                                            }}
                                            labelStyle={{ color: c.textPrimary, fontWeight: 700, marginBottom: 4 }}
                                            labelFormatter={(label) => String(label)}
                                            formatter={(value, name) => {
                                                const key = String(name)
                                                const brandIdx = matrix.brands.findIndex((b) => key.includes(b))
                                                const brand = matrix.brands[brandIdx]
                                                const displayVal = chartValueType === 'percent' ? `${Number(value).toFixed(1)}%` : Number(value).toLocaleString()
                                                return [displayVal, brand || key]
                                            }}
                                        />
                                        <Legend
                                            wrapperStyle={{
                                                fontSize: '10px',
                                                color: c.textSecondary,
                                                paddingTop: 10,
                                            }}
                                            iconType="circle"
                                        />
                                        <ReferenceLine y={0} stroke={c.borderMuted} />
                                        {matrix.brands.map((b) => {
                                            const valueKey = chartValueType === 'percent' ? `${b}_pct` : `${b}_count`
                                            const labelKey = chartLabelType === 'percent' ? `${b}_pct` : `${b}_count`
                                            const labelFormatter = (val: number) => {
                                                if (chartLabelType === 'percent') {
                                                    return `${Number(val).toFixed(1)}%`
                                                }
                                                return Number(val).toLocaleString()
                                            }

                                            return (
                                                <Bar
                                                    key={b}
                                                    dataKey={valueKey}
                                                    name={b}
                                                    fill={getBrandColor(b)}
                                                    radius={[4, 4, 0, 0]}
                                                    maxBarSize={28}
                                                >
                                                    <LabelList
                                                        dataKey={labelKey}
                                                        position="top"
                                                        formatter={labelFormatter}
                                                        style={{
                                                            fontSize: 7,
                                                            fill: c.textSecondary,
                                                            fontWeight: 600,
                                                        }}
                                                    />
                                                </Bar>
                                            )
                                        })}
                                    </BarChart>
                                </ResponsiveContainer>
                            </Box>
                        </>
                    )}
                </CardContent>
            </Card>
        )
    }

    // ── Location & Model wise Sample Sizes Component ───────────────────
    const LocationModelSampleSizeCard = ({ sampleData }: { sampleData?: any }) => {
        const c = useThemeColors()
        const accentColor = '#1871c9ff'
        const borderStyle = '1px solid #000000'
        const lightBlueBg = 'rgba(24, 113, 201, 0.15)'
        const lightGrayBg = '#e2e8f0'

        const isDynamic = sampleData && Array.isArray(sampleData.brands) && sampleData.brands.length > 0 && Array.isArray(sampleData.table)

        // Dynamic Brands (or fallback)
        const brands: string[] = isDynamic ? sampleData.brands : ['TVS HLX125', 'Bajaj BM 125 / Bajaj CT 125']
        
        // Dynamic Tenures (or fallback)
        const tenures: string[] = isDynamic && Array.isArray(sampleData.tenures) && sampleData.tenures.length > 0 
            ? sampleData.tenures 
            : ['3-6 months', '6-12 months']

        // Table Rows (Cities)
        const tableRows: Record<string, any>[] = isDynamic
            ? sampleData.table.filter((r: any) => r.city !== 'Grand Total')
            : [
                { city: 'Freetown', 'TVS HLX125_3-6 months': 40, 'TVS HLX125_6-12 months': 40, 'TVS HLX125_total': 80, 'Bajaj BM 125 / Bajaj CT 125_3-6 months': 41, 'Bajaj BM 125 / Bajaj CT 125_6-12 months': 39, 'Bajaj BM 125 / Bajaj CT 125_total': 80, grand_total: 160 },
                { city: 'Bo', 'TVS HLX125_3-6 months': 20, 'TVS HLX125_6-12 months': 20, 'TVS HLX125_total': 40, 'Bajaj BM 125 / Bajaj CT 125_3-6 months': 20, 'Bajaj BM 125 / Bajaj CT 125_6-12 months': 20, 'Bajaj BM 125 / Bajaj CT 125_total': 40, grand_total: 80 },
                { city: 'Kenema', 'TVS HLX125_3-6 months': 20, 'TVS HLX125_6-12 months': 20, 'TVS HLX125_total': 40, 'Bajaj BM 125 / Bajaj CT 125_3-6 months': 20, 'Bajaj BM 125 / Bajaj CT 125_6-12 months': 20, 'Bajaj BM 125 / Bajaj CT 125_total': 40, grand_total: 80 },
                { city: 'Makeni', 'TVS HLX125_3-6 months': 19, 'TVS HLX125_6-12 months': 21, 'TVS HLX125_total': 40, 'Bajaj BM 125 / Bajaj CT 125_3-6 months': 22, 'Bajaj BM 125 / Bajaj CT 125_6-12 months': 18, 'Bajaj BM 125 / Bajaj CT 125_total': 40, grand_total: 80 },
            ]

        // Grand Total Row
        const grandTotalRow: Record<string, any> = isDynamic
            ? (sampleData.table.find((r: any) => r.city === 'Grand Total') || {})
            : { city: 'Grand Total', 'TVS HLX125_3-6 months': 99, 'TVS HLX125_6-12 months': 101, 'TVS HLX125_total': 200, 'Bajaj BM 125 / Bajaj CT 125_3-6 months': 103, 'Bajaj BM 125 / Bajaj CT 125_6-12 months': 97, 'Bajaj BM 125 / Bajaj CT 125_total': 200, grand_total: 400 }

        return (
            <Card
                sx={{
                    border: `1px solid ${alpha(accentColor, 0.15)}`,
                    borderRadius: 4,
                    boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: `0 12px 48px ${alpha(accentColor, 0.12)}`,
                    },
                    overflow: 'hidden',
                    position: 'relative',
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '4px',
                        background: `linear-gradient(90deg, ${accentColor}, ${alpha(accentColor, 0.4)})`,
                    }
                }}
            >
                <CardContent sx={{ p: 3.5 }}>
                    <CardHeader
                        title="Location & Model wise Sample Sizes"
                        icon={<LocationCity sx={{ fontSize: 20 }} />}
                        subtitle="Sample size breakdown by city (Col D), model (Col E), and tenure (Col T: 3-6 months & 6-12 months)"
                        color={accentColor}
                    />

                    <Paper
                        elevation={0}
                        sx={{
                            overflowX: 'auto',
                            borderRadius: 2,
                            border: borderStyle,
                        }}
                    >
                        <Table
                            size="small"
                            sx={{
                                borderCollapse: 'collapse',
                                fontFamily: 'Arial, Calibri, sans-serif',
                                minWidth: 750,
                                '& .MuiTableCell-root': {
                                    border: borderStyle,
                                    textAlign: 'center',
                                    fontFamily: 'Arial, Calibri, sans-serif',
                                    padding: '8px 12px',
                                }
                            }}
                        >
                            <TableHead>
                                {/* Row 1 Headers */}
                                <TableRow>
                                    <TableCell
                                        rowSpan={1}
                                        align="center"
                                        sx={{
                                            fontWeight: 'bold',
                                            background: lightBlueBg,
                                            minWidth: 100,
                                        }}
                                    />

                                    {brands.map((brand) => {
                                        const isTvs = brand.toUpperCase().includes('TVS')
                                        const isBajaj = brand.toUpperCase().includes('BAJAJ')
                                        const bgColor = isTvs ? '#1871c9' : isBajaj ? '#2ae886' : getBrandColor(brand)
                                        const textColor = isTvs ? '#ffffff' : '#000000'

                                        return (
                                            <>
                                                <TableCell
                                                    key={`brand-${brand}`}
                                                    colSpan={tenures.length}
                                                    align="center"
                                                    sx={{
                                                        fontWeight: 'bold',
                                                        background: bgColor,
                                                        color: textColor,
                                                        fontSize: '0.85rem',
                                                    }}
                                                >
                                                    {brand}
                                                </TableCell>
                                                <TableCell
                                                    key={`brand-${brand}-total-header`}
                                                    colSpan={1}
                                                    align="center"
                                                    sx={{
                                                        fontWeight: 'bold',
                                                        background: lightGrayBg,
                                                        color: '#000000',
                                                        fontSize: '0.85rem',
                                                    }}
                                                >
                                                    {`${brand} Total`}
                                                </TableCell>
                                            </>
                                        )
                                    })}

                                    <TableCell
                                        rowSpan={2}
                                        align="center"
                                        sx={{
                                            fontWeight: 'bold',
                                            background: lightGrayBg,
                                            color: '#000000',
                                            fontSize: '0.85rem',
                                            minWidth: 100,
                                        }}
                                    >
                                        Grand Total
                                    </TableCell>
                                </TableRow>

                                {/* Row 2 Sub-headers */}
                                <TableRow>
                                    <TableCell
                                        align="center"
                                        sx={{
                                            fontWeight: 'bold',
                                            background: lightBlueBg,
                                            color: '#000000',
                                            fontSize: '0.8rem',
                                        }}
                                    >
                                        City
                                    </TableCell>

                                    {brands.map((brand) => (
                                        <>
                                            {tenures.map((tenure) => (
                                                <TableCell
                                                    key={`sub-${brand}-${tenure}`}
                                                    align="center"
                                                    sx={{
                                                        fontWeight: 'bold',
                                                        background: lightBlueBg,
                                                        color: '#000000',
                                                        fontSize: '0.8rem',
                                                    }}
                                                >
                                                    {tenure}
                                                </TableCell>
                                            ))}
                                            <TableCell
                                                key={`sub-${brand}-total`}
                                                align="center"
                                                sx={{
                                                    fontWeight: 'bold',
                                                    background: lightGrayBg,
                                                    color: '#000000',
                                                    fontSize: '0.8rem',
                                                }}
                                            >
                                                Total
                                            </TableCell>
                                        </>
                                    ))}
                                </TableRow>
                            </TableHead>

                            <TableBody>
                                {/* Data Rows */}
                                {tableRows.map((row) => (
                                    <TableRow key={row.city}>
                                        <TableCell align="center" sx={{ fontWeight: 500 }}>
                                            {row.city}
                                        </TableCell>

                                        {brands.map((brand) => {
                                            const brandTotKey = `${brand}_total`
                                            const brandTotalVal = row[brandTotKey] ?? row[`${brand.split('/')[0].trim()}_total`] ?? 0

                                            return (
                                                <>
                                                    {tenures.map((tenure) => {
                                                        const key = `${brand}_${tenure}`
                                                        const val = row[key] ?? row[`${brand}_${tenure.replace(/\s+/g, '')}`] ?? 0
                                                        return (
                                                            <TableCell key={`${row.city}-${brand}-${tenure}`} align="center">
                                                                {val}
                                                            </TableCell>
                                                        )
                                                    })}

                                                    <TableCell
                                                        key={`${row.city}-${brand}-total`}
                                                        align="center"
                                                        sx={{ fontWeight: 600, background: 'rgba(0,0,0,0.02)' }}
                                                    >
                                                        {brandTotalVal}
                                                    </TableCell>
                                                </>
                                            )
                                        })}

                                        <TableCell align="center" sx={{ fontWeight: 600, background: 'rgba(0,0,0,0.02)' }}>
                                            {row.grand_total ?? row.grandTotal ?? 0}
                                        </TableCell>
                                    </TableRow>
                                ))}

                                {/* Footer Row: Grand Total */}
                                <TableRow>
                                    <TableCell
                                        align="center"
                                        sx={{
                                            fontWeight: 'bold',
                                            background: lightBlueBg,
                                            color: '#000000',
                                        }}
                                    >
                                        Grand Total
                                    </TableCell>

                                    {brands.map((brand) => {
                                        const brandTotKey = `${brand}_total`
                                        const brandTotalVal = grandTotalRow[brandTotKey] ?? grandTotalRow[`${brand.split('/')[0].trim()}_total`] ?? 0

                                        return (
                                            <>
                                                {tenures.map((tenure) => {
                                                    const key = `${brand}_${tenure}`
                                                    const val = grandTotalRow[key] ?? grandTotalRow[`${brand}_${tenure.replace(/\s+/g, '')}`] ?? 0
                                                    return (
                                                        <TableCell
                                                            key={`gt-${brand}-${tenure}`}
                                                            align="center"
                                                            sx={{
                                                                fontWeight: 'bold',
                                                                background: lightBlueBg,
                                                                color: '#000000',
                                                            }}
                                                        >
                                                            {val}
                                                        </TableCell>
                                                    )
                                                })}

                                                <TableCell
                                                    key={`gt-${brand}-total`}
                                                    align="center"
                                                    sx={{
                                                        fontWeight: 'bold',
                                                        background: lightBlueBg,
                                                        color: '#000000',
                                                    }}
                                                >
                                                    {brandTotalVal}
                                                </TableCell>
                                            </>
                                        )
                                    })}

                                    <TableCell
                                        align="center"
                                        sx={{
                                            fontWeight: 'bold',
                                            background: lightBlueBg,
                                            color: '#000000',
                                        }}
                                    >
                                        {grandTotalRow.grand_total ?? grandTotalRow.grandTotal ?? 0}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </Paper>
                </CardContent>
            </Card>
        )
    }

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 12 }}>
                <CircularProgress sx={{ color: '#1871c9ff' }} size={50} />
            </Box>
        )
    }

    if (error) {
        return <Alert severity="error" sx={{ borderRadius: 3 }}>{error}</Alert>
    }

    if (!data) {
        return <Alert severity="info" sx={{ borderRadius: 3 }}>No analytics data available.</Alert>
    }

    return (
        <Box sx={{ py: 2 }}>
            {/* Section Header */}
            <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                    <Typography variant="h5" sx={{
                        fontWeight: 800,
                        color: c.textPrimary,
                        letterSpacing: '-0.02em',
                    }}>
                        Analytics Dashboard
                    </Typography>
                    <Typography variant="body2" sx={{ color: c.textMuted, mt: 0.5 }}>
                        Comprehensive overview of survey insights and customer demographics
                    </Typography>
                </Box>
                <Chip
                    label={`${data.age_group?.brands?.length || 0} Brands Analyzed`}
                    sx={{
                        background: alpha('#1871c9ff', 0.1),
                        color: '#1871c9ff',
                        fontWeight: 600,
                    }}
                />
            </Box>

            <Grid container spacing={3}>
                {/* Location & Model wise Sample Sizes - FULL WIDTH */}
                <Grid size={{ xs: 12 }}>
                    <LocationModelSampleSizeCard sampleData={data.location_model_sample_size} />
                </Grid>

                {/* Visualization 1: Age Group - Half width */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <VizCard
                        title="Age Group Distribution"
                        matrix={data.age_group}
                        showMode="both"
                        chartValueType="percent"
                        chartLabelType="percent"
                        icon={<People sx={{ fontSize: 20 }} />}
                        subtitle="Distribution of respondents by age category"
                        brandColor="#1871c9ff"
                    />
                </Grid>

                {/* Visualization 2: Age Group by City & Brand - FULL WIDTH */}
                <Grid size={{ xs: 12 }}>
                    <VizCard
                        title="Age Group by City & Brand"
                        matrix={data.age_city}
                        showMode="both"
                        chartValueType="percent"
                        chartLabelType="percent"
                        isAgeCity={true}
                        icon={<LocationCity sx={{ fontSize: 20 }} />}
                        subtitle="Cross-tabulation of age, city, and brand preferences"
                        brandColor="#2ae886ff"
                    />
                </Grid>

                {/* Visualization 3: Mode of Purchase - Half width */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <VizCard
                        title="Mode of Purchase"
                        matrix={data.mode_of_purchase}
                        showMode="count"
                        chartValueType="percent"
                        chartLabelType="count"
                        icon={<ShoppingBag sx={{ fontSize: 20 }} />}
                        subtitle="Purchase channel preferences by brand"
                        brandColor="#e8903dff"
                    />
                </Grid>

                {/* Visualization 4: Ownership - Half width */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <VizCard
                        title="Ownership"
                        matrix={data.ownership}
                        showMode="count"
                        chartValueType="percent"
                        chartLabelType="percent"
                        icon={<Home sx={{ fontSize: 20 }} />}
                        subtitle="Ownership distribution across brands"
                        brandColor="#1871c9ff"
                    />
                </Grid>

                {/* Visualization 5: User Profession - Full width */}
                <Grid size={{ xs: 12 }}>
                    <VizCard
                        title="User Profession Distribution"
                        matrix={data.profession}
                        showMode="percent"
                        chartValueType="percent"
                        chartLabelType="percent"
                        icon={<Work sx={{ fontSize: 20 }} />}
                        subtitle="Professional background of survey respondents"
                        brandColor="#2ae886ff"
                    />
                </Grid>

                {/* Visualization 6: Vehicle Usage Purpose (Column R) - Full width */}
                <Grid size={{ xs: 12 }}>
                    <VizCard
                        title="Vehicle Usage Purpose"
                        matrix={data.vehicle_usage}
                        showMode="both"
                        chartValueType="percent"
                        chartLabelType="count"
                        icon={<DirectionsBike sx={{ fontSize: 20 }} />}
                        subtitle="Primary purpose of vehicle usage by brand (Column R)"
                        brandColor="#a731abff"
                    />
                </Grid>
            </Grid>
        </Box>
    )
}