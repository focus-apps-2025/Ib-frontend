import React, { useEffect, useState, useMemo } from 'react'
import {
  Box, Card, CardContent, Typography, CircularProgress, Alert, Grid,
  Select, MenuItem, FormControl, InputLabel,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper
} from '@mui/material'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import { dashboardApi } from '../../lib/api'
import { useFilterStore } from '../../store'
import { useThemeColors } from '../../utils/colors'

// Colors for Recommend Categories
const COLORS = {
  Yes: '#4caf50', // Green
  Maybe: '#ffc107', // Yellow
  No: '#f44336', // Red
}
const PIE_COLORS = { Yes: '#4caf50', No: '#f44336' }

export default function NpsTab() {
  const filters = useFilterStore()
  const c = useThemeColors()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<any>(null)
  const [selectedDurationCity, setSelectedDurationCity] = useState<string>('')
  const [selectedDuration, setSelectedDuration] = useState<string>('all')
  const [selectedCityChartBrand, setSelectedCityChartBrand] = useState<string>('All Brands')

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const filterParams = {
          region_id: filters.regionId || undefined,
          country_id: filters.countryId || undefined,
          ib_version_id: filters.ibVersionId || undefined,
          brand_model: filters.brandModel || undefined,
          survey_location: filters.surveyLocation || undefined,
          date_from: filters.dateFrom || undefined,
          date_to: filters.dateTo || undefined,
          search: filters.search || undefined,
        }

        const res = await dashboardApi.npsData(filterParams)
        setData(res.data)
        if (res.data.city_duration_segmentation?.length > 0) {
          const firstCity = res.data.city_duration_segmentation[0]
          setSelectedDurationCity(firstCity.city)
          if (firstCity.durations.length > 0) {
            setSelectedDuration(firstCity.durations[0].duration)
          }
        }
      } catch (err: any) {
        console.error("Error fetching NPS data", err)
        setError("Failed to load NPS data.")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [filters])

  const cityColDefs = useMemo(() => {
    if (!data?.brands) return []
    const defs: any[] = [{ field: 'city', headerName: 'City', pinned: 'left', width: 150 }]

    data.brands.forEach((brand: string) => {
      defs.push({
        headerName: brand,
        children: [
          { field: `${brand}_Yes`, headerName: 'Yes', width: 80, cellStyle: { color: COLORS.Yes, fontWeight: 'bold' } },
          { field: `${brand}_Maybe`, headerName: 'Maybe', width: 90, cellStyle: { color: '#d4a000', fontWeight: 'bold' } },
          { field: `${brand}_No`, headerName: 'No', width: 80, cellStyle: { color: COLORS.No, fontWeight: 'bold' } },
        ]
      })
    })
    return defs
  }, [data])

  const cityChartData = useMemo(() => {
    if (!data?.city_grid || !data?.brands) return []
    return data.city_grid.map((row: any) => {
      let yes = 0, maybe = 0, no = 0
      if (selectedCityChartBrand === 'All Brands') {
        data.brands.forEach((b: string) => {
          yes += row[`${b}_Yes`] || 0
          maybe += row[`${b}_Maybe`] || 0
          no += row[`${b}_No`] || 0
        })
      } else {
        yes = row[`${selectedCityChartBrand}_Yes`] || 0
        maybe = row[`${selectedCityChartBrand}_Maybe`] || 0
        no = row[`${selectedCityChartBrand}_No`] || 0
      }
      return { city: row.city, yes, maybe, no }
    })
  }, [data, selectedCityChartBrand])

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
  }

  if (error) {
    return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>
  }

  if (!data) return null

  const renderPieLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
    const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);

    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const currentCityData = data.city_duration_segmentation?.find((c: any) => c.city === selectedDurationCity)
  const selectedDurationData = currentCityData?.durations?.find((d: any) => d.duration === selectedDuration)?.data || []

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* 1. Recommend Vehicle (Yes/No) Pie Charts */}
      <Card sx={{ bgcolor: c.bgPaper, border: `1px solid ${c.border}` }}>
        <CardContent>
          <Typography variant="h6" sx={{ color: c.textPrimary, mb: 2, fontWeight: 600 }}>
            Will you recommend your vehicle? (Brand-wise)
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={3}>
              <TableContainer component={Paper} variant="outlined" sx={{ bgcolor: c.bgPaper, borderColor: c.border, borderRadius: 1, overflow: 'hidden' }}>
                <Table size="small" sx={{ borderCollapse: 'collapse', '& .MuiTableCell-root': { border: `1px solid ${c.border}` } }}>
                  <TableHead sx={{ bgcolor: `${c.primary}10` }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', color: c.textPrimary }}>Model (All Models)</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: c.textPrimary }}>Base</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.recommend_vehicle_pie.map((item: any) => (
                      <TableRow key={item.brand}>
                        <TableCell sx={{ color: c.textSecondary }}>{item.brand}</TableCell>
                        <TableCell align="right" sx={{ color: c.textSecondary }}>{item.yes + item.no}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
            <Grid item xs={12} md={9}>
              <Grid container spacing={2}>
                {data.recommend_vehicle_pie.map((item: any) => {
                  const pieData = [
                    { name: 'Yes', value: item.yes },
                    { name: 'No', value: item.no }
                  ]
                  return (
                    <Grid item xs={12} sm={6} md={4} key={item.brand}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Typography variant="subtitle2" sx={{ color: c.textSecondary }}>{item.brand}</Typography>
                        <PieChart width={200} height={200}>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={renderPieLabel}
                            outerRadius={80}
                            dataKey="value"
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[entry.name as keyof typeof PIE_COLORS]} />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                          <Legend />
                        </PieChart>
                      </Box>
                    </Grid>
                  )
                })}
              </Grid>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 2. Recommend Category (Yes/Maybe/No) Bar Chart */}
      <Card sx={{ bgcolor: c.bgPaper, border: `1px solid ${c.border}` }}>
        <CardContent>
          <Typography variant="h6" sx={{ color: c.textPrimary, mb: 2, fontWeight: 600 }}>
            Likelihood to Recommend (Overall)
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={3}>
              <TableContainer component={Paper} variant="outlined" sx={{ bgcolor: c.bgPaper, borderColor: c.border, borderRadius: 1, overflow: 'hidden' }}>
                <Table size="small" sx={{ borderCollapse: 'collapse', '& .MuiTableCell-root': { border: `1px solid ${c.border}` } }}>
                  <TableHead sx={{ bgcolor: `${c.primary}10` }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', color: c.textPrimary }}>Model</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: c.textPrimary }}>Base</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.recommend_category_bar.map((item: any) => (
                      <TableRow key={item.brand}>
                        <TableCell sx={{ color: c.textSecondary }}>{item.brand}</TableCell>
                        <TableCell align="right" sx={{ color: c.textSecondary }}>{item.yes + item.maybe + item.no}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
            <Grid item xs={12} md={9} sx={{ minWidth: 0 }}>
              <Grid container spacing={2}>
                {data.recommend_category_bar.map((item: any) => {
                  const chartData = [item]
                  return (
                    <Grid item xs={12} sm={6} md={4} key={item.brand}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', height: 250 }}>
                        <Typography variant="subtitle2" sx={{ color: c.textSecondary, mb: 1, textAlign: 'center' }}>{item.brand}</Typography>
                        <ResponsiveContainer width="99%" height="100%">
                          <BarChart data={chartData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={c.border} vertical={false} />
                            <XAxis dataKey="brand" hide />
                            <YAxis stroke={c.textSecondary} tick={{ fill: c.textSecondary, fontSize: 10 }} />
                            <RechartsTooltip contentStyle={{ backgroundColor: c.bgPaper, borderColor: c.border, color: c.textPrimary }} />
                            <Bar dataKey="yes" name="Yes (9-10)" fill={COLORS.Yes} />
                            <Bar dataKey="maybe" name="Maybe (7-8)" fill={COLORS.Maybe} />
                            <Bar dataKey="no" name="No (0-6)" fill={COLORS.No} />
                          </BarChart>
                        </ResponsiveContainer>
                      </Box>
                    </Grid>
                  )
                })}
              </Grid>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 3. City-wise Grid and Chart */}
      <Card sx={{ bgcolor: c.bgPaper, border: `1px solid ${c.border}` }}>
        <CardContent>
          <Typography variant="h6" sx={{ color: c.textPrimary, mb: 2, fontWeight: 600 }}>
            City-wise Likelihood to Recommend
          </Typography>
          <Box className="ag-theme-alpine" sx={{ height: 300, width: '100%', '--ag-background-color': c.bgPaper, '--ag-header-background-color': `${c.primary}10`, '--ag-border-color': c.border, '--ag-header-foreground-color': c.textPrimary, '--ag-data-color': c.textSecondary, '& .ag-header-cell': { fontWeight: 600 }, mb: 4 }}>
            <AgGridReact
              rowData={data.city_grid}
              columnDefs={cityColDefs}
              defaultColDef={{ resizable: true, sortable: true, filter: true }}
              suppressFieldDotNotation={true}
            />
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" sx={{ color: c.textPrimary, fontWeight: 600 }}>
              Overall City-wise Trend
            </Typography>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Select Brand</InputLabel>
              <Select
                value={selectedCityChartBrand}
                label="Select Brand"
                onChange={(e) => setSelectedCityChartBrand(e.target.value)}
              >
                <MenuItem value="All Brands">All Brands</MenuItem>
                {data.brands?.map((b: string) => (
                  <MenuItem key={b} value={b}>{b}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ width: '100%', height: 400 }}>
            <ResponsiveContainer width="99%" height={400}>
              <BarChart data={cityChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={c.border} vertical={false} />
                <XAxis dataKey="city" stroke={c.textSecondary} tick={{ fill: c.textSecondary }} angle={-45} textAnchor="end" />
                <YAxis stroke={c.textSecondary} tick={{ fill: c.textSecondary }} />
                <RechartsTooltip contentStyle={{ backgroundColor: c.bgPaper, borderColor: c.border, color: c.textPrimary }} />
                <Legend verticalAlign="top" height={36} />
                <Bar dataKey="yes" name="Yes (9-10)" fill={COLORS.Yes} />
                <Bar dataKey="maybe" name="Maybe (7-8)" fill={COLORS.Maybe} />
                <Bar dataKey="no" name="No (0-6)" fill={COLORS.No} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>

      {/* 4. Duration of Usage Segmentation */}
      <Card sx={{ bgcolor: c.bgPaper, border: `1px solid ${c.border}` }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ color: c.textPrimary, fontWeight: 600 }}>
              Duration of Usage Segmentation
            </Typography>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Select Duration</InputLabel>
              <Select
                value={selectedDuration}
                label="Select Duration"
                onChange={(e) => setSelectedDuration(e.target.value)}
              >
                {data.duration_segmentation?.map((d: any) => (
                  <MenuItem key={d.duration} value={d.duration}>{d.duration}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ width: '100%', height: 400 }}>
            {selectedDurationData.length > 0 ? (
              <ResponsiveContainer width="99%" height={400}>
                <BarChart data={selectedDurationData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={c.border} vertical={false} />
                  <XAxis dataKey="brand" stroke={c.textSecondary} tick={{ fill: c.textSecondary }} angle={-45} textAnchor="end" />
                  <YAxis stroke={c.textSecondary} tick={{ fill: c.textSecondary }} />
                  <RechartsTooltip contentStyle={{ backgroundColor: c.bgPaper, borderColor: c.border, color: c.textPrimary }} />
                  <Legend verticalAlign="top" height={36} />
                  <Bar dataKey="yes" name="Yes (9-10)" fill={COLORS.Yes} />
                  <Bar dataKey="maybe" name="Maybe (7-8)" fill={COLORS.Maybe} />
                  <Bar dataKey="no" name="No (0-6)" fill={COLORS.No} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography color="textSecondary">No data available for this duration.</Typography>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
