import { Box, Grid } from '@mui/material'
import BrandComparisonChart from './BrandComparisonChart'
import PassiveTopicsChart from './PassiveTopicsChart'

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

export default function ComparisonTab({ filters }: { filters: FilterState }) {
    // Pass ALL filters to child components, not just a subset
    return (
        <Box>
            <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid size={{ xs: 12 }}>
                    <BrandComparisonChart filters={filters} />
                </Grid>
            </Grid>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                    <PassiveTopicsChart filters={filters} />
                </Grid>
            </Grid>
        </Box>
    )
}