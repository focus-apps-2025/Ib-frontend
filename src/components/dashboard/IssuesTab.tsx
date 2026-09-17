import { useState, useEffect } from 'react'
import {
  Box, Card, CardContent, Typography, Accordion, AccordionSummary,
  AccordionDetails, Table, TableBody, TableCell, TableHead, TableRow,
  Chip, CircularProgress, Alert, Button,
  TextField, FormControl, InputLabel, Select, MenuItem, Grid,
} from '@mui/material'
import { ExpandMore } from '@mui/icons-material'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { issuesApi } from '../../lib/api'
import { useThemeColors } from '../../utils/colors'
import type { FilterState } from '../../store'
import { toParam } from '../../store'


const ISSUE_COLORS = [
  '#6C63FF', '#FF6584', '#4ECCA3', '#FFD93D', '#FF8A65',
  '#AB47BC', '#26C6DA', '#EC407A', '#66BB6A', '#FFA726',
  '#42A5F5', '#EF5350', '#8D6E63', '#78909C', '#00BCD4',
]

interface BrandData {
  name: string
  count: number
  percentage?: number
}
interface AnswerData {
  answer: string
  total: number
  brands: BrandData[]
  is_split?: boolean
}
interface FollowUpData {
  follow_up: string
  total: number
  brands: BrandData[]
  answers?: AnswerData[]
}

interface SubIssueData {
  sub_issue: string
  total: number
  brands: BrandData[]
  has_follow_ups: boolean
  follow_ups: FollowUpData[]
}

interface IssueData {
  issue_name: string
  total_complaints: number
  percentage?: number
  sub_issues?: SubIssueData[]
}

