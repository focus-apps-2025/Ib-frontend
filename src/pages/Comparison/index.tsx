import { useState, useEffect } from 'react'
import {
    Box, Card, CardContent, Typography, Grid,
    TextField, Select, MenuItem, FormControl, InputLabel,
    Button, IconButton, Tooltip,
} from '@mui/material'
import { FilterList, ClearAll } from '@mui/icons-material'
import { regionsApi, countriesApi, ibVersionsApi } from '../../lib/api'
import { useThemeColors } from '../../utils/colors'
import BrandComparisonChart from '../../components/dashboard/BrandComparisonChart'
import PassiveTopicsChart from '../../components/dashboard/PassiveTopicsChart'

export default function ComparisonPage() {
    const c = useThemeColors()
    const [regions, setRegions] = useState<{ id: string; name: string }[]>([])
    const [countries, setCountries] = useState<{ id: string; name: string }[]>([])
    const [ibVersions, setIbVersions] = useState<{ id: string; name: string }[]>([])
    const [regionId, setRegionId] = useState('')
    const [countryId, setCountryId] = useState('')
    const [ibVersionId, setIbVersionId] = useState('')

    // Load dropdown options
    useEffect(() => {
        regionsApi.list().then((r) => setRegions(r.data.data || []))
        ibVersionsApi.list().then((r) => setIbVersions(r.data.data || []))
    }, [])

    useEffect(() => {
        if (regionId) {
            countriesApi.byRegion(regionId).then((r) => setCountries(r.data.data || []))
        } else {
            setCountries([])
        }
    }, [regionId])

    const filters = { regionId, countryId, ibVersionId }

    const resetFilters = () => {
        setRegionId('')
        setCountryId('')
        setIbVersionId('')
    }

    return (
        <Box>
            {/* Filter Bar */}
            <Card sx={{ mb: 2 }}>
                <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <FilterList sx={{ color: c.primary, fontSize: 18 }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: c.textPrimary }}>
                            Filters
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
                        <FormControl size="small" sx={{ minWidth: 140 }}>
                            <InputLabel>Region</InputLabel>
                            <Select
                                id="comparison-filter-region"
                                value={regionId}
                                onChange={(e) => { setRegionId(e.target.value); setCountryId('') }}
                                label="Region"
                            >
                                <MenuItem value="">All Regions</MenuItem>
                                {regions.map((r) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
                            </Select>
                        </FormControl>

                        <FormControl size="small" sx={{ minWidth: 140 }} disabled={!regionId}>
                            <InputLabel>Country</InputLabel>
                            <Select
                                id="comparison-filter-country"
                                value={countryId}
                                onChange={(e) => setCountryId(e.target.value)}
                                label="Country"
                            >
                                <MenuItem value="">All Countries</MenuItem>
                                {countries.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                            </Select>
                        </FormControl>

                        <FormControl size="small" sx={{ minWidth: 120 }}>
                            <InputLabel>IB Version</InputLabel>
                            <Select
                                id="comparison-filter-ib-version"
                                value={ibVersionId}
                                onChange={(e) => setIbVersionId(e.target.value)}
                                label="IB Version"
                            >
                                <MenuItem value="">All</MenuItem>
                                {ibVersions.map((v) => <MenuItem key={v.id} value={v.id}>{v.name}</MenuItem>)}
                            </Select>
                        </FormControl>

                        <Tooltip title="Reset Filters">
                            <IconButton id="comparison-reset-filters-btn" size="small" onClick={resetFilters} sx={{ color: c.secondary }}>
                                <ClearAll />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </CardContent>
            </Card>

            {/* Top: Brand Comparison (full width) */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid size={{ xs: 12 }}>
                    <BrandComparisonChart filters={filters} />
                </Grid>
            </Grid>

            {/* Bottom: Passive Topics (full width) */}
            <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                    <PassiveTopicsChart filters={filters} />
                </Grid>
            </Grid>
        </Box>
    )
}