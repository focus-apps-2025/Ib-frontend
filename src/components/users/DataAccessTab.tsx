import React, { useState, useEffect, useMemo } from 'react'
import { Box, Typography } from '@mui/material'
import { ScopeCheckboxList, type ScopeOption } from './ScopeCheckboxList'
import { regionsApi, countriesApi, ibVersionsApi, responsesApi } from '../../lib/api'

export type ScopeState = {
  all_regions: boolean
  region_ids: string[]
  all_countries: boolean
  country_ids: string[]
  all_ib_versions: boolean
  ib_version_ids: string[]
  all_brands: boolean
  brand_models: string[]
  all_cities: boolean
  survey_locations: string[]
}

export const DEFAULT_SCOPE_STATE: ScopeState = {
  all_regions: true,
  region_ids: [],
  all_countries: true,
  country_ids: [],
  all_ib_versions: true,
  ib_version_ids: [],
  all_brands: true,
  brand_models: [],
  all_cities: true,
  survey_locations: [],
}

interface RawCountry {
  id: string
  name: string
  region_id: string
}

interface DataAccessTabProps {
  scopeState: ScopeState
  onChange: (newState: ScopeState) => void
  referenceData?: {
    regions: { id: string; label: string }[]
    allCountries: { id: string; name: string; region_id: string }[]
    ibVersions: { id: string; label: string }[]
    brands: { id: string; label: string }[]
    cities: { id: string; label: string }[]
  } | null
}

interface DataAccessTabProps {
  scopeState: ScopeState
  onChange: (newState: ScopeState) => void
}

export const DataAccessTab: React.FC<DataAccessTabProps> = ({
  scopeState,
  onChange,
  referenceData: injectedRef,
}) => {
  const [loading, setLoading] = useState(!injectedRef)
  const [regions, setRegions] = useState<ScopeOption[]>(injectedRef?.regions ?? [])
  const [allCountries, setAllCountries] = useState<RawCountry[]>(injectedRef?.allCountries ?? [])
  const [ibVersions, setIbVersions] = useState<ScopeOption[]>(injectedRef?.ibVersions ?? [])
  const [brands, setBrands] = useState<ScopeOption[]>(injectedRef?.brands ?? [])
  const [cities, setCities] = useState<ScopeOption[]>(injectedRef?.cities ?? [])

  // 👇 ONLY fallback fetch — only runs if parent didn't pass data yet
  useEffect(() => {
    if (injectedRef) {
      setRegions(injectedRef.regions)
      setAllCountries(injectedRef.allCountries)
      setIbVersions(injectedRef.ibVersions)
      setBrands(injectedRef.brands)
      setCities(injectedRef.cities)
      setLoading(false)
      return
    }

    // Parent didn't prefetch — fetch as fallback (rare — only if tab opened before prefetch finished)
    let mounted = true
    setLoading(true)
    Promise.all([
      regionsApi.list(),
      countriesApi.list(),
      ibVersionsApi.list(),
      responsesApi.filterOptions(),
    ])
      .then(([regRes, countRes, ibRes, filterRes]) => {
        if (!mounted) return
        setRegions((regRes.data.data || []).map((r: any) => ({ id: r.id, label: r.name })))
        setAllCountries((countRes.data.data || []).map((c: any) => ({
          id: c.id, name: c.name, region_id: c.region_id,
        })))
        setIbVersions((ibRes.data.data || []).map((v: any) => ({ id: v.id, label: v.name })))
        setBrands((filterRes.data.brands || []).map((b: string) => ({ id: b, label: b })))
        setCities((filterRes.data.locations || []).map((c: string) => ({ id: c, label: c })))
      })
      .catch(err => console.error('Error fetching data access options:', err))
      .finally(() => { if (mounted) setLoading(false) })

    return () => { mounted = false }
  }, [injectedRef])


  // Filter visible countries live by selected regions
  const visibleCountries = useMemo(() => {
    if (scopeState.all_regions) {
      return allCountries.map(c => ({ id: c.id, label: c.name }))
    }
    if (scopeState.region_ids.length === 0) {
      return []
    }
    return allCountries
      .filter(c => scopeState.region_ids.includes(c.region_id))
      .map(c => ({ id: c.id, label: c.name }))
  }, [scopeState.all_regions, scopeState.region_ids, allCountries])

  // When regions change, drop any country_ids that are no longer visible
  const handleRegionsChange = (newRegionIds: string[], allSelected: boolean) => {
    let updatedCountryIds = scopeState.country_ids
    if (!allSelected) {
      const allowedCountryIds = new Set(
        allCountries
          .filter(c => newRegionIds.includes(c.region_id))
          .map(c => c.id)
      )
      updatedCountryIds = scopeState.country_ids.filter(cid => allowedCountryIds.has(cid))
    }

    onChange({
      ...scopeState,
      all_regions: allSelected,
      region_ids: newRegionIds,
      country_ids: updatedCountryIds,
    })
  }

  const handleCountriesChange = (newCountryIds: string[], allSelected: boolean) => {
    onChange({
      ...scopeState,
      all_countries: allSelected,
      country_ids: newCountryIds,
    })
  }

  const handleIbVersionsChange = (newIbIds: string[], allSelected: boolean) => {
    onChange({
      ...scopeState,
      all_ib_versions: allSelected,
      ib_version_ids: newIbIds,
    })
  }

  const handleBrandsChange = (newBrands: string[], allSelected: boolean) => {
    onChange({
      ...scopeState,
      all_brands: allSelected,
      brand_models: newBrands,
    })
  }

  const handleCitiesChange = (newCities: string[], allSelected: boolean) => {
    onChange({
      ...scopeState,
      all_cities: allSelected,
      survey_locations: newCities,
    })
  }

  return (
    <Box sx={{ py: 1 }}>
      <ScopeCheckboxList
        title="1. Regions Scope"
        options={regions}
        selectedIds={scopeState.region_ids}
        allSelected={scopeState.all_regions}
        onChange={handleRegionsChange}
        loading={loading}
        emptyMessage="No regions found"
      />

      <ScopeCheckboxList
        title="2. Countries Scope"
        options={visibleCountries}
        selectedIds={scopeState.country_ids}
        allSelected={scopeState.all_countries}
        onChange={handleCountriesChange}
        loading={loading}
        emptyMessage={
          !scopeState.all_regions && scopeState.region_ids.length === 0
            ? 'Select at least one region first'
            : 'No countries found for selected region(s)'
        }
      />

      <ScopeCheckboxList
        title="3. IB Versions Scope"
        options={ibVersions}
        selectedIds={scopeState.ib_version_ids}
        allSelected={scopeState.all_ib_versions}
        onChange={handleIbVersionsChange}
        loading={loading}
        emptyMessage="No IB versions found"
      />

      <ScopeCheckboxList
        title="4. Brands Scope"
        options={brands}
        selectedIds={scopeState.brand_models}
        allSelected={scopeState.all_brands}
        onChange={handleBrandsChange}
        loading={loading}
        emptyMessage="No brands found"
      />

      <ScopeCheckboxList
        title="5. Cities Scope"
        options={cities}
        selectedIds={scopeState.survey_locations}
        allSelected={scopeState.all_cities}
        onChange={handleCitiesChange}
        loading={loading}
        emptyMessage="No cities found"
      />
    </Box>
  )
}

export default DataAccessTab