export default function IssuesTab({ filters }: { filters: FilterState }) {
  const c = useThemeColors()
  const [issues, setIssues] = useState<IssueData[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<Record<string, unknown>>({})
  const [expandedIssue, setExpandedIssue] = useState<string | false>(false)
  const [searchIssue, setSearchIssue] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'count'>('count')

  const cleanIssueName = (name: string): string => {
    let cleaned = name.replace(/\s+issues$/i, '')
    cleaned = cleaned.replace(/\s+issue$/i, '')
    return cleaned || name
  }

  const shortenLabel = (label: string): string => {
    const cleaned = cleanIssueName(label)
    return cleaned.length > 18 ? `${cleaned.substring(0, 15)}...` : cleaned
  }


  const loadAnalysis = async () => {
    setLoading(true)
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
      const res = await issuesApi.analysis(params)
      const rawIssues: IssueData[] = res.data.data || []
      const apiBrands: string[] = res.data.brands || []
      setIssues(rawIssues)
      setBrands(apiBrands)
      setSummary(res.data.summary || {})
    } catch (error) {
      console.error('Error loading analysis:', error)
    }
    setLoading(false)
  }

  useEffect(() => { loadAnalysis() }, [
    filters.regionId,
    filters.countryId,
    filters.ibVersionId,
    filters.brandModel,
    filters.surveyLocation,
    filters.dateFrom,
    filters.dateTo,
    filters.search
  ])

  const filtered = issues
    .filter((i) => i.issue_name.toLowerCase().includes(searchIssue.toLowerCase()))
    .sort((a, b) =>
      sortBy === 'count' ? b.total_complaints - a.total_complaints
        : a.issue_name.localeCompare(b.issue_name)
    )

  const topIssues = filtered.slice(0, 10).map(issue => ({
    ...issue,
    display_name: cleanIssueName(issue.issue_name)
  }))

  const calculatePieData = () => {
    const top10 = filtered.slice(0, 10)
    const totalAllComplaints = filtered.reduce((sum, issue) => sum + issue.total_complaints, 0)
    if (totalAllComplaints === 0) return []
    return top10.map(issue => ({
      name: issue.issue_name,
      value: issue.total_complaints,
      percentage: (issue.total_complaints / totalAllComplaints) * 100
    }))
  }

  const pieData = calculatePieData()

  return (
    <Box>
      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Issues Reported', value: (summary.total_issues_reported as number) || 0, color: '#6C63FF' },
          { label: 'Unique Issues', value: issues.length, color: '#4ECCA3' },
          { label: 'Most Common', value: (summary.most_common_issue as string) || 'N/A', color: '#FFD93D' },
          { label: 'Least Common', value: (summary.least_common_issue as string) || 'N/A', color: '#FF6584' },
        ].map((s) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={s.label}>
            <Card sx={{ background: `${s.color}12`, border: `1px solid ${s.color}30` }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="caption" sx={{ color: c.textSecondary, display: 'block' }}>
                  {s.label}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: s.color }}>
                  {typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Charts Row */}
      {filtered.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: c.textPrimary }}>
                  Top 10 Issues by Complaint Count
                </Typography>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={topIssues} layout="vertical" margin={{ left: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={c.chartGrid} />
                    <XAxis type="number" tick={{ fill: c.chartTick, fontSize: 11 }} />
                    <YAxis type="category" dataKey="issue_name" tick={{ fill: c.chartTick, fontSize: 10 }} width={100} tickFormatter={(value: string) => cleanIssueName(value)} />
                    <Tooltip contentStyle={{ background: c.chartTooltipBg, border: `1px solid ${c.borderStrong}`, borderRadius: 8 }} labelStyle={{ color: c.textPrimary }} formatter={(value: number) => [value.toLocaleString(), 'Complaints']} labelFormatter={(label: string) => cleanIssueName(label)} />
                    <Bar dataKey="total_complaints" radius={[0, 4, 4, 0]}>
                      {topIssues.map((_, i) => (
                        <Cell key={i} fill={ISSUE_COLORS[i % ISSUE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: c.textPrimary }}>
                  Issue Distribution
                </Typography>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={35}
                        paddingAngle={2}
                        labelLine={false}
                        label={({ percent }) => `${(percent * 100).toFixed(1)}%`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={ISSUE_COLORS[index % ISSUE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [`${value.toLocaleString()} complaints`, 'Count']}
                      />
                      <Legend
                        layout="horizontal"
                        verticalAlign="bottom"
                        align="center"
                        iconSize={8}
                        iconType="circle"
                        wrapperStyle={{
                          fontSize: '9px',
                          paddingTop: '8px',
                          lineHeight: '1.2',
                          maxHeight: '50px',
                          overflow: 'hidden',
                        }}
                        formatter={(value: string) => shortenLabel(value)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 280 }}>
                    <Typography variant="body2" sx={{ color: c.textMuted }}>No data available</Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Controls */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField size="small" id="search-issues" label="Search Issues" value={searchIssue} onChange={(e) => setSearchIssue(e.target.value)} sx={{ minWidth: 200 }} />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Sort By</InputLabel>
          <Select id="sort-issues" value={sortBy} onChange={(e) => setSortBy(e.target.value as 'name' | 'count')} label="Sort By">
            <MenuItem value="count">By Complaint Count</MenuItem>
            <MenuItem value="name">Alphabetical</MenuItem>
          </Select>
        </FormControl>
        <Button size="small" onClick={() => setExpandedIssue('all')} sx={{ color: c.primaryLight }}>Expand All</Button>
        <Button size="small" onClick={() => setExpandedIssue(false)} sx={{ color: c.textSecondary }}>Collapse All</Button>
        <Typography variant="caption" sx={{ color: c.textMuted, ml: 'auto' }}>{filtered.length} issues shown</Typography>
      </Box>

      {/* Issues Accordion */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress sx={{ color: c.primary }} />
        </Box>
      ) : filtered.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>No issue data found. Upload an Excel file first.</Alert>
      ) : (
        filtered.map((issue, idx) => (
          <Accordion
            key={issue.issue_name}
            expanded={expandedIssue === issue.issue_name || expandedIssue === 'all'}
            onChange={(_, exp) => setExpandedIssue(exp ? issue.issue_name : false)}
            sx={{
              mb: 1, background: c.accordionBg, border: `1px solid ${c.border}`,
              borderRadius: '8px !important', '&:before': { display: 'none' },
              '&.Mui-expanded': { border: `1px solid ${c.borderStrong}` },
            }}
          >
            <AccordionSummary expandIcon={<ExpandMore sx={{ color: c.primaryLight }} />} sx={{ '& .MuiAccordionSummary-content': { alignItems: 'center', gap: 2 } }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: ISSUE_COLORS[idx % ISSUE_COLORS.length], flexShrink: 0 }} />
              <Typography sx={{ fontWeight: 600, color: c.textPrimary, flex: 1 }}>{issue.issue_name}</Typography>
              <Chip label={`${issue.total_complaints.toLocaleString()} complaints`} size="small" sx={{ background: `${ISSUE_COLORS[idx % ISSUE_COLORS.length]}20`, color: ISSUE_COLORS[idx % ISSUE_COLORS.length], fontWeight: 700, fontSize: '0.7rem' }} />
              <Chip label={`${issue.percentage?.toFixed(1)}%`} size="small" sx={{ background: c.chipWhiteBg, color: c.textSecondary, fontSize: '0.7rem' }} />
            </AccordionSummary>

            <AccordionDetails sx={{ p: 3, borderTop: `1px solid ${c.borderMuted}` }}>
              {!issue.sub_issues || issue.sub_issues.length === 0 ? (
                <Typography sx={{ py: 2, color: c.textMuted, fontSize: '0.85rem', textAlign: 'center' }}>No follow-up data available.</Typography>
              ) : (
                <Grid container spacing={3}>
                  {/* LEFT SIDE: TABLE */}
                  <Grid size={{ xs: 12, lg: 6 }}>
                    <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: 700, color: c.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Complaint Breakdown by Brand
                    </Typography>
                    <Box sx={{ overflowX: 'auto', borderRadius: 2, border: `1px solid ${c.borderMuted}` }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700, background: c.headerCell, color: c.textSecondary, fontSize: '0.75rem', textTransform: 'uppercase' }}>Sub-Issue</TableCell>
                            <TableCell sx={{ fontWeight: 700, background: c.headerCell, color: c.textSecondary, fontSize: '0.75rem', textTransform: 'uppercase' }}>Follow-up Question</TableCell>
                            <TableCell sx={{ fontWeight: 700, background: c.headerCell, color: c.textSecondary, fontSize: '0.75rem', textTransform: 'uppercase' }}>Answer</TableCell>
                            {brands.map((brandName) => (
                              <TableCell key={brandName} align="right" sx={{ fontWeight: 700, background: c.headerCell, color: c.textSecondary, fontSize: '0.75rem', textTransform: 'uppercase' }}>
                                {brandName}
                              </TableCell>
                            ))}
                            <TableCell align="right" sx={{ fontWeight: 700, background: c.headerCell, color: c.textSecondary, fontSize: '0.75rem', textTransform: 'uppercase' }}>Total</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(() => {
                            return (
                              <>
                                {issue.sub_issues?.map((sub) => {
                                  // Calculate total sub-issue row span
                                  let subRowSpan = 0
                                  if (!sub.has_follow_ups || !sub.follow_ups || sub.follow_ups.length === 0) {
                                    subRowSpan = 1
                                  } else {
                                    sub.follow_ups.forEach((fu) => {
                                      subRowSpan += fu.answers && fu.answers.length > 0 ? fu.answers.length : 1
                                    })
                                  }

                                  if (!sub.has_follow_ups || !sub.follow_ups || sub.follow_ups.length === 0) {
                                    // Single row for sub-issue with no follow-ups
                                    return (
                                      <TableRow key={`sub-only-${sub.sub_issue}`} sx={{ '&:hover': { background: c.tableHover } }}>
                                        <TableCell sx={{ fontWeight: 600, color: c.textPrimary, fontSize: '0.8rem' }}>
                                          {sub.sub_issue} ({sub.total})
                                        </TableCell>
                                        <TableCell sx={{ color: c.textMuted, fontSize: '0.78rem' }}></TableCell>
                                        <TableCell sx={{ color: c.textMuted, fontSize: '0.75rem' }}></TableCell>
                                        {brands.map((brandName) => {
                                          const brandCount = sub.brands.find((b) => b.name === brandName)?.count || 0
                                          return (
                                            <TableCell key={brandName} align="right" sx={{ color: c.textPrimary, fontSize: '0.75rem' }}>
                                              {brandCount.toLocaleString()}
                                            </TableCell>
                                          )
                                        })}
                                        <TableCell align="right" sx={{ fontWeight: 700, color: c.textPrimary, fontSize: '0.75rem' }}>
                                          {sub.total.toLocaleString()}
                                        </TableCell>
                                      </TableRow>
                                    )
                                  }

                                  const rows: React.ReactNode[] = []
                                  let isFirstSubCell = true

                                  sub.follow_ups.forEach((fu) => {
                                    const fuRowSpan = fu.answers && fu.answers.length > 0 ? fu.answers.length : 1
                                    let isFirstFuCell = true

                                    if (!fu.answers || fu.answers.length === 0) {
                                      // Follow-up with no answers
                                      rows.push(
                                        <TableRow key={`fu-only-${sub.sub_issue}-${fu.follow_up}`} sx={{ background: 'rgba(108,99,255,0.02)', '&:hover': { background: c.tableHover } }}>
                                          {isFirstSubCell && (
                                            <TableCell rowSpan={subRowSpan} sx={{ fontWeight: 600, color: c.textPrimary, fontSize: '0.8rem', verticalAlign: 'top' }}>
                                              {sub.sub_issue} ({sub.total})
                                            </TableCell>
                                          )}
                                          <TableCell sx={{ fontWeight: 500, color: c.textSecondary, fontSize: '0.78rem' }}>
                                            ↳ {fu.follow_up} ({fu.total})
                                          </TableCell>
                                          <TableCell sx={{ color: c.textMuted, fontSize: '0.75rem' }}></TableCell>
                                          {brands.map((brandName) => {
                                            const brandCount = fu.brands.find((b) => b.name === brandName)?.count || 0
                                            return (
                                              <TableCell key={brandName} align="right" sx={{ color: c.textSecondary, fontSize: '0.75rem' }}>
                                                {brandCount.toLocaleString()}
                                              </TableCell>
                                            )
                                          })}
                                          <TableCell align="right" sx={{ fontWeight: 600, color: c.textSecondary, fontSize: '0.75rem' }}>
                                            {fu.total.toLocaleString()}
                                          </TableCell>
                                        </TableRow>
                                      )
                                      isFirstSubCell = false
                                    } else {
                                      fu.answers.forEach((ans) => {
                                        const rowBg = ans.is_split
                                          ? 'rgba(255, 235, 59, 0.15)'
                                          : 'inherit'

                                        rows.push(
                                          <TableRow key={`ans-${sub.sub_issue}-${fu.follow_up}-${ans.answer}`} sx={{ background: rowBg, '&:hover': { background: c.tableHover } }}>
                                            {isFirstSubCell && (
                                              <TableCell rowSpan={subRowSpan} sx={{ fontWeight: 600, color: c.textPrimary, fontSize: '0.8rem', verticalAlign: 'top' }}>
                                                {sub.sub_issue} ({sub.total})
                                              </TableCell>
                                            )}
                                            {isFirstFuCell && (
                                              <TableCell rowSpan={fuRowSpan} sx={{ fontWeight: 500, color: c.textSecondary, fontSize: '0.78rem', verticalAlign: 'top', background: 'rgba(108,99,255,0.02)' }}>
                                                ↳ {fu.follow_up} ({fu.total})
                                              </TableCell>
                                            )}
                                            <TableCell sx={{ color: c.textPrimary, fontSize: '0.75rem' }}>
                                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                {ans.answer.startsWith('"') && ans.answer.endsWith('"') 
                                                  ? ans.answer 
                                                  : `"${ans.answer}"`}
                                                {ans.is_split && <span title="Split answer">🟡</span>}
                                              </Box>
                                            </TableCell>
                                            {brands.map((brandName) => {
                                              const brandObj = ans.brands.find((b) => b.name === brandName)
                                              const count = brandObj?.count || 0
                                              const percentage = brandObj?.percentage
                                              
                                              return (
                                                <TableCell
                                                  key={brandName}
                                                  align="right"
                                                  sx={{
                                                    color: c.textMuted,
                                                    fontSize: '0.75rem',
                                                  }}
                                                >
                                                  {percentage !== undefined ? (
                                                    `${count.toLocaleString()} (${percentage}%)`
                                                  ) : (
                                                    count.toLocaleString()
                                                  )}
                                                </TableCell>
                                              )
                                            })}
                                            <TableCell
                                              align="right"
                                              sx={{
                                                fontWeight: 500,
                                                color: c.textMuted,
                                                fontSize: '0.75rem',
                                              }}
                                            >
                                              {ans.total.toLocaleString()}
                                            </TableCell>
                                          </TableRow>
                                        )
                                        isFirstSubCell = false
                                        isFirstFuCell = false
                                      })
                                    }
                                  })
                                  return rows
                                })}
                              </>
                            )
                          })()}

                          {/* Grand Total Row */}
                          <TableRow sx={{ background: `${c.headerCell}50`, fontWeight: 700 }}>
                            <TableCell colSpan={3} sx={{ fontWeight: 700, color: c.textPrimary, fontSize: '0.8rem' }}>Grand Total</TableCell>
                            {brands.map((brandName) => {
                              const totalBrandCount = issue.sub_issues?.reduce((sum, s) => sum + (s.brands.find(b => b.name === brandName)?.count || 0), 0) || 0
                              return (
                                <TableCell key={brandName} align="right" sx={{ fontWeight: 700, color: c.textPrimary }}>
                                  {totalBrandCount.toLocaleString()}
                                </TableCell>
                              )
                            })}
                            <TableCell align="right" sx={{ fontWeight: 700, color: c.textPrimary }}>
                              {issue.sub_issues?.reduce((sum, s) => sum + s.total, 0).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </Box>
                  </Grid>

                  {/* RIGHT SIDE: CHART */}
                  <Grid size={{ xs: 12, lg: 6 }}>
                    <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: 700, color: c.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Distribution by Sub-Issue
                    </Typography>
                    <Box sx={{ p: 2, border: `1px solid ${c.borderMuted}`, borderRadius: 2 }}>
                      {issue.sub_issues && issue.sub_issues.length > 0 ? (
                        <ResponsiveContainer width="100%" height={Math.max(250, issue.sub_issues.length * 50)}>
                          <BarChart
                            data={issue.sub_issues.map(sub => {
                              const rowData: Record<string, any> = { name: sub.sub_issue }
                              brands.forEach(bname => {
                                rowData[bname] = sub.brands.find(b => b.name === bname)?.count || 0
                              })
                              return rowData
                            })}
                            layout="horizontal"
                            margin={{ left: 10, right: 10, top: 25, bottom: 10 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke={c.chartGrid} horizontal={true} vertical={false} />
                            <XAxis dataKey="name" tick={{ fill: c.chartTick, fontSize: 10, fontWeight: 600 }} />
                            <YAxis tick={{ fill: c.chartTick, fontSize: 10, fontWeight: 500 }} />
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: '10px', paddingTop: 10 }} />
                            {brands.map((brandName, index) => (
                              <Bar
                                key={brandName}
                                dataKey={brandName}
                                fill={ISSUE_COLORS[index % ISSUE_COLORS.length]}
                                radius={[4, 4, 0, 0]}
                              />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <Typography sx={{ textAlign: 'center', color: c.textMuted, py: 4 }}>No chart data available</Typography>
                      )}
                    </Box>
                  </Grid>
                </Grid>
              )}
            </AccordionDetails>
          </Accordion>
        ))
      )}
    </Box>
  )
}