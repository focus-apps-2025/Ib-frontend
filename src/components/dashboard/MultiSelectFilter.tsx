import { useMemo, useState, useLayoutEffect, useRef } from 'react'
import {
  Box,
  Chip,
  Collapse,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  TextField,
} from '@mui/material'
import { ExpandLess, ExpandMore } from '@mui/icons-material'

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
  /**
   * When true, options whose name starts with "TVS" (case-insensitive) are
   * shown at the top level, while every other option is nested under a
   * collapsible "Other" group.
   */
  nestedBrandMode?: boolean
}

const toOption = (opt: MultiSelectOption): { id: string; name: string } =>
  typeof opt === 'string' ? { id: opt, name: opt } : { id: opt.id, name: opt.name }

const isTvsBrand = (name: string) => name.trim().toUpperCase().startsWith('TVS')

export default function MultiSelectFilter({
  id,
  label,
  value,
  options,
  onChange,
  minWidth = 140,
  disabled = false,
  searchable = false,
  nestedBrandMode = false,
}: MultiSelectFilterProps) {
  const [query, setQuery] = useState('')
  const [otherOpen, setOtherOpen] = useState(false)

  const namesById = useMemo(() => {
    const map: Record<string, string> = {}
    options.forEach((opt) => {
      const { id: optionId, name } = toOption(opt)
      map[optionId] = name
    })
    return map
  }, [options])

  const searchBoxRef = useRef<HTMLDivElement>(null)
  const [searchBoxHeight, setSearchBoxHeight] = useState(0)

  useLayoutEffect(() => {
    if (searchable && searchBoxRef.current) {
      setSearchBoxHeight(searchBoxRef.current.getBoundingClientRect().height)
    }
  }, [searchable])

  // Split options into TVS (top-level) and Other (nested) when nestedBrandMode is on
  const { tvsOptions, otherOptions } = useMemo(() => {
    if (!nestedBrandMode) {
      return { tvsOptions: options, otherOptions: [] as MultiSelectOption[] }
    }
    const tvs: MultiSelectOption[] = []
    const other: MultiSelectOption[] = []
    options.forEach((opt) => {
      if (isTvsBrand(toOption(opt).name)) tvs.push(opt)
      else other.push(opt)
    })
    return { tvsOptions: tvs, otherOptions: other }
  }, [options, nestedBrandMode])

  const visibleTvs = useMemo(() => {
    if (!searchable) return tvsOptions
    const q = query.trim().toLowerCase()
    if (!q) return tvsOptions
    return tvsOptions.filter((opt) => toOption(opt).name.toLowerCase().includes(q))
  }, [tvsOptions, searchable, query])

  const visibleOther = useMemo(() => {
    if (!searchable) return otherOptions
    const q = query.trim().toLowerCase()
    if (!q) return otherOptions
    return otherOptions.filter((opt) => toOption(opt).name.toLowerCase().includes(q))
  }, [otherOptions, searchable, query])

  // Auto-expand "Other" when searching and a match lives inside it
  const searchActive = searchable && query.trim().length > 0
  const otherExpanded = otherOpen || (searchActive && visibleOther.length > 0)

  const remove = (selectedValue: string) => onChange(value.filter((v) => v !== selectedValue))

  // ── Nested "Other" group helpers ──
  const otherIds = useMemo(() => otherOptions.map((o) => toOption(o).id), [otherOptions])
  const selectedOtherIds = value.filter((v) => otherIds.includes(v))
  const allOtherSelected = otherIds.length > 0 && selectedOtherIds.length === otherIds.length
  const someOtherSelected = selectedOtherIds.length > 0 && !allOtherSelected

  const toggleAllOther = () => {
    if (allOtherSelected) {
      // uncheck all other brands
      onChange(value.filter((v) => !otherIds.includes(v)))
    } else {
      // check all other brands (keep existing selections, dedupe)
      const merged = new Set([...value, ...otherIds])
      onChange(Array.from(merged))
    }
  }
  const renderOption = (opt: MultiSelectOption) => {
    const { id: optionId, name } = toOption(opt)
    const checked = value.map(String).includes(String(optionId))

    return (
      <MenuItem
        key={optionId}
        value={optionId}
        // ── Handle the toggle ourselves ──
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (checked) {
            onChange(value.filter((v) => String(v) !== String(optionId)))
          } else {
            onChange([...value, optionId])
          }
        }}
        sx={{
          py: 0.75,
          '&.Mui-selected': { background: 'transparent' },
          '&.Mui-selected:hover': { background: 'rgba(108,99,255,0.06)' },
        }}
      >
        <Box
          sx={{
            width: 18,
            height: 18,
            flexShrink: 0,
            mr: 1,
            borderRadius: '3px',
            border: '2px solid',
            borderColor: checked ? '#6C63FF' : 'rgba(0,0,0,0.4)',
            background: checked ? '#6C63FF' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {checked && (
            <svg viewBox="0 0 24 24" width="14" height="14" style={{ display: 'block', fill: '#fff' }}>
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          )}
        </Box>
        <ListItemText primary={name} />
      </MenuItem>
    )
  }

  return (

    <FormControl size="small" sx={{ minWidth }} disabled={disabled}>
      <InputLabel shrink>{label}</InputLabel>
      <Select
        id={id}
        multiple
        value={value}
        label={label}
        displayEmpty
        // ── CRITICAL: don't let Select handle the toggle; we do it in each MenuItem ──
        onChange={() => { /* no-op — handled per MenuItem */ }}
        onClose={() => {
          setQuery('')
          setOtherOpen(false)
        }}

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
          anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
          transformOrigin: { vertical: 'top', horizontal: 'left' },
          slotProps: {
            list: { sx: { maxHeight: 320, pt: 0 } },
            paper: { sx: { maxHeight: 400 } },
          },
          autoFocus: false,
        }}
      >
        {/* ── Search field — a non-interactive header, not a MenuItem ── */}
        {searchable && (
          <Box
            ref={searchBoxRef}
            role="presentation"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            sx={{
              px: 1.5, py: 1,
              position: 'sticky', top: 0,
              bgcolor: 'background.paper',
              zIndex: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
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
                    // prevent Select's type-ahead from stealing the input
                    e.stopPropagation()
                    if (e.key !== 'Escape') e.stopPropagation()
                  },
                },
              }}
            />
          </Box>
        )}

        {/* ── Flat mode ── */}
        {!nestedBrandMode &&
          (searchable ? [...visibleTvs, ...visibleOther] : options).map(renderOption)}

        {/* ── Nested mode: TVS + Other group ── */}
        {nestedBrandMode && [
          ...visibleTvs.map(renderOption),
          ...(otherOptions.length > 0
            ? [
                <Box
                  key="other-header"
                  role="presentation"
                  onMouseDown={(e) => {
                    // prevent Select from closing/selecting when clicking this header
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setOtherOpen((prev) => !prev)
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    px: 1.5,
                    py: 1,
                    cursor: 'pointer',
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    position: 'sticky',
                    top: searchable ? searchBoxHeight : 0,   // ← measured, not guessed
                    // below search if searchable
                    zIndex: 1,
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Box
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      toggleAllOther()
                    }}
                    sx={{
                      width: 18,
                      height: 18,
                      flexShrink: 0,
                      mr: 1,
                      borderRadius: '3px',
                      border: '2px solid',
                      borderColor: allOtherSelected || someOtherSelected ? '#6C63FF' : 'rgba(0,0,0,0.4)',
                      background: allOtherSelected || someOtherSelected ? '#6C63FF' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    {allOtherSelected && (
                      <svg viewBox="0 0 24 24" width="14" height="14" style={{ display: 'block', fill: '#fff' }}>
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                    )}
                    {!allOtherSelected && someOtherSelected && (
                      <Box sx={{ width: 10, height: 2, background: '#fff', borderRadius: 1 }} />
                    )}
                  </Box>
                  <Box sx={{ flex: 1, fontWeight: 600 }}>
                    Other
                    <Box
                      component="span"
                      sx={{ ml: 1, color: 'text.secondary', fontWeight: 400, fontSize: '0.75rem' }}
                    >
                      {selectedOtherIds.length}/{otherIds.length} selected
                    </Box>
                  </Box>
                  {otherExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                </Box>,
                ...(otherExpanded ? visibleOther.map(renderOption) : []),
              ]
            : []),
        ]}
      </Select>
    </FormControl>
  )
}