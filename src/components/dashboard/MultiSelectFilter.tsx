import { useMemo, useState } from 'react'
import {
  Box,
  Checkbox,
  Chip,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  TextField,
} from '@mui/material'

export type MultiSelectOption = { id: string; name: string } | string

interface MultiSelectFilterProps {
  /** HTML id forwarded to the underlying MUI `<Select>` (kept for tests, e.g. `filter-region`). */
  id: string
  label: string
  value: string[]
  /** Options as `{ id, name }` objects or plain strings. */
  options: MultiSelectOption[]
  onChange: (next: string[]) => void
  minWidth?: number | string
  disabled?: boolean
  /** Shows a search TextField at the top of the dropdown menu. */
  searchable?: boolean
}

const toOption = (opt: MultiSelectOption): { id: string; name: string } =>
  typeof opt === 'string' ? { id: opt, name: opt } : { id: opt.id, name: opt.name }

/**
 * Multi-select checkbox dropdown built on MUI's `<Select multiple>`.
 *
 * - Selected values render as removable Chips inside the input ("All" when empty).
 * - Each `MenuItem` shows a `Checkbox` + `ListItemText`.
 * - The menu scrolls (maxHeight) and the dropdown stays open while the user
 *   ticks/unticks options – it only closes on an outside click (MUI's `multiple`
 *   Select never closes on item selection).
 */
export default function MultiSelectFilter({
  id,
  label,
  value,
  options,
  onChange,
  minWidth = 140,
  disabled = false,
  searchable = false,
}: MultiSelectFilterProps) {
  const [query, setQuery] = useState('')

  const namesById = useMemo(() => {
    const map: Record<string, string> = {}
    options.forEach((opt) => {
      const { id: optionId, name } = toOption(opt)
      map[optionId] = name
    })
    return map
  }, [options])

  const visibleOptions = useMemo(() => {
    if (!searchable) return options
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((opt) => toOption(opt).name.toLowerCase().includes(q))
  }, [options, searchable, query])

  const remove = (selectedValue: string) => onChange(value.filter((v) => v !== selectedValue))

  return (
    <FormControl size="small" sx={{ minWidth }} disabled={disabled}>
      <InputLabel shrink>{label}</InputLabel>
      <Select
        id={id}
        multiple
        value={value}
        label={label}
        displayEmpty
        onChange={(e) => {
          const next = e.target.value as string[]
          onChange(Array.isArray(next) ? next : [])
        }}
        onClose={() => setQuery('')}
        // Force the floating label to sit in the (already notched) border. Without
        // `shrink`, MUI keeps the label centered for an empty array and it overlaps
        // the "All" placeholder. `whiteSpace: normal` lets the flex-wrapped chips
        // lay out on multiple lines instead of being clipped/overwritten.
        SelectDisplayProps={{ style: { whiteSpace: 'normal' } }}
        renderValue={(selected) => {
          const sel = (selected as string[] | undefined) || []
          if (sel.length === 0) {
            return (
              <Box component="span" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                All
              </Box>
            )
          }
          return (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
              {sel.map((selectedValue) => (
                <Chip
                  key={selectedValue}
                  size="small"
                  variant="outlined"
                  label={namesById[selectedValue] ?? selectedValue}
                  onDelete={() => remove(selectedValue)}
                  slotProps={{
                    root: {
                      // Clicking a chip's delete icon must NOT open the dropdown.
                      onMouseDown: (e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      },
                      onClick: (e) => e.stopPropagation(),
                      onKeyDown: (e) => e.stopPropagation(),
                    },
                  }}
                />
              ))}
            </Box>
          )
        }}
        MenuProps={{
          slotProps: {
            list: { sx: { maxHeight: 280 } },
          },
        }}
      >
        {searchable && (
          <Box component="li" role="none" sx={{ bgcolor: 'transparent' }}>
            <TextField
              id={`${id}-search`}
              size="small"
              fullWidth
              placeholder="Search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              slotProps={{
                htmlInput: {
                  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
                    // Keep keystrokes inside the search box instead of letting
                    // the menu steal navigation/typeahead keys. Escape still
                    // bubbles so the dropdown can close.
                    if (e.key !== 'Escape') e.stopPropagation()
                  },
                },
              }}
            />
          </Box>
        )}
        {visibleOptions.map((opt) => {
          const { id: optionId, name } = toOption(opt)
          const checked = value.includes(optionId)
          return (
            <MenuItem key={optionId} value={optionId} selected={checked} sx={{ py: 0.75 }}>
              <Checkbox checked={checked} size="small" tabIndex={-1} disableRipple />
              <ListItemText primary={name} />
            </MenuItem>
          )
        })}
      </Select>
    </FormControl>
  )
}