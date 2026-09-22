import React, { useMemo } from 'react'
import {
  Box, Typography, Checkbox, FormControlLabel, Chip, Paper,
  CircularProgress, Grid
} from '@mui/material'
import { useThemeColors } from '../../utils/colors'

export type ScopeOption = {
  id: string
  label: string
}

export interface ScopeCheckboxListProps {
  title: string
  options: ScopeOption[]
  selectedIds: string[]
  allSelected: boolean
  onChange: (selectedIds: string[], allSelected: boolean) => void
  loading?: boolean
  emptyMessage?: string
}

export const ScopeCheckboxList: React.FC<ScopeCheckboxListProps> = ({
  title,
  options,
  selectedIds,
  allSelected,
  onChange,
  loading = false,
  emptyMessage = 'No options available',
}) => {
  const c = useThemeColors()

  const allOptionIds = useMemo(() => options.map(o => o.id), [options])

  const effectiveSelectedCount = useMemo(() => {
    if (allSelected) return options.length
    return selectedIds.filter(id => allOptionIds.includes(id)).length
  }, [allSelected, selectedIds, options, allOptionIds])

  const isIndeterminate = useMemo(() => {
    if (allSelected) return false
    return effectiveSelectedCount > 0 && effectiveSelectedCount < options.length
  }, [allSelected, effectiveSelectedCount, options.length])

  const handleMasterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked
    if (checked) {
      onChange(allOptionIds, true)
    } else {
      onChange([], false)
    }
  }

  const handleChildToggle = (id: string) => {
    let newSelected: string[]
    if (allSelected) {
      // Unchecking one when all were selected -> keep all except this id
      newSelected = allOptionIds.filter(item => item !== id)
    } else {
      if (selectedIds.includes(id)) {
        newSelected = selectedIds.filter(item => item !== id)
      } else {
        newSelected = [...selectedIds, id]
      }
    }

    const isAllNow = options.length > 0 && newSelected.length === options.length
    onChange(newSelected, isAllNow)
  }

  const chipLabel = useMemo(() => {
    if (options.length === 0) return 'None'
    if (allSelected || effectiveSelectedCount === options.length) return 'All'
    if (effectiveSelectedCount === 0) return 'None'
    return `${effectiveSelectedCount} selected`
  }, [allSelected, effectiveSelectedCount, options.length])

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        mb: 2,
        borderRadius: 2,
        border: `1px solid ${c.cardBorder}`,
        background: c.surfaceBackground,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: c.textPrimary }}>
          {title}
        </Typography>
        <Chip
          label={chipLabel}
          size="small"
          color={chipLabel === 'All' ? 'primary' : chipLabel === 'None' ? 'default' : 'info'}
          variant="outlined"
          sx={{ fontWeight: 600, fontSize: '0.75rem' }}
        />
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={24} sx={{ color: c.primary }} />
        </Box>
      ) : options.length === 0 ? (
        <Typography variant="body2" sx={{ color: c.textSecondary, fontStyle: 'italic', py: 1 }}>
          {emptyMessage}
        </Typography>
      ) : (
        <>
          <FormControlLabel
            control={
              <Checkbox
                checked={allSelected || (options.length > 0 && effectiveSelectedCount === options.length)}
                indeterminate={isIndeterminate}
                onChange={handleMasterChange}
                color="primary"
                size="small"
              />
            }
            label={
              <Typography variant="body2" sx={{ fontWeight: 600, color: c.textPrimary }}>
                Select All ({options.length})
              </Typography>
            }
            sx={{ mb: 1, display: 'block' }}
          />

          <Box
            sx={{
              maxHeight: 220,
              overflowY: 'auto',
              pr: 1,
              '&::-webkit-scrollbar': { width: 6 },
              '&::-webkit-scrollbar-thumb': { borderRadius: 3, background: 'rgba(0,0,0,0.2)' },
            }}
          >
            <Grid container spacing={1}>
              {options.map(option => {
                const isChecked = allSelected || selectedIds.includes(option.id)
                return (
                  <Grid size={{xs: 12, sm: 6}} key={option.id}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={isChecked}
                          onChange={() => handleChildToggle(option.id)}
                          color="primary"
                          size="small"
                        />
                      }
                      label={
                        <Typography variant="body2" sx={{ color: c.textPrimary, fontSize: '0.85rem' }}>
                          {option.label}
                        </Typography>
                      }
                      sx={{ width: '100%', margin: 0 }}
                    />
                  </Grid>
                )
              })}
            </Grid>
          </Box>
        </>
      )}
    </Paper>
  )
}

export default ScopeCheckboxList
