import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Box, Card, CardContent, Typography, Tabs, Tab, Grid,
  TextField, Select, MenuItem, FormControl, InputLabel,
  Button, IconButton, Tooltip, CircularProgress, Snackbar, Alert,
} from '@mui/material'
import {
  Refresh, FileDownload, FilterList, ClearAll,
  TrendingUp, People, LocationOn, Speed, DirectionsCar, CalendarMonth,
  DownloadForOffline, Cancel,
} from '@mui/icons-material'
import { AgGridReact } from 'ag-grid-react'
import { ModuleRegistry, AllCommunityModule, InfiniteRowModelModule } from 'ag-grid-community'
import type { ColDef, GridReadyEvent, IDatasource, IGetRowsParams } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'


// Recharts imports for hidden slide capture
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer
} from 'recharts'

import PptxGenJS from 'pptxgenjs'
import html2canvas from 'html2canvas'

ModuleRegistry.registerModules([AllCommunityModule, InfiniteRowModelModule])
import { responsesApi, regionsApi, countriesApi, ibVersionsApi, dashboardApi, comparisonApi, issuesApi, marketFeedbackApi } from '../../lib/api'
import { useFilterStore, toParam } from '../../store'
import { useThemeColors } from '../../utils/colors'
import IssuesTab from '../../components/dashboard/IssuesTab'
import DashboardAnalytics from '../../components/dashboard/DashboardAnalytics'
import ComparisonTab from '../../components/dashboard/ComparisonTab'
import NpsTab from '../../components/dashboard/NpsTab'
import ServiceDashboardTab from '../../components/dashboard/ServiceDashboardTab'
import MarketFeedbackTab, { DEFAULT_TVS_TOP_ISSUES, getSortedFormattedKmBreakdown, generateFeedbackFromSurveyData, getPhotoUrl } from '../../components/dashboard/MarketFeedbackTab'
import MultiSelectFilter from '../../components/dashboard/MultiSelectFilter'

import { getColumnHeader } from '../../utils/columnHeaders'

// ─── Month/Year Date Pickers ─────────────────────────────────────────────────
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'

// Allow parsing of the store's 'YYYY-MM' values (e.g. "2025-03") into dayjs.
dayjs.extend(customParseFormat)

/** Parse a stored 'YYYY-MM' string into a Dayjs object (null when empty). */
const toMonthPickValue = (value: string): Dayjs | null =>
  value ? dayjs(value, 'YYYY-MM') : null

/** Convert a picked Dayjs value back into the 'YYYY-MM' store format ('' when empty). */
const fromMonthPickValue = (value: Dayjs | null): string =>
  value ? value.format('YYYY-MM') : ''

// ─── Summary Card ─────────────────────────────────────────────────────────────
function StatCard({ title, value, icon, color, subtitle }: {
  title: string; value: string | number; icon: React.ReactNode
  color: string; subtitle?: string
}) {
  const c = useThemeColors()
  return (
    <Card
      sx={{
        background: `linear-gradient(135deg, ${color}18, ${color}08)`,
        border: `1px solid ${color}30`,
        height: '100%',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 8px 24px ${color}20` },
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="caption" sx={{ color: c.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.65rem' }}>
              {title}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, color: c.textPrimary, mt: 0.5 }}>
              {value?.toLocaleString?.() ?? value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" sx={{ color: c.textMuted }}>{subtitle}</Typography>
            )}
          </Box>
          <Box sx={{ p: 1.5, borderRadius: 2, background: `${color}20`, color }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const [tab, setTab] = useState(0)
  const [analysisMode, setAnalysisMode] = useState<string[]>(['product', 'service'])
  const filters = useFilterStore()
  const c = useThemeColors()
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([])
  const [countries, setCountries] = useState<{ id: string; name: string }[]>([])
  const [ibVersions, setIbVersions] = useState<{ id: string; name: string }[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [cities, setCities] = useState<string[]>([])
  const [stats, setStats] = useState<Record<string, number | string>>({})
  const [statsLoading, setStatsLoading] = useState(true)
  const [gridApi, setGridApi] = useState<unknown>(null)
  const [totalRows, setTotalRows] = useState(0)

  const [pptGenerating, setPptGenerating] = useState(false)
  const [pptProgress, setPptProgressRaw] = useState('')
  const [pptData, setPptData] = useState<any>(null)

  // ─── PPT cancellation support ─────────────────────────────────────────────
  // Generation runs long synchronous blocks between awaits, so a plain React
  // state flag would read stale values inside them. A ref is used instead, and
  // every progress checkout aborts generation when the cancel flag is raised.
  const PPT_CANCELLED = 'PPT_CANCELLED'
  const pptCancelRef = useRef(false)
  const setPptProgress = (msg: string) => {
    setPptProgressRaw(msg)
    if (pptCancelRef.current) {
      throw new Error(PPT_CANCELLED)
    }
  }

  const [toastMessage, setToastMessage] = useState('')
  const [toastOpen, setToastOpen] = useState(false)
  const [toastSeverity, setToastSeverity] = useState<'success' | 'error' | 'info'>('success')

  const cleanIssueName = (name: string): string => {
    let cleaned = name.replace(/\s+issues$/i, '')
    cleaned = cleaned.replace(/\s+issue$/i, '')
    return cleaned || name
  }

  const captureElement = async (id: string): Promise<string> => {
    const el = document.getElementById(id)
    if (!el) {
      console.warn(`Element with id ${id} not found for capture`)
      return ''
    }
    try {
      const canvas = await html2canvas(el, {
        useCORS: true,
        scale: 2,
        backgroundColor: '#ffffff',
      })
      return canvas.toDataURL('image/png')
    } catch (err) {
      console.error(`Failed to capture element ${id}:`, err)
      return ''
    }
  }

  const createTitleSlide = (slide1: any, pptx: any, customBrands?: string[]) => {
    slide1.background = { fill: 'FFFFFF' }

    // Full-bleed hero image at the top
    slide1.addImage({
      path: '/assets/home.png',
      x: 0,
      y: 0,
      w: 10,
      h: 4.8,
      sizing: { type: 'cover', w: 10, h: 4.8 },
    })

    // Bottom white strip
    slide1.addShape(pptx.shapes.RECTANGLE, {
      x: 0,
      y: 4.6,
      w: 10,
      h: 1.1,
      fill: { color: 'FFFFFF' },
      line: { color: 'FFFFFF', width: 0 },
    })

    // Left side of the bottom strip: Filter summary & Analysis mode
    const countryIds = Array.isArray(filters.countryId)
      ? filters.countryId
      : (filters.countryId ? [filters.countryId] : [])

    const regionIds = Array.isArray(filters.regionId)
      ? filters.regionId
      : (filters.regionId ? [filters.regionId] : [])

    let countryLabel = ''
    if (countryIds.length > 0) {
      const found = countries.find((c) => c.id === countryIds[0])
      countryLabel = found ? found.name : countryIds[0]
    } else if (regionIds.length > 0) {
      const found = regions.find((r) => r.id === regionIds[0])
      countryLabel = found ? found.name : regionIds[0]
    }

    const line1Text = countryLabel ? `${countryLabel}` : 'Overall'

    const hasProduct = analysisMode.includes('product')
    const hasService = analysisMode.includes('service')
    let modeText = 'Product, Service'
    if (hasProduct && !hasService) modeText = 'Product'
    else if (hasService && !hasProduct) modeText = 'Service'

    const line2Text = `${modeText}`

    slide1.addText(
      [
        { text: line1Text, options: { bold: true, fontSize: 30, color: '1E293B', fontFace: 'Arial' } },
        { text: '\n' + line2Text, options: { bold: false, fontSize: 11, color: '64748B', fontFace: 'Arial' } },
      ],
      {
        x: 0.0,
        y: 4.4,
        w: 3.5,
        h: 1.225,
        valign: 'left',
        lineSpacing: 18,
      }
    )

    // Center of the bottom strip: Selected brand names list (or fallback to dataset brands)
    let displayBrands: string[] = []
    if (Array.isArray(filters.brandModel) && filters.brandModel.length > 0) {
      displayBrands = filters.brandModel
    } else if (Array.isArray(customBrands) && customBrands.length > 0) {
      displayBrands = customBrands
    } else if (Array.isArray(brands) && brands.length > 0) {
      displayBrands = brands
    }

    if (displayBrands.length > 0) {
      const count = displayBrands.length
      const fontSize = count <= 3 ? 12 : count <= 5 ? 10 : 8
      const lineSpacing = fontSize * 1.5          // 1.5x line spacing
      const blockH = count * (lineSpacing / 72) + 0.1  // convert pt → inches, add padding
      const blockY = 4.4 + (1.225 - blockH) / 2   // vertically center inside bottom strip

      slide1.addText(
        displayBrands.map((b, idx) => ({
          text: b,
          options: {
            bold: true,
            fontSize,
            color: '000000',
            fontFace: 'Arial',
            breakLine: idx < count - 1,           // line break after each item except last
            paraSpaceAfter: 0,
            lineSpacing: lineSpacing,
          },
        })),
        {
          x: 3.6,
          y: blockY,
          w: 4.8,
          h: blockH,
          align: 'left',
          valign: 'top',
        }
      )
    }

    // Right side of the bottom strip: Company logo
    slide1.addImage({
      path: '/assets/logo.png',
      x: 8.6,
      y: 4.7,
      w: 1.1,
      h: 0.8,
    })
  }

  const handleDownloadServicePPT = async () => {
    pptCancelRef.current = false
    setPptGenerating(true)
    setPptProgress('Initializing & fetching Service Dashboard data...')

    try {
      const filterParams = {
        file_id: filters.fileId || undefined,
        region_id: toParam(filters.regionId),
        country_id: toParam(filters.countryId),
        ib_version_id: toParam(filters.ibVersionId),
        brand_model: toParam(filters.brandModel),
        survey_location: toParam(filters.surveyLocation),
        date_from: filters.dateFrom || undefined,
        date_to: filters.dateTo || undefined,
        search: filters.search || undefined,
      }

      const [analyticsRes, serviceRes, npsRes, benefitsRes, satisfactionRes, cpsRes] = await Promise.all([
        dashboardApi.analytics(filterParams),
        dashboardApi.serviceFrequency(filterParams),
        dashboardApi.serviceNps(filterParams),
        dashboardApi.serviceBenefitsBetterments(filterParams),
        dashboardApi.serviceSatisfaction(filterParams),
        dashboardApi.serviceCps(filterParams),
      ])
      console.log('serviceFrequency raw:', JSON.stringify(serviceRes.data, null, 2))

      const analytics = analyticsRes.data || {}
      const serviceData = serviceRes.data || {}
      const serviceNpsData = npsRes.data || {}
      const serviceBenefitsData = benefitsRes.data || {}
      const satisfactionData = satisfactionRes.data || {}
      const cpsData = cpsRes.data || {}

      const kmsDataAll = serviceData.kms_frequency || { total_responses: 0, categories: [], brand_breakdown: [] }
      const timeDataAll = serviceData.time_frequency || { total_responses: 0, categories: [], brand_breakdown: [] }

      if (!analytics) {
        setToastSeverity('error')
        setToastMessage('Cannot generate Service PPT: No data available for the active filters.')
        setToastOpen(true)
        setPptGenerating(false)
        return
      }

      setPptProgress('Preparing Service presentation...')

      const pptx = new PptxGenJS()
      pptx.layout = 'LAYOUT_16x9'

      let slideCounter = 0
      const _originalAddSlide = pptx.addSlide.bind(pptx)
      pptx.addSlide = (...args: any[]) => {
        slideCounter++
        return _originalAddSlide(...args)
      }
      const dividerTOC: { title: string; slideNumber: number }[] = []
      const TOC_SLIDE_NUMBER = 2

      const today = new Date().toISOString().split('T')[0]
      const displayDate = new Date().toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })

      const BRAND_COLORS_LIST = ['00B4D8', '7C3AED', 'F97316', '10B981', 'EF4444', '3B82F6', '8B5CF6', 'EC4899', 'F59E0B', '06B6D4']
      const LIGHT_COLORS_LIST = ['B3E5FC', 'D1C4E9', 'FFE0B2', 'D1FAE5', 'FEE2E2', 'DBEAFE', 'EDE9FE', 'FCE7F3', 'FEF3C7', 'CFFAFE']

      const SPECIFIC_BRAND_COLORS: Record<string, string> = {
        // TVS — cyan
        'TVS Raider': '00B4D8', 'TVS Apache': '00B4D8', 'TVS': '00B4D8',

        // Bajaj — purple
        'Bajaj Pulsar': '7C3AED', 'Bajaj': '7C3AED',

        // Yamaha — orange
        'Yamaha FZ': 'FF5A00', 'Yamaha': 'FF5A00',

        // Honda — navy
        'Honda CB': '1E3A8A', 'Honda': '1E3A8A',

        // Suzuki — teal
        'Suzuki Gixxer': '2A9D8F', 'Suzuki': '2A9D8F',
      }
      const SPECIFIC_LIGHT_COLORS: Record<string, string> = {
        'TVS Raider': 'B3E5FC', 'TVS Apache': 'B3E5FC', 'TVS': 'B3E5FC',
        'Bajaj Pulsar': 'D1C4E9', 'Bajaj': 'D1C4E9',
        'Yamaha FZ': 'FFE0CC', 'Yamaha': 'FFE0CC',
        'Honda CB': 'DBEAFE', 'Honda': 'DBEAFE',          // ← navy light
        'Suzuki Gixxer': 'D1F0EC', 'Suzuki': 'D1F0EC',
      }

      const hashBrand = (str: string): number => {
        let hash = 0
        for (let i = 0; i < str.length; i++) {
          hash = str.charCodeAt(i) + ((hash << 5) - hash)
        }
        return Math.abs(hash)
      }

      // Dynamic brand ordering directly from DB response (TVS brands placed first)
      const getOrderedBrands = (brands: string[]): string[] => {
        if (!Array.isArray(brands)) return []
        const unique: string[] = []
        brands.forEach((b) => {
          if (b && typeof b === 'string') {
            const clean = b.trim()
            if (clean && clean.toLowerCase() !== 'blank' && !unique.includes(clean)) {
              unique.push(clean)
            }
          }
        })
        const tvsBrands = unique.filter((b) => {
          const lower = b.toLowerCase()
          return lower.includes('tvs') || lower.includes('raider') || lower.includes('apache')
        })
        const otherBrands = unique.filter((b) => {
          const lower = b.toLowerCase()
          return !lower.includes('tvs') && !lower.includes('raider') && !lower.includes('apache')
        })
        return [...tvsBrands, ...otherBrands]
      }

      const getBrandColor = (brandName: string): string => {
        if (!brandName) return '475569'
        const clean = String(brandName).trim()
        if (SPECIFIC_BRAND_COLORS[clean]) {
          return SPECIFIC_BRAND_COLORS[clean]
        }
        const lower = clean.toLowerCase()

        if (lower.includes('apache') || lower.includes('raider') || lower.includes('tvs')) return '00B4D8'
        if (lower.includes('pulsar') || lower.includes('bajaj')) return '7C3AED'
        if (lower.includes('yamaha') || lower.includes('fz')) return 'FF5A00'
        if (lower.includes('honda') || lower.includes('cb')) return '1E3A8A'   // ← navy
        if (lower.includes('gixxer') || lower.includes('suzuki')) return '2A9D8F'

        const idx = hashBrand(clean.toUpperCase()) % BRAND_COLORS_LIST.length
        return BRAND_COLORS_LIST[idx]
      }

      // Dynamic light color palette assignment
      const getAgeGroupLightColor = (brandName: string): string => {
        if (!brandName) return 'ECEFF1'
        const clean = String(brandName).trim()
        if (SPECIFIC_LIGHT_COLORS[clean]) {
          return SPECIFIC_LIGHT_COLORS[clean]
        }
        const lower = clean.toLowerCase()

        if (lower.includes('apache') || lower.includes('raider') || lower.includes('tvs')) return 'B3E5FC'
        if (lower.includes('pulsar') || lower.includes('bajaj')) return 'D1C4E9'
        if (lower.includes('yamaha') || lower.includes('fz')) return 'FFE0CC'
        if (lower.includes('honda') || lower.includes('cb')) return 'DBEAFE'   // ← navy light
        if (lower.includes('gixxer') || lower.includes('suzuki')) return 'D1F0EC'

        const idx = hashBrand(clean.toUpperCase()) % LIGHT_COLORS_LIST.length
        return LIGHT_COLORS_LIST[idx]
      }
      const getBrandHeaderOptions = (brandName: string) => ({
        bold: true,
        fill: getBrandColor(brandName),
        color: 'FFFFFF',
        align: 'center',
        valign: 'middle',
        fontFace: 'Arial',
        fontSize: 8
      })

      const getBrandColorsArray = (brands: string[]): string[] => {
        return brands.map(b => getBrandColor(b))
      }

      function matrixToChartData(matrix: any, type: 'count' | 'percent' = 'percent') {
        if (!matrix || !Array.isArray(matrix.chart) || matrix.chart.length === 0) return []
        const { brands } = matrix
        if (!Array.isArray(brands)) return []
        const orderedBrands = getOrderedBrands(brands)
        return matrix.chart.map((row: any) => ({
          name: row.category || 'Unknown',
          labels: orderedBrands || [],
          values: orderedBrands.map((b: string) => {
            const key = type === 'count' ? `${b}_count` : `${b}_pct`
            return row?.[key] || 0
          })
        }))
      }

      const NEUTRAL_GREY = '607D8B'

      const addMatrixTable = (slide: any, matrix: any, title: string, x: number, y: number, w: number, h: number, hideTotal: boolean = false,) => {
        if (!matrix || !Array.isArray(matrix.table) || matrix.table.length === 0) {
          slide.addText('No data available', { x, y, w, h, fontSize: 12, color: '999999', align: 'center' })
          return
        }
        const { brands, table, category_header } = matrix
        if (!Array.isArray(brands)) return
        const orderedBrands = getOrderedBrands(brands)
        const rows: any[][] = []
        const headerRow: any[] = [
          { text: title || category_header || 'Category', options: { bold: true, fill: NEUTRAL_GREY, color: 'FFFFFF', align: 'left', fontSize: 8 } }
        ]
        orderedBrands.forEach((brand: string) => {
          headerRow.push({
            text: brand,
            options: getBrandHeaderOptions(brand),
          })
        })

        if (!hideTotal) {
          headerRow.push({
            text: 'Total',
            options: {
              bold: true,
              fill: NEUTRAL_GREY,
              color: 'FFFFFF',
              align: 'right',
              valign: 'middle',
              fontSize: 8,
            },
          })
        }

        rows.push(headerRow)

        table.forEach((row: any) => {
          const isTotal = row.category === 'Grand Total'
          const dataRow: any[] = [
            { text: String(row.category), options: { bold: isTotal, align: 'left', fontSize: 7 } }
          ]
          orderedBrands.forEach((brand: string) => {
            const rawCount = row?.[`${brand}_count`] !== undefined ? row[`${brand}_count`] : row?.[brand]
            const count = typeof rawCount === 'number' ? rawCount : (parseFloat(rawCount) || 0)
            const rawPct = row?.[`${brand}_pct`] !== undefined ? row[`${brand}_pct`] : 0
            const pct = typeof rawPct === 'number' ? rawPct : (parseFloat(rawPct) || 0)
            let displayText = ''
            if (isTotal) {
              displayText = typeof count === 'number' ? count.toLocaleString() : String(count)
            } else {
              displayText = `${count} (${Math.round(pct)}%)`
            }
            dataRow.push({ text: displayText, options: { bold: isTotal, align: 'right', fontSize: 7 } })
          })
          if (!hideTotal) {
            dataRow.push({
              text:
                typeof row.total === 'number'
                  ? row.total.toLocaleString()
                  : String(row.total || 0),
              options: { bold: true, align: 'right', valign: 'middle', fontSize: 7 },
            })
          }
          dataRow.push({ text: typeof row.total === 'number' ? row.total.toLocaleString() : String(row.total || 0), options: { bold: true, align: 'right', fontSize: 7 } })
          rows.push(dataRow)
        })

        const colCount = 2 + orderedBrands.length          // reference layout: always counts the Total slot
        const baseWidth = w / colCount

        // Effective table width:
        //   - hideTotal = false → full `w` (unchanged)
        //   - hideTotal = true  → reserve the space the Total column would have used,
        //                         so the remaining columns keep their original size.
        const totalColW = baseWidth * 0.8
        const effectiveW = hideTotal ? (w - totalColW) : w

        slide.addTable(rows, {
          x, y, w: effectiveW, h,
          border: { type: 'solid', color: 'E0E0E0', size: 0.5 },
          fontSize: 7,
          fontFace: 'Arial',
          colW: [
            baseWidth * 1.2,
            ...orderedBrands.map(() => baseWidth * 0.9),
            ...(hideTotal ? [] : [totalColW]),
          ],
          rowH: rows.map(() => 0.2),
          valign: 'middle',
        })
      }

      const addAgeCityTableFullWidth = (slide: any, matrix: any, x: number, y: number, w: number, h: number) => {
        if (!matrix || !Array.isArray(matrix.table) || matrix.table.length === 0) {
          slide.addText('No data available', {
            x, y, w, h,
            fontSize: 12,
            color: '999999',
            align: 'center',
          })
          return
        }

        if (!Array.isArray(matrix.brands)) return

        // ─── Robust check — a brand is "empty" if it has NO non-zero values ───
        const brandHasData = (brand: string): boolean => {
          return matrix.table.some((row: any) => {
            const directVal = row?.[brand]
            if (directVal !== undefined && directVal !== null && Number(directVal) > 0) return true

            const countVal = row?.[`${brand}_count`]
            if (countVal !== undefined && countVal !== null && Number(countVal) > 0) return true

            const totalVal = row?.[`${brand}_total`]
            if (totalVal !== undefined && totalVal !== null && Number(totalVal) > 0) return true

            const matchingKey = Object.keys(row || {}).find(k =>
              k.startsWith(brand) && k !== brand
            )
            if (matchingKey) {
              const val = row[matchingKey]
              if (val !== undefined && val !== null && Number(val) > 0) return true
            }

            return false
          })
        }

        const brandsWithData = matrix.brands.filter((brand: string) => brandHasData(brand))

        if (brandsWithData.length === 0) {
          slide.addText('No data available', {
            x, y, w, h,
            fontSize: 12,
            color: '999999',
            align: 'center',
          })
          return
        }

        const orderedBrands = getOrderedBrands(brandsWithData)

        const cityAgeMap: Record<string, Record<string, Record<string, number>>> = {}
        const allAgeGroups = new Set<string>()

        matrix.table.forEach((row: any) => {
          const parts = String(row.category).split('|')
          const city = parts[0] || ''
          const ageGroup = parts[1] || ''
          if (city && ageGroup) {
            allAgeGroups.add(ageGroup)
            if (!cityAgeMap[city]) cityAgeMap[city] = {}
            if (!cityAgeMap[city][ageGroup]) cityAgeMap[city][ageGroup] = {}
            orderedBrands.forEach((brand: string) => {
              const directVal = row?.[brand]
              const countVal = row?.[`${brand}_count`]
              const rawVal = directVal !== undefined ? directVal : countVal
              cityAgeMap[city][ageGroup][brand] = Number(rawVal) || 0
            })
          }
        })

        const cities = Object.keys(cityAgeMap)

        // ─── Ordered so "Less than 20" comes FIRST ───
        const ageGroupOrder = ['Less than 20', '20-30', '30-40', '40-50', '50-60']
        const orderedAgeGroups = ageGroupOrder.filter(ag => allAgeGroups.has(ag))

        // ─── FIX A: Remove age groups that have NO data in ANY city × brand ───
        //     An age group is kept only if at least one (city, brand) has a value > 0.
        const sortedAgeGroups = orderedAgeGroups.filter(ageGroup => {
          return cities.some(city =>
            orderedBrands.some(brand => (cityAgeMap[city]?.[ageGroup]?.[brand] || 0) > 0)
          )
        })

        // Safety: if everything got filtered out (unexpected), fall back to the original
        const ageGroupsToUse = sortedAgeGroups.length > 0 ? sortedAgeGroups : orderedAgeGroups
        // ──────────────────────────────────────────────────────────────────────

        const totalDataCols = orderedBrands.length * (ageGroupsToUse.length + 1)
        const totalCols = 1 + totalDataCols
        const isManyCols = totalCols > 15
        const cityColWidth = isManyCols ? 0.85 : 1.0
        const dataColWidth = (w - cityColWidth) / totalDataCols
        const colWidths = [cityColWidth, ...Array(totalDataCols).fill(dataColWidth)]
        const subColCount = ageGroupsToUse.length + 1
        const fontSize = isManyCols ? 5 : 6
        const rowHeight = isManyCols ? 0.22 : 0.25

        const brandHeaderH = 0.28

        // City & Age Group header box
        slide.addText('City & Age Group', {
          x, y, w: cityColWidth, h: brandHeaderH,
          fontSize: 6, bold: true, color: 'FFFFFF',
          align: 'center', valign: 'middle', fontFace: 'Arial',
          fill: { color: NEUTRAL_GREY },
          line: { color: 'FFFFFF', size: 0.5 },
        })

        orderedBrands.forEach((brand: string, bIdx: number) => {
          const brandX = x + cityColWidth + bIdx * subColCount * dataColWidth
          const brandW = subColCount * dataColWidth
          const fill = getBrandColor(brand)

          slide.addText(brand, {
            x: brandX, y, w: brandW, h: brandHeaderH,
            fontSize: 6, bold: true, color: 'FFFFFF',
            align: 'center', valign: 'middle', fontFace: 'Arial',
            fill: { color: fill },
            line: { color: 'FFFFFF', size: 0.5 },
          })
        })

        const tableY = y + brandHeaderH
        const tableH = h - brandHeaderH

        const subHeaderRow: any[] = [
          { text: '', options: { fill: NEUTRAL_GREY } }
        ]
        orderedBrands.forEach((brand: string) => {
          const fill = getAgeGroupLightColor(brand)
          ageGroupsToUse.forEach((ageGroup: string) => {
            subHeaderRow.push({
              text: ageGroup,
              options: { bold: true, fill, color: '333333', align: 'center', fontSize: 6 }
            })
          })
          subHeaderRow.push({
            text: 'Total',
            options: { bold: true, fill: NEUTRAL_GREY, color: 'FFFFFF', align: 'center', fontSize: 6, italic: true }
          })
        })

        const tableRows: any[][] = [subHeaderRow]

        cities.forEach((city) => {
          const brandTotals: Record<string, number> = {}
          orderedBrands.forEach((brand: string) => {
            brandTotals[brand] = 0
            ageGroupsToUse.forEach((ageGroup: string) => {
              brandTotals[brand] += (cityAgeMap[city]?.[ageGroup]?.[brand] || 0)
            })
          })

          const dataRow: any[] = [{ text: city, options: { align: 'left', fontSize: 6, bold: true } }]
          orderedBrands.forEach((brand: string) => {
            ageGroupsToUse.forEach((ageGroup: string) => {
              const value = cityAgeMap[city]?.[ageGroup]?.[brand] || 0
              const total = brandTotals[brand] || 1
              const pct = total > 0 ? ((value / total) * 100) : 0
              dataRow.push({
                text: pct > 0 ? `${Math.round(pct)}%` : '—',
                options: { align: 'right', fontSize: 6 }
              })
            })
            dataRow.push({
              text: '100%',
              options: { bold: true, align: 'right', fontSize: 6 }
            })
          })
          tableRows.push(dataRow)
        })

        const grandRow: any[] = [{ text: 'Grand Total', options: { bold: true, align: 'left', fontSize: 6 } }]
        orderedBrands.forEach((brand: string) => {
          let grandTotal = 0
          cities.forEach((city) => {
            ageGroupsToUse.forEach((ageGroup: string) => {
              grandTotal += (cityAgeMap[city]?.[ageGroup]?.[brand] || 0)
            })
          })
          const totalPerBrand = grandTotal || 1
          ageGroupsToUse.forEach((ageGroup: string) => {
            let total = 0
            cities.forEach((city) => { total += (cityAgeMap[city]?.[ageGroup]?.[brand] || 0) })
            const pct = totalPerBrand > 0 ? ((total / totalPerBrand) * 100) : 0
            grandRow.push({
              text: pct > 0 ? `${Math.round(pct)}%` : '—',
              options: { bold: true, align: 'right', fontSize: 6 }
            })
          })
          grandRow.push({
            text: '100%',
            options: { bold: true, align: 'right', fontSize: 6 }
          })
        })
        tableRows.push(grandRow)

        slide.addTable(tableRows, {
          x, y: tableY, w, h: tableH,
          border: { type: 'solid', color: 'E0E0E0', size: 0.5 },
          fontSize,
          fontFace: 'Arial',
          colW: colWidths,
          rowH: tableRows.map(() => rowHeight),
          valign: 'middle',
        })
      }

      const addSlideTitle = (slide: any, title: string, subtitle: string) => {
        slide.addText(title, { x: 0.3, y: 0.2, w: 8.0, h: 0.4, fontSize: 18, bold: true, color: '1E293B', fontFace: 'Arial' })
        if (subtitle) {
          slide.addText(subtitle, { x: 0.3, y: 0.59, w: 8.0, h: 0.25, fontSize: 10, color: '#2B5797', fontFace: 'Arial' })
        }
        slide.addShape(pptx.shapes.LINE, { x: 0.3, y: 0.85, w: 9.4, h: 0.0, line: { color: '3B82F6', width: 2 } })
        slide.addImage({ path: '/assets/logo.png', x: 8.72, y: 0.25, w: 1.0, h: 0.52 })
      }

      const addDividerSlide = (sectionTitle: string) => {
        const slide = pptx.addSlide()
        dividerTOC.push({ title: sectionTitle, slideNumber: slideCounter })

        slide.background = { fill: '1E293B' }
        slide.addText(sectionTitle, { x: 1.0, y: 2.0, w: 8.0, h: 1.2, fontSize: 38, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', fontFace: 'Arial' })
        slide.addShape(pptx.shapes.LINE, { x: 3.5, y: 3.4, w: 3.0, h: 0.0, line: { color: '3B82F6', width: 3 } })

        slide.addText('« Back to Contents', {
          x: 0.3, y: 5.15, w: 2.4, h: 0.3,
          fontSize: 10, color: '93C5FD', underline: true, fontFace: 'Arial',
          hyperlink: { slide: TOC_SLIDE_NUMBER, tooltip: 'Back to Contents' },
        })

        return slide
      }

      // ─── HELPER: Add chart (native editable PPT chart) ───
      const addVerticalBarChart = (
        slide: any,
        matrixOrData: any,
        x: number,
        y: number,
        w: number,
        h: number,
        colors?: string[],
        type: 'count' | 'percent' = 'percent'
      ) => {
        let chartData: any[] = []
        let resolvedColors: string[] = []

        if (matrixOrData && typeof matrixOrData === 'object' && !Array.isArray(matrixOrData)) {
          const chartRows = (Array.isArray(matrixOrData.chart) && matrixOrData.chart.length > 0)
            ? matrixOrData.chart.filter((r: any) => r.category !== 'Grand Total')
            : (Array.isArray(matrixOrData.table) ? matrixOrData.table.filter((r: any) => r.category !== 'Grand Total') : [])

          const brands = matrixOrData.brands
          if (Array.isArray(brands) && chartRows.length > 0) {
            const orderedBrands = getOrderedBrands(brands)
            const categories = chartRows.map((r: any) => String(r.category || ''))

            chartData = orderedBrands.map((brand: string) => ({
              name: brand,
              labels: categories,
              values: chartRows.map((r: any) => {
                const pctKey = `${brand}_pct`
                const countKey = `${brand}_count`
                if (type === 'count') {
                  const val = r[countKey] ?? r[brand] ?? 0
                  return typeof val === 'number' ? val : (parseFloat(val) || 0)
                } else {
                  if (r[pctKey] !== undefined && r[pctKey] !== null) {
                    const val = parseFloat(r[pctKey])
                    return !isNaN(val) ? Math.round(val) : 0
                  }
                  const cnt = typeof r[brand] === 'number' ? r[brand] : (parseFloat(r[brand]) || 0)
                  return Math.round(cnt)
                }
              })
            }))

            resolvedColors = getBrandColorsArray(orderedBrands)
          }
        } else if (Array.isArray(matrixOrData)) {
          chartData = matrixOrData
          resolvedColors = colors && colors.length > 0 ? colors : ['00B4D8', '7C3AED', 'F59E0B', '10B981']
        }

        if (!chartData || chartData.length === 0) {
          slide.addText('No chart data available', {
            x, y, w, h,
            fontSize: 10,
            color: '999999',
            align: 'center',
          })
          return
        }

        try {
          slide.addChart(pptx.ChartType.bar, chartData, {
            x, y, w, h,
            barDir: 'col',
            chartColors: resolvedColors,
            showTitle: false,
            showLegend: true,
            legendPos: 'b',
            legendFontSize: 7,
            legendFontFace: 'Arial',
            catAxisLabelFontSize: 7,
            catAxisLabelFontFace: 'Arial',
            valAxisLabelFontSize: 7,
            valAxisMinVal: 0,
            valAxisMaxVal: 100,
            valAxisMajorUnit: 20,
            showValue: true,
            dataLabelFontSize: 7,
            dataLabelColor: '333333',
            dataLabelFontFace: 'Arial',
            dataLabelPosition: 'outEnd',
            // ✅ ADD THIS: Format data labels with percentage symbol
            dataLabelFormatCode: type === 'percent' ? '0"%"' : '0',
            barGapWidthPct: 150,
            barOverlapPct: -30,
            valGridLine: { style: 'none' },
            catGridLine: { style: 'none' },
            valAxisLineShow: true,
            catAxisLineShow: true,
          })
        } catch (err) {
          console.error('Error adding native PPT chart:', err)
          slide.addText('Chart could not be rendered', {
            x, y, w, h,
            fontSize: 10,
            color: '999999',
            align: 'center',
          })
        }
      }

      // ─── SLIDE 1: Title Page ───
      setPptProgress('Generating Slide 1: Title...')
      const slide1 = pptx.addSlide()
      const rawServiceBrands = (kmsDataAll?.brand_breakdown || []).map((b: any) => b.brand || b.name || b)
      createTitleSlide(slide1, pptx, rawServiceBrands)
      const tocSlide = pptx.addSlide()
      tocSlide.background = { fill: 'FFFFFF' }
      // ─── DIVIDER 1: Demography ───
      addDividerSlide('Demography')

      setPptProgress('Generating Slide: Location & Model wise Sample Sizes...')
      const slideSample = pptx.addSlide()
      slideSample.background = { fill: 'FFFFFF' }
      addSlideTitle(slideSample, 'Location & Model wise Sample Sizes', 'Sample sizes across cities, brand models, and duration of usage')

      try {
        const sampleData = analytics.location_model_sample_size || {}
        const rawSampleBrands = sampleData.brands || ['TVS HLX125', 'Bajaj BM 125 / Bajaj CT 125']

        const sampleBrands = getOrderedBrands(rawSampleBrands).sort((a: string, b: string) => {
          const aIsTvs = a.toUpperCase().includes('TVS') ? 0 : 1
          const bIsTvs = b.toUpperCase().includes('TVS') ? 0 : 1
          return aIsTvs - bIsTvs
        })

        const sampleTenures = sampleData.tenures || ['3-6 months', '6-12 months']
        const sampleTable = sampleData.table || []

        if (sampleTable.length > 0) {
          const citiesRows = sampleTable.filter((r: any) => r.city !== 'Grand Total')
          const grandTotalRow = sampleTable.find((r: any) => r.city === 'Grand Total') || {}

          const lightBlueBg = 'B3E5FC'
          const lightGrayBg = 'E2E8F0'

          // ── Row 1 Header ── brand cells now BLANK (text added as overlay below)
          const headerRow1: any[] = [
            {
              text: 'City',
              options: {
                fill: lightBlueBg,
                color: '000000',
                bold: true,
                align: 'center',
                valign: 'middle',
                fontSize: 8,
                fontFace: 'Arial',
                border: [
                  { color: '000000', pt: 1 },   // top — solid black
                  { color: '000000', pt: 1 },   // right
                  { color: lightBlueBg, pt: 1 },// bottom — invisible (row2 draws its own top)
                  { color: '000000', pt: 1 },   // left
                ],
              },
            },
          ]

          sampleBrands.forEach((brand: string) => {
            const bgColor = getBrandColor(brand)

            headerRow1.push({
              text: brand,
              options: {
                colspan: sampleTenures.length,
                fill: bgColor,
                color: 'FFFFFF',
                bold: true,
                align: 'center',
                valign: 'middle',
                fontSize: 8,
                fontFace: 'Arial',
                wrap: true,
                border: [
                  { color: '000000', pt: 1 },
                  { color: bgColor, pt: 1 },
                  { color: '000000', pt: 1 },
                  { color: bgColor, pt: 1 },
                ],
              },
            })

            headerRow1.push({
              text: `${brand} Total`,
              options: {
                fill: lightGrayBg,
                color: '000000',
                bold: true,
                align: 'center',
                valign: 'middle',
                fontSize: 8,
                border: [
                  { color: '000000', pt: 1 },
                  { color: '000000', pt: 1 },
                  { color: '000000', pt: 1 },
                  { color: '000000', pt: 1 },
                ],
              },
            })
          })

          headerRow1.push({
            text: 'Grand Total',
            options: {
              fill: lightGrayBg,
              color: '000000',
              bold: true,
              align: 'center',
              valign: 'middle',
              fontSize: 8,
              border: [
                { color: '000000', pt: 1 },   // top — solid black
                { color: '000000', pt: 1 },   // right
                { color: lightGrayBg, pt: 1 },// bottom — invisible (row2 draws its own top)
                { color: '000000', pt: 1 },   // left
              ],
            },
          })
          // ── Row 2 Sub-headers ──
          const headerRow2: any[] = [
            {
              text: '',
              options: {
                fill: lightBlueBg,
                border: [
                  { color: '000000', pt: 1 },
                  { color: '000000', pt: 1 },
                  { color: '000000', pt: 1 },
                  { color: '000000', pt: 1 },
                ],
              },
            },
          ]


          sampleBrands.forEach((brand: string) => {
            sampleTenures.forEach((tenure: string) => {
              headerRow2.push({
                text: tenure,
                options: {
                  fill: lightBlueBg,
                  color: '000000',
                  bold: true,
                  align: 'center',
                  valign: 'middle',
                  fontSize: 8,
                  border: [
                    { color: '000000', pt: 1 },
                    { color: '000000', pt: 1 },
                    { color: '000000', pt: 1 },
                    { color: '000000', pt: 1 },
                  ],
                },
              })
            })
            headerRow2.push({
              text: 'Total',
              options: {
                fill: lightGrayBg,
                color: '000000',
                bold: true,
                align: 'center',
                valign: 'middle',
                fontSize: 8,
                border: [
                  { color: '000000', pt: 1 },
                  { color: '000000', pt: 1 },
                  { color: '000000', pt: 1 },
                  { color: '000000', pt: 1 },
                ],
              },
            })
          })

          headerRow2.push({
            text: '',
            options: {
              fill: lightGrayBg,
              border: [
                { color: '000000', pt: 1 },
                { color: '000000', pt: 1 },
                { color: '000000', pt: 1 },
                { color: '000000', pt: 1 },
              ],
            },
          })

          const allRows: any[][] = [headerRow1, headerRow2]

          citiesRows.forEach((row: any) => {
            const dataRow: any[] = [
              { text: String(row.city || ''), options: { align: 'center', bold: true, fontSize: 8 } }
            ]

            sampleBrands.forEach((brand: string) => {
              const brandTotKey = `${brand}_total`
              const brandTotalVal = row[brandTotKey] ?? row[`${brand.split('/')[0].trim()}_total`] ?? 0

              sampleTenures.forEach((tenure: string) => {
                const key = `${brand}_${tenure}`
                const val = row[key] ?? row[`${brand}_${tenure.replace(/\s+/g, '')}`] ?? 0
                dataRow.push({ text: String(val), options: { align: 'center', fontSize: 8 } })
              })

              dataRow.push({ text: String(brandTotalVal), options: { align: 'center', bold: true, fill: 'F8FAFC', fontSize: 8 } })
            })

            const gTotal = row.grand_total ?? row.grandTotal ?? 0
            dataRow.push({ text: String(gTotal), options: { align: 'center', bold: true, fill: 'F8FAFC', fontSize: 8 } })

            allRows.push(dataRow)
          })

          const gtRow: any[] = [
            { text: 'Grand Total', options: { align: 'center', bold: true, fill: lightBlueBg, fontSize: 8 } }
          ]

          sampleBrands.forEach((brand: string) => {
            const brandTotKey = `${brand}_total`
            const brandTotalVal = grandTotalRow[brandTotKey] ?? grandTotalRow[`${brand.split('/')[0].trim()}_total`] ?? 0

            sampleTenures.forEach((tenure: string) => {
              const key = `${brand}_${tenure}`
              const val = grandTotalRow[key] ?? grandTotalRow[`${brand}_${tenure.replace(/\s+/g, '')}`] ?? 0
              gtRow.push({ text: String(val), options: { align: 'center', bold: true, fill: lightBlueBg, fontSize: 8 } })
            })

            gtRow.push({ text: String(brandTotalVal), options: { align: 'center', bold: true, fill: lightBlueBg, fontSize: 8 } })
          })

          const overallGrand = grandTotalRow.grand_total ?? grandTotalRow.grandTotal ?? 0
          gtRow.push({ text: String(overallGrand), options: { align: 'center', bold: true, fill: lightBlueBg, fontSize: 8 } })

          allRows.push(gtRow)

          // ── Proportional colW (fits slide regardless of brand count) ──
          const targetTableWidth = 9.4
          const cityRatio = 0.85
          const tenureRatio = 0.72
          const brandTotalRatio = 0.95
          const grandTotalRatio = 1.3

          const rawTotal = cityRatio
            + sampleBrands.length * (sampleTenures.length * tenureRatio + brandTotalRatio)
            + grandTotalRatio

          const scale = targetTableWidth / rawTotal

          const cityColW = +(cityRatio * scale).toFixed(3)
          const tenureColW = +(tenureRatio * scale).toFixed(3)
          const brandTotalColW = +(brandTotalRatio * scale).toFixed(3)
          const grandTotalColW = +(grandTotalRatio * scale).toFixed(3)

          const colW = [
            cityColW,
            ...sampleBrands.flatMap(() => [
              ...sampleTenures.map(() => tenureColW),
              brandTotalColW
            ]),
            grandTotalColW
          ]

          const tableWidth = colW.reduce((a, b) => a + b, 0)

          // ── Explicit row heights so we can precisely overlay text on row 1 ──
          const headerRowH = 0.4   // taller to comfortably fit 2-line brand names
          const subHeaderRowH = 0.3
          const dataRowH = 0.25
          const rowH = [headerRowH, subHeaderRowH, ...citiesRows.map(() => dataRowH), dataRowH]

          const tableX = 0.3
          const tableY = 1.2

          slideSample.addTable(allRows, {
            x: tableX, y: tableY, w: tableWidth,
            border: { type: 'solid', color: '000000', size: 1 },
            fontSize: 8,
            fontFace: 'Arial',
            colW: colW,
            rowH: rowH,
            align: 'center',
          })

          // ── Overlay brand name text boxes, centered over each merged block ──

        }
      } catch (e: any) {
        console.error('[PPT] SLIDE LOCATION SAMPLE ERROR:', e)
      }

      // ─── SLIDE 2: Age Group Distribution & City Cross-tabulation ──
      setPptProgress('Generating Slide 2: Age Group Distribution & City Cross-tabulation...')
      const slide2 = pptx.addSlide()
      slide2.background = { fill: 'FFFFFF' }

      addSlideTitle(slide2, 'Age Group Distribution & City Cross-tabulation', 'Distribution of respondents by age category and city')

      try {
        if (analytics.age_group && Array.isArray(analytics.age_group.brands) && analytics.age_group.brands.length > 0) {
          addMatrixTable(slide2, analytics.age_group, 'Age Group', 0.3, 1.3, 4.6, 1.8)

          slide2.addText('Age Group Distribution Chart', {
            x: 5.1, y: 1.2, w: 4.6, h: 0.2,
            fontSize: 9, bold: true, color: '6C63FF', align: 'center'
          })
          addVerticalBarChart(slide2, analytics.age_group, 5.1, 1.4, 4.6, 1.75, undefined, 'percent')
        }

        if (analytics.age_city && Array.isArray(analytics.age_city.brands) && analytics.age_city.brands.length > 0) {
          slide2.addText('Age Group by City & Brand (Cross-tabulation)', {
            x: 0.3, y: 3.25, w: 9.4, h: 0.2,
            fontSize: 10, bold: true, color: '1E293B', align: 'center'
          })
          addAgeCityTableFullWidth(slide2, analytics.age_city, 0.3, 3.5, 9.4, 3.35)
        }
      } catch (e: any) {
        console.error('[PPT] SLIDE 2 ERROR:', e);
        slide2.addText(`Slide 2 error: ${e?.message}`, {
          x: 0.3, y: 2.0, w: 9.4, h: 0.5,
          fontSize: 10, color: 'CC0000', align: 'center'
        })
      }
      // ─── SLIDE 3: Mode of Purchase & Ownership ──────────────────
      setPptProgress('Generating Slide 3: Mode of Purchase & Ownership...')
      const slide3 = pptx.addSlide()
      slide3.background = { fill: 'FFFFFF' }

      addSlideTitle(slide3, 'Mode of Purchase & Ownership', 'Purchase channel preferences & ownership distribution')

      try {
        if (analytics.mode_of_purchase && Array.isArray(analytics.mode_of_purchase.brands) && analytics.mode_of_purchase.brands.length > 0) {
          slide3.addText('Mode of Purchase', {
            x: 0.3, y: 1.3, w: 4.4, h: 0.2,
            fontSize: 10, bold: true, color: '1E293B', align: 'center'
          })
          addMatrixTable(slide3, analytics.mode_of_purchase, 'Mode of Purchase', 0.3, 1.55, 4.4, 1.4)

          slide3.addText('Mode of Purchase Chart', {
            x: 0.3, y: 2.98, w: 4.4, h: 0.18,
            fontSize: 8, bold: true, color: '6C63FF', align: 'center'
          })
          addVerticalBarChart(slide3, analytics.mode_of_purchase, 0.3, 3.18, 4.4, 2.0, undefined, 'percent')
        }

        if (analytics.ownership && Array.isArray(analytics.ownership.brands) && analytics.ownership.brands.length > 0) {
          slide3.addText('Ownership', {
            x: 5.3, y: 1.3, w: 4.4, h: 0.2,
            fontSize: 10, bold: true, color: '1E293B', align: 'center'
          })
          addMatrixTable(slide3, analytics.ownership, 'Ownership', 5.3, 1.55, 4.4, 1.4)

          slide3.addText('Ownership Chart', {
            x: 5.3, y: 2.98, w: 4.4, h: 0.18,
            fontSize: 8, bold: true, color: '6C63FF', align: 'center'
          })
          addVerticalBarChart(slide3, analytics.ownership, 5.3, 3.18, 4.4, 2.0, undefined, 'percent')
        }
      } catch (e: any) {
        console.error('[PPT] SLIDE 3 ERROR:', e);
      }

      // ─── SLIDE 4: User Profession Distribution ──────────────────
      setPptProgress('Generating Slide 4: User Profession Distribution...')
      const slide4 = pptx.addSlide()
      slide4.background = { fill: 'FFFFFF' }
      addSlideTitle(slide4, 'User Profession Distribution', 'Professional background of survey respondents')

      try {
        let profMatrix = analytics.profession || analytics.professions
        if (!profMatrix) {
          const professionKey = Object.keys(analytics).find(key => key.toLowerCase().includes('profession'))
          if (professionKey) profMatrix = analytics[professionKey]
        }

        const hasProfData = profMatrix && typeof profMatrix === 'object' && !Array.isArray(profMatrix) && profMatrix.brands && Array.isArray(profMatrix.brands) && profMatrix.brands.length > 0

        if (hasProfData) {
          slide4.addText('Profession Distribution', {
            x: 0.3, y: 1.0, w: 4.4, h: 0.25,
            fontSize: 10, bold: true, color: '1E293B', align: 'center'
          })

          if (Array.isArray(profMatrix.table) && profMatrix.table.length > 0) {
            addMatrixTable(slide4, profMatrix, 'Profession', 0.5, 1.3, 4.4, 3.8, true)
          }

          slide4.addText('Profession Distribution by Brand', {
            x: 5.3, y: 1.0, w: 4.4, h: 0.25,
            fontSize: 9, bold: true, color: '6C63FF', align: 'center'
          })
          addVerticalBarChart(slide4, profMatrix, 5.3, 1.3, 4.4, 3.8, undefined, 'percent')
        }
      } catch (e: any) {
        console.error('[PPT] SLIDE 4 ERROR:', e)
      }

      // ─── DIVIDER 2: Service Dashboard ───
      //addDividerSlide('Service Dashboard')

      // ─── SPECIFIC CORPORATE SLIDE RENDERER ONLY FOR SLIDES 6 & 7 (SERVICE SECTIONS) ───
      const renderCorporateServiceSlide = (
        sectionTitle: string,
        questionText: string,
        freqData: any
      ) => {
        const slide = pptx.addSlide()
        slide.background = { fill: 'FFFFFF' }

        // Slide Outer Border
        slide.addShape(pptx.ShapeType.rect, {
          x: 0.05, y: 0.05, w: 9.9, h: 5.525,
          fill: { color: 'FFFFFF', transparency: 100 },
          line: { color: 'E2E8F0', width: 0.5 }
        })

        // Header Top Left
        slide.addText("Respondent Profile Demographic", {
          x: 0.4, y: 0.16, w: 7.2, h: 0.32,
          fontSize: 24, bold: true, color: '1E1B4B', fontFace: 'Arial'
        })
        slide.addText(questionText, {
          x: 0.4, y: 0.50, w: 7.2, h: 0.32,
          fontSize: 18, bold: true, color: '1E1B4B', fontFace: 'Arial'
        })

        // Header Top Right Logo
        slide.addImage({
          path: '/assets/logo.png',
          x: 8.6, y: 0.16, w: 1.1, h: 0.52
        })

        // Decorative Rainbow Line
        const rainbowColors = ['00B4D8', 'F97316', '7C3AED', 'EC4899', '10B981', 'F59E0B', '06B6D4']
        const totalLineWidth = 9.3
        const segWidth = totalLineWidth / rainbowColors.length
        rainbowColors.forEach((color, idx) => {
          slide.addShape(pptx.ShapeType.rect, {
            x: 0.35 + idx * segWidth, y: 0.86, w: segWidth, h: 0.025,
            fill: { color: color },
            line: { transparency: 100 }
          })
        })

        // Chart Container (Rounded Rectangle)
        slide.addShape(pptx.ShapeType.rect, {
          x: 0.35, y: 0.95, w: 9.3, h: 4.45,   // 0.95 → 5.40, spans through table bottom
          fill: { color: 'F4F8FC' },
          line: { color: 'E2E8F0', width: 0.75 }
        })
        // Chart Container Title Box
        slide.addShape(pptx.ShapeType.rect, {
          x: 3.95, y: 0.98, w: 2.1, h: 0.24,          // was y: 1.01, h: 0.30
          fill: { color: 'FFFFFF' },
          line: { color: 'CBD5E1', width: 0.75 }
        })
        slide.addText(sectionTitle, {
          x: 3.95, y: 0.98, w: 2.1, h: 0.24,          // was y: 1.01, h: 0.30
          fontSize: 11, bold: true, color: '000000', align: 'center', valign: 'middle', fontFace: 'Arial'   // was fontSize: 15
        })

        const categories = freqData?.categories || []
        const brandBreakdown = freqData?.brand_breakdown || []
        const rawBrands = brandBreakdown.length > 0
          ? brandBreakdown.map((b: any) => b.brand)
          : (analytics?.age_group?.brands || ['TVS', 'HONDA', 'YAMAHA'])
        const orderedBrands = getOrderedBrands(rawBrands)


        const brandColors = getBrandColorsArray(orderedBrands)
        // Native PPT Chart Generation
        if (categories.length > 0 && orderedBrands.length > 0) {
          const catLabels = categories.map((c: any) => String(c.category || ''))
          const chartSeries = orderedBrands.map((bName: string) => {
            const brandObj = brandBreakdown.find((item: any) => item.brand === bName)
            const values = categories.map((c: any) => {
              const match = brandObj?.categories?.find((item: any) => item.category === c.category)
              return match ? Math.round(match.percentage || 0) : 0
            })
            return {
              name: bName,
              labels: catLabels,
              values: values
            }
          })

          try {
            slide.addChart(pptx.ChartType.bar, chartSeries, {
              x: 0.45,
              y: 1.24,                    // was y: 1.35 — chart starts higher
              w: 9.1,
              h: 2.15,
              barDir: 'col',          // ← vertical bars, this is what makes it a "column" chart
              chartColors: brandColors,
              chartColorsOpacity: 100,
              showTitle: false,
              showLegend: true,
              legendPos: 't',
              legendFontSize: 6.5,
              legendFontFace: 'Arial',
              catAxisLabelFontSize: 8.5,
              catAxisLabelColor: '475569',
              catAxisLabelFontFace: 'Arial',
              catGridLine: { style: 'none' },
              valGridLine: { style: 'none' },
              valAxisHidden: false,
              valAxisLineShow: true,
              catAxisLineShow: true,
              showValue: true,
              dataLabelFormatCode: '0"%"',
              dataLabelFontSize: 8,
              dataLabelColor: '333333',
              dataLabelFontFace: 'Arial',
              dataLabelPosition: 'outEnd',
              barGapWidthPct: 150,
              barOverlapPct: -30,
            })
          } catch (chartErr) {
            console.error('Error adding native PPT chart:', chartErr)
            // add a visible fallback so future bugs don't silently disappear
            slide.addText('Chart could not be rendered', {
              x: 0.45, y: 1.35, w: 9.1, h: 2.18,
              fontSize: 12, color: 'CC0000', align: 'center', valign: 'middle',
            })
          }
        } else {
          slide.addText(`No ${sectionTitle} data available for the active filters.`, {
            x: 0.5, y: 1.8, w: 9.0, h: 1.0,
            fontSize: 13, bold: true, color: '94A3B8', align: 'center', valign: 'middle', fontFace: 'Arial'
          })
        }

        // Table Below Chart Container (aligned at x: 0.35, w: 9.3 to match chart container)
        const tableX = 0.35
        const tableY = 3.55
        const tableW = 9.3
        const tableH = 1.85

        const tableRows: any[][] = []

        // Header Row
        const headerRow: any[] = [
          {
            text: sectionTitle === 'KMS Frequency' ? 'Kms frequency' : 'Time frequency',
            options: { bold: true, fill: NEUTRAL_GREY, color: 'FFFFFF', align: 'center', valign: 'middle', fontSize: 6.5 }
            //              was: fill: '1871C9'  ↑
          }
        ]
        orderedBrands.forEach((b: string, i: number) => {
          headerRow.push({
            text: b,
            options: { bold: true, fill: brandColors[i], color: 'FFFFFF', align: 'center', valign: 'middle', fontSize: 8.5 }
          })
        })
        tableRows.push(headerRow)

        if (categories.length > 0) {
          // Data Rows
          categories.forEach((catItem: any) => {
            const rowCells: any[] = [
              {
                text: String(catItem.category),
                options: { bold: false, fill: 'FFFFFF', color: '1E293B', align: 'left', valign: 'middle', fontSize: 8 }
              }
            ]

            orderedBrands.forEach((b: string) => {
              const brandObj = brandBreakdown.find((item: any) => item.brand === b)
              const match = brandObj?.categories?.find((item: any) => item.category === catItem.category)
              const count = match ? match.count : 0

              rowCells.push({
                text: String(count),
                options: { bold: false, fill: 'FFFFFF', color: '1E293B', align: 'center', valign: 'middle', fontSize: 8 }
              })
            })

            tableRows.push(rowCells)
          })

          // Grand Total Row
          const grandTotalRow: any[] = [
            {
              text: 'Grand Total',
              options: { bold: true, fill: NEUTRAL_GREY, color: 'FFFFFF', align: 'center', valign: 'middle', fontSize: 8.5 }
              //              was: fill: '1871C9'  ↑
            }
          ]
          orderedBrands.forEach((b: string, i: number) => {
            const brandObj = brandBreakdown.find((item: any) => item.brand === b)
            const bTotal = brandObj ? brandObj.total : 0
            grandTotalRow.push({
              text: String(bTotal),
              options: { bold: true, fill: brandColors[i], color: 'FFFFFF', align: 'center', valign: 'middle', fontSize: 8.5 }
            })
          })
          tableRows.push(grandTotalRow)
        } else {
          const emptyRow: any[] = [
            {
              text: 'No data available for current filters',
              options: { bold: false, fill: 'FFFFFF', color: '94A3B8', align: 'center', valign: 'middle', fontSize: 8 }
            }
          ]
          orderedBrands.forEach(() => {
            emptyRow.push({
              text: '-',
              options: { bold: false, fill: 'FFFFFF', color: '94A3B8', align: 'center', valign: 'middle', fontSize: 8 }
            })
          })
          tableRows.push(emptyRow)
        }

        const numCols = Math.max(1, tableRows[0]?.length || 1)
        const catColW = 2.4
        const brandColW = numCols > 1 ? (tableW - catColW) / (numCols - 1) : tableW
        const colWidths = numCols > 1 ? [catColW, ...Array(numCols - 1).fill(brandColW)] : [catColW]

        slide.addTable(tableRows, {
          x: tableX, y: tableY, w: tableW, h: tableH,
          border: { type: 'solid', color: 'D1D5DB', size: 0.5 },
          fontSize: 8,
          fontFace: 'Arial',
          colW: colWidths,
          rowH: tableRows.map(() => 0.22),
          valign: 'middle',
        })
      }

      // ─── SLIDE 6: Service Frequency by KMS ───
      setPptProgress('Generating Slide 6: Service Frequency by KMS...')
      renderCorporateServiceSlide(
        'KMS Frequency',
        'What KMS frequency do you get your vehicle serviced?',
        kmsDataAll
      )

      // ─── SLIDE 7: Service Frequency by Time ───
      setPptProgress('Generating Slide 7: Service Frequency by Time...')
      renderCorporateServiceSlide(
        'Time Frequency',
        'What time frequency do you get your vehicle serviced?',
        timeDataAll
      )

      // ─── DIVIDER: Section A ───

      // ─── DIVIDER: Authorized Workshop NPS ───
      addDividerSlide('Authorized Workshop NPS')

      // ─── SLIDE: Authorized Workshop Recommendation (Brand-wise) ───
      setPptProgress('Generating Slide: Authorized Workshop Recommendation...')
      const slideAuthRec = pptx.addSlide()
      addSlideTitle(
        slideAuthRec,
        'Will you recommend your friends / family members for servicing their vehicle at Authorized service workshop?',
        ''
      )

      const authBreakdown = serviceNpsData?.authorized?.brand_breakdown || []
      const rawAuthBrands = authBreakdown.map((b: any) => b.brand)
      const orderedAuthBrands = getOrderedBrands(rawAuthBrands)

      // Compact Model Base table — smaller footprint, positioned a bit higher, no Total row
      const tableStartY = 1.05
      const tableRowH = 0.22
      const tableColModelW = 1.5
      const tableColBaseW = 0.7

      slideAuthRec.addText('Model', {
        x: 0.3, y: tableStartY, w: tableColModelW, h: tableRowH,
        fill: 'E0E0E0', color: '333333', bold: true, align: 'left', fontSize: 8,
        border: { type: 'solid', color: 'CCCCCC', pt: 1 },
        line: { color: 'CCCCCC', width: 1 }
      })
      slideAuthRec.addText('Base', {
        x: 0.3 + tableColModelW, y: tableStartY, w: tableColBaseW, h: tableRowH,
        fill: 'E0E0E0', color: '333333', bold: true, align: 'center', fontSize: 8,
        border: { type: 'solid', color: 'CCCCCC', pt: 1 },
        line: { color: 'CCCCCC', width: 1 }
      })

      let currentY = tableStartY + tableRowH
      orderedAuthBrands.forEach((brand) => {
        const brandData = authBreakdown.find((d: any) => d.brand === brand)
        const base = brandData ? brandData.total_responses : 0

        slideAuthRec.addText(brand, {
          x: 0.3, y: currentY, w: tableColModelW, h: tableRowH,
          fill: getBrandColor(brand), color: 'FFFFFF', bold: true, align: 'left', fontSize: 8,
          border: { type: 'solid', color: 'CCCCCC', pt: 1 },
          line: { color: 'CCCCCC', width: 1 }
        })
        slideAuthRec.addText(String(base), {
          x: 0.3 + tableColModelW, y: currentY, w: tableColBaseW, h: tableRowH,
          color: '333333', align: 'center', fontSize: 8,
          border: { type: 'solid', color: 'CCCCCC', pt: 1 },
          line: { color: 'CCCCCC', width: 1 }
        })
        currentY += tableRowH
      })

      // Brand-wise Recommendation Pie Charts — placed below the Model Base table
      const pieCount = orderedAuthBrands.length
      const pieSize = 2.0
      const pieGap = 0.3
      const totalPieWidth = pieCount * pieSize + (pieCount - 1) * pieGap
      const slideContentWidth = 9.4 // available width between left/right margins
      let pieX = 0.3 + Math.max(0, (slideContentWidth - totalPieWidth) / 2)
      const pieStartY = currentY + 0.35

      orderedAuthBrands.forEach((brand) => {
        const brandData = authBreakdown.find((d: any) => d.brand === brand)
        if (brandData && (brandData.recommend_yes > 0 || brandData.recommend_no > 0)) {
          const chartData = [
            { name: 'Recommendation', labels: ['Yes', 'No'], values: [brandData.recommend_yes, brandData.recommend_no] }
          ]

          slideAuthRec.addText(brand, {
            x: pieX, y: pieStartY, w: pieSize, h: 0.35,
            color: '1E293B', bold: true, align: 'center', fontSize: 9, fontFace: 'Arial'
          })

          slideAuthRec.addChart(pptx.charts.PIE, chartData, {
            x: pieX, y: pieStartY + 0.2, w: pieSize, h: pieSize,
            showLegend: true,
            legendPos: 'b',
            legendFontSize: 9,
            showTitle: false,
            dataLabelFormatCode: '0%',
            showValue: false,
            showPercent: true,
            dataLabelColor: 'FFFFFF',
            dataLabelFontSize: 8,
            dataLabelFontFace: 'Arial',
            dataLabelPosition: 'ctr',
            chartColors: ['4CAF50', 'F44336'],
            chartColorsOpacity: 100,
          })

          pieX += pieSize + pieGap
        }
      })

      // ─── HELPER: Render Service NPS Overall Based on Workshop Slide ───
      const renderServiceNpsOverallSlide = (
        workshopKey: 'authorized' | 'pgm',
        sectionTitle: string = 'Service NPS Overall Based on Workshop'
      ) => {
        setPptProgress(`Generating Slide: ${sectionTitle} (${workshopKey.toUpperCase()})...`)
        const workshopData = serviceNpsData?.[workshopKey] || {}
        const breakdown = workshopData?.brand_breakdown || []
        const rawBrands = breakdown.map((b: any) => b.brand)
        const orderedBrands = getOrderedBrands(rawBrands.length > 0 ? rawBrands : (analytics?.age_group?.brands || ['TVS', 'HONDA', 'YAMAHA']))

        const slideNpsOverall = pptx.addSlide()
        slideNpsOverall.background = { fill: 'FFFFFF' }
        addSlideTitle(slideNpsOverall, sectionTitle, '')

        // ─── Model / Base table (top-left) — compact, moved up ───
        const tableStartYOverall = 1.05
        const headerHOverall = 0.28
        const modelColWOverall = 1.3
        const baseColWOverall = 0.6

        slideNpsOverall.addText('MODEL', {
          x: 0.3, y: tableStartYOverall, w: modelColWOverall, h: headerHOverall,
          fill: 'BEBEBE', color: '333333', bold: true, align: 'center', valign: 'middle', fontSize: 8,
          border: { type: 'solid', color: 'CCCCCC', pt: 1 },
          line: { color: 'CCCCCC', width: 1 }
        })
        slideNpsOverall.addText('BASE', {
          x: 0.3 + modelColWOverall, y: tableStartYOverall, w: baseColWOverall, h: headerHOverall,
          fill: 'BEBEBE', color: '333333', bold: true, align: 'center', valign: 'middle', fontSize: 8,
          border: { type: 'solid', color: 'CCCCCC', pt: 1 },
          line: { color: 'CCCCCC', width: 1 }
        })

        const tableRowHOverall = 0.22
        let modelRowYOverall = tableStartYOverall + headerHOverall
        orderedBrands.forEach((brand) => {
          const bd = breakdown.find((d: any) => d.brand === brand)
          const base = bd ? bd.total_responses : 0
          slideNpsOverall.addText(brand, {
            x: 0.3, y: modelRowYOverall, w: modelColWOverall, h: tableRowHOverall,
            fill: getBrandColor(brand), color: 'FFFFFF', bold: true, align: 'center', valign: 'middle', fontSize: 8,
            border: { type: 'solid', color: 'CCCCCC', pt: 1 },
            line: { color: 'CCCCCC', width: 1 }
          })
          slideNpsOverall.addText(String(base), {
            x: 0.3 + modelColWOverall, y: modelRowYOverall, w: baseColWOverall, h: tableRowHOverall,
            fill: 'FFFFFF', color: '333333', bold: true, align: 'center', valign: 'middle', fontSize: 8,
            border: { type: 'solid', color: 'CCCCCC', pt: 1 },
            line: { color: 'CCCCCC', width: 1 }
          })
          modelRowYOverall += tableRowHOverall
        })
        const tableBottomYOverall = modelRowYOverall

        const overallCount = workshopData?.total_responses || 0
        const labelName = workshopKey === 'authorized' ? 'Overall Authorized Workshop' : 'Overall PGM Workshop'
        slideNpsOverall.addText(`${labelName} : ${overallCount}`, {
          x: 0.3,
          y: tableBottomYOverall + 3.0,
          w: 2.2,
          h: 0.32,

          color: '1E293B',
          bold: true,
          align: 'center',
          valign: 'middle',
          fontSize: 7,
          fontFace: 'Arial'
        })

        // ─── Badges (top-center, stacked) ───
        slideNpsOverall.addText('BEST IN MARKET', {
          x: 3.7, y: 0.95, w: 2.6, h: 0.28,
          fill: '4CAF50', color: 'FFFFFF', bold: true, align: 'center', valign: 'middle', fontSize: 10
        })
        slideNpsOverall.addText('SCOPE OF IMPROVEMENT', {
          x: 3.7, y: 1.25, w: 2.6, h: 0.28,
          fill: 'F44336', color: 'FFFFFF', bold: true, align: 'center', valign: 'middle', fontSize: 10
        })

        // ─── Legend ───
        const NPS_COLORS_OVERALL = ['4CAF50', 'FFC107', 'F44336']
        const legendItemsOverall = [
          { label: 'Promoter', color: NPS_COLORS_OVERALL[0] },
          { label: 'Passive', color: NPS_COLORS_OVERALL[1] },
          { label: 'Detractor', color: NPS_COLORS_OVERALL[2] },
        ]
        const LEGEND_BOX_OVERALL = 0.10
        const LEGEND_FONT_OVERALL = 8
        const legendItemWOverall = 0.9
        const legendTotalWOverall = legendItemsOverall.length * legendItemWOverall
        let legendXOverall = (10 - legendTotalWOverall) / 2 + 0.15
        const legendYOverall = 1.65

        legendItemsOverall.forEach((item) => {
          slideNpsOverall.addShape(pptx.ShapeType.rect, {
            x: legendXOverall, y: legendYOverall, w: LEGEND_BOX_OVERALL, h: LEGEND_BOX_OVERALL,
            fill: { color: item.color }, line: { color: item.color, transparency: 100 }
          })
          slideNpsOverall.addText(item.label, {
            x: legendXOverall + 0.16, y: legendYOverall - 0.05, w: 0.75, h: 0.22,
            color: '333333', fontSize: LEGEND_FONT_OVERALL, align: 'left', valign: 'middle', fontFace: 'Calibri'
          })
          legendXOverall += legendItemWOverall
        })

        // ─── Overall Label ───
        const overallYPos = 1.97
        const overallHPos = 0.25
        slideNpsOverall.addText('Overall', {
          x: 3.9, y: overallYPos, w: 2.6, h: overallHPos,
          color: '1E293B', bold: true, align: 'center', fontSize: 10, fontFace: 'Calibri'
        })
        const overallBottomYPos = overallYPos + overallHPos

        // ─── Build chart data ───
        const chartDataOverall: any[] = [
          { name: 'Promoter', labels: [], values: [] },
          { name: 'Passive', labels: [], values: [] },
          { name: 'Detractor', labels: [], values: [] },
        ]
        const npsScoresOverall: { brand: string; nps: number }[] = []

        orderedBrands.forEach((brand) => {
          const bd = breakdown.find((d: any) => d.brand === brand)
          const promPct = bd ? Math.round(bd.promoters_pct || 0) : 0
          const passPct = bd ? Math.round(bd.passives_pct || 0) : 0
          const detrPct = bd ? Math.round(bd.detractors_pct || 0) : 0
          const npsScore = bd ? Math.round(bd.nps_score || 0) : 0

          chartDataOverall[0].labels.push(brand); chartDataOverall[0].values.push(promPct)
          chartDataOverall[1].labels.push(brand); chartDataOverall[1].values.push(passPct)
          chartDataOverall[2].labels.push(brand); chartDataOverall[2].values.push(detrPct)

          npsScoresOverall.push({ brand, nps: npsScore })
        })

        const bestBrandOverall = npsScoresOverall.length > 0
          ? npsScoresOverall.reduce((best, cur) => (cur.nps > best.nps ? cur : best), npsScoresOverall[0])
          : null

        const npsBoxYOverall = Math.max(tableBottomYOverall, overallBottomYPos) + 0.2
        const npsBoxHOverall = 0.4
        const chartGapOverall = 0.15
        const barsTopYOverall = npsBoxYOverall + npsBoxHOverall + chartGapOverall

        const chartWOverall = 7.2
        const chartXOverall = (10 - chartWOverall) / 2
        const barsHOverall = 2.2
        const numBrandsOverall = orderedBrands.length

        const PLOT_LAYOUT_OVERALL = { x: 0.02, y: 0.08, w: 0.96, h: 0.72 }

        slideNpsOverall.addChart(pptx.charts.BAR, chartDataOverall, {
          x: chartXOverall, y: barsTopYOverall, w: chartWOverall, h: barsHOverall,
          layout: PLOT_LAYOUT_OVERALL,
          barDir: 'col',
          barGrouping: 'clustered',
          showLegend: false,
          showTitle: false,
          chartColors: NPS_COLORS_OVERALL,
          showValue: true,
          dataLabelPosition: 'outEnd',
          dataLabelFontSize: 9,
          dataLabelFontFace: 'Arial',
          dataLabelColor: '333333',
          dataLabelFormatCode: '0"%"',
          valAxisHidden: false,
          valAxisLineShow: false,
          valAxisLineColor: '6a6a6a',
          valAxisLabelFontSize: 8,
          valAxisLabelColor: '1E293B',
          valAxisLabelFormatCode: '0"%"',
          valAxisLabelPos: 'none',
          valAxisMajorTickMark: 'none',
          valAxisMinorTickMark: 'none',
          valAxisMaxVal: 100,
          valAxisMinVal: 0,
          valGridLine: { style: 'none' },
          catAxisLineShow: true,
          catAxisLineColor: '6a6a6a',
          catAxisLabelPos: 'low',
          catAxisLabelFontSize: 8,
          barGapWidthPct: 180,
          barOverlapPct: -35,
        })

        // ─── NPS score boxes above chart ───
        const plotXOverall = chartXOverall + PLOT_LAYOUT_OVERALL.x * chartWOverall
        const plotWOverall = PLOT_LAYOUT_OVERALL.w * chartWOverall
        const groupWOverall = plotWOverall / Math.max(1, numBrandsOverall)

        npsScoresOverall.forEach((item, idx) => {
          const boxW = Math.min(1.4, groupWOverall * 0.85)
          const boxX = plotXOverall + idx * groupWOverall + (groupWOverall - boxW) / 2
          const isBest = bestBrandOverall ? item.brand === bestBrandOverall.brand : false
          const isTvsBest = isBest && !!bestBrandOverall && bestBrandOverall.brand.includes('TVS')
          const boxColor = isBest ? (isTvsBest ? '4CAF50' : 'F44336') : '999999'

          slideNpsOverall.addText(`NPS ${item.nps}%`, {
            x: boxX, y: npsBoxYOverall, w: boxW, h: npsBoxHOverall,
            fill: boxColor, color: 'FFFFFF', bold: true, align: 'center', valign: 'middle', fontSize: 10
          })
        })
      }

      // ─── SLIDE: Authorized Service NPS Overall Based on Workshop ───
      renderServiceNpsOverallSlide('authorized', 'Service NPS Overall Based on Workshop')

      // ─── DIVIDER: Benefits & Betterments ───
      addDividerSlide('Benefits & Betterments')

      // Helper function to generate Benefits & Betterments slides matching handleDownloadPPT corporate layout
      const renderCorporateBenefitsBettermentsSlides = (
        sectionName: string,
        sectionKey: 'authorized' | 'pgm'
      ) => {
        const rawBenefitsData = serviceBenefitsData?.data || serviceBenefitsData || {}
        const secData = rawBenefitsData?.[sectionKey] || {
          sample_size: 0,
          overall: { top_benefits: [], top_issues: [], brand_benefits: {}, brand_issues: {} },
          promoter: { top_benefits: [], top_issues: [], brand_benefits: {}, brand_issues: {} },
          passive: { top_benefits: [], top_issues: [], brand_benefits: {}, brand_issues: {} },
          detractor: { top_benefits: [], top_issues: [], brand_benefits: {}, brand_issues: {} },
        }

        const sampleSize = secData.sample_size || 0
        const overall = secData.overall || {}
        const brandBenefits = overall.brand_benefits || {}
        const brandIssues = overall.brand_issues || {}

        // Helper to format items for panel chart
        const formatFeedbackItems = (
          items: any[],
          overallItems: any[],
          isOverallCategory: boolean,
          base: number
        ) => {
          const isJunkTopicName = (name: string) => {
            if (!name) return true
            const s = String(name).trim().toLowerCase()
            if (['blank', 'nil', 'none', 'n/a', 'na', 'null', 'nan', '-', '.', '..'].includes(s)) return true
            if (!isNaN(Number(s))) return true
            const junkWords = [
              'average', 'avg', 'best', 'bad', 'good', 'very good', 'poor', 'very poor',
              'fair', 'excellent', 'satisfied', 'unsatisfied', 'dissatisfied',
              'very satisfied', 'neutral', 'medium', 'high', 'low', 'ok', 'okay',
              'normal', 'strongly agree', 'agree', 'disagree', 'strongly disagree'
            ]
            if (junkWords.includes(s)) return true
            if (s.startsWith('submitform')) return true
            return false
          }

          return (items || [])
            .filter((it: any) => !isJunkTopicName(it.topic || it.issue || it.name))
            .map((it: any) => {
              const itemName = String(it.topic || it.issue || it.name || '')
              const count = Number(it.count || 0)
              let percentage = 0

              // Use pre-computed percentage from backend (divides by correct segment base)
              if (it.percentage !== undefined && it.percentage !== null) {
                percentage = Math.round(Number(it.percentage))
              } else if (isOverallCategory) {
                percentage = base > 0 ? Math.round((count / base) * 100) : 0
              } else {
                const overallMatch = (overallItems || []).find(
                  (o: any) => String(o.topic || o.issue || o.name || '').trim().toLowerCase() === itemName.trim().toLowerCase()
                )
                const totalCount = overallMatch ? Number(overallMatch.count || 0) : count
                percentage = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0
              }

              return {
                name: itemName,
                count: count,
                percentage: percentage,
              }
            })
            .filter((it: any) => it.count > 0 || it.percentage > 0)   // ← add this line  
        }

        // ─── FIXED: renderPanelChart with descending sort ───
        const renderPanelChart = (
          slideObj: any,
          panelX: number,
          panelY: number,
          panelW: number,
          panelH: number,
          items: { name: string; count: number; percentage: number }[],
          isGreen: boolean
        ) => {
          if (!items || items.length === 0) return

          // ─── SORT IN DESCENDING ORDER (largest first) ───
          const sortedItems = [...items].sort((a, b) => b.percentage - a.percentage)
          const top10 = sortedItems.slice(0, 10)

          // ─── REVERSE so largest appears at TOP of chart ───
          const reversed = [...top10].reverse()

          const chartData = [
            {
              name: isGreen ? 'Benefits' : 'Betterment',
              labels: reversed.map((it) => it.name),
              values: reversed.map((it) => it.percentage),
            },
          ]

          const maxVal = Math.max(...chartData[0].values, 10)
          const valAxisMax = Math.min(100, Math.max(20, Math.ceil(maxVal / 10) * 10))

          try {
            slideObj.addChart(pptx.ChartType.bar, chartData, {
              x: panelX + 0.1,
              y: panelY + 0.40,
              w: panelW - 0.2,
              h: panelH - 0.50,
              barDir: 'bar',
              barGrouping: 'standard',
              chartColors: [isGreen ? '28A745' : 'DC3545'],
              showTitle: false,
              showLegend: false,
              showValue: true,
              dataLabelPosition: 'outEnd',
              dataLabelFormatCode: '0"%"',
              dataLabelFontSize: 8,
              dataLabelColor: '1E293B',
              dataLabelFontFace: 'Arial',
              catAxisLabelFontSize: 8,
              catAxisLabelColor: '333333',
              catAxisLineShow: false,
              valAxisLineShow: false,
              valAxisHidden: true,
              valAxisMinVal: 0,
              valAxisMaxVal: valAxisMax,
              valGridLine: { style: 'none' },
              barGapWidthPct: 40,
            })
          } catch (err) {
            console.error('Error adding panel chart:', err)
          }
        }

        // Helper to create a dual-panel slide (Green Benefits on Left, Red Betterment on Right)
        const createFeedbackPanelSlide = (
          slideTitle: string,
          benefitItemsRaw: any[],
          issueItemsRaw: any[],
          overallBenefitItemsRaw: any[],
          overallIssueItemsRaw: any[],
          isOverallCategory: boolean,
          baseCount: number
        ) => {
          // ─── 1. Format data FIRST (before creating the slide) ───
          const formattedBenefits = formatFeedbackItems(
            benefitItemsRaw,
            overallBenefitItemsRaw,
            isOverallCategory,
            baseCount
          )
          const formattedIssues = formatFeedbackItems(
            issueItemsRaw,
            overallIssueItemsRaw,
            isOverallCategory,
            baseCount
          )

          const hasBenefits = formattedBenefits.length > 0
          const hasIssues = formattedIssues.length > 0

          // ─── 2. Skip the slide entirely if both panels are empty ───
          if (!hasBenefits && !hasIssues) return

          // ─── 3. NOW create the slide ───
          setPptProgress(`Generating Slide: ${slideTitle}...`)
          const slideFB = pptx.addSlide()
          slideFB.background = { fill: 'FFFFFF' }
          addSlideTitle(slideFB, slideTitle, '')

          // ─── 4. Layout constants ───
          const SLIDE_CONTENT_X = 0.3
          const SLIDE_CONTENT_W = 9.4
          const PANEL_W = 4.55
          const PANEL_H = 4.25
          const PANEL_Y = 1.0
          const PANEL_GAP = 0.3

          const leftX = SLIDE_CONTENT_X                              // 0.3
          const rightX = SLIDE_CONTENT_X + PANEL_W + PANEL_GAP       // 5.15
          const centeredPanelX = SLIDE_CONTENT_X + (SLIDE_CONTENT_W - PANEL_W) / 2  // 2.725

          // ─── 5. Render panels based on data availability ───
          if (hasBenefits && !hasIssues) {
            // Only Benefits → centered
            slideFB.addShape(pptx.ShapeType.rect, {
              x: centeredPanelX, y: PANEL_Y, w: PANEL_W, h: PANEL_H,
              fill: { color: 'F0FDF4' },
              line: { color: '4ECCA3', width: 1.5 },
            })
            slideFB.addText('AREAS FOR BENEFITS', {
              x: centeredPanelX, y: PANEL_Y, w: PANEL_W, h: 0.35,
              fill: { color: '28A745' },
              color: 'FFFFFF', bold: true, align: 'center', valign: 'middle',
              fontSize: 10, fontFace: 'Arial',
            })
            renderPanelChart(slideFB, centeredPanelX, PANEL_Y, PANEL_W, PANEL_H, formattedBenefits, true)
          } else if (!hasBenefits && hasIssues) {
            // Only Betterments → centered
            slideFB.addShape(pptx.ShapeType.rect, {
              x: centeredPanelX, y: PANEL_Y, w: PANEL_W, h: PANEL_H,
              fill: { color: 'FEF2F2' },
              line: { color: 'FF6584', width: 1.5 },
            })
            slideFB.addText('AREAS FOR BETTERMENT', {
              x: centeredPanelX, y: PANEL_Y, w: PANEL_W, h: 0.35,
              fill: { color: 'DC3545' },
              color: 'FFFFFF', bold: true, align: 'center', valign: 'middle',
              fontSize: 10, fontFace: 'Arial',
            })
            renderPanelChart(slideFB, centeredPanelX, PANEL_Y, PANEL_W, PANEL_H, formattedIssues, false)
          } else {
            // Both present → side-by-side (original layout)
            slideFB.addShape(pptx.ShapeType.rect, {
              x: leftX, y: PANEL_Y, w: PANEL_W, h: PANEL_H,
              fill: { color: 'F0FDF4' },
              line: { color: '4ECCA3', width: 1.5 },
            })
            slideFB.addText('AREAS FOR BENEFITS', {
              x: leftX, y: PANEL_Y, w: PANEL_W, h: 0.35,
              fill: { color: '28A745' },
              color: 'FFFFFF', bold: true, align: 'center', valign: 'middle',
              fontSize: 10, fontFace: 'Arial',
            })

            slideFB.addShape(pptx.ShapeType.rect, {
              x: rightX, y: PANEL_Y, w: PANEL_W, h: PANEL_H,
              fill: { color: 'FEF2F2' },
              line: { color: 'FF6584', width: 1.5 },
            })
            slideFB.addText('AREAS FOR BETTERMENT', {
              x: rightX, y: PANEL_Y, w: PANEL_W, h: 0.35,
              fill: { color: 'DC3545' },
              color: 'FFFFFF', bold: true, align: 'center', valign: 'middle',
              fontSize: 10, fontFace: 'Arial',
            })

            renderPanelChart(slideFB, leftX, PANEL_Y, PANEL_W, PANEL_H, formattedBenefits, true)
            renderPanelChart(slideFB, rightX, PANEL_Y, PANEL_W, PANEL_H, formattedIssues, false)
          }

          // ─── 6. Base footer (only rendered when a slide actually exists) ───
          slideFB.addText(`Base: ${baseCount || 0} respondents`, {
            x: 0.3, y: 5.32, w: 4.0, h: 0.25,
            fontSize: 8.5, color: '64748B', italic: true, fontFace: 'Arial',
          })
        }

        const overallSeg = secData.overall || {}

        // 1. Overall Location Customer Feedback Slides (Location-wide)
        const feedbackCategories: { key: 'overall' | 'promoter' | 'passive' | 'detractor'; titleSuffix: string }[] = [
          { key: 'overall', titleSuffix: 'Overall Customer Feedback' },
          { key: 'promoter', titleSuffix: 'Promoters (Yes) Customer Feedback' },
          { key: 'passive', titleSuffix: 'Passives (Maybe) Customer Feedback' },
          { key: 'detractor', titleSuffix: 'Detractors (No) Customer Feedback' },
        ]

        feedbackCategories.forEach((catConfig) => {
          const segObj = secData[catConfig.key] || {}
          const segBase = segObj.base || sampleSize  // use segment-specific base from backend
          createFeedbackPanelSlide(
            `${sectionName} | ${catConfig.titleSuffix}`,
            segObj.top_benefits || [],
            segObj.top_issues || [],
            overallSeg.top_benefits || [],
            overallSeg.top_issues || [],
            catConfig.key === 'overall',
            segBase
          )
        })

        // 2. Per-Brand Customer Feedback Slides (Each Brand gets 4 category slides)
        const allBrandsSet = new Set<string>()
        feedbackCategories.forEach((catConfig) => {
          const segObj = secData[catConfig.key] || {}
          Object.keys(segObj.brand_benefits || {}).forEach((b) => allBrandsSet.add(b))
          Object.keys(segObj.brand_issues || {}).forEach((b) => allBrandsSet.add(b))
        })
        const orderedSectionBrands = getOrderedBrands(Array.from(allBrandsSet))

        orderedSectionBrands.forEach((brand) => {
          feedbackCategories.forEach((catConfig) => {
            const segObj = secData[catConfig.key] || {}
            const segBase = segObj.base || sampleSize  // use segment-specific base from backend
            const bBen = segObj.brand_benefits?.[brand] || []
            const bIss = segObj.brand_issues?.[brand] || []
            const overallBBen = overallSeg.brand_benefits?.[brand] || []
            const overallBIss = overallSeg.brand_issues?.[brand] || []
            createFeedbackPanelSlide(
              `${sectionName} - ${brand} | ${catConfig.titleSuffix}`,
              bBen,
              bIss,
              overallBBen,
              overallBIss,
              catConfig.key === 'overall',
              segBase
            )
          })
        })
      }

      // Render Authorized Workshop Benefits & Betterments slides
      renderCorporateBenefitsBettermentsSlides('Authorized Service Workshop', 'authorized')

      // ─── DIVIDER: Service Standard Process Quality ───
      addDividerSlide('Service Satisfication')

      const satisfactionMetrics: any[] = satisfactionData?.metrics || []
      const satisfactionBrandBases: any[] = satisfactionData?.brand_bases || []
      const satBrands = satisfactionBrandBases.length > 0
        ? satisfactionBrandBases.map((b: any) => b.brand)
        : (analytics?.age_group?.brands || ['TVS', 'HONDA', 'YAMAHA'])
      const orderedSatBrands = getOrderedBrands(satBrands)
      const satBrandColors = getBrandColorsArray(orderedSatBrands)

      const renderServiceSatisfactionSlide = (
        slideTitle: string,
        subtitle: string,
        metricKeys: string[]
      ) => {
        const slide = pptx.addSlide()
        slide.background = { fill: 'FFFFFF' }
        addSlideTitle(slide, slideTitle, subtitle)

        const slideMetrics = satisfactionMetrics.filter((m: any) => metricKeys.includes(m.key))

        // 1. Left Top Table: Positive Points Main Table
        const tableX = 0.3
        const tableY = 1.20
        const tableW = 4.6
        const tableH = 2.4

        const mainTableRows: any[][] = []

        // Main Table Header Row
        const headerRow: any[] = [
          { text: 'Positive Points', options: { bold: true, fill: NEUTRAL_GREY, color: 'FFFFFF', align: 'left', fontSize: 7.5, valign: 'middle' } }
        ]
        orderedSatBrands.forEach((b: string) => {
          headerRow.push({ text: b, options: getBrandHeaderOptions(b) })
        })
        mainTableRows.push(headerRow)

        // Main Table Data Rows
        slideMetrics.forEach((m: any) => {
          const rowCells: any[] = [
            { text: String(m.question || m.key), options: { bold: false, color: '1E293B', align: 'left', fontSize: 7, valign: 'middle' } }
          ]
          orderedSatBrands.forEach((b: string) => {
            const bd = (m.brand_data || []).find((item: any) => item.brand === b)
            const filled = bd?.filled_count ?? bd?.base_count ?? 0
            const yes = bd?.yes_count ?? 0
            rowCells.push({
              text: String(yes),
              options: { bold: false, color: '1E293B', align: 'center', fontSize: 7, valign: 'middle' }
            })
          })
          mainTableRows.push(rowCells)
        })

        const qColW = 2.0
        const bColW = (tableW - qColW) / Math.max(1, orderedSatBrands.length)
        const colWidths = [qColW, ...Array(orderedSatBrands.length).fill(bColW)]

        slide.addTable(mainTableRows, {
          x: tableX, y: tableY, w: tableW, h: tableH,
          border: { type: 'solid', color: 'E0E0E0', size: 0.5 },
          fontSize: 7,
          fontFace: 'Arial',
          colW: colWidths,
          rowH: mainTableRows.map(() => 0.35),
          valign: 'middle',
        })

        // 2. Left Bottom Table: Authorized Workshop Base Table
        const baseTableY = 3.80
        const baseTableH = 0.8
        const baseTableRows: any[][] = []

        const baseHeaderRow: any[] = [
          { text: 'Authorized Workshop Only (BN)', options: { bold: true, fill: NEUTRAL_GREY, color: 'FFFFFF', align: 'left', fontSize: 7.5, valign: 'middle' } }
        ]
        orderedSatBrands.forEach((b: string) => {
          baseHeaderRow.push({ text: b, options: getBrandHeaderOptions(b) })
        })
        baseTableRows.push(baseHeaderRow)

        const baseDataRow: any[] = [
          { text: 'Base Count', options: { bold: true, color: '1E293B', align: 'left', fontSize: 7.5, valign: 'middle' } }
        ]
        orderedSatBrands.forEach((b: string) => {
          const bd = satisfactionBrandBases.find((item: any) => item.brand === b)
          const baseCount = bd?.base_count ?? 0
          baseDataRow.push({
            text: String(baseCount),
            options: { bold: true, color: '1E293B', align: 'center', fontSize: 7.5, valign: 'middle' }
          })
        })
        baseTableRows.push(baseDataRow)

        slide.addTable(baseTableRows, {
          x: tableX, y: baseTableY, w: tableW, h: baseTableH,
          border: { type: 'solid', color: 'E0E0E0', size: 0.5 },
          fontSize: 7.5,
          fontFace: 'Arial',
          colW: colWidths,
          rowH: [0.35, 0.35],
          valign: 'middle',
        })

        // ─── DIVIDER: Section A ───
        //addDividerSlide('Section A')

        // ─── RIGHT SIDE CHART: Horizontal Bar Chart (Yes % Distribution per Brand) ───
        const chartX = 5.1
        const chartY = 1.5                    // was 1.05 — shifted down to make room for box top + title
        const chartW = 4.6
        const chartH = 3.15                   // was 4.0 — shrunk so box bottom stays at same Y

        // ─── Chart container box (drawn FIRST so it sits behind the title + chart) ───
        const CHART_BOX_X = chartX - 0.1
        const CHART_BOX_Y = 1.2
        const CHART_BOX_W = chartW + 0.2
        const CHART_BOX_H = (chartY + chartH) - CHART_BOX_Y + 0.15

        slide.addShape(pptx.ShapeType.roundRect, {
          x: CHART_BOX_X,
          y: CHART_BOX_Y,
          w: CHART_BOX_W,
          h: CHART_BOX_H,
          fill: { color: 'F8FAFC' },
          line: { color: 'E2E8F0', width: 1 },
          rectRadius: 0.08,
        })

        // ─── Chart title inside the box (below box top) ───
        slide.addText('Percentage Distribution (Yes %)', {
          x: chartX, y: CHART_BOX_Y + 0.08, w: chartW, h: 0.25,
          fontSize: 9, bold: true, color: '6C63FF', align: 'center', fontFace: 'Arial',
        })

        // ─── Chart inside the box (drawn after box + title) ───
        const chartMetrics = [...slideMetrics].reverse()   // 5E, 5D, 5C, 5B, 5A  → renders as 5A at top

        const chartSeries = orderedSatBrands.map((bName: string) => {
          const values = chartMetrics.map((m: any) => {
            const bd = (m.brand_data || []).find((item: any) => item.brand === bName)
            return bd ? Math.round(bd.yes_pct || 0) : 0
          })
          return {
            name: bName,
            labels: chartMetrics.map((m: any) => shortQuestionLabel(m)),
            values: values,
          }
        })

        try {
          slide.addChart(pptx.ChartType.bar, chartSeries, {
            x: chartX,
            y: chartY,
            w: chartW,
            h: chartH,
            barDir: 'bar',
            chartColors: satBrandColors,
            showTitle: false,
            showLegend: true,
            legendPos: 't',
            legendFontSize: 7,
            catAxisLabelFontSize: 7,          // ← was 8; smaller so long labels fit
            catAxisLabelColor: '333333',
            catAxisLineShow: true,
            catAxisLineColor: 'CBD5E1',
            catGridLine: { style: 'none' },
            valAxisHidden: true,
            valGridLine: { style: 'none' },
            showValue: true,
            dataLabelFormatCode: '0"%"',
            dataLabelFontSize: 7.5,
            dataLabelColor: '333333',
            barGapWidthPct: 180,
            barOverlapPct: -30,
          })
        } catch (chartErr) {
          console.error('Error adding satisfaction chart:', chartErr)
          slide.addText('Chart could not be rendered', {
            x: chartX, y: chartY + 0.5, w: chartW, h: 2.0,
            fontSize: 12, color: 'CC0000', align: 'center', valign: 'middle',
          })
        }
      }
      const shortQuestionLabel = (m: any): string => {
        const q = String(m.question || m.key || '').trim()
        // strip leading "5A) ", "5A. ", "5A - ", etc.
        const stripped = q.replace(/^\s*\d+[A-Za-z]?\s*[\).\-:]\s*/, '')
        return stripped || String(m.key || '')
      }

      // Generate Slide for 5A to 5E
      setPptProgress('Generating Slide: Service Standard Process Quality (5A - 5E)...')
      renderServiceSatisfactionSlide(
        'Service Standard Process Quality (5A - 5E)',
        'Metrics Section (5A - 5E): Service Experience Positive Points Summary',
        ['5A', '5B', '5C', '5D', '5E']
      )

      // Generate Slide for 5F to 5J
      setPptProgress('Generating Slide: Service Standard Process Quality (5F - 5J)...')
      renderServiceSatisfactionSlide(
        'Service Standard Process Quality (5F - 5J)',
        'Metrics Section (5F - 5J): Service Experience Positive Points Summary',
        ['5F', '5G', '5H', '5I', '5J']
      )

      // ─── DIVIDER: Additional Service Metrics Sections ───
      // addDividerSlide('Additional Service Metrics Sections')

      const sections = satisfactionData?.sections || {}

      // ─── Helper: Add Yes/No Satisfaction Slide with Correct Chart Layout ───
      const renderIndividualSectionSlide = (sKey: string) => {
        const secObj = sections[sKey]
        if (!secObj) return
        const slide = pptx.addSlide()
        slide.background = { fill: 'FFFFFF' }
        addSlideTitle(slide, secObj.question, '')

        const secData: any[] = secObj.brand_data || []
        const secBrands = secData.map((d: any) => d.brand)
        const orderedSecBrands = getOrderedBrands(secBrands.length > 0 ? secBrands : orderedSatBrands)

        // Left Side Table (Response: Yes, No, Grand Total)
        const tableX = 0.3
        const tableY = 1.2
        const tableW = 4.6
        const tableH = 3.6

        const tableRows: any[][] = []
        const headerRow: any[] = [
          { text: 'Response', options: { bold: true, fill: NEUTRAL_GREY, color: 'FFFFFF', align: 'left', fontSize: 8, valign: 'middle' } }
        ]
        orderedSecBrands.forEach((b: string) => {
          headerRow.push({ text: b, options: getBrandHeaderOptions(b) })
        })
        tableRows.push(headerRow)

        // Yes Row
        // Yes Row
        const yesRow: any[] = [
          { text: 'Yes', options: { bold: true, color: '10B981', align: 'left', fontSize: 8, valign: 'middle' } }
        ]
        orderedSecBrands.forEach((b: string) => {
          const bd = secData.find((d: any) => d.brand === b)
          const yesCount = bd?.yes_count ?? 0

          // ✅ count only, no percentage
          yesRow.push({
            text: String(yesCount),
            options: { bold: false, color: '1E293B', align: 'center', fontSize: 8, valign: 'middle' }
          })
        })
        tableRows.push(yesRow)

        // No Row
        const noRow: any[] = [
          { text: 'No', options: { bold: true, color: 'EF4444', align: 'left', fontSize: 8, valign: 'middle' } }
        ]
        orderedSecBrands.forEach((b: string) => {
          const bd = secData.find((d: any) => d.brand === b)
          const noCount = bd?.no_count ?? 0

          // ✅ count only, no percentage
          noRow.push({
            text: String(noCount),
            options: { bold: false, color: '1E293B', align: 'center', fontSize: 8, valign: 'middle' }
          })
        })
        tableRows.push(noRow)

        // Grand Total Row
        const totalRow: any[] = [
          { text: 'Grand Total', options: { bold: true, fill: NEUTRAL_GREY, color: 'FFFFFF', align: 'left', fontSize: 8, valign: 'middle' } }
        ]
        orderedSecBrands.forEach((b: string) => {
          const bd = secData.find((d: any) => d.brand === b)
          const totalCount = bd?.total_count ?? 0
          totalRow.push({
            text: String(totalCount),
            options: { bold: true, fill: getBrandColor(b), color: 'FFFFFF', align: 'center', fontSize: 8, valign: 'middle' }
          })
        })
        tableRows.push(totalRow)

        const numCols = 1 + orderedSecBrands.length
        const colW = tableW / numCols
        slide.addTable(tableRows, {
          x: tableX, y: tableY, w: tableW, h: tableH,
          border: { type: 'solid', color: 'E0E0E0', size: 0.5 },
          fontSize: 8,
          fontFace: 'Arial',
          colW: Array(numCols).fill(colW),
          rowH: [0.35, 0.35, 0.35, 0.35],
          valign: 'middle',
        })

        // ─── RIGHT SIDE CHART ───
        const chartX = 5.1
        const chartY = 1.5                         // was 1.2
        const chartW = 4.6
        const chartH = 3.15                        // was 3.4

        // ─── Chart container box (drawn FIRST) ───
        const CHART_BOX_X = chartX - 0.1
        const CHART_BOX_Y = 1.2
        const CHART_BOX_W = chartW + 0.2
        const CHART_BOX_H = (chartY + chartH) - CHART_BOX_Y + 0.15

        slide.addShape(pptx.ShapeType.roundRect, {
          x: CHART_BOX_X,
          y: CHART_BOX_Y,
          w: CHART_BOX_W,
          h: CHART_BOX_H,
          fill: { color: 'F8FAFC' },
          line: { color: 'E2E8F0', width: 1 },
          rectRadius: 0.08,
        })

        // ─── Chart title inside box ───
        slide.addText('Percentage Distribution (Yes vs No)', {
          x: chartX, y: CHART_BOX_Y + 0.08, w: chartW, h: 0.25,
          fontSize: 9, bold: true, color: '6C63FF', align: 'center', fontFace: 'Arial',
        })

        // ─── Chart ───
        const chartSeriesData = orderedSecBrands.map((bName: string) => {
          const bd = secData.find((d: any) => d.brand === bName)
          const yesPct = bd ? Math.round(bd.yes_pct || 0) : 0
          const noPct = bd ? Math.round(bd.no_pct || 0) : 0
          return {
            name: bName,
            labels: ['Yes', 'No'],
            values: [yesPct, noPct],
          }
        })

        const secBrandColors = getBrandColorsArray(orderedSecBrands)

        try {
          slide.addChart(pptx.ChartType.bar, chartSeriesData, {
            x: chartX,
            y: chartY,
            w: chartW,
            h: chartH,
            barDir: 'bar',
            chartColors: secBrandColors,
            showTitle: false,
            showLegend: true,
            legendPos: 't',
            legendFontSize: 7.5,
            catAxisLabelFontSize: 8,
            catAxisLabelColor: '333333',
            catAxisLineShow: true,
            catAxisLineColor: 'CBD5E1',
            catGridLine: { style: 'none' },
            valAxisHidden: true,
            valGridLine: { style: 'none' },
            showValue: true,
            dataLabelFormatCode: '0"%"',
            dataLabelFontSize: 7.5,
            dataLabelColor: '333333',
            barGapWidthPct: 180,
            barOverlapPct: -30,
          })
        } catch (err) {
          console.error(`Error adding section ${sKey} chart:`, err)
        }
      }

      // ─── Helper: Add Merged Section 7 & 8 Slide with Correct Chart Layout ───
      const renderMergedSection78Slide = () => {
        const sec7 = sections['7']
        const sec8 = sections['8']
        if (!sec7 && !sec8) return

        const slide = pptx.addSlide()
        slide.background = { fill: 'FFFFFF' }
        addSlideTitle(slide, 'Section 7 & 8: Vehicle Issues & Reporting Summary', '')

        const sec7Brands = sec7?.brand_data?.map((d: any) => d.brand) || []
        const sec8Brands = sec8?.brand_data?.map((d: any) => d.brand) || []
        const allSecBrands = Array.from(new Set([...sec7Brands, ...sec8Brands]))
        const orderedMergedBrands = getOrderedBrands(allSecBrands.length > 0 ? allSecBrands : orderedSatBrands)

        // Left Side Table (Question / Metric x Brands total counts)
        const tableX = 0.3
        const tableY = 1.2
        const tableW = 4.6
        const tableH = 3.6

        const tableRows: any[][] = []
        const headerRow: any[] = [
          { text: 'Question / Metric', options: { bold: true, fill: NEUTRAL_GREY, color: 'FFFFFF', align: 'left', fontSize: 7.5, valign: 'middle' } }
        ]
        orderedMergedBrands.forEach((b: string) => {
          headerRow.push({ text: b, options: getBrandHeaderOptions(b) })
        })
        tableRows.push(headerRow)

        if (sec7) {
          const row7: any[] = [
            { text: String(sec7.question || 'Section 7'), options: { bold: false, color: '1E293B', align: 'left', fontSize: 7, valign: 'middle' } }
          ]
          orderedMergedBrands.forEach((b: string) => {
            const bd = (sec7.brand_data || []).find((d: any) => d.brand === b)
            const count = bd?.total_count ?? 0
            row7.push({
              text: String(count),
              options: { bold: true, color: '1E293B', align: 'center', fontSize: 7.5, valign: 'middle' }
            })
          })
          tableRows.push(row7)
        }

        if (sec8) {
          const row8: any[] = [
            { text: String(sec8.question || 'Section 8'), options: { bold: false, color: '1E293B', align: 'left', fontSize: 7, valign: 'middle' } }
          ]
          orderedMergedBrands.forEach((b: string) => {
            const bd = (sec8.brand_data || []).find((d: any) => d.brand === b)
            const count = bd?.total_count ?? 0
            row8.push({
              text: String(count),
              options: { bold: true, color: '1E293B', align: 'center', fontSize: 7.5, valign: 'middle' }
            })
          })
          tableRows.push(row8)
        }

        const qColW = 2.0
        const bColW = (tableW - qColW) / Math.max(1, orderedMergedBrands.length)
        const colWidths = [qColW, ...Array(orderedMergedBrands.length).fill(bColW)]

        slide.addTable(tableRows, {
          x: tableX, y: tableY, w: tableW, h: tableH,
          border: { type: 'solid', color: 'E0E0E0', size: 0.5 },
          fontSize: 7,
          fontFace: 'Arial',
          colW: colWidths,
          rowH: tableRows.map(() => 0.45),
          valign: 'middle',
        })

        // ─── RIGHT SIDE CHART ───
        const chartX = 5.1
        const chartY = 1.5                         // was 1.2
        const chartW = 4.6
        const chartH = 3.15                        // was 3.4

        // ─── Chart container box (drawn FIRST) ───
        const CHART_BOX_X = chartX - 0.1
        const CHART_BOX_Y = 1.2
        const CHART_BOX_W = chartW + 0.2
        const CHART_BOX_H = (chartY + chartH) - CHART_BOX_Y + 0.15

        slide.addShape(pptx.ShapeType.roundRect, {
          x: CHART_BOX_X,
          y: CHART_BOX_Y,
          w: CHART_BOX_W,
          h: CHART_BOX_H,
          fill: { color: 'F8FAFC' },
          line: { color: 'E2E8F0', width: 1 },
          rectRadius: 0.08,
        })

        // ─── Chart title inside box ───
        slide.addText('Total Responses Comparison (Section 7 vs Section 8)', {
          x: chartX, y: CHART_BOX_Y + 0.08, w: chartW, h: 0.25,
          fontSize: 9, bold: true, color: '6C63FF', align: 'center', fontFace: 'Arial',
        })

        // ─── Chart ───
        const shortSectionLabel = (q: any, fallback: string): string => {
          const s = String(q || '').trim()
          const stripped = s.replace(/^\s*\d+\s*[\).\-:]\s*/, '') || fallback
          return stripped.length > 100 ? stripped.slice(0, 100) + '…' : stripped
        }

        const label7 = shortSectionLabel(sec7?.question, 'Section 7')
        const label8 = shortSectionLabel(sec8?.question, 'Section 8')

        // ── Per-brand respondent base (used as denominator) ──
        const brandBaseMap = new Map<string, number>(
          satisfactionBrandBases.map((b: any) => [b.brand, b.base_count ?? 0])
        )

        const chartSeries = orderedMergedBrands.map((bName: string) => {
          const count7 = sec7
            ? ((sec7.brand_data || []).find((d: any) => d.brand === bName)?.total_count ?? 0)
            : 0
          const count8 = sec8
            ? ((sec8.brand_data || []).find((d: any) => d.brand === bName)?.total_count ?? 0)
            : 0

          // ⬇️ This is the actual fix — divide by the base, multiply by 100.
          const brandBase = brandBaseMap.get(bName) ?? 0
          const pct7 = brandBase > 0 ? Math.round((count7 / brandBase) * 100) : 0
          const pct8 = brandBase > 0 ? Math.round((count8 / brandBase) * 100) : 0

          return {
            name: bName,
            labels: [label8, label7],   // reversed so 7 shows at top
            values: [pct8, pct7],       // ✅ percentages, not counts
          }
        })

        const mergedBrandColors = getBrandColorsArray(orderedMergedBrands)

        try {
          slide.addChart(pptx.ChartType.bar, chartSeries, {
            x: chartX,
            y: chartY,
            w: chartW,
            h: chartH,
            barDir: 'bar',
            chartColors: mergedBrandColors,
            showTitle: false,
            showLegend: true,
            legendPos: 't',
            legendFontSize: 7.5,
            catAxisLabelFontSize: 7,
            catAxisLabelColor: '333333',
            catAxisLineShow: true,
            catAxisLineColor: 'CBD5E1',
            catGridLine: { style: 'none' },
            valAxisHidden: true,
            valGridLine: { style: 'none' },
            showValue: true,
            dataLabelFormatCode: '0"%"',
            dataLabelFontSize: 7.5,
            dataLabelColor: '333333',
            barGapWidthPct: 180,
            barOverlapPct: -30,
          })
        } catch (err) {
          console.error('Error adding merged section 7 & 8 chart:', err)
        }
      }

      // Slide: Section 6 (VPS)
      setPptProgress('Generating Slide: Section 6 (Vehicle Performance Satisfaction)...')
      renderIndividualSectionSlide('6')

      // Slide: Section 7 & 8 (Merged)
      setPptProgress('Generating Slide: Section 7 & 8 (Vehicle Issues & Reporting Summary)...')
      renderMergedSection78Slide()

      // Slide: Section 9 (Fixing problems First Time Right)
      setPptProgress('Generating Slide: Section 9 (Fixing problems First Time Right)...')
      renderIndividualSectionSlide('9')

      // Slide: Section 10 (Delivery as per promised time)
      setPptProgress('Generating Slide: Section 10 (Delivery as per promised time)...')
      renderIndividualSectionSlide('10')

      // ─── DIVIDER: Section B ───
      addDividerSlide('Section B')

      // ─── DIVIDER: Why are not approaching Authorized outlets reasons ───
      addDividerSlide('Why are not approaching Authorized outlets reasons')

      // Render PGM (Private Garage Mechanic) Benefits & Betterments slides
      renderCorporateBenefitsBettermentsSlides('PGM (Private Garage Mechanic)', 'pgm')

      // ─── DIVIDER: PGM Customer NPS ───
      addDividerSlide('PGM Customer NPS')

      // Render PGM NPS distribution
      renderServiceNpsOverallSlide('pgm', 'Service NPS Overall Based on Workshop')

      // ─── DIVIDER: Customer Perception Score (CPS) ───
      addDividerSlide('Customer Perception Score (CPS)')

      // ─── SLIDES: CPS per question ───
      const cpsQuestions = [
        { id: 'pk', title: 'Recommend TVS Genuine Spare Parts', code: 'C1 (PK)' },
        { id: 'po', title: 'Availability of TVS Genuine Spare Parts', code: 'C2 (PO)' },
        { id: 'ps', title: 'Quality of TVS Genuine Spare Parts', code: 'C3 (PS)' },
        { id: 'pw', title: 'Value for Money of TVS Genuine Spare Parts', code: 'C4 (PW)' },
      ]

      const brandBreakdownCps = cpsData.brand_breakdown || []

      cpsQuestions.forEach((q) => {
        setPptProgress(`Generating Slide: CPS - ${q.code}...`)
        const slideCps = pptx.addSlide()
        slideCps.background = { fill: 'FFFFFF' }
        addSlideTitle(slideCps, `${q.code}: ${q.title}`, 'Customer Perception Score')

        const validBrands = brandBreakdownCps.filter((row: any) => {
          const qData = row[q.id] || { Yes: 0, Maybe: 0, No: 0, total: 0 }
          return qData.total > 0
        })

        if (validBrands.length === 0) {
          slideCps.addText('No data available', { x: 0.5, y: 2.0, w: '90%', fontSize: 14, color: '666666' })
          return
        }

        // --- Table (Top Left) ---
        const tableRows: any[] = []
        tableRows.push([
          { text: 'Brand Model', options: { bold: true, fill: 'F3F4F6', color: '111827' } },
          { text: 'Yes', options: { bold: true, fill: 'F3F4F6', color: '10B981', align: 'right' } },
          { text: 'Maybe', options: { bold: true, fill: 'F3F4F6', color: 'F59E0B', align: 'right' } },
          { text: 'No', options: { bold: true, fill: 'F3F4F6', color: 'EF4444', align: 'right' } },
          { text: 'Total', options: { bold: true, fill: 'F3F4F6', color: '4B5563', align: 'right' } },
        ])

        validBrands.forEach((row: any) => {
          const qData = row[q.id] || { Yes: 0, Maybe: 0, No: 0, total: 0 }
          const pctYes = Math.round((qData.Yes / qData.total) * 100) || 0
          const pctMaybe = Math.round((qData.Maybe / qData.total) * 100) || 0
          const pctNo = Math.round((qData.No / qData.total) * 100) || 0

          tableRows.push([
            { text: row.brand, options: { color: '4B5563', fontSize: 10 } },
            { text: `${qData.Yes} (${pctYes}%)`, options: { align: 'right', color: '111827', fontSize: 10 } },
            { text: `${qData.Maybe} (${pctMaybe}%)`, options: { align: 'right', color: '111827', fontSize: 10 } },
            { text: `${qData.No} (${pctNo}%)`, options: { align: 'right', color: '111827', fontSize: 10 } },
            { text: `${qData.total}`, options: { align: 'right', color: '4B5563', bold: true, fontSize: 10 } },
          ])
        })

        slideCps.addTable(tableRows, {
          x: 0.5,
          y: 1.1,
          w: 8.5,
          border: { pt: 0.5, color: 'E5E7EB' },
          colW: [2.5, 1.5, 1.5, 1.5, 1.5]
        })

        // --- Pie Charts (Bottom Row) ---
        const pieY = 3.2
        const pieSize = 1.9
        const spacingX = 2.1
        const totalW = validBrands.length * spacingX
        const startX = Math.max(0.5, (10 - totalW) / 2)

        validBrands.forEach((row: any, idx: number) => {
          const qData = row[q.id] || { Yes: 0, Maybe: 0, No: 0, total: 0 }

          const labels = []
          const values = []
          const colors = []
          if (qData.Yes > 0) { labels.push('Yes'); values.push(qData.Yes); colors.push('10B981') }
          if (qData.Maybe > 0) { labels.push('Maybe'); values.push(qData.Maybe); colors.push('F59E0B') }
          if (qData.No > 0) { labels.push('No'); values.push(qData.No); colors.push('EF4444') }

          const pieChartData = [{ name: row.brand, labels, values }]

          const currentX = startX + (idx * spacingX)
          slideCps.addText(row.brand, {
            x: currentX, y: pieY - 0.2, w: pieSize, align: 'center', fontSize: 9, bold: true, color: '333333'
          })

          slideCps.addChart(pptx.charts.PIE, pieChartData, {
            x: currentX,
            y: pieY,
            w: pieSize,
            h: pieSize,
            dataLabelFormatCode: '0%',
            showLabel: false,
            showValue: false,
            showPercent: true,
            showLegend: true,
            legendPos: 'b',
            chartColors: colors,
            dataNoEffects: true,
            dataLabelColor: 'FFFFFF',
            dataLabelFontSize: 9,
          })
        })
      })

      // ─── DIVIDER: Feedback from the market ───
      addDividerSlide('Feedback from the market')
      setPptProgress('Generating Feedback from the market slides...')

      // ── Data source: same as ServiceDashboardTab's Feedback tab ──
      const svcAuthData = serviceBenefitsData?.data?.authorized || {
        sample_size: 0,
        overall: { top_issues: [], top_benefits: [], brand_issues: {}, brand_benefits: {} },
      }

      // ── Remarks + Photos + Contents ──
      let mfRemarks: Record<string, string> = {}
      let mfPhotos: Record<string, any[]> = {}
      let mfContents: Record<string, string> = {}
      try {
        const mfRes = await marketFeedbackApi.getAll()
        if (mfRes.data?.success && mfRes.data?.data) {
          mfRemarks = mfRes.data.data.remarks || {}
          mfPhotos = mfRes.data.data.photos || {}
          mfContents = mfRes.data.data.contents || {}
        }
      } catch (err) {
        console.warn('Could not fetch market feedback DB entries for PPT:', err)
      }

      try {
        if (Object.keys(mfRemarks).length === 0) {
          const localRem = localStorage.getItem('tvs_market_feedback_remarks_v4')
          if (localRem) mfRemarks = JSON.parse(localRem)
        }
        if (Object.keys(mfPhotos).length === 0) {
          const localPho = localStorage.getItem('tvs_market_feedback_photos_v4')
          if (localPho) mfPhotos = JSON.parse(localPho)
        }
      } catch (e) { /* ignore */ }

      // ── Helpers ──
      const isJunkTopicName = (name: string) => {
        if (!name) return true
        const s = String(name).trim().toLowerCase()
        if (['blank', 'nil', 'none', 'n/a', 'na', 'null', 'nan', '-', '.', '..'].includes(s)) return true
        if (!isNaN(Number(s))) return true
        const junkWords = [
          'average', 'avg', 'best', 'bad', 'good', 'very good', 'poor', 'very poor',
          'fair', 'excellent', 'satisfied', 'unsatisfied', 'dissatisfied',
          'very satisfied', 'neutral', 'medium', 'high', 'low', 'ok', 'okay',
          'normal', 'strongly agree', 'agree', 'disagree', 'strongly disagree',
        ]
        if (junkWords.includes(s)) return true
        if (s.startsWith('submitform')) return true
        return false
      }

      const isTvsBrand = (b: string) =>
        String(b || '').trim().toUpperCase().startsWith('TVS')

      const buildIssueFeedbackBullets = (
        mainIssue: string,
        brand: string,
        valueCounts: { value: string; count: number; percentage: number }[],
        totalCount: number,
        parentCategory: string
      ): string[] => {
        if (!valueCounts || valueCounts.length === 0) {
          return [`No specific feedback values captured for ${mainIssue}.`]
        }
        const sorted = [...valueCounts].sort((a, b) => b.count - a.count)
        const top = sorted[0]
        const rest = sorted.slice(1, 4)

        const OPENER_THRESHOLD = 70
        const useSignificant = top.percentage >= OPENER_THRESHOLD

        const bullets: string[] = []

        if (useSignificant) {
          bullets.push(
            `The significant of ${top.percentage}% user in ${brand} is the highest ` +
            `percentage of complaints about ${top.value}.`
          )
        } else {
          bullets.push(
            `A major portion of ${mainIssue} complaints (${top.percentage}%) occur ` +
            `in ${brand}, with ${top.value} being the most reported concern.`
          )
        }

        if (rest.length >= 1) bullets.push(`Similarly, ${rest[0].percentage}% of users reported concerns under ${rest[0].value}.`)
        if (rest.length >= 2) bullets.push(`${rest[1].percentage}% of users reported concerns under ${rest[1].value}.`)
        if (rest.length >= 3) bullets.push(`${rest[2].percentage}% of users reported concerns under ${rest[2].value}.`)

        bullets.push(
          `Overall (${totalCount})(${top.percentage}%) ${brand} users have reported on ` +
          `${mainIssue} which was the major complaint in ${parentCategory}.`
        )

        return bullets
      }

      // ── Build mfIssues from OVERALL segment only ──
      type FeedbackShape = {
        id: string
        issueName: string
        subIssueTitle: string
        valueCounts: { value: string; count: number; percentage: number }[]
        bullets: string[]
        overallSummary: string
        totalUsersReported: number
        remarkKey: string
      }

      const mfIssues: { issue_name: string; total_complaints: number; feedbacks: FeedbackShape[] }[] = []

      const overallSeg: any = svcAuthData.overall || {}
      let overallTopIssues: any[] = overallSeg.top_issues || []

      const tvsIssueBrands = Object.keys(overallSeg.brand_issues || {}).filter(isTvsBrand)
      if (tvsIssueBrands.length > 0) {
        overallTopIssues = tvsIssueBrands.flatMap((b) => overallSeg.brand_issues?.[b] || [])
      }
      overallTopIssues = overallTopIssues.filter((i: any) => !isJunkTopicName(i.topic))

      const overallFeedbacks: FeedbackShape[] = []
      let counter = 1

      overallTopIssues.slice(0, 10).forEach((item: any) => {
        const valueCounts: { value: string; count: number; percentage: number }[] =
          (item.value_counts || []).filter((vc: any) => !isJunkTopicName(vc.value))

        if (valueCounts.length === 0) return

        // ✅ Prefer user-edited content from UI, fall back to auto-generated bullets
        const contentKey = `service_content_issue_${item.topic}`
        const customContent = mfContents[contentKey] || ''

        let bullets: string[]
        if (customContent.trim()) {
          bullets = customContent
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
        } else {
          bullets = buildIssueFeedbackBullets(
            item.topic,
            'Authorized Workshop',
            valueCounts,
            item.count || 0,
            'Authorized Service Workshop Betterments'
          )
        }

        overallFeedbacks.push({
          id: `svc-overall-${counter++}`,
          issueName: item.topic,
          subIssueTitle: item.topic,
          valueCounts,
          bullets,
          overallSummary: bullets[bullets.length - 1] || '',
          totalUsersReported: item.count || 0,
          remarkKey: `service_issue_${item.topic}`,
        })
      })

      if (overallFeedbacks.length > 0) {
        mfIssues.push({
          issue_name: 'Feedback from the Market (Service) — Overall',
          total_complaints: overallFeedbacks.reduce((s, f) => s + f.totalUsersReported, 0),
          feedbacks: overallFeedbacks,
        })
      }

      // ── Group ──
      const groupedByIssue: Record<string, any[]> = {}
      mfIssues.forEach((issueCategory: any) => {
        const issueName = issueCategory.issue_name || 'Issues'
        if (!groupedByIssue[issueName]) groupedByIssue[issueName] = []
          ; (issueCategory.feedbacks || []).forEach((feedback: any) => {
            groupedByIssue[issueName].push({ issueName, feedback })
          })
      })

      Object.entries(groupedByIssue).forEach(([issueName, entries]) => {
        const withMedia: any[] = []
        const textOnly: any[] = []

        entries.forEach((entry) => {
          const remarkKey = entry.feedback.remarkKey
          const remark = mfRemarks[remarkKey] || ''
          const photos = mfPhotos[remarkKey] || []
          if (photos.length > 0 || remark) {
            withMedia.push({ ...entry, remark, photos })
          } else {
            textOnly.push(entry)
          }
        })

        // ═══════════════════════════════════════════════════════════════
        // ── SLIDES: entries WITH media (photo LEFT, remark RIGHT) ──
        // ═══════════════════════════════════════════════════════════════
        withMedia.forEach(({ issueName: iss, feedback, remark, photos }) => {
          const mfSlide = pptx.addSlide()
          mfSlide.background = { fill: 'FFFFFF' }

          mfSlide.addText(iss, {
            x: 0.3, y: 0.2, w: 8.0, h: 0.45,
            fontSize: 22, bold: true, color: '#1F2A6B', fontFace: 'Arial',
          })

          mfSlide.addShape(pptx.ShapeType.line, {
            x: 0.3, y: 0.75, w: 9.4, h: 0,
            line: { color: '3B82F6', width: 2 },
          })

          mfSlide.addImage({
            path: '/assets/logo.png',
            x: 8.72, y: 0.15, w: 1.0, h: 0.52,
          })

          mfSlide.addText(feedback.issueName, {
            x: 0.3, y: 0.9, w: 9.4, h: 0.35,
            fontSize: 14, bold: true, color: '1E293B', fontFace: 'Arial',
          })

          // LEFT: PHOTO(S)
          if (photos.length > 0) {
            const firstPhotoUrl = getPhotoUrl(photos[0].url)
            if (photos.length === 1) {
              mfSlide.addImage({
                path: firstPhotoUrl,
                x: 0.3, y: 1.35, w: 5.4, h: 3.9,
                sizing: { type: 'contain', w: 5.4, h: 3.9 },
              })
            } else {
              const secondPhotoUrl = getPhotoUrl(photos[1].url)
              mfSlide.addImage({
                path: firstPhotoUrl,
                x: 0.3, y: 1.35, w: 2.6, h: 3.9,
                sizing: { type: 'contain', w: 2.6, h: 3.9 },
              })
              mfSlide.addImage({
                path: secondPhotoUrl,
                x: 3.1, y: 1.35, w: 2.6, h: 3.9,
                sizing: { type: 'contain', w: 2.6, h: 3.9 },
              })
            }
          }

          // RIGHT: REMARK
          if (remark) {
            if (photos.length > 0) {
              mfSlide.addText(
                [
                  { text: 'Field Remark:\n', options: { bold: true, fontSize: 10, color: '1E293B' } },
                  { text: remark, options: { fontSize: 9, color: '1E293B', italic: true } },
                ],
                {
                  x: 6.0, y: 1.35, w: 3.7, h: 3.9,
                  align: 'justify', valign: 'middle', fontFace: 'Arial',
                }
              )
            } else {
              mfSlide.addText(
                [
                  { text: 'Field Remark:\n', options: { bold: true, fontSize: 10, color: '1E293B' } },
                  { text: remark, options: { fontSize: 9, color: '1E293B', italic: true } },
                ],
                {
                  x: 0.8, y: 1.35, w: 8.4, h: 3.9,
                  align: 'justify', valign: 'middle', fontFace: 'Arial',
                }
              )
            }
          }
        })

        const buildBulletRuns = (feedback: FeedbackShape) => {
          const runs: any[] = []
          const BULLET_FONT = 11
          const BULLET_COLOR = '334155'
          const LINE_SPACING = 1.4

          const GAP_AFTER_PARA_1 = 10
          const GAP_BETWEEN_OTHER = 5
          const GAP_AFTER_LAST_BULLET = 8

          // Hanging-indent measurements (in inches)
          const BULLET_INDENT = 0.20      // where the • glyph sits
          const TEXT_INDENT = 0.40        // where wrapped text starts

          const bullets: string[] = Array.isArray(feedback.bullets) && feedback.bullets.length > 0
            ? feedback.bullets
            : ['No specific feedback values captured.']

          bullets.forEach((text, idx) => {
            const isLast = idx === bullets.length - 1
            const spaceAfter = isLast
              ? GAP_AFTER_LAST_BULLET
              : (idx === 0 ? GAP_AFTER_PARA_1 : GAP_BETWEEN_OTHER)

            const highlightRegex = /(\(\s*\d+\s*\)|\(\s*\d+\s*%\s*\)|\d+\s*%)/g

            // ── Split text into highlight / non-highlight fragments ──
            const fragmentRuns: any[] = []
            let lastIndex = 0
            let match: RegExpExecArray | null

            while ((match = highlightRegex.exec(text)) !== null) {
              const before = text.slice(lastIndex, match.index)
              if (before) {
                fragmentRuns.push({
                  text: before,
                  options: {
                    fontSize: BULLET_FONT,
                    color: BULLET_COLOR,
                    fontFace: 'Arial',
                    lineSpacingMultiple: LINE_SPACING,
                  },
                })
              }
              fragmentRuns.push({
                text: match[0],
                options: {
                  fontSize: BULLET_FONT,
                  color: '166534',
                  bold: true,
                  fontFace: 'Arial',
                  lineSpacingMultiple: LINE_SPACING,
                },
              })
              lastIndex = match.index + match[0].length
            }

            const after = text.slice(lastIndex)
            if (after) {
              fragmentRuns.push({
                text: after,
                options: {
                  fontSize: BULLET_FONT,
                  color: BULLET_COLOR,
                  fontFace: 'Arial',
                  lineSpacingMultiple: LINE_SPACING,
                },
              })
            }

            if (fragmentRuns.length === 0) {
              fragmentRuns.push({
                text,
                options: {
                  fontSize: BULLET_FONT,
                  color: BULLET_COLOR,
                  fontFace: 'Arial',
                  lineSpacingMultiple: LINE_SPACING,
                },
              })
            }

            // ── Attach the bullet + hanging indent to the FIRST fragment ──
            const firstFragment = fragmentRuns[0]
            firstFragment.options = {
              ...firstFragment.options,
              bullet: { code: '2022' },     // • Unicode
              indentLevel: 0,
              // PptxGenJS uses `indent` (in points) — 1 inch = 72 pt
              indent: Math.round((TEXT_INDENT - BULLET_INDENT) * 72),  // ~14 pt
              // marL (left margin of the paragraph) is what controls the hanging indent
              // In PptxGenJS this maps to `indent`, and the outer text box x sets the base.
            }

            // ✅ Last fragment ends the paragraph
            const lastFragment = fragmentRuns[fragmentRuns.length - 1]
            lastFragment.options.breakLine = true
            lastFragment.options.paraSpaceAfter = spaceAfter

            fragmentRuns.forEach((fr) => runs.push(fr))
          })

          return runs
        }

        // ═══════════════════════════════════════════════════════════════
        // ── Estimate entry height (line-based, plus extra gap after para 1) ──
        // ═══════════════════════════════════════════════════════════════
        const estimateEntryLines = (entry: any): number => {
          const fb: FeedbackShape = entry.feedback
          const titleLen = (fb.issueName || '').length
          const titleLines = Math.max(1, Math.ceil(titleLen / 70))

          let bulletLines = 0
            ; (fb.bullets || []).forEach((b, i) => {
              const lineCount = Math.max(1, Math.ceil(String(b).length / 95))
              // First paragraph gets an extra "line" to account for the larger gap
              bulletLines += lineCount + (i === 0 ? 1 : 0)
            })

          const compressedBody = Math.ceil(bulletLines * 0.5)
          return titleLines + compressedBody + 1
        }

        // ═══════════════════════════════════════════════════════════════
        // ── Pack text-only entries into slides — MAX 3 issues per slide ──
        // ═══════════════════════════════════════════════════════════════
        const MAX_LINES_PER_SLIDE = 22
        const MAX_LINES_PER_SLIDE_3PLUS = 15
        const MAX_TOPICS_PER_SLIDE = 3           // ← hard cap of 3

        const textChunks: any[][] = []
        {
          let currentChunk: any[] = []
          let currentLines = 0

          textOnly.forEach((entry) => {
            const lines = estimateEntryLines(entry)
            const reachedTopicCap = currentChunk.length >= MAX_TOPICS_PER_SLIDE
            const wouldExceedBase = currentLines + lines > MAX_LINES_PER_SLIDE
            const wouldExceed3Plus =
              currentChunk.length >= 2 && currentLines + lines > MAX_LINES_PER_SLIDE_3PLUS

            if (currentChunk.length > 0 && (reachedTopicCap || wouldExceedBase || wouldExceed3Plus)) {
              textChunks.push(currentChunk)
              currentChunk = []
              currentLines = 0
            }
            currentChunk.push(entry)
            currentLines += lines
          })

          if (currentChunk.length > 0) textChunks.push(currentChunk)
        }

        // ═══════════════════════════════════════════════════════════════
        // ── Render each packed chunk ──
        // ═══════════════════════════════════════════════════════════════
        textChunks.forEach((chunk) => {
          const mfSlide = pptx.addSlide()
          mfSlide.background = { fill: 'FFFFFF' }

          mfSlide.addText(issueName, {
            x: 0.3, y: 0.2, w: 8.0, h: 0.45,
            fontSize: 22, bold: true, color: '#1F2A6B', fontFace: 'Arial',
          })

          mfSlide.addShape(pptx.ShapeType.line, {
            x: 0.3, y: 0.75, w: 9.4, h: 0,
            line: { color: '3B82F6', width: 2 },
          })

          mfSlide.addImage({
            path: '/assets/logo.png',
            x: 8.72, y: 0.15, w: 1.0, h: 0.52,
          })

          const contentTopY = 0.95
          const allRuns: any[] = []

          chunk.forEach((entry, idx) => {
            const { feedback } = entry

            // Gap between topics (skip for the first one)
            if (idx > 0) {
              allRuns.push({
                text: '',
                options: {
                  fontSize: 4,
                  breakLine: true,
                  paraSpaceBefore: 12,
                  paraSpaceAfter: 0,
                  lineSpacingMultiple: 0.3,
                },
              })
            }

            // Sub-heading (issue topic)
            allRuns.push({
              text: feedback.issueName || '',
              options: {
                fontSize: 11,
                bold: true,
                color: '1E293B',
                fontFace: 'Arial',
                breakLine: true,
                paraSpaceAfter: 5,
                paraSpaceBefore: 0,
                lineSpacingMultiple: 0.75,
              },
            })

            // Bullets
            const bulletRuns = buildBulletRuns(feedback)
            bulletRuns.forEach((r) => allRuns.push(r))
          })

          if (allRuns.length > 0) {
            mfSlide.addText(allRuns, {
              x: 0.4,
              y: contentTopY,
              w: 9.2,
              h: 4.5,
              valign: 'top',
              fontFace: 'Arial',
              wrap: true,
              align: 'justify'
            })
          }
        })
      })
      // ─── DIVIDER: Key Insights ───
      addDividerSlide('Key Insights')

      // ─── SLIDE: Key Insights (Dynamic based on data) ───
      setPptProgress('Generating Slide: Key Insights...')
      const slideKeyInsights = pptx.addSlide()
      slideKeyInsights.background = { fill: 'FFFFFF' }
      addSlideTitle(slideKeyInsights, 'Key Insights', '')

      // Card container for insights
      slideKeyInsights.addShape(pptx.ShapeType.rect, {
        x: 0.5, y: 1.1, w: 9.0, h: 4.2,
        fill: { color: 'F8FAFC' },
        line: { color: 'E2E8F0', width: 1 }
      })

      // Dynamic Key Insights Generator function
      const generateDynamicKeyInsights = () => {
        const bullets: { text: string; options: any }[] = []

        // Bullet 1: Dynamic NPS Comparison (Authorized Workshop vs PGM / Private Garage)
        const authObj = serviceNpsData?.authorized || {}
        const pgmObj = serviceNpsData?.pgm || {}
        const authBrands: any[] = authObj.brand_breakdown || []
        const pgmBrands: any[] = pgmObj.brand_breakdown || []

        const firstSelected = (values: string[]) => (values && values.length > 0 ? values[0] : '')
        const locationName = firstSelected(filters.countryId) || firstSelected(filters.surveyLocation) || firstSelected(filters.regionId) || 'Overall'
        const brandModelLabel = toParam(filters.brandModel)
        const brandModelName = brandModelLabel ? ` (${brandModelLabel})` : ''
        const titleLocation = `${locationName}${brandModelName}`

        const allBrands = Array.from(new Set([
          ...authBrands.map((b: any) => b.brand),
          ...pgmBrands.map((b: any) => b.brand)
        ]))

        let npsComparisonText = ''
        if (allBrands.length > 0) {
          const brandSentences = allBrands.map((brandName) => {
            const aData = authBrands.find((b: any) => b.brand === brandName)
            const pData = pgmBrands.find((b: any) => b.brand === brandName)
            const aNps = aData ? Math.round(aData.nps_score ?? aData.promoters_pct ?? 0) : 0
            const pNps = pData ? Math.round(pData.nps_score ?? pData.promoters_pct ?? 0) : 0
            const comp = aNps >= pNps ? 'higher than' : 'lower than'
            return `${brandName} Authorized workshop is (${aNps}%) is ${comp} that of private garage (${pNps}%)`
          })

          if (brandSentences.length === 1) {
            npsComparisonText = `For ${titleLocation}, the NPS of ${brandSentences[0]}.`
          } else if (brandSentences.length === 2) {
            npsComparisonText = `For ${titleLocation}, the NPS of ${brandSentences[0]} where ${brandSentences[1]}.`
          } else {
            const last = brandSentences.pop()
            npsComparisonText = `For ${titleLocation}, the NPS of ${brandSentences.join(', where ')} and ${last}.`
          }
        } else {
          const aOverall = Math.round(authObj.nps_score ?? authObj.promoters_pct ?? 0)
          const pOverall = Math.round(pgmObj.nps_score ?? pgmObj.promoters_pct ?? 0)
          const comp = aOverall >= pOverall ? 'higher than' : 'lower than'
          npsComparisonText = `For ${titleLocation}, the overall NPS of Authorized workshop (${aOverall}%) is ${comp} private garage (${pOverall}%).`
        }

        bullets.push({
          text: npsComparisonText,
          options: { bullet: true, breakLine: true, fontSize: 11, color: '1E293B', spaceAfter: 14 }
        })

        // Bullet 2: Betterment & Workshop Improvements based on Benefits/Betterment Data
        const rawBenefits = serviceBenefitsData?.data || serviceBenefitsData || {}
        const authBenefits = rawBenefits?.authorized || {}
        const topIssues: any[] = authBenefits?.overall?.top_issues || []
        const issueTopics = topIssues.slice(0, 4).map((i: any) => i.topic || i.issue || i.name).filter(Boolean)

        let bettermentText = ''
        if (issueTopics.length > 0) {
          bettermentText = `Authorized workshops should focus on key betterment areas identified by users, including ${issueTopics.join(', ')}. Addressing user complaints promptly and improving workshop facilities will maintain high customer satisfaction.`
        } else {
          bettermentText = `Authorized workshops should improve customer lounge amenities to provide a better service experience. They should also extend operating hours to offer greater convenience for users. In addition, users complaints must be addressed and resolved promptly to maintain satisfaction. They need better workshop facilities like pickup and drop service and express service.`
        }

        bullets.push({
          text: bettermentText,
          options: { bullet: true, breakLine: true, fontSize: 11, color: '1E293B', spaceAfter: 14 }
        })

        // Bullet 3: Service Cost Explanation & Trust Building based on Satisfaction Data
        const metrics: any[] = satisfactionData?.metrics || []
        const topPositiveMetrics = metrics
          .filter((m: any) => m.question || m.key)
          .slice(0, 2)
          .map((m: any) => m.question || m.key)

        let trustText = ''
        if (topPositiveMetrics.length > 0) {
          trustText = `Providing clear explanations of service costs and repairs for key service aspects (such as ${topPositiveMetrics.join(' and ')}) will help build user trust and improve overall satisfaction.`
        } else {
          trustText = `Providing clear explanations of service costs and repairs will help build user trust and improve overall satisfaction.`
        }

        bullets.push({
          text: trustText,
          options: { bullet: true, fontSize: 11, color: '1E293B', spaceAfter: 14 }
        })

        return bullets
      }

      const keyInsightBullets = generateDynamicKeyInsights()

      slideKeyInsights.addText(
        keyInsightBullets,
        {
          x: 0.8,
          y: 1.3,
          w: 8.4,
          h: 3.8,
          fontFace: 'Arial',
          valign: 'middle',
          lineSpacing: 28,
          align: 'justify'
        }
      )



      setPptProgress('Building table of contents...')

      tocSlide.addText('Table of Contents', {
        x: 0.3, y: 0.2, w: 8.0, h: 0.4,
        fontSize: 18, bold: true, color: '1E293B', fontFace: 'Arial',
      })
      tocSlide.addShape(pptx.shapes.LINE, {
        x: 0.3, y: 0.85, w: 9.4, h: 0.0,
        line: { color: '3B82F6', width: 2 },
      })
      tocSlide.addImage({ path: '/assets/logo.png', x: 8.72, y: 0.25, w: 1.0, h: 0.53 })

      // ─── TOC layout config ───
      const slideW = 10
      const slideH = 5.625
      const marginX = 0.5
      const marginRight = 0.5
      const colGap = 0.3
      const rowGap = 0.25

      const cols = 3
      const cardW = (slideW - marginX - marginRight - (cols - 1) * colGap) / cols  // 2.8
      let cardH = 0.95
      let cardStartY = 1.5

      // Auto-shrink if there are more than 9 items (4+ rows needed)
      const rows = Math.ceil(dividerTOC.length / cols)
      if (rows > 3) {
        cardH = 0.75
        cardStartY = 1.35
      }

      // ─── Card style constants ───
      const CARD_BG = 'F1F5F9'
      const CARD_BORDER = 'E2E8F0'
      const ACCENT_BLUE = '3B82F6'
      const NUMBER_COLOR = '3B82F6'
      const TITLE_COLOR = '1E293B'

      dividerTOC.forEach((item, idx) => {
        const row = Math.floor(idx / cols)
        const col = idx % cols

        const cardX = marginX + col * (cardW + colGap)
        const cardY = cardStartY + row * (cardH + rowGap)

        // ── Card background (rounded rect) ──
        tocSlide.addShape(pptx.ShapeType.roundRect, {
          x: cardX,
          y: cardY,
          w: cardW,
          h: cardH,
          fill: { color: CARD_BG },
          line: { color: CARD_BORDER, width: 1 },
          rectRadius: 0.08,
        })

        // ── Left accent strip (thin vertical bar in brand blue) ──
        tocSlide.addShape(pptx.ShapeType.rect, {
          x: cardX,
          y: cardY,
          w: 0.06,
          h: cardH,
          fill: { color: ACCENT_BLUE },
          line: { color: ACCENT_BLUE, width: 0 },
        })

        // ── Number badge (two-digit) ──
        const numberText = String(idx + 1).padStart(2, '0')
        tocSlide.addText(numberText, {
          x: cardX + 0.15,
          y: cardY,
          w: 0.7,
          h: cardH,
          fontSize: 20,
          bold: true,
          color: NUMBER_COLOR,
          fontFace: 'Arial',
          align: 'center',
          valign: 'middle',
        })

        // ── Section title (hyperlink) ──
        tocSlide.addText(item.title, {
          x: cardX + 0.9,
          y: cardY,
          w: cardW - 1.05,
          h: cardH,
          fontSize: 11,
          bold: true,
          color: TITLE_COLOR,
          fontFace: 'Arial',
          align: 'left',
          valign: 'middle',
          hyperlink: { slide: item.slideNumber, tooltip: `Go to ${item.title}` },
        })
      })

      // ─── FINAL SLIDE: Thank You ───
      setPptProgress('Generating Slide: Thank You...')
      const slideThankYou = pptx.addSlide()
      slideThankYou.background = { fill: 'FFFFFF' }

      // Full-bleed background image
      slideThankYou.addImage({
        path: '/assets/Thank.png',
        x: 0,
        y: 0,
        w: 10,
        h: 5.625,
        sizing: { type: 'cover', w: 10, h: 5.625 },
      })

      // Centered "Thank You" text overlay
      slideThankYou.addText(
        [
          { text: 'Thank', options: { breakLine: true } },
          { text: 'You', options: {} },
        ],
        {
          x: -0.1,
          y: -0.2,              // pull the text block upward (negative = above center)
          w: 10,
          h: 5.625,
          align: 'center',
          valign: 'middle',
          fontSize: 55,
          bold: true,
          color: '#1434A4',
          fontFace: 'Calibri',
          lineSpacing: 60,      // keeps the two stacked lines close together
          shadow: {
            type: 'outer',
            color: '000000',
            opacity: 0.5,
            blur: 8,
            offset: 2,
            angle: 45,
          },
        }
      )
      setPptProgress('Saving PowerPoint file...')
      const serviceCountryIds = Array.isArray(filters.countryId)
        ? filters.countryId
        : (filters.countryId ? [filters.countryId] : [])
      const serviceRegionIds = Array.isArray(filters.regionId)
        ? filters.regionId
        : (filters.regionId ? [filters.regionId] : [])

      let serviceCountryName = 'Overall'
      if (serviceCountryIds.length > 0) {
        const found = countries.find((c) => c.id === serviceCountryIds[0] || c.name === serviceCountryIds[0])
        serviceCountryName = found ? found.name : serviceCountryIds[0]
      } else if (serviceRegionIds.length > 0) {
        const found = regions.find((r) => r.id === serviceRegionIds[0] || r.name === serviceRegionIds[0])
        serviceCountryName = found ? found.name : serviceRegionIds[0]
      }
      const cleanServiceCountry = serviceCountryName.trim().replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, '_') || 'Overall'

      await pptx.writeFile({ fileName: `${cleanServiceCountry}_service_${today}.pptx` })

      if (pptCancelRef.current) {
        throw new Error(PPT_CANCELLED)
      }

      setToastSeverity('success')
      setToastMessage('Service PPT downloaded successfully!')
      setToastOpen(true)
    } catch (err: any) {
      if (err && err.message === PPT_CANCELLED) {
        setToastSeverity('info')
        setToastMessage('Service PPT generation cancelled.')
      } else {
        console.error('Service PPT Generation Error:', err)
        setToastSeverity('error')
        setToastMessage(`Failed to generate Service PPT: ${err.message || err}`)
      }
      setToastOpen(true)
    } finally {
      setPptGenerating(false)
    }
  }

  const handleDownloadPPT = async () => {
    pptCancelRef.current = false
    setPptGenerating(true)
    setPptProgress('Initializing & fetching data...')

    try {
      const filterParams = {
        region_id: toParam(filters.regionId),
        country_id: toParam(filters.countryId),
        ib_version_id: toParam(filters.ibVersionId),
        brand_model: toParam(filters.brandModel),
        survey_location: toParam(filters.surveyLocation),
        date_from: filters.dateFrom || undefined,
        date_to: filters.dateTo || undefined,
        search: filters.search || undefined,
      }

      // Fetch all required data in parallel
      const [analyticsRes, issuesRes, comparisonRes, topicsRes, npsRes, brandFeedbackRes] = await Promise.all([
        dashboardApi.analytics(filterParams),
        issuesApi.analysis(filterParams),
        comparisonApi.brandPassiveIssues(filterParams),
        comparisonApi.brandTopics(filterParams),
        dashboardApi.npsData(filterParams),
        dashboardApi.brandNpsFeedback(filterParams),
      ])
      // Dynamic brand ordering directly from DB response (TVS brands placed first)
      const getOrderedBrands = (brands: string[]): string[] => {
        if (!Array.isArray(brands)) return []
        const unique: string[] = []
        brands.forEach((b) => {
          if (b && typeof b === 'string') {
            const clean = b.trim()
            if (clean && clean.toLowerCase() !== 'blank' && !unique.includes(clean)) {
              unique.push(clean)
            }
          }
        })
        const tvsBrands = unique.filter((b) => {
          const lower = b.toLowerCase()
          return lower.includes('tvs') || lower.includes('raider') || lower.includes('apache')
        })
        const otherBrands = unique.filter((b) => {
          const lower = b.toLowerCase()
          return !lower.includes('tvs') && !lower.includes('raider') && !lower.includes('apache')
        })
        return [...tvsBrands, ...otherBrands]
      }

      // SAFETY: Ensure these are always arrays or objects, never undefined
      const analytics = analyticsRes.data || {}
      const issues = (issuesRes.data && issuesRes.data.data) || []
      const issueBrands = (issuesRes.data && issuesRes.data.brands) || []
      const comparison = (comparisonRes.data && comparisonRes.data.data) || []
      const topics = (topicsRes.data && topicsRes.data.data) || []
      const nps = npsRes.data || {}
      const brandFeedback = (brandFeedbackRes.data && brandFeedbackRes.data.brands) || []
      const orderedNpsBrands = (nps && nps.brands) ? getOrderedBrands(nps.brands) : []

      // SAFE CHECK: Using .length is fine now because they are guaranteed to be arrays
      if (!analytics || (issues.length === 0 && comparison.length === 0 && topics.length === 0)) {
        setToastSeverity('error')
        setToastMessage('Cannot generate PPT: No data available for the active filters.')
        setToastOpen(true)
        setPptGenerating(false)
        return
      }

      // ─── PRE-FLIGHT CHECK (Uncomment to find exact crash) ───
      // console.log('Issues Data:', issues);
      // issues.forEach((issue, i) => {
      //   issue.sub_issues?.forEach((sub, j) => {
      //     if (!Array.isArray(sub.follow_ups)) {
      //       console.error(`CRASH FOUND: Sub-issue ${j} of issue ${i} has invalid follow_ups!`, sub);
      //     }
      //   });
      // });

      setPptProgress('Preparing data for presentation...')

      const pptx = new PptxGenJS()
      pptx.layout = 'LAYOUT_16x9'

      const BRAND_COLORS_LIST = ['00B4D8', '7C3AED', 'F97316', '10B981', 'EF4444', '3B82F6', '8B5CF6', 'EC4899', 'F59E0B', '06B6D4']
      const LIGHT_COLORS_LIST = ['B3E5FC', 'D1C4E9', 'FFE0B2', 'D1FAE5', 'FEE2E2', 'DBEAFE', 'EDE9FE', 'FCE7F3', 'FEF3C7', 'CFFAFE']


      const SPECIFIC_BRAND_COLORS: Record<string, string> = {
        // TVS — cyan
        'TVS Raider': '00B4D8', 'TVS Apache': '00B4D8', 'TVS': '00B4D8',

        // Bajaj — purple
        'Bajaj Pulsar': '7C3AED', 'Bajaj': '7C3AED',

        // Yamaha — orange
        'Yamaha FZ': 'FF5A00', 'Yamaha': 'FF5A00',

        // Honda — navy
        'Honda CB': '1E3A8A', 'Honda': '1E3A8A',

        // Suzuki — teal
        'Suzuki Gixxer': '2A9D8F', 'Suzuki': '2A9D8F',
      }

      const SPECIFIC_LIGHT_COLORS: Record<string, string> = {
        'TVS Raider': 'B3E5FC', 'TVS Apache': 'B3E5FC', 'TVS': 'B3E5FC',
        'Bajaj Pulsar': 'D1C4E9', 'Bajaj': 'D1C4E9',
        'Yamaha FZ': 'FFE0CC', 'Yamaha': 'FFE0CC',
        'Honda CB': 'DBEAFE', 'Honda': 'DBEAFE',          // ← navy light
        'Suzuki Gixxer': 'D1F0EC', 'Suzuki': 'D1F0EC',
      }

      // ─── Slide counter + TOC tracking (for internal hyperlinks) ───
      let slideCounter = 0
      const _originalAddSlide = pptx.addSlide.bind(pptx)
      pptx.addSlide = (...args: any[]) => {
        slideCounter++
        return _originalAddSlide(...args)
      }
      const dividerTOC: { title: string; slideNumber: number }[] = []
      const TOC_SLIDE_NUMBER = 2

      const today = new Date().toISOString().split('T')[0]
      const displayDate = new Date().toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })

      const hashBrand = (str: string): number => {
        let hash = 0
        for (let i = 0; i < str.length; i++) {
          hash = str.charCodeAt(i) + ((hash << 5) - hash)
        }
        return Math.abs(hash)
      }

      const getBrandColor = (brandName: string): string => {
        if (!brandName) return '475569'
        const clean = String(brandName).trim()
        if (SPECIFIC_BRAND_COLORS[clean]) {
          return SPECIFIC_BRAND_COLORS[clean]
        }
        const lower = clean.toLowerCase()

        if (lower.includes('apache') || lower.includes('raider') || lower.includes('tvs')) return '00B4D8'
        if (lower.includes('pulsar') || lower.includes('bajaj')) return '7C3AED'
        if (lower.includes('yamaha') || lower.includes('fz')) return 'FF5A00'
        if (lower.includes('honda') || lower.includes('cb')) return '1E3A8A'   // ← navy
        if (lower.includes('gixxer') || lower.includes('suzuki')) return '2A9D8F'

        const idx = hashBrand(clean.toUpperCase()) % BRAND_COLORS_LIST.length
        return BRAND_COLORS_LIST[idx]
      }
      // ─── HELPER: Get light version for age groups ───
      const getAgeGroupLightColor = (brandName: string): string => {
        if (!brandName) return 'ECEFF1'
        const clean = String(brandName).trim()
        if (SPECIFIC_LIGHT_COLORS[clean]) {
          return SPECIFIC_LIGHT_COLORS[clean]
        }
        const lower = clean.toLowerCase()

        if (lower.includes('apache') || lower.includes('raider') || lower.includes('tvs')) return 'B3E5FC'
        if (lower.includes('pulsar') || lower.includes('bajaj')) return 'D1C4E9'
        if (lower.includes('yamaha') || lower.includes('fz')) return 'FFE0CC'
        if (lower.includes('honda') || lower.includes('cb')) return 'DBEAFE'   // ← navy light
        if (lower.includes('gixxer') || lower.includes('suzuki')) return 'D1F0EC'

        const idx = hashBrand(clean.toUpperCase()) % LIGHT_COLORS_LIST.length
        return LIGHT_COLORS_LIST[idx]
      }
      // ─── HELPER: Get brand header options ───
      const getBrandHeaderOptions = (brandName: string) => {
        return {
          bold: true,
          fill: getBrandColor(brandName),
          color: 'FFFFFF',
          align: 'center',
          valign: 'middle',
          fontFace: 'Arial',
          fontSize: 8
        }
      }


      // ─── HELPER: Get brand colors array for charts ───
      const getBrandColorsArray = (brands: string[]): string[] => {
        return brands.map(b => getBrandColor(b))
      }



      // ─── HELPER: Transform matrix data to pptxgenjs chart data ───
      function matrixToChartData(matrix: any, type: 'count' | 'percent' = 'percent') {
        if (!matrix || !Array.isArray(matrix.chart) || matrix.chart.length === 0) return []

        const { brands } = matrix
        if (!Array.isArray(brands)) return []

        const orderedBrands = getOrderedBrands(brands)

        return matrix.chart.map((row: any) => ({
          name: row.category || 'Unknown',
          labels: orderedBrands || [],
          values: orderedBrands.map((b: string) => {
            const key = type === 'count' ? `${b}_count` : `${b}_pct`
            return row?.[key] || 0
          })
        }))
      }

      // Neutral grey used ONLY for the header cell of the Category and Total columns
      const NEUTRAL_GREY = '607D8B'

      // ─── HELPER: Add matrix table to slide ───
      const addMatrixTable = (slide: any, matrix: any, title: string, x: number, y: number, w: number, h: number, hideTotal: boolean = false) => {
        if (!matrix || !Array.isArray(matrix.table) || matrix.table.length === 0) {
          slide.addText('No data available', {
            x, y, w, h,
            fontSize: 12,
            color: '999999',
            align: 'center',
          })
          return
        }

        const { brands, table, category_header } = matrix
        if (!Array.isArray(brands)) return

        const orderedBrands = getOrderedBrands(brands)

        const rows: any[][] = []

        const headerRow: any[] = [
          { text: title || category_header || 'Category', options: { bold: true, fill: NEUTRAL_GREY, color: 'FFFFFF', align: 'left', fontSize: 8 } }
        ]
        orderedBrands.forEach((brand: string) => {
          headerRow.push({
            text: brand,
            options: getBrandHeaderOptions(brand),
          })
        })

        if (!hideTotal) {
          headerRow.push({
            text: 'Total',
            options: {
              bold: true,
              fill: NEUTRAL_GREY,
              color: 'FFFFFF',
              align: 'right',
              valign: 'middle',
              fontSize: 8,
            },
          })
        }

        rows.push(headerRow)

        table.forEach((row: any) => {
          const isTotal = row.category === 'Grand Total'
          const dataRow: any[] = [
            {
              text: String(row.category),
              options: {
                bold: isTotal,
                align: 'left',
                fontSize: 7
              }
            }
          ]
          orderedBrands.forEach((brand: string) => {
            const rawCount = row?.[`${brand}_count`] !== undefined ? row[`${brand}_count`] : row?.[brand]
            const count = typeof rawCount === 'number' ? rawCount : (parseFloat(rawCount) || 0)
            const rawPct = row?.[`${brand}_pct`] !== undefined ? row[`${brand}_pct`] : 0
            const pct = typeof rawPct === 'number' ? rawPct : (parseFloat(rawPct) || 0)
            let displayText = ''

            if (isTotal) {
              displayText = typeof count === 'number' ? count.toLocaleString() : String(count)
            } else {
              displayText = `${count} (${Math.round(pct)}%)`
            }

            dataRow.push({
              text: displayText,
              options: {
                bold: isTotal,
                align: 'right',
                fontSize: 7
              }
            })
          })
          if (!hideTotal) {
            dataRow.push({
              text:
                typeof row.total === 'number'
                  ? row.total.toLocaleString()
                  : String(row.total || 0),
              options: { bold: true, align: 'right', valign: 'middle', fontSize: 7 },
            })
          }
          rows.push(dataRow)
        })

        const colCount = 2 + orderedBrands.length          // reference layout: always counts the Total slot
        const baseWidth = w / colCount

        // Effective table width:
        //   - hideTotal = false → full `w` (unchanged)
        //   - hideTotal = true  → reserve the space the Total column would have used,
        //                         so the remaining columns keep their original size.
        const totalColW = baseWidth * 0.8
        const effectiveW = hideTotal ? (w - totalColW) : w

        slide.addTable(rows, {
          x, y, w: effectiveW, h,
          border: { type: 'solid', color: 'E0E0E0', size: 0.5 },
          fontSize: 7,
          fontFace: 'Arial',
          colW: [
            baseWidth * 1.2,
            ...orderedBrands.map(() => baseWidth * 0.9),
            ...(hideTotal ? [] : [totalColW]),
          ],
          rowH: rows.map(() => 0.2),
          valign: 'middle',
        })
      }

      const addAgeCityTableFullWidth = (slide: any, matrix: any, x: number, y: number, w: number, h: number) => {
        if (!matrix || !Array.isArray(matrix.table) || matrix.table.length === 0) {
          slide.addText('No data available', {
            x, y, w, h,
            fontSize: 12,
            color: '999999',
            align: 'center',
          })
          return
        }

        if (!Array.isArray(matrix.brands)) return

        // ─── Robust check — a brand is "empty" if it has NO non-zero values ───
        const brandHasData = (brand: string): boolean => {
          return matrix.table.some((row: any) => {
            const directVal = row?.[brand]
            if (directVal !== undefined && directVal !== null && Number(directVal) > 0) return true

            const countVal = row?.[`${brand}_count`]
            if (countVal !== undefined && countVal !== null && Number(countVal) > 0) return true

            const totalVal = row?.[`${brand}_total`]
            if (totalVal !== undefined && totalVal !== null && Number(totalVal) > 0) return true

            const matchingKey = Object.keys(row || {}).find(k =>
              k.startsWith(brand) && k !== brand
            )
            if (matchingKey) {
              const val = row[matchingKey]
              if (val !== undefined && val !== null && Number(val) > 0) return true
            }

            return false
          })
        }

        const brandsWithData = matrix.brands.filter((brand: string) => brandHasData(brand))

        if (brandsWithData.length === 0) {
          slide.addText('No data available', {
            x, y, w, h,
            fontSize: 12,
            color: '999999',
            align: 'center',
          })
          return
        }

        const orderedBrands = getOrderedBrands(brandsWithData)

        const cityAgeMap: Record<string, Record<string, Record<string, number>>> = {}
        const allAgeGroups = new Set<string>()

        matrix.table.forEach((row: any) => {
          const parts = String(row.category).split('|')
          const city = parts[0] || ''
          const ageGroup = parts[1] || ''
          if (city && ageGroup) {
            allAgeGroups.add(ageGroup)
            if (!cityAgeMap[city]) cityAgeMap[city] = {}
            if (!cityAgeMap[city][ageGroup]) cityAgeMap[city][ageGroup] = {}
            orderedBrands.forEach((brand: string) => {
              const directVal = row?.[brand]
              const countVal = row?.[`${brand}_count`]
              const rawVal = directVal !== undefined ? directVal : countVal
              cityAgeMap[city][ageGroup][brand] = Number(rawVal) || 0
            })
          }
        })

        const cities = Object.keys(cityAgeMap)

        // ─── Ordered so "Less than 20" comes FIRST ───
        const ageGroupOrder = ['Less than 20', '20-30', '30-40', '40-50', '50-60']
        const orderedAgeGroups = ageGroupOrder.filter(ag => allAgeGroups.has(ag))

        // ─── FIX A: Remove age groups that have NO data in ANY city × brand ───
        //     An age group is kept only if at least one (city, brand) has a value > 0.
        const sortedAgeGroups = orderedAgeGroups.filter(ageGroup => {
          return cities.some(city =>
            orderedBrands.some(brand => (cityAgeMap[city]?.[ageGroup]?.[brand] || 0) > 0)
          )
        })

        // Safety: if everything got filtered out (unexpected), fall back to the original
        const ageGroupsToUse = sortedAgeGroups.length > 0 ? sortedAgeGroups : orderedAgeGroups
        // ──────────────────────────────────────────────────────────────────────

        const totalDataCols = orderedBrands.length * (ageGroupsToUse.length + 1)
        const totalCols = 1 + totalDataCols
        const isManyCols = totalCols > 15
        const cityColWidth = isManyCols ? 0.85 : 1.0
        const dataColWidth = (w - cityColWidth) / totalDataCols
        const colWidths = [cityColWidth, ...Array(totalDataCols).fill(dataColWidth)]
        const subColCount = ageGroupsToUse.length + 1
        const fontSize = isManyCols ? 5 : 6
        const rowHeight = isManyCols ? 0.22 : 0.25

        const brandHeaderH = 0.28

        // City & Age Group header box
        slide.addText('City & Age Group', {
          x, y, w: cityColWidth, h: brandHeaderH,
          fontSize: 6, bold: true, color: 'FFFFFF',
          align: 'center', valign: 'middle', fontFace: 'Arial',
          fill: { color: NEUTRAL_GREY },
          line: { color: 'FFFFFF', size: 0.5 },
        })

        orderedBrands.forEach((brand: string, bIdx: number) => {
          const brandX = x + cityColWidth + bIdx * subColCount * dataColWidth
          const brandW = subColCount * dataColWidth
          const fill = getBrandColor(brand)

          slide.addText(brand, {
            x: brandX, y, w: brandW, h: brandHeaderH,
            fontSize: 6, bold: true, color: 'FFFFFF',
            align: 'center', valign: 'middle', fontFace: 'Arial',
            fill: { color: fill },
            line: { color: 'FFFFFF', size: 0.5 },
          })
        })

        const tableY = y + brandHeaderH
        const tableH = h - brandHeaderH

        const subHeaderRow: any[] = [
          { text: '', options: { fill: NEUTRAL_GREY } }
        ]
        orderedBrands.forEach((brand: string) => {
          const fill = getAgeGroupLightColor(brand)
          ageGroupsToUse.forEach((ageGroup: string) => {
            subHeaderRow.push({
              text: ageGroup,
              options: { bold: true, fill, color: '333333', align: 'center', fontSize: 6 }
            })
          })
          subHeaderRow.push({
            text: 'Total',
            options: { bold: true, fill: NEUTRAL_GREY, color: 'FFFFFF', align: 'center', fontSize: 6, italic: true }
          })
        })

        const tableRows: any[][] = [subHeaderRow]

        cities.forEach((city) => {
          const brandTotals: Record<string, number> = {}
          orderedBrands.forEach((brand: string) => {
            brandTotals[brand] = 0
            ageGroupsToUse.forEach((ageGroup: string) => {
              brandTotals[brand] += (cityAgeMap[city]?.[ageGroup]?.[brand] || 0)
            })
          })

          const dataRow: any[] = [{ text: city, options: { align: 'left', fontSize: 6, bold: true } }]
          orderedBrands.forEach((brand: string) => {
            ageGroupsToUse.forEach((ageGroup: string) => {
              const value = cityAgeMap[city]?.[ageGroup]?.[brand] || 0
              const total = brandTotals[brand] || 1
              const pct = total > 0 ? ((value / total) * 100) : 0
              dataRow.push({
                text: pct > 0 ? `${Math.round(pct)}%` : '—',
                options: { align: 'right', fontSize: 6 }
              })
            })
            dataRow.push({
              text: '100%',
              options: { bold: true, align: 'right', fontSize: 6 }
            })
          })
          tableRows.push(dataRow)
        })

        const grandRow: any[] = [{ text: 'Grand Total', options: { bold: true, align: 'left', fontSize: 6 } }]
        orderedBrands.forEach((brand: string) => {
          let grandTotal = 0
          cities.forEach((city) => {
            ageGroupsToUse.forEach((ageGroup: string) => {
              grandTotal += (cityAgeMap[city]?.[ageGroup]?.[brand] || 0)
            })
          })
          const totalPerBrand = grandTotal || 1
          ageGroupsToUse.forEach((ageGroup: string) => {
            let total = 0
            cities.forEach((city) => { total += (cityAgeMap[city]?.[ageGroup]?.[brand] || 0) })
            const pct = totalPerBrand > 0 ? ((total / totalPerBrand) * 100) : 0
            grandRow.push({
              text: pct > 0 ? `${Math.round(pct)}%` : '—',
              options: { bold: true, align: 'right', fontSize: 6 }
            })
          })
          grandRow.push({
            text: '100%',
            options: { bold: true, align: 'right', fontSize: 6 }
          })
        })
        tableRows.push(grandRow)

        slide.addTable(tableRows, {
          x, y: tableY, w, h: tableH,
          border: { type: 'solid', color: 'E0E0E0', size: 0.5 },
          fontSize,
          fontFace: 'Arial',
          colW: colWidths,
          rowH: tableRows.map(() => rowHeight),
          valign: 'middle',
        })
      }

      // ─── HELPER: Add branded title ───
      const addSlideTitle = (slide: any, title: string, subtitle: string) => {
        slide.addText(title, {
          x: 0.3, y: 0.2, w: 8.0, h: 0.4,
          fontSize: 18,
          bold: true,
          color: '1E293B',
          fontFace: 'Arial'
        })

        slide.addText(subtitle, {
          x: 0.3, y: 0.59, w: 8.0, h: 0.25,
          fontSize: 10,
          color: '#2B5797',
          fontFace: 'Arial'
        })

        slide.addShape(pptx.shapes.LINE, {
          x: 0.3, y: 0.85, w: 9.4, h: 0.0,
          line: { color: '3B82F6', width: 2 }
        })

        slide.addImage({
          path: '/assets/logo.png',
          x: 8.42,
          y: 0.15,
          w: 1.0,
          h: 0.52
        })
      }

      // ─── HELPER: Add Divider / Section Header slide ───
      const addDividerSlide = (sectionTitle: string) => {
        const slide = pptx.addSlide()
        dividerTOC.push({ title: sectionTitle, slideNumber: slideCounter })

        slide.background = { fill: '1E293B' }
        slide.addText(sectionTitle, { x: 1.0, y: 2.0, w: 8.0, h: 1.2, fontSize: 38, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', fontFace: 'Arial' })
        slide.addShape(pptx.shapes.LINE, { x: 3.5, y: 3.4, w: 3.0, h: 0.0, line: { color: '3B82F6', width: 3 } })
        // slide.addImage({ path: '/assets/logo.png', x: 8.72, y: 0.25, w: 1.0, h: 0.52 })

        slide.addText('« Back to Contents', {
          x: 0.3, y: 5.15, w: 2.4, h: 0.3,
          fontSize: 10, color: '93C5FD', underline: true, fontFace: 'Arial',
          hyperlink: { slide: TOC_SLIDE_NUMBER, tooltip: 'Back to Contents' },
        })

        return slide
      }

      // ─── HELPER: Add chart (native editable PPT chart) ───
      const addVerticalBarChart = (
        slide: any,
        matrixOrData: any,
        x: number,
        y: number,
        w: number,
        h: number,
        colors?: string[],
        type: 'count' | 'percent' = 'percent'
      ) => {
        let chartData: any[] = []
        let resolvedColors: string[] = []

        if (matrixOrData && typeof matrixOrData === 'object' && !Array.isArray(matrixOrData)) {
          const chartRows = (Array.isArray(matrixOrData.chart) && matrixOrData.chart.length > 0)
            ? matrixOrData.chart.filter((r: any) => r.category !== 'Grand Total')
            : (Array.isArray(matrixOrData.table) ? matrixOrData.table.filter((r: any) => r.category !== 'Grand Total') : [])

          const brands = matrixOrData.brands
          if (Array.isArray(brands) && chartRows.length > 0) {
            const orderedBrands = getOrderedBrands(brands)
            const categories = chartRows.map((r: any) => String(r.category || ''))

            chartData = orderedBrands.map((brand: string) => ({
              name: brand,
              labels: categories,
              values: chartRows.map((r: any) => {
                const pctKey = `${brand}_pct`
                const countKey = `${brand}_count`
                if (type === 'count') {
                  const val = r[countKey] ?? r[brand] ?? 0
                  return typeof val === 'number' ? val : (parseFloat(val) || 0)
                } else {
                  if (r[pctKey] !== undefined && r[pctKey] !== null) {
                    const val = parseFloat(r[pctKey])
                    return !isNaN(val) ? Math.round(val) : 0
                  }
                  const cnt = typeof r[brand] === 'number' ? r[brand] : (parseFloat(r[brand]) || 0)
                  return Math.round(cnt)
                }
              })
            }))

            resolvedColors = getBrandColorsArray(orderedBrands)
          }
        } else if (Array.isArray(matrixOrData)) {
          chartData = matrixOrData
          resolvedColors = colors && colors.length > 0 ? colors : ['00B4D8', '7C3AED', 'F59E0B', '10B981']
        }

        if (!chartData || chartData.length === 0) {
          slide.addText('No chart data available', {
            x, y, w, h,
            fontSize: 10,
            color: '999999',
            align: 'center',
          })
          return
        }

        try {
          slide.addChart(pptx.ChartType.bar, chartData, {
            x, y, w, h,
            barDir: 'col',
            chartColors: resolvedColors,
            showTitle: false,
            showLegend: true,
            legendPos: 'b',
            legendFontSize: 7,
            legendFontFace: 'Arial',
            catAxisLabelFontSize: 7,
            catAxisLabelFontFace: 'Arial',
            valAxisLabelFontSize: 7,
            valAxisMinVal: 0,
            valAxisMaxVal: 100,
            valAxisMajorUnit: 20,
            showValue: true,
            dataLabelFontSize: 7,
            dataLabelColor: '333333',
            dataLabelFontFace: 'Arial',
            dataLabelPosition: 'outEnd',
            // ✅ ADD THIS: Format data labels with percentage symbol
            dataLabelFormatCode: type === 'percent' ? '0"%"' : '0',
            barGapWidthPct: 150,
            barOverlapPct: -30,
            valGridLine: { style: 'none' },
            catGridLine: { style: 'none' },
            valAxisLineShow: true,
            catAxisLineShow: true,
          })
        } catch (err) {
          console.error('Error adding native PPT chart:', err)
          slide.addText('Chart could not be rendered', {
            x, y, w, h,
            fontSize: 10,
            color: '999999',
            align: 'center',
          })
        }
      }

      // ─── SLIDE 1: Title Page ──────────────────────────────────────
      setPptProgress('Generating Slide 1: Title...')
      const slide1 = pptx.addSlide()
      const rawProductBrands = analytics?.age_group?.brands || []
      createTitleSlide(slide1, pptx, rawProductBrands)
      const tocSlide = pptx.addSlide()
      tocSlide.background = { fill: 'FFFFFF' }
      // ─── DIVIDER 1: Demography ───
      addDividerSlide('Demographics')

      setPptProgress('Generating Slide: Location & Model wise Sample Sizes...')
      const slideSample = pptx.addSlide()
      slideSample.background = { fill: 'FFFFFF' }
      addSlideTitle(slideSample, 'Location & Model wise Sample Sizes', 'Sample sizes across cities, brand models, and duration of usage')

      try {
        const sampleData = analytics.location_model_sample_size || {}
        const rawSampleBrands = sampleData.brands || ['TVS HLX125', 'Bajaj BM 125 / Bajaj CT 125']

        const sampleBrands = getOrderedBrands(rawSampleBrands).sort((a: string, b: string) => {
          const aIsTvs = a.toUpperCase().includes('TVS') ? 0 : 1
          const bIsTvs = b.toUpperCase().includes('TVS') ? 0 : 1
          return aIsTvs - bIsTvs
        })

        const sampleTenures = sampleData.tenures || ['3-6 months', '6-12 months']
        const sampleTable = sampleData.table || []

        if (sampleTable.length > 0) {
          const citiesRows = sampleTable.filter((r: any) => r.city !== 'Grand Total')
          const grandTotalRow = sampleTable.find((r: any) => r.city === 'Grand Total') || {}

          const lightBlueBg = 'B3E5FC'
          const lightGrayBg = 'E2E8F0'

          // ── Row 1 Header ── brand cells now BLANK (text added as overlay below)
          const headerRow1: any[] = [
            {
              text: 'City',
              options: {
                fill: lightBlueBg,
                color: '000000',
                bold: true,
                align: 'center',
                valign: 'middle',
                fontSize: 8,
                fontFace: 'Arial',
                border: [
                  { color: '000000', pt: 1 },   // top — solid black
                  { color: '000000', pt: 1 },   // right
                  { color: lightBlueBg, pt: 1 },// bottom — invisible (row2 draws its own top)
                  { color: '000000', pt: 1 },   // left
                ],
              },
            },
          ]

          sampleBrands.forEach((brand: string) => {
            const bgColor = getBrandColor(brand)

            headerRow1.push({
              text: brand,
              options: {
                colspan: sampleTenures.length,
                fill: bgColor,
                color: 'FFFFFF',
                bold: true,
                align: 'center',
                valign: 'middle',
                fontSize: 8,
                fontFace: 'Arial',
                wrap: true,
                border: [
                  { color: '000000', pt: 1 },
                  { color: bgColor, pt: 1 },
                  { color: '000000', pt: 1 },
                  { color: bgColor, pt: 1 },
                ],
              },
            })

            headerRow1.push({
              text: `${brand} Total`,
              options: {
                fill: lightGrayBg,
                color: '000000',
                bold: true,
                align: 'center',
                valign: 'middle',
                fontSize: 8,
                border: [
                  { color: '000000', pt: 1 },
                  { color: '000000', pt: 1 },
                  { color: '000000', pt: 1 },
                  { color: '000000', pt: 1 },
                ],
              },
            })
          })

          headerRow1.push({
            text: 'Grand Total',
            options: {
              fill: lightGrayBg,
              color: '000000',
              bold: true,
              align: 'center',
              valign: 'middle',
              fontSize: 8,
              border: [
                { color: '000000', pt: 1 },   // top — solid black
                { color: '000000', pt: 1 },   // right
                { color: lightGrayBg, pt: 1 },// bottom — invisible (row2 draws its own top)
                { color: '000000', pt: 1 },   // left
              ],
            },
          })
          // ── Row 2 Sub-headers ──
          const headerRow2: any[] = [
            {
              text: '',
              options: {
                fill: lightBlueBg,
                border: [
                  { color: '000000', pt: 1 },
                  { color: '000000', pt: 1 },
                  { color: '000000', pt: 1 },
                  { color: '000000', pt: 1 },
                ],
              },
            },
          ]


          sampleBrands.forEach((brand: string) => {
            sampleTenures.forEach((tenure: string) => {
              headerRow2.push({
                text: tenure,
                options: {
                  fill: lightBlueBg,
                  color: '000000',
                  bold: true,
                  align: 'center',
                  valign: 'middle',
                  fontSize: 8,
                  border: [
                    { color: '000000', pt: 1 },
                    { color: '000000', pt: 1 },
                    { color: '000000', pt: 1 },
                    { color: '000000', pt: 1 },
                  ],
                },
              })
            })
            headerRow2.push({
              text: 'Total',
              options: {
                fill: lightGrayBg,
                color: '000000',
                bold: true,
                align: 'center',
                valign: 'middle',
                fontSize: 8,
                border: [
                  { color: '000000', pt: 1 },
                  { color: '000000', pt: 1 },
                  { color: '000000', pt: 1 },
                  { color: '000000', pt: 1 },
                ],
              },
            })
          })

          headerRow2.push({
            text: '',
            options: {
              fill: lightGrayBg,
              border: [
                { color: '000000', pt: 1 },
                { color: '000000', pt: 1 },
                { color: '000000', pt: 1 },
                { color: '000000', pt: 1 },
              ],
            },
          })

          const allRows: any[][] = [headerRow1, headerRow2]

          citiesRows.forEach((row: any) => {
            const dataRow: any[] = [
              { text: String(row.city || ''), options: { align: 'center', bold: true, fontSize: 8 } }
            ]

            sampleBrands.forEach((brand: string) => {
              const brandTotKey = `${brand}_total`
              const brandTotalVal = row[brandTotKey] ?? row[`${brand.split('/')[0].trim()}_total`] ?? 0

              sampleTenures.forEach((tenure: string) => {
                const key = `${brand}_${tenure}`
                const val = row[key] ?? row[`${brand}_${tenure.replace(/\s+/g, '')}`] ?? 0
                dataRow.push({ text: String(val), options: { align: 'center', fontSize: 8 } })
              })

              dataRow.push({ text: String(brandTotalVal), options: { align: 'center', bold: true, fill: 'F8FAFC', fontSize: 8 } })
            })

            const gTotal = row.grand_total ?? row.grandTotal ?? 0
            dataRow.push({ text: String(gTotal), options: { align: 'center', bold: true, fill: 'F8FAFC', fontSize: 8 } })

            allRows.push(dataRow)
          })

          const gtRow: any[] = [
            { text: 'Grand Total', options: { align: 'center', bold: true, fill: lightBlueBg, fontSize: 8 } }
          ]

          sampleBrands.forEach((brand: string) => {
            const brandTotKey = `${brand}_total`
            const brandTotalVal = grandTotalRow[brandTotKey] ?? grandTotalRow[`${brand.split('/')[0].trim()}_total`] ?? 0

            sampleTenures.forEach((tenure: string) => {
              const key = `${brand}_${tenure}`
              const val = grandTotalRow[key] ?? grandTotalRow[`${brand}_${tenure.replace(/\s+/g, '')}`] ?? 0
              gtRow.push({ text: String(val), options: { align: 'center', bold: true, fill: lightBlueBg, fontSize: 8 } })
            })

            gtRow.push({ text: String(brandTotalVal), options: { align: 'center', bold: true, fill: lightBlueBg, fontSize: 8 } })
          })

          const overallGrand = grandTotalRow.grand_total ?? grandTotalRow.grandTotal ?? 0
          gtRow.push({ text: String(overallGrand), options: { align: 'center', bold: true, fill: lightBlueBg, fontSize: 8 } })

          allRows.push(gtRow)

          // ── Proportional colW (fits slide regardless of brand count) ──
          const targetTableWidth = 9.4
          const cityRatio = 0.85
          const tenureRatio = 0.72
          const brandTotalRatio = 0.95
          const grandTotalRatio = 1.3

          const rawTotal = cityRatio
            + sampleBrands.length * (sampleTenures.length * tenureRatio + brandTotalRatio)
            + grandTotalRatio

          const scale = targetTableWidth / rawTotal

          const cityColW = +(cityRatio * scale).toFixed(3)
          const tenureColW = +(tenureRatio * scale).toFixed(3)
          const brandTotalColW = +(brandTotalRatio * scale).toFixed(3)
          const grandTotalColW = +(grandTotalRatio * scale).toFixed(3)

          const colW = [
            cityColW,
            ...sampleBrands.flatMap(() => [
              ...sampleTenures.map(() => tenureColW),
              brandTotalColW
            ]),
            grandTotalColW
          ]

          const tableWidth = colW.reduce((a, b) => a + b, 0)

          // ── Explicit row heights so we can precisely overlay text on row 1 ──
          const headerRowH = 0.4   // taller to comfortably fit 2-line brand names
          const subHeaderRowH = 0.3
          const dataRowH = 0.25
          const rowH = [headerRowH, subHeaderRowH, ...citiesRows.map(() => dataRowH), dataRowH]

          const tableX = 0.3
          const tableY = 1.2

          slideSample.addTable(allRows, {
            x: tableX, y: tableY, w: tableWidth,
            border: { type: 'solid', color: '000000', size: 1 },
            fontSize: 8,
            fontFace: 'Arial',
            colW: colW,
            rowH: rowH,
            align: 'center',
          })

          // ── Overlay brand name text boxes, centered over each merged block ──

        }
      } catch (e: any) {
        console.error('[PPT] SLIDE LOCATION SAMPLE ERROR:', e)
      }
      // ─── SLIDE 2: Age Group Distribution & City Cross-tabulation ──
      setPptProgress('Generating Slide 2: Age Group Distribution & City Cross-tabulation...')
      const slide2 = pptx.addSlide()
      slide2.background = { fill: 'FFFFFF' }

      addSlideTitle(slide2, 'Age Group Distribution & City Cross-tabulation', 'Distribution of respondents by age category and city')

      try {
        if (analytics.age_group && Array.isArray(analytics.age_group.brands) && analytics.age_group.brands.length > 0) {
          addMatrixTable(slide2, analytics.age_group, 'Age Group', 0.3, 1.3, 4.6, 1.8)

          slide2.addText('Age Group Distribution Chart', {
            x: 5.1, y: 1.2, w: 4.6, h: 0.2,
            fontSize: 9, bold: true, color: '6C63FF', align: 'center'
          })
          addVerticalBarChart(slide2, analytics.age_group, 5.1, 1.48, 4.6, 1.8, undefined, 'percent')
        }

        if (analytics.age_city && Array.isArray(analytics.age_city.brands) && analytics.age_city.brands.length > 0) {
          slide2.addText('Age Group by City & Brand (Cross-tabulation)', {
            x: 0.3, y: 3.25, w: 9.4, h: 0.2,
            fontSize: 10, bold: true, color: '1E293B', align: 'center'
          })
          addAgeCityTableFullWidth(slide2, analytics.age_city, 0.3, 3.5, 9.4, 3.35)
        }
      } catch (e: any) {
        console.error('[PPT] SLIDE 2 ERROR:', e);
        slide2.addText(`Slide 2 error: ${e?.message}`, {
          x: 0.3, y: 2.0, w: 9.4, h: 0.5,
          fontSize: 10, color: 'CC0000', align: 'center'
        })
      }
      // ─── SLIDE 3: Mode of Purchase & Ownership ──────────────────
      setPptProgress('Generating Slide 3: Mode of Purchase & Ownership...')
      const slide3 = pptx.addSlide()
      slide3.background = { fill: 'FFFFFF' }

      addSlideTitle(slide3, 'Mode of Purchase & Ownership', 'Purchase channel preferences & ownership distribution')

      // ─── SLIDE 3 ──────────────────────────────────────────────────
      try {
        if (analytics.mode_of_purchase && Array.isArray(analytics.mode_of_purchase.brands) && analytics.mode_of_purchase.brands.length > 0) {
          slide3.addText('Mode of Purchase', {
            x: 0.3, y: 1.3, w: 4.4, h: 0.2,
            fontSize: 10, bold: true, color: '1E293B', align: 'center'
          })
          addMatrixTable(slide3, analytics.mode_of_purchase, 'Mode of Purchase', 0.3, 1.55, 4.4, 1.4)

          slide3.addText('Mode of Purchase Chart', {
            x: 0.3, y: 2.98, w: 4.4, h: 0.18,
            fontSize: 8, bold: true, color: '6C63FF', align: 'center'
          })
          addVerticalBarChart(slide3, analytics.mode_of_purchase, 0.3, 3.18, 4.4, 2.0, undefined, 'percent')
        }

        if (analytics.ownership && Array.isArray(analytics.ownership.brands) && analytics.ownership.brands.length > 0) {
          slide3.addText('Ownership', {
            x: 5.3, y: 1.3, w: 4.4, h: 0.2,
            fontSize: 10, bold: true, color: '1E293B', align: 'center'
          })
          addMatrixTable(slide3, analytics.ownership, 'Ownership', 5.3, 1.55, 4.4, 1.4)

          slide3.addText('Ownership Chart', {
            x: 5.3, y: 2.98, w: 4.4, h: 0.18,
            fontSize: 8, bold: true, color: '6C63FF', align: 'center'
          })
          addVerticalBarChart(slide3, analytics.ownership, 5.3, 3.18, 4.4, 2.0, undefined, 'percent')
        }
      } catch (e: any) {
        console.error('[PPT] SLIDE 3 ERROR:', e);
        slide3.addText(`Slide 3 error: ${e?.message}`, {
          x: 0.3, y: 2.0, w: 9.4, h: 0.5,
          fontSize: 10, color: 'CC0000', align: 'center'
        })
      }

      // ─── SLIDE: Vehicle Usage Purpose ──────────────────────────
      setPptProgress('Generating Slide: Vehicle Usage Purpose...')
      const slideUsage = pptx.addSlide()
      slideUsage.background = { fill: 'FFFFFF' }
      addSlideTitle(slideUsage, 'Vehicle Usage Purpose', 'Vehicle usage purpose distribution by brand')

      try {
        if (analytics.vehicle_usage && Array.isArray(analytics.vehicle_usage.brands) && analytics.vehicle_usage.brands.length > 0) {
          slideUsage.addText('Vehicle Usage Purpose Chart', {
            x: 0.3, y: 0.95, w: 9.4, h: 0.2,
            fontSize: 9, bold: true, color: '6C63FF', align: 'center'
          })
          addVerticalBarChart(slideUsage, analytics.vehicle_usage, 0.3, 1.15, 9.4, 2.0, undefined, 'percent')

          // Bottom: Table with existing brand colors
          slideUsage.addText('Vehicle Usage Purpose Table', {
            x: 0.3, y: 3.25, w: 9.4, h: 0.2,
            fontSize: 9, bold: true, color: '1E293B', align: 'center'
          })
          addMatrixTable(slideUsage, analytics.vehicle_usage, 'Vehicle usage', 0.3, 3.48, 9.4, 1.8)
        }
      } catch (e: any) {
        console.error('[PPT] SLIDE VEHICLE USAGE ERROR:', e)
      }

      setPptProgress('Generating Slide 4: User Profession Distribution...')
      const slide4 = pptx.addSlide()
      slide4.background = { fill: 'FFFFFF' }
      addSlideTitle(slide4, 'User Profession Distribution', 'Professional background of survey respondents')

      try {
        let profMatrix = analytics.profession || analytics.professions
        if (!profMatrix) {
          const professionKey = Object.keys(analytics).find(key => key.toLowerCase().includes('profession'))
          if (professionKey) profMatrix = analytics[professionKey]
        }

        const hasProfData = profMatrix &&
          typeof profMatrix === 'object' &&
          !Array.isArray(profMatrix) &&
          profMatrix.brands &&
          Array.isArray(profMatrix.brands) &&
          profMatrix.brands.length > 0

        if (hasProfData) {
          // ─── MOVED TO LEFT-MIDDLE ───
          // Heading moved down from y: 1.0 to y: 2.2
          slide4.addText('Profession Distribution', {
            x: 0.3, y: 1.80, w: 4.4, h: 0.25,
            fontSize: 10, bold: true, color: '1E293B', align: 'center'
          })

          // Table moved down from y: 1.3 to y: 2.5
          if (Array.isArray(profMatrix.table) && profMatrix.table.length > 0) {
            addMatrixTable(slide4, profMatrix, 'Profession', 0.5, 2.1, 4.4, 3.0, true)
          }

          // Right side chart - keep at same position (Top)
          slide4.addText('Profession Distribution by Brand', {
            x: 5.3, y: 1.0, w: 4.4, h: 0.25,
            fontSize: 9, bold: true, color: '6C63FF', align: 'center'
          })
          addVerticalBarChart(slide4, profMatrix, 5.3, 1.3, 4.4, 3.8, undefined, 'percent')
        } else {
          slide4.addText('Profession data not available for current filters.', {
            x: 0.3, y: 2.5, w: 9.4, h: 0.8,
            fontSize: 14, bold: true, color: '999999', align: 'center', valign: 'middle'
          })
        }
      } catch (e: any) {
        console.error('[PPT] SLIDE 4 ERROR:', e)
        slide4.addText(`Slide 4 error: ${e?.message || 'Unknown error'}`, {
          x: 0.3, y: 2.0, w: 9.4, h: 0.5,
          fontSize: 10, color: 'CC0000', align: 'center'
        })
      }



      // ─── DIVIDER 2: NPS ───
      addDividerSlide('NPS')

      // ============================================================================
      // NPS SLIDES (Inserted after Profession slide)
      // ============================================================================
      if (nps && nps.brands) {


        // ─── SLIDE 5: Will you recommend your vehicle? (Brand-wise) ───
        setPptProgress('Generating Slide: Will you recommend your vehicle?')
        const slide5 = pptx.addSlide()
        addSlideTitle(slide5, 'Will you recommend your vehicle to your friends / relatives / family members?', '')

        // Left side: Model Base table
        slide5.addText('Model', {
          x: 0.3, y: 1.15, w: 2.0, h: 0.3,
          fill: 'E0E0E0', color: '333333', bold: true, align: 'left', fontSize: 10,
          border: { type: 'solid', color: 'CCCCCC', pt: 1 },
          line: { color: 'CCCCCC', width: 1 }
        })
        slide5.addText('Base', {
          x: 2.3, y: 1.15, w: 1.0, h: 0.3,
          fill: 'E0E0E0', color: '333333', bold: true, align: 'center', fontSize: 10,
          border: { type: 'solid', color: 'CCCCCC', pt: 1 },
          line: { color: 'CCCCCC', width: 1 }
        })

        let currentY = 1.45
        orderedNpsBrands.forEach((brand) => {
          const brandData = nps.recommend_vehicle_pie?.find((d: any) => d.brand === brand)
          const base = brandData ? (brandData.yes + brandData.no) : 0

          slide5.addText(brand, {
            x: 0.3, y: currentY, w: 2.0, h: 0.3,
            fill: getBrandColor(brand), color: 'FFFFFF', bold: true, align: 'left', fontSize: 9,
            border: { type: 'solid', color: 'CCCCCC', pt: 1 },
            line: { color: 'CCCCCC', width: 1 }
          })
          slide5.addText(String(base), {
            x: 2.3, y: currentY, w: 1.0, h: 0.3,
            color: '333333', align: 'center', fontSize: 9,
            border: { type: 'solid', color: 'CCCCCC', pt: 1 },
            line: { color: 'CCCCCC', width: 1 }
          })
          currentY += 0.3
        })

        // Right side: Pie Charts
        // Right side: Pie Charts (styled to match reference image)
        const pieCount = orderedNpsBrands.length
        const pieSize = 2.0                    // bigger pie, like the image
        const pieGap = 0.3
        const totalPieWidth = pieCount * pieSize + (pieCount - 1) * pieGap
        let pieX = 1.3 + Math.max(0, (6.4 - totalPieWidth) / 2)  // center in remaining space

        orderedNpsBrands.forEach((brand) => {
          const brandData = nps.recommend_vehicle_pie?.find((d: any) => d.brand === brand)
          if (brandData && (brandData.yes > 0 || brandData.no > 0)) {
            const chartData = [
              { name: 'Recommendation', labels: ['Yes', 'No'], values: [brandData.yes, brandData.no] }
            ]

            // Title above pie — bold, dark, matches image style
            slide5.addText(brand, {
              x: pieX, y: 3.0, w: pieSize, h: 0.35,
              color: '1E293B', bold: true, align: 'center', fontSize: 8, fontFace: 'Arial'
            })

            slide5.addChart(pptx.charts.PIE, chartData, {
              x: pieX, y: 3.2, w: pieSize, h: pieSize,
              showLegend: true,
              legendPos: 'b',
              legendFontSize: 9,
              showTitle: false,
              dataLabelFormatCode: '0%',
              showValue: false,
              showPercent: true,
              dataLabelColor: 'FFFFFF',
              dataLabelFontSize: 8,
              dataLabelFontFace: 'Arial',
              dataLabelPosition: 'ctr',
              chartColors: ['4CAF50', 'F44336'],  // green / red, matches image
              chartColorsOpacity: 100,
            })

            pieX += pieSize + pieGap
          }
        })


        // ─── SLIDE 6: Likelihood to Recommend (Overall Product) ───
        setPptProgress('Generating Slide: Overall Product Likelihood...')
        const slide6 = pptx.addSlide()
        slide6.background = { fill: 'FFFFFF' }
        addSlideTitle(slide6, 'Overall Product', '')

        // ─── Model / Base table (top-left) ───
        slide6.addText('MODEL', {
          x: 0.3, y: 1.0, w: 1.4, h: 0.35,
          fill: 'BEBEBE', color: '333333', bold: true, align: 'center', valign: 'middle', fontSize: 10,
          border: { type: 'solid', color: 'CCCCCC', pt: 1 },
          line: { color: 'CCCCCC', width: 1 }
        })
        slide6.addText('BASE', {
          x: 1.7, y: 1.0, w: 1.0, h: 0.35,
          fill: 'BEBEBE', color: '333333', bold: true, align: 'center', valign: 'middle', fontSize: 10,
          border: { type: 'solid', color: 'CCCCCC', pt: 1 },
          line: { color: 'CCCCCC', width: 1 }
        })

        const tableRowH = 0.4
        let modelRowY = 1.35
        orderedNpsBrands.forEach((brand) => {
          const bd = nps.recommend_category_bar?.find((d: any) => d.brand === brand)
          const base = bd ? (bd.yes + bd.maybe + bd.no) : 0
          slide6.addText(brand, {
            x: 0.3, y: modelRowY, w: 1.4, h: tableRowH,
            fill: getBrandColor(brand), color: 'FFFFFF', bold: true, align: 'center', valign: 'middle', fontSize: 8.5,
            border: { type: 'solid', color: 'CCCCCC', pt: 1 },
            line: { color: 'CCCCCC', width: 1 }
          })
          slide6.addText(String(base), {
            x: 1.7, y: modelRowY, w: 1.0, h: tableRowH,
            fill: 'FFFFFF', color: '333333', bold: true, align: 'center', valign: 'middle', fontSize: 9,
            border: { type: 'solid', color: 'CCCCCC', pt: 1 },
            line: { color: 'CCCCCC', width: 1 }
          })
          modelRowY += tableRowH
        })
        const tableBottomY = modelRowY

        // ─── Badges (top-center, stacked) - MATCH SLIDE N+ ───
        slide6.addText('BEST IN MARKET', {
          x: 3.7, y: 0.95, w: 2.6, h: 0.28,
          fill: '4CAF50', color: 'FFFFFF', bold: true, align: 'center', valign: 'middle', fontSize: 10
        })
        slide6.addText('SCOPE OF IMPROVEMENT', {
          x: 3.7, y: 1.25, w: 2.6, h: 0.28,
          fill: 'F44336', color: 'FFFFFF', bold: true, align: 'center', valign: 'middle', fontSize: 10
        })

        // ─── Legend - MATCH SLIDE N+ (smaller) ───
        const NPS_COLORS = ['4CAF50', 'FFC107', 'F44336']
        const legendItems6 = [
          { label: 'Promoter', color: NPS_COLORS[0] },
          { label: 'Passive', color: NPS_COLORS[1] },
          { label: 'Detractor', color: NPS_COLORS[2] },
        ]
        const LEGEND_BOX = 0.10
        const LEGEND_FONT = 8
        const legendItemW = 0.9
        const legendTotalW = legendItems6.length * legendItemW
        let legendX6 = (10 - legendTotalW) / 2 + 0.15
        const legendY = 1.65

        legendItems6.forEach((item) => {
          slide6.addShape(pptx.ShapeType.rect, {
            x: legendX6, y: legendY, w: LEGEND_BOX, h: LEGEND_BOX,
            fill: { color: item.color }, line: { color: item.color, transparency: 100 }
          })
          slide6.addText(item.label, {
            x: legendX6 + 0.16, y: legendY - 0.05, w: 0.75, h: 0.22,
            color: '333333', fontSize: LEGEND_FONT, align: 'left', valign: 'middle', fontFace: 'Calibri'
          })
          legendX6 += legendItemW
        })

        // ─── Overall Label - ADJUSTED POSITION ───
        const overallY = 1.97
        const overallH = 0.25
        slide6.addText('Overall', {
          x: 3.9, y: overallY, w: 2.6, h: overallH,
          color: '1E293B', bold: true, align: 'center', fontSize: 10, fontFace: 'Calibri'
        })
        const overallBottomY = overallY + overallH

        // ─── Build chart data ───
        const chartData6: any[] = [
          { name: 'Promoter', labels: [], values: [] },
          { name: 'Passive', labels: [], values: [] },
          { name: 'Detractor', labels: [], values: [] },
        ]
        const npsScores6: { brand: string; nps: number }[] = []

        orderedNpsBrands.forEach((brand) => {
          const bd = nps.recommend_category_bar?.find((d: any) => d.brand === brand)
          const base = bd ? (bd.yes + bd.maybe + bd.no) : 0

          const yesPct = base > 0 && bd ? Math.round((bd.yes / base) * 100) : 0
          const maybePct = base > 0 && bd ? Math.round((bd.maybe / base) * 100) : 0
          const noPct = base > 0 && bd ? Math.round((bd.no / base) * 100) : 0

          chartData6[0].labels.push(brand); chartData6[0].values.push(yesPct)
          chartData6[1].labels.push(brand); chartData6[1].values.push(maybePct)
          chartData6[2].labels.push(brand); chartData6[2].values.push(noPct)

          npsScores6.push({ brand, nps: yesPct - noPct })
        })

        const bestBrand6 = npsScores6.reduce((best, cur) => (cur.nps > best.nps ? cur : best), npsScores6[0])

        // ─── DYNAMIC POSITIONING (like city-wise slides) ───
        const npsBoxY = Math.max(tableBottomY, overallBottomY) + 0.2  // DYNAMIC, not fixed
        const npsBoxH = 0.4
        const chartGap = 0.15
        const barsTopY = npsBoxY + npsBoxH + chartGap

        const chartW6 = 7.2
        const chartX6 = (10 - chartW6) / 2
        const barsH = 2.2
        const numBrands6 = orderedNpsBrands.length

        const PLOT_LAYOUT = { x: 0.02, y: 0.08, w: 0.96, h: 0.72 }

        slide6.addChart(pptx.charts.BAR, chartData6, {
          x: chartX6, y: barsTopY, w: chartW6, h: barsH,
          layout: PLOT_LAYOUT,
          barDir: 'col',
          barGrouping: 'clustered',
          showLegend: false,
          showTitle: false,
          chartColors: NPS_COLORS,
          showValue: true,
          dataLabelPosition: 'outEnd',
          dataLabelFontSize: 9,
          dataLabelFontFace: 'Arial',
          dataLabelColor: '333333',
          dataLabelFormatCode: '0"%"',
          valAxisHidden: false,
          valAxisLineShow: false,
          valAxisLineColor: '6a6a6a',
          valAxisLabelFontSize: 8,
          valAxisLabelColor: '1E293B',
          valAxisLabelFormatCode: '0"%"',
          valAxisLabelPos: 'none',
          valAxisMajorTickMark: 'none',
          valAxisMinorTickMark: 'none',
          valAxisMaxVal: 100,
          valAxisMinVal: 0,
          valGridLine: { style: 'none' },
          catAxisLineShow: true,
          catAxisLineColor: '6a6a6a',
          catAxisLabelPos: 'low',
          catAxisLabelFontSize: 8,
          barGapWidthPct: 180,
          barOverlapPct: -35,
        })

        // ─── NPS score boxes ───
        const plotX6 = chartX6 + PLOT_LAYOUT.x * chartW6
        const plotW6 = PLOT_LAYOUT.w * chartW6
        const plotH6 = PLOT_LAYOUT.h * barsH
        const groupW6 = plotW6 / numBrands6

        npsScores6.forEach((item, idx) => {
          const boxW = Math.min(1.4, groupW6 * 0.85)
          const boxX = plotX6 + idx * groupW6 + (groupW6 - boxW) / 2
          const isBest = bestBrand6 ? item.brand === bestBrand6.brand : false
          const isTvsBest = isBest && !!bestBrand6 && bestBrand6.brand.includes('TVS')
          const boxColor = isBest ? (isTvsBest ? '4CAF50' : 'F44336') : '999999'

          slide6.addText(`NPS ${item.nps}%`, {
            x: boxX, y: npsBoxY, w: boxW, h: npsBoxH,
            fill: { color: 'FFFFFF' },
            color: '333333', bold: true, align: 'center', valign: 'middle', fontSize: 9,
            line: { color: boxColor, width: 2 },
          })
        })
        // ─── SLIDE 7+: City-Wise ───
        if (nps.city_grid && nps.city_grid.length > 0) {
          setPptProgress('Generating Slides: City-wise Likelihood...')

          nps.city_grid.forEach((cityRow: any) => {
            const cityName = cityRow.city || 'Unknown City'
            const slideC = pptx.addSlide()
            slideC.background = { fill: 'FFFFFF' }
            addSlideTitle(slideC, `${cityName} - City-wise Likelihood to Recommend`, '')

            // ─── Model / Base table (top-left) ───
            slideC.addText('MODEL', {
              x: 0.3, y: 1.0, w: 1.4, h: 0.35,
              fill: 'BEBEBE', color: '333333', bold: true, align: 'center', valign: 'middle', fontSize: 10,
              border: { type: 'solid', color: 'CCCCCC', pt: 1 },
              line: { color: 'CCCCCC', width: 1 }
            })
            slideC.addText('BASE', {
              x: 1.7, y: 1.0, w: 1.0, h: 0.35,
              fill: 'BEBEBE', color: '333333', bold: true, align: 'center', valign: 'middle', fontSize: 10,
              border: { type: 'solid', color: 'CCCCCC', pt: 1 },
              line: { color: 'CCCCCC', width: 1 }
            })

            const tableRowHC = 0.4
            let modelRowYC = 1.35

            // ─── Build chart data as PERCENTAGES of each brand's base (yes+maybe+no), not raw counts ───
            const chartDataC: any[] = [
              { name: 'Promoter', labels: [], values: [] },
              { name: 'Passive', labels: [], values: [] },
              { name: 'Detractor', labels: [], values: [] },
            ]
            const npsScoresC: { brand: string; nps: number }[] = []

            orderedNpsBrands.forEach((brand) => {
              const yes = cityRow[`${brand}_Yes`] || 0
              const maybe = cityRow[`${brand}_Maybe`] || 0
              const no = cityRow[`${brand}_No`] || 0
              const base = yes + maybe + no

              // Table row
              slideC.addText(brand, {
                x: 0.3, y: modelRowYC, w: 1.4, h: tableRowHC,
                fill: getBrandColor(brand), color: 'FFFFFF', bold: true, align: 'center', valign: 'middle', fontSize: 8.5,
                border: { type: 'solid', color: 'CCCCCC', pt: 1 },
                line: { color: 'CCCCCC', width: 1 }
              })
              slideC.addText(String(base), {
                x: 1.7, y: modelRowYC, w: 1.0, h: tableRowHC,
                fill: 'FFFFFF', color: '333333', bold: true, align: 'center', valign: 'middle', fontSize: 9,
                border: { type: 'solid', color: 'CCCCCC', pt: 1 },
                line: { color: 'CCCCCC', width: 1 }
              })
              modelRowYC += tableRowHC

              // Percentages, not counts
              const yesPct = base > 0 ? Math.round((yes / base) * 100) : 0
              const maybePct = base > 0 ? Math.round((maybe / base) * 100) : 0
              const noPct = base > 0 ? Math.round((no / base) * 100) : 0

              chartDataC[0].labels.push(brand); chartDataC[0].values.push(yesPct)
              chartDataC[1].labels.push(brand); chartDataC[1].values.push(maybePct)
              chartDataC[2].labels.push(brand); chartDataC[2].values.push(noPct)

              npsScoresC.push({ brand, nps: yesPct - noPct })
            })
            const tableBottomYC = modelRowYC

            // ─── Badges (top-center, stacked) ───
            slideC.addText('BEST IN MARKET', {
              x: 3.7, y: 0.95, w: 2.6, h: 0.28,    // Changed x to 3.7, y to 0.95, h to 0.28
              fill: '4CAF50', color: 'FFFFFF', bold: true, align: 'center', valign: 'middle', fontSize: 10
            })
            slideC.addText('SCOPE OF IMPROVEMENT', {
              x: 3.7, y: 1.25, w: 2.6, h: 0.28,    // Changed x to 3.7, y to 1.25, h to 0.28
              fill: 'F44336', color: 'FFFFFF', bold: true, align: 'center', valign: 'middle', fontSize: 10
            })

            // ─── Legend — green (Yes) / yellow (Maybe) / red (No) ───
            const NPS_COLORS_C = ['4CAF50', 'FFC107', 'F44336']
            const legendItemsC = [
              { label: 'Promoter', color: NPS_COLORS_C[0] },
              { label: 'Passive', color: NPS_COLORS_C[1] },
              { label: 'Detractor', color: NPS_COLORS_C[2] },
            ]
            const LEGEND_BOX = 0.10        // Changed from 0.14
            const LEGEND_FONT = 8          // Changed from 9
            const legendItemW = 0.9        // Changed from 1.15 spacing
            const legendTotalW = legendItemsC.length * legendItemW
            let legendXC = (10 - legendTotalW) / 2 + 0.15    // Centered like Slide N+
            const legendY = 1.65           // Changed from 1.80

            legendItemsC.forEach((item) => {
              slideC.addShape(pptx.ShapeType.rect, {
                x: legendXC, y: legendY, w: LEGEND_BOX, h: LEGEND_BOX,
                fill: { color: item.color }, line: { color: item.color, transparency: 100 }
              })
              slideC.addText(item.label, {
                x: legendXC + 0.16, y: legendY - 0.05, w: 0.75, h: 0.22,    // Adjusted positioning
                color: '333333', fontSize: LEGEND_FONT, align: 'left', valign: 'middle', fontFace: 'Calibri'
              })
              legendXC += legendItemW    // Changed from 1.15
            })
            const overallYC = 1.97        // Changed from 2.08
            const overallHC = 0.25
            slideC.addText('Overall', {
              x: 3.9, y: overallYC, w: 2.6, h: overallHC,
              color: '1E293B', bold: true, align: 'center', fontSize: 10, fontFace: 'Calibri'
            })
            const overallBottomYC = overallYC + overallHC

            const bestBrandC = npsScoresC.reduce((best, cur) => (cur.nps > best.nps ? cur : best), npsScoresC[0])

            // ─── Vertical layout (dynamic — never overlaps table or "Overall" label) ───
            const npsBoxYC = Math.max(tableBottomYC, overallBottomYC) + 0.2
            const npsBoxHC = 0.4
            const chartGapC = 0.15
            const barsTopYC = npsBoxYC + npsBoxHC + chartGapC

            // ─── Smaller, centered chart with gaps between bars ───
            const chartWC = 7.2
            const chartXC = (10 - chartWC) / 2
            const barsHC = 2.2
            const numBrandsC = orderedNpsBrands.length

            const PLOT_LAYOUT_C = { x: 0.02, y: 0.08, w: 0.96, h: 0.72 }

            slideC.addChart(pptx.charts.BAR, chartDataC, {
              x: chartXC, y: barsTopYC, w: chartWC, h: barsHC,
              layout: PLOT_LAYOUT_C,
              barDir: 'col',
              barGrouping: 'clustered',
              showLegend: false,
              showTitle: false,
              chartColors: NPS_COLORS_C,
              showValue: true,
              dataLabelPosition: 'outEnd',
              dataLabelFontSize: 9,
              dataLabelFontFace: 'Arial',
              dataLabelColor: '333333',
              dataLabelFormatCode: '0"%"',
              valAxisHidden: false,
              valAxisLineShow: false,
              valAxisLineColor: '6a6a6a',
              valAxisLabelFontSize: 8,
              valAxisLabelColor: '1E293B',
              valAxisLabelFormatCode: '0"%"',
              valAxisLabelPos: 'none',
              valAxisMajorTickMark: 'none',
              valAxisMinorTickMark: 'none',
              valAxisMaxVal: 100,
              valAxisMinVal: 0,
              valGridLine: { style: 'none' },
              catAxisLineShow: true,
              catAxisLineColor: '6a6a6a',
              catAxisLabelPos: 'low',
              catAxisLabelFontSize: 8,
              barGapWidthPct: 180,   // gap between brand groups
              barOverlapPct: -35,    // gap between Yes/Maybe/No bars within a group
            })

            // ─── NPS score boxes, aligned to the locked plot area ───
            const plotXC = chartXC + PLOT_LAYOUT_C.x * chartWC
            const plotWC = PLOT_LAYOUT_C.w * chartWC
            const plotHC = PLOT_LAYOUT_C.h * barsHC
            const groupWC = plotWC / numBrandsC

            npsScoresC.forEach((item, idx) => {
              const boxW = Math.min(1.4, groupWC * 0.85)
              const boxX = plotXC + idx * groupWC + (groupWC - boxW) / 2
              const isBest = bestBrandC ? item.brand === bestBrandC.brand : false
              const isTvsBest = isBest && !!bestBrandC && bestBrandC.brand.includes('TVS')
              const boxColor = isBest ? (isTvsBest ? '4CAF50' : 'F44336') : '999999'

              slideC.addText(`NPS ${item.nps}%`, {
                x: boxX, y: npsBoxYC, w: boxW, h: npsBoxHC,
                fill: { color: 'FFFFFF' },
                color: '333333', bold: true, align: 'center', valign: 'middle', fontSize: 9,
                line: { color: boxColor, width: 2 },
              })
            })
          })
        }

        // ─── SLIDE N+: City-wise Duration Segmentation (Combined Slide) ───
        // ─── SLIDE N+: City-wise Duration Segmentation (Combined Slide) ───
        if (nps.city_duration_segmentation && nps.city_duration_segmentation.length > 0) {
          setPptProgress('Generating Slide: City-wise Duration Segmentation...')

          const SLIDE_W = 10

          nps.city_duration_segmentation.forEach((cityObj: any) => {
            const cityName = cityObj.city || 'Unknown City'
            const slideD = pptx.addSlide()
            slideD.background = { fill: 'FFFFFF' }
            addSlideTitle(slideD, `${cityName} - City-wise Duration of Usage Segmentation`, 'Likelihood to Recommend by usage duration')

            const durations = cityObj.durations || []
            const numBlocks = durations.length

            // ─── Shared badges ───
            const badgeW = 2.6
            const badgeX = (SLIDE_W - badgeW) / 2
            slideD.addText('BEST IN MARKET', {
              x: badgeX, y: 0.95, w: badgeW, h: 0.28,
              fill: '4CAF50', color: 'FFFFFF', bold: true, align: 'center', valign: 'middle', fontSize: 10
            })
            slideD.addText('SCOPE OF IMPROVEMENT', {
              x: badgeX, y: 1.25, w: badgeW, h: 0.28,
              fill: 'F44336', color: 'FFFFFF', bold: true, align: 'center', valign: 'middle', fontSize: 10
            })

            // ─── Shared legend ───
            const NPS_COLORS_D = ['4CAF50', 'FFC107', 'F44336']
            const legendItemsD = [
              { label: 'Promoter', color: NPS_COLORS_D[0] },
              { label: 'Passive', color: NPS_COLORS_D[1] },
              { label: 'Detractor', color: NPS_COLORS_D[2] },
            ]
            const LEGEND_BOX = 0.10
            const LEGEND_FONT = 8
            const legendItemW = 0.9
            const legendTotalW = legendItemsD.length * legendItemW
            let legendXD = (SLIDE_W - legendTotalW) / 2 + 0.15
            const legendY = 1.65
            legendItemsD.forEach((item) => {
              slideD.addShape(pptx.ShapeType.rect, {
                x: legendXD, y: legendY, w: LEGEND_BOX, h: LEGEND_BOX,
                fill: { color: item.color }, line: { color: item.color, transparency: 100 }
              })
              slideD.addText(item.label, {
                x: legendXD + 0.16, y: legendY - 0.05, w: 0.75, h: 0.22,
                color: '333333', fontSize: LEGEND_FONT, align: 'left', valign: 'middle', fontFace: 'Calibri'
              })
              legendXD += legendItemW
            })

            // ─── Tables pinned to outer edges (KEEP AS IS) ───
            const tableW = 1.9
            const tableX_left = 0.3
            const tableX_right = SLIDE_W - 0.3 - tableW
            const tableTopY = 0.95
            const HEADER_H = 0.24
            const ROW_H = 0.22
            const ROW_H_LONG = 0.3

            // ─── INCREASED CHART WIDTH (MAXIMUM) ───
            const chartWC = 9.6  // INCREASED from 9.0 to 9.6 for maximum width
            const chartXC = (SLIDE_W - chartWC) / 2  // Center aligned

            // Calculate block width based on fixed total chart width
            const blockGap = 0.2  // REDUCED from 0.3 to 0.2 for tighter gap
            const numBrandsD = orderedNpsBrands.length
            const totalChartWidth = chartWC
            const blockW = (totalChartWidth - blockGap * (numBlocks - 1)) / numBlocks

            const totalGroupW = blockW * numBlocks + blockGap * (numBlocks - 1)
            const groupStartX = chartXC + (totalChartWidth - totalGroupW) / 2

            const blockTopY = 2.05
            const npsBoxY = blockTopY + 0.3
            const npsBoxH = 0.35
            const barsTopY = npsBoxY + npsBoxH + 0.1
            const barsH = 2.4  // INCREASED from 2.3 to 2.4 for taller bars

            const brandTrend: Record<string, { duration: string; nps: number }[]> = {}

            durations.forEach((seg: any, blockIdx: number) => {
              const blockX = groupStartX + blockIdx * (blockW + blockGap)
              const isFirst = blockIdx === 0
              const tableX = numBlocks === 2 ? (isFirst ? tableX_left : tableX_right) : blockX

              const shortLabel = String(seg.duration).split('(')[0].trim()
              slideD.addText(shortLabel, {
                x: blockX - 0.2, y: blockTopY, w: blockW + 0.4, h: 0.22,
                color: '1E293B', bold: true, align: 'center', fontSize: 9, fontFace: 'Arial'
              })

              slideD.addText('MODEL', {
                x: tableX, y: tableTopY, w: 1.2, h: HEADER_H,
                fill: 'BEBEBE', color: '333333', bold: true, align: 'center', valign: 'middle', fontSize: 8.5,
                border: { type: 'solid', color: 'CCCCCC', pt: 1 },
                line: { color: 'CCCCCC', width: 1 }
              })
              slideD.addText('BASE', {
                x: tableX + 1.2, y: tableTopY, w: 0.7, h: HEADER_H,
                fill: 'BEBEBE', color: '333333', bold: true, align: 'center', valign: 'middle', fontSize: 8.5,
                border: { type: 'solid', color: 'CCCCCC', pt: 1 },
                line: { color: 'CCCCCC', width: 1 }
              })
              let tableRowY = tableTopY + HEADER_H
              const chartDataD: any[] = [
                { name: 'Promoter', labels: [], values: [] },
                { name: 'Passive', labels: [], values: [] },
                { name: 'Detractor', labels: [], values: [] },
              ]
              const npsScoresD: { brand: string; nps: number }[] = []

              orderedNpsBrands.forEach((brand: string) => {
                const bd = seg.data?.find((d: any) => d.brand === brand)
                const yes = bd?.yes || 0
                const maybe = bd?.maybe || 0
                const no = bd?.no || 0
                const base = yes + maybe + no

                const isLongName = brand.length > 14
                const rowH = isLongName ? ROW_H_LONG : ROW_H

                slideD.addText(brand, {
                  x: tableX, y: tableRowY, w: 1.2, h: rowH,
                  fill: getBrandColor(brand), color: 'FFFFFF', bold: true,
                  align: 'center', valign: 'middle', fontSize: isLongName ? 6.5 : 7.5,
                  wrap: true,
                  border: { type: 'solid', color: 'CCCCCC', pt: 1 },
                  line: { color: 'CCCCCC', width: 1 }
                })
                slideD.addText(String(base), {
                  x: tableX + 1.2, y: tableRowY, w: 0.7, h: rowH,
                  fill: 'FFFFFF', color: '333333', bold: true, align: 'center', valign: 'middle', fontSize: 8,
                  border: { type: 'solid', color: 'CCCCCC', pt: 1 },
                  line: { color: 'CCCCCC', width: 1 }
                })
                tableRowY += rowH

                const yesPct = base > 0 ? Math.round((yes / base) * 100) : 0
                const maybePct = base > 0 ? Math.round((maybe / base) * 100) : 0
                const noPct = base > 0 ? Math.round((no / base) * 100) : 0

                chartDataD[0].labels.push(brand); chartDataD[0].values.push(yesPct)
                chartDataD[1].labels.push(brand); chartDataD[1].values.push(maybePct)
                chartDataD[2].labels.push(brand); chartDataD[2].values.push(noPct)

                const npsVal = yesPct - noPct
                npsScoresD.push({ brand, nps: npsVal })
                if (!brandTrend[brand]) brandTrend[brand] = []
                brandTrend[brand].push({ duration: seg.duration, nps: npsVal })
              })

              const bestBrandD = npsScoresD.length
                ? npsScoresD.reduce((best, cur) => (cur.nps > best.nps ? cur : best), npsScoresD[0])
                : null

              const PLOT_LAYOUT_D = { x: 0.02, y: 0.08, w: 0.96, h: 0.72 }

              slideD.addChart(pptx.charts.BAR, chartDataD, {
                x: blockX, y: barsTopY, w: blockW, h: barsH,
                layout: PLOT_LAYOUT_D,
                barDir: 'col',
                barGrouping: 'clustered',
                showLegend: false,
                showTitle: false,
                chartColors: NPS_COLORS_D,
                showValue: true,
                dataLabelPosition: 'outEnd',
                dataLabelFontSize: 9,
                dataLabelFontFace: 'Arial',
                dataLabelColor: '333333',
                dataLabelFormatCode: '0"%"',
                valAxisHidden: false,
                valAxisLineShow: false,
                valAxisLineColor: '6a6a6a',
                valAxisLabelFontSize: 8,
                valAxisLabelColor: '1E293B',
                valAxisLabelFormatCode: '0"%"',
                valAxisLabelPos: 'none',
                valAxisMajorTickMark: 'none',
                valAxisMinorTickMark: 'none',
                valAxisMaxVal: 100,
                valAxisMinVal: 0,
                valGridLine: { style: 'none' },
                catAxisLineShow: true,
                catAxisLineColor: '6a6a6a',
                catAxisLabelPos: 'low',
                catAxisLabelFontSize: 8,
                barGapWidthPct: 220,   // INCREASED from 200 to 220
                barOverlapPct: -45,    // INCREASED from -40 to -45
              })

              // ─── NPS boxes aligned directly above each bar candle group ───
              const plotX = blockX + PLOT_LAYOUT_D.x * blockW
              const plotW = PLOT_LAYOUT_D.w * blockW
              const plotH = PLOT_LAYOUT_D.h * barsH
              const groupW = plotW / numBrandsD

              npsScoresD.forEach((item, idx) => {
                // Position NPS box directly above its corresponding bar group
                const boxW = Math.min(1.2, groupW * 0.9)  // WIDER box to match bar group
                const boxX = plotX + idx * groupW + (groupW - boxW) / 2
                const isBest = bestBrandD ? item.brand === bestBrandD.brand : false
                const isTvsBest = isBest && !!bestBrandD && bestBrandD.brand.includes('TVS')
                const boxColor = isBest ? (isTvsBest ? '4CAF50' : 'F44336') : '999999'

                slideD.addText(`NPS ${item.nps}%`, {
                  x: boxX, y: npsBoxY, w: boxW, h: npsBoxH,
                  fill: { color: 'FFFFFF' },
                  color: '333333', bold: true, align: 'center', valign: 'middle', fontSize: 8,
                  line: { color: boxColor, width: 2 },
                })
              })
            })

            // ─── Divider line(s) ───
            for (let i = 0; i < numBlocks - 1; i++) {
              const dividerX = groupStartX + (i + 1) * blockW + i * blockGap + blockGap / 2
              slideD.addShape(pptx.ShapeType.line, {
                x: dividerX, y: blockTopY, w: 0, h: (barsTopY + barsH) - blockTopY,
                line: { color: 'D9D9D9', width: 1 }
              })
            }

            // ─── Bottom summary box ───
            const brandNames = Object.keys(brandTrend)
            if (brandNames.length >= 2 && numBlocks >= 2) {
              const avgNps = (b: string) =>
                brandTrend[b].reduce((sum, d) => sum + d.nps, 0) / brandTrend[b].length
              const ranked = [...brandNames].sort((a, b) => avgNps(b) - avgNps(a))
              const leader = ranked[0]
              const rest = ranked.slice(1)

              const summaryText =
                `${leader} performs better across ${brandTrend[leader].map((d) => d.duration).join(' and ')} ` +
                `(${brandTrend[leader].map((d) => `${d.nps}%`).join(' and ')}) compared to ${rest.join(', ')} ` +
                `at (${rest.map((b) => brandTrend[b].map((d) => `${d.nps}%`).join(' and ')).join('; ')}), ` +
                `showing that user satisfaction improves more strongly for ${leader}.`

              const summaryY = barsTopY + barsH - 0.1

              slideD.addText(summaryText, {
                x: 0.2, y: summaryY, w: SLIDE_W - 0.4, h: 0.6,
                fill: { color: 'E8F4FD', transparency: 0 },
                color: '1E293B', fontSize: 9, align: 'center', valign: 'middle',
                fontFace: 'Arial',
                lineSpacingMultiple: 1.3,
                border: { type: 'solid', color: '90CAF9', pt: 1 },
              })
            }
          })
        }
      }

      // ─── DIVIDER 3: Benefits & Betterments ───
      addDividerSlide('Benefits & Betterments')

      // ─── SLIDE N+1 to N+4 (per brand): NPS-Segmented Customer Feedback Slides ───
      if (brandFeedback && brandFeedback.length > 0) {
        setPptProgress('Generating Per-Brand NPS Customer Feedback slides...')

        const feedbackCategories: { key: 'overall' | 'promoters' | 'passives' | 'detractors'; titleSuffix: string }[] = [
          { key: 'overall', titleSuffix: 'Overall Customer Feedback' },
          { key: 'promoters', titleSuffix: 'Promoters (Yes) Customer Feedback' },
          { key: 'passives', titleSuffix: 'Passives (Maybe) Customer Feedback' },
          { key: 'detractors', titleSuffix: 'Detractors (No) Customer Feedback' },
        ]

        const allFeedbackBrands: string[] = []
        orderedNpsBrands.forEach((b: string) => {
          if (!allFeedbackBrands.includes(b)) allFeedbackBrands.push(b)
        })
        brandFeedback.forEach((bf: any) => {
          if (bf.brand && !allFeedbackBrands.includes(bf.brand)) {
            allFeedbackBrands.push(bf.brand)
          }
        })

        allFeedbackBrands.forEach((brandName: string) => {
          const brandFb = brandFeedback.find((bf: any) =>
            String(bf.brand || '').trim().toUpperCase() === String(brandName || '').trim().toUpperCase()
          )

          feedbackCategories.forEach((catConfig) => {
            const catData = brandFb?.categories?.[catConfig.key] || { base: 0, topics: [], issues: [] }

            // ─── 1. Define helpers + build data FIRST (no pptx calls yet) ───
            const isJunkTopicName = (name: string) => {
              if (!name) return true
              const s = String(name).trim().toLowerCase()
              if (['blank', 'nil', 'none', 'n/a', 'na', 'null', 'nan', '-', '.', '..'].includes(s)) return true
              if (!isNaN(Number(s))) return true
              const junkWords = [
                'average', 'avg', 'best', 'bad', 'good', 'very good', 'poor', 'very poor',
                'fair', 'excellent', 'satisfied', 'unsatisfied', 'dissatisfied',
                'very satisfied', 'neutral', 'medium', 'high', 'low', 'ok', 'okay',
                'normal', 'strongly agree', 'agree', 'disagree', 'strongly disagree'
              ]
              if (junkWords.includes(s)) return true
              if (s.startsWith('submitform')) return true
              return false
            }

            const overallCat = brandFb?.categories?.overall || { base: 0, topics: [], issues: [] }

            const segmentBase = Number(catData.base || 0)

            const topicItems = (catData.topics || [])
              .filter(t => !isJunkTopicName(t.topic))
              .map(t => {
                const count = Number(t.count || 0)
                // ✅ NEW: always divide by the segment base shown in the footer
                const pct = segmentBase > 0
                  ? Math.round((count / segmentBase) * 100)
                  : 0
                return { name: t.topic, count, percentage: pct }
              })

            const issueItems = (catData.issues || [])
              .filter(i => !isJunkTopicName(i.issue))
              .map(i => {
                const count = Number(i.count || 0)
                const pct = segmentBase > 0
                  ? Math.round((count / segmentBase) * 100)
                  : 0
                return { name: i.issue, count, percentage: pct }
              })
            const hasBenefits = topicItems.length > 0
            const hasIssues = issueItems.length > 0

            // ─── 2. SKIP SLIDE if both are empty — BEFORE calling pptx.addSlide() ───
            if (!hasBenefits && !hasIssues) return

            // ─── 3. NOW create the slide ───
            const slideFB = pptx.addSlide()
            slideFB.background = { fill: 'FFFFFF' }
            addSlideTitle(slideFB, `${brandName} | ${catConfig.titleSuffix}`, '')

            // ─── 4. Layout constants ───
            const SLIDE_CONTENT_X = 0.3
            const SLIDE_CONTENT_W = 9.4
            const PANEL_W = 4.55
            const PANEL_H = 4.25
            const PANEL_Y = 1.0
            const PANEL_GAP = 0.3

            const leftX = SLIDE_CONTENT_X
            const rightX = SLIDE_CONTENT_X + PANEL_W + PANEL_GAP
            const centeredPanelX = SLIDE_CONTENT_X + (SLIDE_CONTENT_W - PANEL_W) / 2

            // ─── 5. Panel chart renderer (unchanged) ───
            const renderPanelChart = (
              panelX: number,
              items: { name: string; count: number; percentage: number }[],
              isGreen: boolean
            ) => {
              if (!items || items.length === 0) return

              const sortedItems = [...items].sort((a, b) => b.percentage - a.percentage)
              const top10 = sortedItems.slice(0, 10)
              const reversed = [...top10].reverse()

              const chartData = [
                {
                  name: isGreen ? 'Benefits' : 'Betterment',
                  labels: reversed.map((it) => it.name),
                  values: reversed.map((it) => it.percentage),
                },
              ]

              try {
                slideFB.addChart(pptx.ChartType.bar, chartData, {
                  x: panelX + 0.1,
                  y: PANEL_Y + 0.40,
                  w: PANEL_W - 0.2,
                  h: PANEL_H - 0.50,
                  barDir: 'bar',
                  barGrouping: 'standard',
                  chartColors: [isGreen ? '28A745' : 'DC3545'],
                  showTitle: false,
                  showLegend: false,
                  showValue: true,
                  dataLabelPosition: 'outEnd',
                  dataLabelFormatCode: '0"%"',
                  dataLabelFontSize: 8,
                  dataLabelColor: '1E293B',
                  dataLabelFontFace: 'Arial',
                  catAxisLabelFontSize: 8,
                  catAxisLabelColor: '333333',
                  catAxisLineShow: false,
                  valAxisLineShow: false,
                  valAxisHidden: true,
                  valAxisMinVal: 0,
                  valAxisMaxVal: 100,
                  valAxisMajorUnit: 20,
                  valGridLine: { style: 'none' },
                  barGapWidthPct: 40,
                })
              } catch (err) {
                console.error('Error adding panel chart:', err)
              }
            }

            // ─── 6. Render panels based on data availability ───
            if (hasBenefits && !hasIssues) {
              slideFB.addShape(pptx.ShapeType.rect, {
                x: centeredPanelX, y: PANEL_Y, w: PANEL_W, h: PANEL_H,
                fill: { color: 'F0FDF4' },
                line: { color: '4ECCA3', width: 1.5 },
              })
              slideFB.addText('AREAS FOR BENEFITS', {
                x: centeredPanelX, y: PANEL_Y, w: PANEL_W, h: 0.35,
                fill: { color: '28A745' },
                color: 'FFFFFF', bold: true, align: 'center', valign: 'middle',
                fontSize: 10, fontFace: 'Arial',
              })
              renderPanelChart(centeredPanelX, topicItems, true)
            } else if (!hasBenefits && hasIssues) {
              slideFB.addShape(pptx.ShapeType.rect, {
                x: centeredPanelX, y: PANEL_Y, w: PANEL_W, h: PANEL_H,
                fill: { color: 'FEF2F2' },
                line: { color: 'FF6584', width: 1.5 },
              })
              slideFB.addText('AREAS FOR BETTERMENT', {
                x: centeredPanelX, y: PANEL_Y, w: PANEL_W, h: 0.35,
                fill: { color: 'DC3545' },
                color: 'FFFFFF', bold: true, align: 'center', valign: 'middle',
                fontSize: 10, fontFace: 'Arial',
              })
              renderPanelChart(centeredPanelX, issueItems, false)
            } else {
              slideFB.addShape(pptx.ShapeType.rect, {
                x: leftX, y: PANEL_Y, w: PANEL_W, h: PANEL_H,
                fill: { color: 'F0FDF4' },
                line: { color: '4ECCA3', width: 1.5 },
              })
              slideFB.addText('AREAS FOR BENEFITS', {
                x: leftX, y: PANEL_Y, w: PANEL_W, h: 0.35,
                fill: { color: '28A745' },
                color: 'FFFFFF', bold: true, align: 'center', valign: 'middle',
                fontSize: 10, fontFace: 'Arial',
              })

              slideFB.addShape(pptx.ShapeType.rect, {
                x: rightX, y: PANEL_Y, w: PANEL_W, h: PANEL_H,
                fill: { color: 'FEF2F2' },
                line: { color: 'FF6584', width: 1.5 },
              })
              slideFB.addText('AREAS FOR BETTERMENT', {
                x: rightX, y: PANEL_Y, w: PANEL_W, h: 0.35,
                fill: { color: 'DC3545' },
                color: 'FFFFFF', bold: true, align: 'center', valign: 'middle',
                fontSize: 10, fontFace: 'Arial',
              })

              renderPanelChart(leftX, topicItems, true)
              renderPanelChart(rightX, issueItems, false)
            }

            // ─── 7. Base footer (only rendered when we reach this point) ───
            slideFB.addText(`Base: ${catData.base || 0} respondents`, {
              x: 0.3, y: 5.32, w: 4.0, h: 0.25,
              fontSize: 8.5, color: '64748B', italic: true, fontFace: 'Arial',
            })
          })

        })
      }

      // ─── DIVIDER: Betterments Next Level ───
      addDividerSlide('Betterments Next Level')

      // ─── SLIDES: Sub-issues / Betterments Next Level by Brand ───
      if (issues && issues.length > 0) {
        setPptProgress('Generating Betterments Next Level slides...')

        const cleanBrandStr = (name: string): string => String(name || '').trim().toUpperCase()
        const formatSubComplaint = (text: string): string => {
          if (!text) return ''
          const cleaned = String(cleanIssueName(text) || '').trim()

          // ── Rule 1: "What is the issue in X?" → "X issue" ──
          const issueMatch = cleaned.match(/^what\s+is\s+the\s+issue\s+in\s+(.+?)\s*\??\s*$/i)
          if (issueMatch) {
            const subject = issueMatch[1].trim()
            if (subject) {
              // Capitalize first letter of the subject
              const titled = subject.charAt(0).toUpperCase() + subject.slice(1)
              return `${titled} issue`
            }
          }

          // ── Rule 2: keep full text if it starts with Q- / Q. / Q: ──
          if (/^Q\s*[-.:]/i.test(cleaned)) {
            return cleaned
          }

          // ── Rule 3: otherwise, cut at the first hyphen-like separator ──
          const raw = cleaned.split(/\s*[-–—−]\s*/)[0].trim()
          return raw || cleaned
        }
        const formatIssueTitleByBrand = (issueName: string): string => {
          const cleaned = cleanIssueName(issueName)
          const formatted = cleaned.split(' ').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '').join(' ')
          return `${formatted}`
        }

        const SUB_ISSUES_PER_SLIDE = 10

        issues.forEach((issueItem: any) => {
          const subIssues = (issueItem.sub_issues || []).filter(
            (s: any) => s.sub_issue && s.sub_issue !== 'Blank'
          )
          if (subIssues.length === 0) return

          // Collect unique brands for this main issue
          const brandSet = new Set<string>()
          subIssues.forEach((s: any) => {
            if (Array.isArray(s.brands)) {
              s.brands.forEach((b: any) => {
                if (b.name && b.name !== 'Blank') brandSet.add(b.name)
              })
            }
          })

          let currentBrands = getOrderedBrands(Array.from(brandSet))
          if (currentBrands.length === 0) {
            currentBrands = orderedNpsBrands
          }
          if (currentBrands.length === 0) return

          // Calculate brand totals across sub-issues for this main issue
          const brandGrandTotals: Record<string, number> = {}
          currentBrands.forEach((b) => { brandGrandTotals[b] = 0 })

          subIssues.forEach((s: any) => {
            currentBrands.forEach((b) => {
              const match = s.brands?.find(
                (br: any) => cleanBrandStr(br.name) === cleanBrandStr(b)
              )
              brandGrandTotals[b] += match?.count || 0
            })
          })

          const mainTitle = formatIssueTitleByBrand(issueItem.issue_name)

          // Chunk sub-issues into groups of max 5 per slide
          for (let i = 0; i < subIssues.length; i += SUB_ISSUES_PER_SLIDE) {
            const chunkSubIssues = subIssues.slice(i, i + SUB_ISSUES_PER_SLIDE)

            // Create Slide
            const slideBNL = pptx.addSlide()
            slideBNL.background = { fill: 'FFFFFF' }

            addSlideTitle(slideBNL, mainTitle, '')

            // ─── LEFT SIDE: TABLE ───
            const tableX = 0.3
            const tableY = 1.1
            const tableW = 4.4

            const tableRows: any[][] = []

            // ─── Header row (centered vertically) ───
            const headerRow: any[] = [
              {
                text: 'Sub Complaint',
                options: {
                  bold: true,
                  fill: NEUTRAL_GREY,
                  color: 'FFFFFF',
                  align: 'left',
                  valign: 'middle',        // ← ADDED: Vertically center
                  fontSize: 8,
                  fontFace: 'Arial'
                }
              }
            ]
            currentBrands.forEach((b) => {
              headerRow.push({
                text: b,
                options: {
                  ...getBrandHeaderOptions(b),
                  valign: 'middle'          // ← ADDED: Vertically center
                }
              })
            })
            tableRows.push(headerRow)

            // ─── Data rows for chunk sub-issues (centered vertically) ───
            chunkSubIssues.forEach((s: any) => {
              const dataRow: any[] = [
                {
                  text: formatSubComplaint(s.sub_issue),
                  options: {
                    bold: false,
                    align: 'left',
                    valign: 'middle',       // ← ADDED: Vertically center
                    fontSize: 7.5,
                    fontFace: 'Arial'
                  }
                }
              ]
              currentBrands.forEach((b) => {
                const match = s.brands?.find(
                  (br: any) => cleanBrandStr(br.name) === cleanBrandStr(b)
                )
                const count = match?.count || 0
                dataRow.push({
                  text: String(count),
                  options: {
                    bold: false,
                    align: 'center',
                    valign: 'middle',       // ← ADDED: Vertically center
                    fontSize: 7.5,
                    fontFace: 'Arial'
                  }
                })
              })
              tableRows.push(dataRow)
            })

            // ─── Grand Total row (centered vertically) ───
            const grandRow: any[] = [
              {
                text: 'Grand Total',
                options: {
                  bold: true,
                  align: 'left',
                  valign: 'middle',         // ← ADDED: Vertically center
                  fontSize: 8,
                  fontFace: 'Arial'
                }
              }
            ]
            currentBrands.forEach((b) => {
              grandRow.push({
                text: String(brandGrandTotals[b] || 0),
                options: {
                  bold: true,
                  align: 'center',
                  valign: 'middle',         // ← ADDED: Vertically center
                  fontSize: 8,
                  fontFace: 'Arial'
                }
              })
            })
            tableRows.push(grandRow)

            const subColW = (tableW - 1.8) / currentBrands.length
            const colWidths = [1.8, ...currentBrands.map(() => Math.max(0.6, subColW))]

            slideBNL.addTable(tableRows, {
              x: tableX, y: tableY, w: tableW, h: Math.min(4.2, tableRows.length * 0.3),
              border: { type: 'solid', color: 'CCCCCC', size: 0.5 },
              fontSize: 7.5,
              fontFace: 'Arial',
              colW: colWidths,
              rowH: tableRows.map(() => 0.26),
            })

            // ─── RIGHT SIDE: CHART ───
            const chartX = 4.9
            const chartY = 1.40
            const chartW = 4.8
            const chartH = 3.75

            // ─── Chart container box (drawn FIRST so it sits behind legend + chart) ───
            const CHART_BOX_X = chartX - 0.1
            const CHART_BOX_Y = 1.10
            const CHART_BOX_W = chartW + 0.2
            const CHART_BOX_H = (chartY + chartH) - CHART_BOX_Y + 0.15

            slideBNL.addShape(pptx.ShapeType.roundRect, {
              x: CHART_BOX_X,
              y: CHART_BOX_Y,
              w: CHART_BOX_W,
              h: CHART_BOX_H,
              fill: { color: 'F8FAFC' },
              line: { color: 'E2E8F0', width: 1 },
              rectRadius: 0.08,
            })

            // ─── Legend INSIDE the box (drawn after the box) ───
            const legendStartY = CHART_BOX_Y + 0.15
            const legendItemWidth = 1.2
            const legendBoxSize = 0.12
            const legendTextGap = 0.02
            const legendTotalWidth = currentBrands.length * legendItemWidth
            const legendStartX = chartX + (chartW - legendTotalWidth) / 2

            currentBrands.forEach((brand: string, idx: number) => {
              const brandColor = getBrandColor(brand)
              const legendX = legendStartX + idx * legendItemWidth

              // Legend color box
              slideBNL.addShape(pptx.ShapeType.rect, {
                x: legendX,
                y: legendStartY,
                w: legendBoxSize,
                h: legendBoxSize,
                fill: { color: brandColor },
                line: { color: brandColor, transparency: 100 },
              })

              // Legend label text
              slideBNL.addText(brand, {
                x: legendX + legendBoxSize + legendTextGap,
                y: legendStartY - 0.03,
                w: legendItemWidth - legendBoxSize - legendTextGap - 0.05,
                h: legendBoxSize + 0.06,
                fontSize: 5,
                color: '333333',
                align: 'left',
                valign: 'middle',
                fontFace: 'Arial',
              })
            })

            // ─── Chart INSIDE the box (drawn last) ───
            const reversedChunkSubIssues = [...chunkSubIssues].reverse()

            const chartDataBNL = currentBrands.map((b) => {
              const brandTotal = brandGrandTotals[b] || 0
              return {
                name: b,
                labels: reversedChunkSubIssues.map((s: any) => formatSubComplaint(s.sub_issue)),
                values: reversedChunkSubIssues.map((s: any) => {
                  const match = s.brands?.find(
                    (br: any) => cleanBrandStr(br.name) === cleanBrandStr(b)
                  )
                  const count = match?.count || 0
                  return brandTotal > 0 ? Math.round((count / brandTotal) * 100) : 0
                }),
              }
            })

            const brandColorsBNL = getBrandColorsArray(currentBrands)

            try {
              slideBNL.addChart(pptx.ChartType.bar, chartDataBNL, {
                x: chartX,
                y: chartY,
                w: chartW,
                h: chartH,
                barDir: 'bar',
                barGrouping: 'clustered',
                chartColors: brandColorsBNL,
                showTitle: false,
                showLegend: false,
                showValue: true,
                dataLabelPosition: 'outEnd',
                dataLabelFormatCode: '0"%"',
                dataLabelFontSize: 7.5,
                dataLabelColor: '1E293B',
                dataLabelFontFace: 'Arial',
                catAxisLabelFontSize: 8,
                catAxisLabelColor: '333333',
                catAxisLineShow: true,
                catAxisLineColor: 'CBD5E1',
                valAxisLineShow: false,
                valAxisHidden: true,
                valAxisMinVal: 0,
                valAxisMaxVal: 100,
                valAxisMajorUnit: 20,
                valGridLine: { style: 'none' },
                barGapWidthPct: 100,
              })
            } catch (err) {
              console.error(`[PPT] Error adding chart for issue ${issueItem.issue_name}:`, err)
            }
          }
        })
      }

      // ─── DIVIDER 4: Issue with L4,L5 ───
      addDividerSlide('Issue with L4,L5')

      // ─── Follow-up Questions Slides ──────────────────────────────
      setPptProgress('Generating Follow-up Questions summary slide...')

      // Reorder and normalize brand names
      const orderedFuBrands: string[] = []
      const tvsBrand = issueBrands.find(b => b.toUpperCase().includes('TVS') || b.toUpperCase().includes('NTORQ'))
      const hondaBrand = issueBrands.find(b => b.toUpperCase().includes('HONDA') || b.toUpperCase().includes('DIO'))
      const yamahaBrand = issueBrands.find(b => b.toUpperCase().includes('YAMAHA') || b.toUpperCase().includes('ZR'))

      if (tvsBrand) orderedFuBrands.push(tvsBrand)
      else orderedFuBrands.push('TVS NTORQ 125 XP FI')

      if (hondaBrand) orderedFuBrands.push(hondaBrand)
      else orderedFuBrands.push('HONDA DIO 125')

      if (yamahaBrand) orderedFuBrands.push(yamahaBrand)
      else orderedFuBrands.push('YAMAHA RAY ZR 125 FI')

      // Also add any other brands that might be present
      issueBrands.forEach(b => {
        if (!orderedFuBrands.includes(b)) {
          orderedFuBrands.push(b)
        }
      })

      // Title Case formatting helper for Main Issue Titles
      const formatMainIssueTitle = (name: string, count: number): string => {
        const cleaned = cleanIssueName(name)
        const formatted = cleaned.split(' ').map(word => {
          if (!word) return ''
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        }).join(' ')
        return `${formatted} (${count})`
      }

      // Build the header row (6 columns)
      const fuHeaderRow: any[] = [
        { text: 'S.No', options: { bold: true, fill: '475569', color: 'FFFFFF', align: 'center', fontFace: 'Arial', fontSize: 9 } },
        { text: '(Subtopic)L3', options: { bold: true, fill: '475569', color: 'FFFFFF', align: 'center', fontFace: 'Arial', fontSize: 9 } },
        { text: '(Follow-up)L4', options: { bold: true, fill: '475569', color: 'FFFFFF', align: 'center', fontFace: 'Arial', fontSize: 9 } },
        { text: '(Answers)L5', options: { bold: true, fill: '475569', color: 'FFFFFF', align: 'center', fontFace: 'Arial', fontSize: 9 } },
      ]
      orderedFuBrands.forEach((brandName: string) => {
        fuHeaderRow.push({ text: brandName, options: getBrandHeaderOptions(brandName) })
      })

      interface RawDataRow {
        subTopicText: string
        followUpText: string
        answerText: string
        isSplit: boolean
        vehicleCells: { cnt: number; pct: number }[]
      }

      let generatedAnySlide = false

      issues.forEach((issue: any) => {
        // Find valid sub-issues that actually contain answers
        const validSubIssues = (issue.sub_issues || []).filter((sub: any) => {
          if (!sub.has_follow_ups || !sub.follow_ups) return false
          return sub.follow_ups.some((fu: any) => fu.answers && fu.answers.length > 0)
        })

        if (validSubIssues.length === 0) return

        // Sum the TVS count for the Main Issue
        let issueTvsCount = 0
        validSubIssues.forEach((sub: any) => {
          sub.brands?.forEach((br: any) => {
            if (br.name?.toUpperCase().startsWith("TVS")) {
              issueTvsCount += br.count || 0
            }
          })
        })

        // Gather all raw rows for this main issue
        const rawRows: RawDataRow[] = []

        validSubIssues.forEach((sub: any) => {
          let subTvsCount = 0
          sub.brands?.forEach((br: any) => {
            if (br.name?.toUpperCase().startsWith("TVS")) {
              subTvsCount += br.count || 0
            }
          })
          const subText = `${sub.sub_issue} (${subTvsCount})`

          sub.follow_ups.forEach((fu: any) => {
            if (!fu.answers || fu.answers.length === 0) return

            // Calculate TVS count for this follow-up question
            let fuTvsCount = 0
            fu.answers.forEach((ans: any) => {
              ans.brands?.forEach((br: any) => {
                if (br.name?.toUpperCase().startsWith("TVS")) {
                  fuTvsCount += br.count || 0
                }
              })
            })
            const followUpText = fu.follow_up ? `${fu.follow_up} (${fuTvsCount})` : ''

            fu.answers.forEach((ans: any) => {
              const displayAnswer = ans.answer.startsWith('"') && ans.answer.endsWith('"')
                ? ans.answer
                : `"${ans.answer}"`

              // Calculate TVS count for this specific answer
              let ansTvsCount = 0
              ans.brands?.forEach((br: any) => {
                if (br.name?.toUpperCase().startsWith("TVS")) {
                  ansTvsCount += br.count || 0
                }
              })
              const ansTextWithCount = `${displayAnswer} (${ansTvsCount})`

              const vehicleCells = orderedFuBrands.map((b: string) => {
                const cnt = ans.brands?.find((br: any) => br.name === b)?.count || 0
                const subBrandTotal = sub.brands?.find((br: any) => br.name === b)?.count || 0
                const pct = subBrandTotal > 0 ? Math.round((cnt / subBrandTotal) * 100) : 0
                return { cnt, pct }
              })

              rawRows.push({
                subTopicText: subText,
                followUpText: followUpText,
                answerText: ansTextWithCount,
                isSplit: !!ans.is_split,
                vehicleCells
              })
            })
          })
        })

        if (rawRows.length === 0) return

        // Split rawRows into chunks of max 14 rows
        const maxRowsPerSlide = 13
        const totalSlidesForIssue = Math.ceil(rawRows.length / maxRowsPerSlide)

        // ─── Sub-topic numbering — assigned ONCE per unique sub-topic, across all slides ───
        const subTopicNumberMap = new Map<string, number>()
        {
          let counter = 0
          let lastSubTopic = ''
          for (const r of rawRows) {
            if (r.subTopicText !== lastSubTopic) {
              counter++
              subTopicNumberMap.set(r.subTopicText, counter)
              lastSubTopic = r.subTopicText
            }
          }
        }

        for (let slideIdx = 0; slideIdx < totalSlidesForIssue; slideIdx++) {
          const chunk = rawRows.slice(slideIdx * maxRowsPerSlide, (slideIdx + 1) * maxRowsPerSlide)
          const isLastSlideOfIssue = (slideIdx === totalSlidesForIssue - 1)

          // Create the slide
          const fuSlide = pptx.addSlide()
          fuSlide.background = { fill: 'FFFFFF' }
          generatedAnySlide = true

          // Title formatting
          const formattedTitle = formatMainIssueTitle(issue.issue_name, issueTvsCount)
          const displayTitle = totalSlidesForIssue > 1
            ? `${formattedTitle} `//? `${formattedTitle} - Slide ${slideIdx + 1}/${totalSlidesForIssue}`
            : formattedTitle

          // Slide Title
          fuSlide.addText(displayTitle, {
            x: 0.3, y: 0.3, w: 6.0, h: 0.5,
            fontSize: 22, bold: true, color: '1E293B', fontFace: 'Arial'
          })

          // Logo Branding Image
          fuSlide.addImage({
            path: '/assets/logo.png',
            x: 8.72,
            y: 0.25,
            w: 1.0,
            h: 0.52
          })

          // Divider Line
          fuSlide.addShape(pptx.shapes.LINE, {
            x: 0.3, y: 0.85, w: 9.4, h: 0.0,
            line: { color: '3B82F6', width: 2 }
          })

          // Build table rows for this slide
          const pageTableRows: any[][] = [fuHeaderRow]

          for (let i = 0; i < chunk.length; i++) {
            const row = chunk[i]
            const rowCells: any[] = []

            // Check if Subtopic group starts on this row inside this chunk
            // Check if Subtopic group starts on this row inside this chunk
            const isNewSubtopic = (i === 0) || (row.subTopicText !== chunk[i - 1].subTopicText)
            if (isNewSubtopic) {
              let span = 1
              while (i + span < chunk.length && chunk[i + span].subTopicText === row.subTopicText) {
                span++
              }

              // ── S.No cell ──
              // ── S.No cell — pull from the issue-level map ──
              const subTopicNumber = subTopicNumberMap.get(row.subTopicText) ?? 0

              rowCells.push({
                text: String(subTopicNumber),
                options: {
                  rowspan: span,
                  valign: 'middle',
                  align: 'center',
                  bold: true,
                  fontSize: 7.5,
                  fill: 'F8F9FA'
                }
              })

              // ── Sub-topic cell ──
              rowCells.push({
                text: row.subTopicText,
                options: {
                  rowspan: span,
                  valign: 'middle',
                  align: 'center',
                  bold: true,
                  fontSize: 7.5,
                  fill: 'F8F9FA'
                }
              })
            }

            // Check if Follow-up group starts on this row inside this chunk
            const isNewFollowup = (i === 0) ||
              (row.subTopicText !== chunk[i - 1].subTopicText) ||
              (row.followUpText !== chunk[i - 1].followUpText)
            if (isNewFollowup) {
              let span = 1
              while (i + span < chunk.length &&
                chunk[i + span].subTopicText === row.subTopicText &&
                chunk[i + span].followUpText === row.followUpText) {
                span++
              }
              rowCells.push({
                text: row.followUpText,
                options: {
                  rowspan: span,
                  valign: 'middle',
                  align: 'center',
                  bold: true,
                  fontSize: 7.5,
                  fill: 'F8F9FA'
                }
              })
            }

            // Answer
            rowCells.push({
              text: row.answerText,
              options: {
                align: 'left',
                fontSize: 7.5,
                fill: row.isSplit ? 'FFFFFF' : 'FFFFFF'
              }
            })

            // Vehicles
            row.vehicleCells.forEach((vc) => {
              rowCells.push({
                text: `${vc.cnt} (${vc.pct}%)`,
                options: {
                  align: 'right',
                  fontSize: 7.5,
                  fill: row.isSplit ? 'FFFFFF' : 'FFFFFF'
                }
              })
            })

            pageTableRows.push(rowCells)
          }

          // Append Grand Total row on the last slide of the issue
          if (isLastSlideOfIssue) {
            const fuGrandRow: any[] = [
              { text: '', options: { fill: 'ECEFF1' } },                                        // S.No (empty)
              { text: 'Grand Total', options: { bold: true, fill: 'ECEFF1', color: '222222', align: 'left', fontSize: 7.5 } },
              { text: '', options: { fill: 'ECEFF1' } },
              { text: '', options: { fill: 'ECEFF1' } }
            ]

            orderedFuBrands.forEach((b: string) => {
              let brandTotalAnswers = 0
              issue.sub_issues?.forEach((subObj: any) => {
                subObj.follow_ups?.forEach((fuObj: any) => {
                  fuObj.answers?.forEach((ansObj: any) => {
                    brandTotalAnswers += ansObj.brands?.find((br: any) => br.name === b)?.count || 0
                  })
                })
              })
              fuGrandRow.push({ text: `${brandTotalAnswers} (100%)`, options: { bold: true, fill: 'ECEFF1', align: 'right', fontSize: 7.5 } })
            })

            pageTableRows.push(fuGrandRow)
          }

          // Add the table to the slide
          fuSlide.addTable(pageTableRows, {
            x: 0.3,
            y: 0.95,
            w: 9.4,
            border: { type: 'solid', color: '000000', size: 1 },
            fontSize: 7.5,
            fontFace: 'Arial',
            rowH: pageTableRows.map(() => 0.22)
          })
        }
      })

      if (!generatedAnySlide) {
        const fuSlide = pptx.addSlide()
        fuSlide.background = { fill: 'FFFFFF' }
        fuSlide.addText('Main Issue (Count)', {
          x: 0.3, y: 0.3, w: 6.0, h: 0.5,
          fontSize: 22, bold: true, color: '1E293B', fontFace: 'Arial'
        })
        fuSlide.addImage({
          path: '/src/assets/logo.png',
          x: 8.0,
          y: 0.25,
          w: 1.7,
          h: 0.5
        })
        fuSlide.addShape(pptx.shapes.LINE, {
          x: 0.3, y: 0.85, w: 9.4, h: 0.0,
          line: { color: '3B82F6', width: 2 }
        })
      }

      // ─── DIVIDER: Feedback from the market ───
      addDividerSlide('Feedback from the market')
      setPptProgress('Generating Feedback from the market slides...')

      let mfRemarks: Record<string, string> = {}
      let mfPhotos: Record<string, any[]> = {}
      let mfContents: Record<string, string> = {}
      try {
        const mfRes = await marketFeedbackApi.getAll()
        if (mfRes.data?.success && mfRes.data?.data) {
          mfRemarks = mfRes.data.data.remarks || {}
          mfPhotos = mfRes.data.data.photos || {}
          mfContents = mfRes.data.data.contents || {}
        }
      } catch (err) {
        console.warn('Could not fetch market feedback DB entries for PPT:', err)
      }

      try {
        if (Object.keys(mfRemarks).length === 0) {
          const localRem = localStorage.getItem('tvs_market_feedback_remarks_v4')
          if (localRem) mfRemarks = JSON.parse(localRem)
        }
        if (Object.keys(mfPhotos).length === 0) {
          const localPho = localStorage.getItem('tvs_market_feedback_photos_v4')
          if (localPho) mfPhotos = JSON.parse(localPho)
        }
        if (Object.keys(mfContents).length === 0) {                                     // ← ADD
          const localCon = localStorage.getItem('tvs_market_feedback_contents_v4')      // ← ADD
          if (localCon) mfContents = JSON.parse(localCon)                               // ← ADD
        }                                                                               // ← ADD
      } catch (e) { /* ignore */ }

      let mfIssues: any[] = DEFAULT_TVS_TOP_ISSUES
      try {
        const tvsAnalysisRes = await issuesApi.analysis({
          brand_model: 'TVS',
          region_id: toParam(filters.regionId),
          country_id: toParam(filters.countryId),
          ib_version_id: toParam(filters.ibVersionId),
          survey_location: toParam(filters.surveyLocation),
          date_from: filters.dateFrom || undefined,
          date_to: filters.dateTo || undefined,
          search: filters.search || undefined,
        })
        const apiIssues = tvsAnalysisRes.data?.data
        if (Array.isArray(apiIssues) && apiIssues.length > 0) {
          mfIssues = generateFeedbackFromSurveyData(apiIssues, 'TVS')
        }
      } catch (err) {
        console.warn('Using default TVS market feedback baseline for PPT:', err)
      }

      // ─── Group feedback entries: 
      //     1. Entries WITH photo+remark → each gets its own slide (image + remark only)
      //     2. Entries WITHOUT photo+remark → grouped 2 sub-issues per slide as bullets
      // ────────────────────────────────────────────────────────────────────────────
      const groupedByIssue: Record<string, any[]> = {}

      mfIssues.forEach((issueCategory: any) => {
        const issueName = issueCategory.issue_name || 'Issues'
        if (!groupedByIssue[issueName]) groupedByIssue[issueName] = []
          ; (issueCategory.feedbacks || []).forEach((feedback: any) => {
            groupedByIssue[issueName].push({ issueName, feedback })
          })
      })

      Object.entries(groupedByIssue).forEach(([issueName, entries]) => {
        // ── Split entries into "with media" (photo or remark) and "text-only" ──
        const withMedia: any[] = []
        const textOnly: any[] = []

        entries.forEach((entry) => {
          // Try the Service-tab key first, then fall back to the legacy composite key
          // Product Market Feedback tab saves media under:
          //   `${issue_name}_${subIssueTitle}`
          const remarkKey = `${entry.issueName}_${entry.feedback.subIssueTitle}`
          const remark = mfRemarks[remarkKey] || ''
          const photos = mfPhotos[remarkKey] || []

          if (photos.length > 0 || remark) {
            withMedia.push({ ...entry, remark, photos })
          } else {
            textOnly.push(entry)
          }
        })

        // ── SLIDES: entries WITH media (image + remark, NO bullet contents) ──
        withMedia.forEach(({ issueName: iss, feedback, remark, photos }) => {
          const mfSlide = pptx.addSlide()
          mfSlide.background = { fill: 'FFFFFF' }

          // ── Title (Issue name only) ──
          mfSlide.addText(iss, {
            x: 0.3, y: 0.2, w: 8.0, h: 0.45,
            fontSize: 22, bold: true, color: '#1F2A6B', fontFace: 'Arial',
          })

          // ── Divider line under title ──
          mfSlide.addShape(pptx.ShapeType.line, {
            x: 0.3, y: 0.75, w: 9.4, h: 0,
            line: { color: '3B82F6', width: 2 },
          })

          // ── Logo ──
          mfSlide.addImage({
            path: '/assets/logo.png',
            x: 8.72, y: 0.15, w: 1.0, h: 0.52,
          })

          // ── Sub-heading (sub-issue name only) ──
          mfSlide.addText(feedback.subIssueTitle, {
            x: 0.3, y: 0.9, w: 9.4, h: 0.35,
            fontSize: 14, bold: true, color: '1E293B', fontFace: 'Arial',
          })

          // ── Image + Remark only (no bullet contents) ──
          if (photos.length > 0) {
            const firstPhotoUrl = getPhotoUrl(photos[0].url)
            if (photos.length === 1) {
              mfSlide.addImage({
                path: firstPhotoUrl,
                x: 0.3, y: 1.35, w: 5.4, h: 3.9,
                sizing: { type: 'contain', w: 5.4, h: 3.9 },
              })
            } else {
              const secondPhotoUrl = getPhotoUrl(photos[1].url)
              mfSlide.addImage({
                path: firstPhotoUrl,
                x: 0.3, y: 1.35, w: 2.6, h: 3.9,
                sizing: { type: 'contain', w: 2.6, h: 3.9 },
              })
              mfSlide.addImage({
                path: secondPhotoUrl,
                x: 3.1, y: 1.35, w: 2.6, h: 3.9,
                sizing: { type: 'contain', w: 2.6, h: 3.9 },
              })
            }

            // Right side: only the Field Remark
            if (remark) {
              mfSlide.addText(
                [
                  { text: 'Field Remark:\n', options: { bold: true, fontSize: 10, color: '1E293B' } },
                  { text: remark, options: { fontSize: 9, color: '1E293B', italic: true } },
                ],
                {
                  x: 6.0, y: 1.35, w: 3.7, h: 3.9,
                  align: 'justify', valign: 'middle', fontFace: 'Arial',
                }
              )
            }
          } else if (remark) {
            // Remark only (no photos)
            mfSlide.addText(
              [
                { text: 'Field Remark:\n', options: { bold: true, fontSize: 10, color: '1E293B' } },
                { text: remark, options: { fontSize: 9, color: '1E293B', italic: true } },
              ],
              {
                x: 0.8, y: 1.35, w: 8.4, h: 3.9,
                align: 'justify', valign: 'middle', fontFace: 'Arial',
              }
            )
          }
        })

        const buildBulletRuns = (feedback: any) => {
          const runs: any[] = []
          const BULLET_FONT = 9
          const BULLET_COLOR = '334155'
          const BULLET_SPACE_AFTER = 8
          const LINE_SPACING = 1.0

          // Product Market Feedback tab saves content under:
          //   `market_content_${feedback.id}`
          const productContentKey = `market_content_${feedback.id}`
          const serviceContentKey = `service_content_issue_${feedback.issueName}`

          const customContent =
            mfContents[productContentKey] ||
            mfContents[serviceContentKey] ||
            ''

          // ── Case A: user-edited content exists → use it ──
          if (customContent.trim()) {
            const lines = customContent
              .split('\n')
              .map((l) => l.trim())
              .filter((l) => l.length > 0)

            lines.forEach((line, idx) => {
              const isLast = idx === lines.length - 1
              const highlightRegex = /(\(\s*\d+\s*\)|\(\s*\d+\s*%\s*\)|\d+\s*%)/g

              runs.push({
                text: '• ',
                options: {
                  fontSize: BULLET_FONT,
                  color: BULLET_COLOR,
                  fontFace: 'Arial',
                  paraSpaceAfter: isLast ? 0 : BULLET_SPACE_AFTER,
                  lineSpacingMultiple: LINE_SPACING,
                },
              })

              let lastIndex = 0
              let match: RegExpExecArray | null
              while ((match = highlightRegex.exec(line)) !== null) {
                const before = line.slice(lastIndex, match.index)
                if (before) {
                  runs.push({
                    text: before,
                    options: {
                      fontSize: BULLET_FONT,
                      color: BULLET_COLOR,
                      fontFace: 'Arial',
                      lineSpacingMultiple: LINE_SPACING,
                    },
                  })
                }
                runs.push({
                  text: match[0],
                  options: {
                    fontSize: BULLET_FONT,
                    color: '166534',
                    bold: true,
                    fontFace: 'Arial',
                    lineSpacingMultiple: LINE_SPACING,
                  },
                })
                lastIndex = match.index + match[0].length
              }

              const after = line.slice(lastIndex)
              if (after) {
                runs.push({
                  text: after,
                  options: {
                    fontSize: BULLET_FONT,
                    color: BULLET_COLOR,
                    fontFace: 'Arial',
                    lineSpacingMultiple: LINE_SPACING,
                    breakLine: true,
                    paraSpaceAfter: isLast ? 0 : BULLET_SPACE_AFTER,
                  },
                })
              } else {
                const last = runs[runs.length - 1]
                last.options.breakLine = true
                last.options.paraSpaceAfter = isLast ? 0 : BULLET_SPACE_AFTER
              }
            })

            return runs
          }

          // ── Case B: no custom content → fall back to auto-generated km bullets ──
          const sortedKm = getSortedFormattedKmBreakdown(feedback.kmBreakdown, feedback.subIssueTitle)

          sortedKm.forEach((item: any) => {
            runs.push({
              text: `• ${item.description}`,
              options: {
                fontSize: BULLET_FONT,
                color: BULLET_COLOR,
                fontFace: 'Arial',
                breakLine: true,
                paraSpaceAfter: BULLET_SPACE_AFTER,
                lineSpacingMultiple: LINE_SPACING,
              },
            })
          })

          // Overall summary — same behaviour as before
          if (feedback.overallSummary) {
            const summary: string = String(feedback.overallSummary)
            const highlightRegex = /(\(\s*\d+\s*\)|\(\s*\d+\s*%\s*\)|\d+\s*%)/g

            runs.push({
              text: '• ',
              options: {
                fontSize: BULLET_FONT,
                color: BULLET_COLOR,
                fontFace: 'Arial',
                paraSpaceAfter: BULLET_SPACE_AFTER,
                lineSpacingMultiple: LINE_SPACING,
              },
            })

            let lastIndex = 0
            let match: RegExpExecArray | null
            while ((match = highlightRegex.exec(summary)) !== null) {
              const before = summary.slice(lastIndex, match.index)
              if (before) {
                runs.push({
                  text: before,
                  options: {
                    fontSize: BULLET_FONT,
                    color: BULLET_COLOR,
                    fontFace: 'Arial',
                    lineSpacingMultiple: LINE_SPACING,
                  },
                })
              }
              runs.push({
                text: match[0],
                options: {
                  fontSize: BULLET_FONT,
                  color: '166534',
                  bold: true,
                  fontFace: 'Arial',
                  lineSpacingMultiple: LINE_SPACING,
                },
              })
              lastIndex = match.index + match[0].length
            }

            const after = summary.slice(lastIndex)
            if (after) {
              runs.push({
                text: after,
                options: {
                  fontSize: BULLET_FONT,
                  color: BULLET_COLOR,
                  fontFace: 'Arial',
                  lineSpacingMultiple: LINE_SPACING,
                  breakLine: true,
                },
              })
            } else {
              runs[runs.length - 1].options.breakLine = true
            }
          }

          return runs
        }

        // Group textOnly into slide chunks:
        //  - if all entries are "light", fit 4 per slide
        //  - if mixed, fit 3 per slide
        //  - if any is "heavy", fit 2 per slide
        const LIGHT_THRESHOLD = 60   // <= this weight → light
        const HEAVY_THRESHOLD = 110  // >= this weight → heavy



        const estimateEntryLines = (entry: any): number => {
          const fb = entry.feedback

          const titleLen = (fb.subIssueTitle || '').length
          const titleLines = Math.max(1, Math.ceil(titleLen / 70))

          let bulletLines = 0
            ; (fb.kmBreakdown || []).forEach((b: any) => {
              const len = String(b.description || '').length
              bulletLines += Math.max(1, Math.ceil(len / 95))
            })

          const summaryLen = (fb.overallSummary || '').length
          const summaryLines = summaryLen > 0 ? Math.max(1, Math.ceil(summaryLen / 95)) : 0

          // Compressed spacing means bullets + summary occupy ~half a normal line
          const compressedBody = Math.ceil((bulletLines + summaryLines) * 0.5)

          // Title stays 1 unit per line (it's not compressed)
          return titleLines + compressedBody + 1   // +1 = padding/margin
        }
        // ── Pack text-only entries into slides ──
        const MAX_LINES_PER_SLIDE = 22
        const MAX_LINES_PER_SLIDE_3PLUS = 15   // stricter cap when 3+ topics land on one slide
        const MAX_TOPICS_PER_SLIDE = 3         // ← hard cap: never more than 3 topics per slide

        const textChunks: any[][] = []
        {
          let currentChunk: any[] = []
          let currentLines = 0

          textOnly.forEach((entry) => {
            const lines = estimateEntryLines(entry)

            // 1) Hard cap: if already 3 topics on this slide → flush
            const reachedTopicCap = currentChunk.length >= MAX_TOPICS_PER_SLIDE

            // 2) Base cap: adding this entry exceeds total line budget
            const wouldExceedBase = currentLines + lines > MAX_LINES_PER_SLIDE

            // 3) Stricter cap once 2 topics already present
            const wouldExceed3Plus =
              currentChunk.length >= 2 &&
              currentLines + lines > MAX_LINES_PER_SLIDE_3PLUS

            if (currentChunk.length > 0 && (reachedTopicCap || wouldExceedBase || wouldExceed3Plus)) {
              textChunks.push(currentChunk)
              currentChunk = []
              currentLines = 0
            }

            currentChunk.push(entry)
            currentLines += lines
          })

          if (currentChunk.length > 0) textChunks.push(currentChunk)
        }

        // ── Render each packed chunk ──
        textChunks.forEach((chunk) => {
          const mfSlide = pptx.addSlide()
          mfSlide.background = { fill: 'FFFFFF' }

          // Title
          mfSlide.addText(issueName, {
            x: 0.3, y: 0.2, w: 8.0, h: 0.45,
            fontSize: 22, bold: true, color: '#1F2A6B', fontFace: 'Arial',
          })

          // Divider
          mfSlide.addShape(pptx.ShapeType.line, {
            x: 0.3, y: 0.75, w: 9.4, h: 0,
            line: { color: '3B82F6', width: 2 },
          })

          // Logo
          mfSlide.addImage({
            path: '/assets/logo.png',
            x: 8.72, y: 0.15, w: 1.0, h: 0.52,
          })

          // ── Distribute chunk blocks by their estimated weight ──
          // ── Stack all topics naturally, one after another ──
          const contentTopY = 0.95

          // Build one big runs array with all topics in order
          const allRuns: any[] = []

          chunk.forEach((entry, idx) => {
            const { feedback } = entry

            // Small gap between topics (skip for the first one)
            if (idx > 0) {
              allRuns.push({
                text: '',
                options: {
                  fontSize: 4,
                  breakLine: true,
                  paraSpaceBefore: 12,
                  paraSpaceAfter: 0,
                  lineSpacingMultiple: 0.3,
                },
              })
            }

            // ── Sub-heading ──
            allRuns.push({
              text: feedback.subIssueTitle || '',
              options: {
                fontSize: 12,
                bold: true,
                color: '1E293B',
                fontFace: 'Arial',
                breakLine: true,
                paraSpaceAfter: 5,
                paraSpaceBefore: 0,
                lineSpacingMultiple: 0.75,
              },
            })

            // ── Bullets + summary ──
            const bulletRuns = buildBulletRuns(feedback)
            bulletRuns.forEach((r) => allRuns.push(r))
          })

          // ── Render everything in ONE text box, top-aligned ──
          if (allRuns.length > 0) {
            mfSlide.addText(allRuns, {
              x: 0.4,
              y: contentTopY,
              w: 9.2,
              h: 4.5,                    // fixed height, top-aligned; content flows naturally
              valign: 'top',
              fontFace: 'Arial',
              wrap: true,
            })
          }
        })
      })

      // ─── DIVIDER: Key Insights ───
      addDividerSlide('Key Insights')
      setPptProgress('Generating Key Insights slide...')

      const kiSlide = pptx.addSlide()
      kiSlide.background = { fill: 'FFFFFF' }

      // Title
      kiSlide.addText('Key Insights', {
        x: 0.3, y: 0.3, w: 8.2, h: 0.5,
        fontSize: 22, bold: true, color: '1E293B', fontFace: 'Arial'
      })

      // Logo
      kiSlide.addImage({
        path: '/assets/logo.png',
        x: 8.72, y: 0.25, w: 1.0, h: 0.52
      })

      // Divider
      kiSlide.addShape(pptx.ShapeType.line, {
        x: 0.3, y: 0.85, w: 9.4, h: 0,
        line: { color: '3B82F6', width: 2 }
      })

      // ─────────────────────────────────────────────────────────────────
      // DYNAMIC DATA EXTRACTION (correct paths)
      // ─────────────────────────────────────────────────────────────────

      // Brands
      const availableBrands: string[] =
        (nps && Array.isArray(nps.brands) && nps.brands.length > 0)
          ? nps.brands
          : (Array.isArray(orderedNpsBrands) && orderedNpsBrands.length > 0)
            ? orderedNpsBrands
            : (Array.isArray(issueBrands) ? issueBrands : [])

      const primaryBrand =
        availableBrands.find((b: string) => b.toUpperCase().includes('TVS')) ||
        availableBrands[0] ||
        'TVS'

      const secondaryBrand =
        availableBrands.find(
          (b: string) =>
            b !== primaryBrand && !b.toUpperCase().includes('TVS')
        ) || availableBrands[1] || 'Competitor'

      // ── NPS stats helper (uses recommend_category_bar) ──
      const getBrandNpsStats = (brandName: string) => {
        const bd = nps?.recommend_category_bar?.find(
          (d: any) => String(d.brand || '').toUpperCase() === brandName.toUpperCase()
        )
        if (!bd) return null
        const base = (bd.yes || 0) + (bd.maybe || 0) + (bd.no || 0)
        if (base === 0) return null

        const promotersPct = Math.round(((bd.yes || 0) / base) * 100)
        const passivesPct = Math.round(((bd.maybe || 0) / base) * 100)
        const detractorsPct = Math.round(((bd.no || 0) / base) * 100)
        const npsScore = promotersPct - detractorsPct

        return { npsScore, promotersPct, passivesPct, detractorsPct, base }
      }

      const primaryStats = getBrandNpsStats(primaryBrand)
      const secondaryStats = getBrandNpsStats(secondaryBrand)

      const primaryNps = primaryStats?.npsScore ?? 0
      const secondaryNps = secondaryStats?.npsScore ?? 0
      const primaryPassives = primaryStats?.passivesPct ?? 0
      const secondaryPassives = secondaryStats?.passivesPct ?? 0
      const primaryDetractors = primaryStats?.detractorsPct ?? 0
      const secondaryDetractors = secondaryStats?.detractorsPct ?? 0

      // ── Duration-based NPS (uses city_duration_segmentation) ──
      // Aggregate across all cities to find per-brand NPS per duration.
      const aggregateDurationNps = (): Record<string, Record<string, number>> => {
        const map: Record<string, Record<string, number>> = {}

        nps?.city_duration_segmentation?.forEach((cityObj: any) => {
          cityObj.durations?.forEach((seg: any) => {
            const durLabel = String(seg.duration || '').trim()
            if (!durLabel) return

            orderedNpsBrands.forEach((brand: string) => {
              const bd = seg.data?.find((d: any) => d.brand === brand)
              if (!bd) return
              const base = (bd.yes || 0) + (bd.maybe || 0) + (bd.no || 0)
              if (base === 0) return

              const npsVal =
                Math.round((bd.yes / base) * 100) - Math.round((bd.no / base) * 100)

              if (!map[brand]) map[brand] = {}
              // Simple approach: take the last seen (or average if you prefer)
              if (!map[brand][durLabel]) map[brand][durLabel] = npsVal
              else map[brand][durLabel] = Math.round((map[brand][durLabel] + npsVal) / 2)
            })
          })
        })

        return map
      }

      const durationNpsMap = aggregateDurationNps()

      // Pick "3-6 months" and "6-12 months" dynamically (sorted)
      const allDurations = new Set<string>()
      Object.values(durationNpsMap).forEach((m) => Object.keys(m).forEach((d) => allDurations.add(d)))

      const sortedDurations = Array.from(allDurations).sort((a, b) => {
        const na = parseInt(a.match(/\d+/)?.[0] || '0', 10)
        const nb = parseInt(b.match(/\d+/)?.[0] || '0', 10)
        return na - nb
      })

      const firstDuration = sortedDurations[0] || '3 – 6 months'
      const lastDuration = sortedDurations[sortedDurations.length - 1] || '6 – 12 months'

      const primaryDurationInitial = durationNpsMap[primaryBrand]?.[firstDuration] ?? 0
      const primaryDurationLater = durationNpsMap[primaryBrand]?.[lastDuration] ?? 0
      const secondaryDurationInitial = durationNpsMap[secondaryBrand]?.[firstDuration] ?? 0
      const secondaryDurationLater = durationNpsMap[secondaryBrand]?.[lastDuration] ?? 0

      // ── Negative driver issues list ──
      const negativeDriverList =
        Array.isArray(issues) && issues.length > 0
          ? issues
            .map((cat: any) => {
              const raw = String(cat.issue_name || '').trim()
              if (!raw) return ''
              // Title-case
              return raw
                .split(' ')
                .map((w: string) =>
                  w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''
                )
                .join(' ')
            })
            .filter((n: string) => n.length > 1)
            .slice(0, 10)
            .join(', ')
          : 'None reported'

      // ─────────────────────────────────────────────────────────────────
      // BUILD TEXT RUNS
      // ─────────────────────────────────────────────────────────────────
      const INSIGHT_FONT = 11
      const TEXT_COLOR = '334155'
      const BULLET_COLOR = '3B82F6'
      const PARA_GAP = 12
      const LINE_SPACING = 1.8

      // Helper: build runs for one insight bullet (prefix + text + breakLine)
      const buildInsightRuns = (body: string): any[] => [
        {
          text: '• ',
          options: {
            fontSize: INSIGHT_FONT,
            bold: true,
            color: BULLET_COLOR,
            fontFace: 'Arial',
            lineSpacingMultiple: LINE_SPACING,
            paraSpaceBefore: 0,
            paraSpaceAfter: 0,
          },
        },
        {
          text: body,
          options: {
            fontSize: INSIGHT_FONT,
            color: TEXT_COLOR,
            fontFace: 'Arial',
            breakLine: true,
            paraSpaceAfter: PARA_GAP,
            lineSpacingMultiple: LINE_SPACING,
            indentLevel: 0,
          },
        },
      ]

      // ─────────────────────────────────────────────────────────────────
      // BUILD PER-BRAND INSIGHT BODIES
      // ─────────────────────────────────────────────────────────────────

      // ─────────────────────────────────────────────────────────────────
      // PER-BRAND STATS (for all brands)
      // ─────────────────────────────────────────────────────────────────
      // ─────────────────────────────────────────────────────────────────
      // PER-BRAND STATS (for all brands)
      // ─────────────────────────────────────────────────────────────────
      const brandStats = availableBrands.map((brand: string) => {
        const stats = getBrandNpsStats(brand)
        return {
          brand,
          nps: stats?.npsScore ?? 0,
          promoters: stats?.promotersPct ?? 0,
          passives: stats?.passivesPct ?? 0,
          detractors: stats?.detractorsPct ?? 0,
        }
      })

      const getStat = (brand: string) =>
        brandStats.find((b) => b.brand === brand) || {
          brand, nps: 0, promoters: 0, passives: 0, detractors: 0,
        }

      const pStat = getStat(primaryBrand)
      const sStat = getStat(secondaryBrand)

      // ─────────────────────────────────────────────────────────────────
      // PARAGRAPH 1 — NPS head-to-head + Passives / Detractors
      // ─────────────────────────────────────────────────────────────────
      const npsGap = pStat.nps - sStat.nps
      const npsCompareWord = npsGap > 0 ? 'higher' : npsGap < 0 ? 'lower' : 'on par'

      const passivesGap = pStat.passives - sStat.passives
      const passivesWord = passivesGap < 0 ? 'lower' : passivesGap > 0 ? 'higher' : 'similar'

      const detractorsGap = pStat.detractors - sStat.detractors
      const detractorsWord = detractorsGap > 0 ? 'higher' : detractorsGap < 0 ? 'lower' : 'similar'

      const insight1Body =
        `The NPS of ${primaryBrand} (${pStat.nps}%) is ${npsCompareWord} than that of ${secondaryBrand} (${sStat.nps}%). ` +
        `This is mainly because ${primaryBrand} has a ${passivesWord} percentage of Passives (${pStat.passives}%) ` +
        `compared to ${secondaryBrand} (${sStat.passives}%). ` +
        `However, the percentage of Detractors ${primaryBrand} has (${pStat.detractors}%) is ${detractorsWord} ` +
        `than that of ${secondaryBrand} (${sStat.detractors}%). ` +
        `Converting passives into promoters and reducing detractors can further improve the NPS of ${primaryBrand}.`

      // ─────────────────────────────────────────────────────────────────
      // PARAGRAPH 2 — Duration shift (primary + secondary)
      // ─────────────────────────────────────────────────────────────────
      const buildDurationSentence = (brand: string, label: string) => {
        const initial = durationNpsMap[brand]?.[firstDuration] ?? 0
        const later = durationNpsMap[brand]?.[lastDuration] ?? 0
        const delta = later - initial
        const verb =
          delta > 0 ? `increased${Math.abs(delta) <= 3 ? ' slightly' : ''} from ${initial}% to ${later}%`
            : delta < 0 ? `declined from ${initial}% to ${later}%`
              : `remained flat at ${initial}%`
        return `${label} ${verb}`
      }

      const insight2Body =
        `The NPS of ${primaryBrand} ${buildDurationSentence(primaryBrand, '').trim()}. ` +
        `as the vehicle usage duration from ${firstDuration} to ${lastDuration}. ` +
        `In contrast, the NPS of ${secondaryBrand} ${buildDurationSentence(secondaryBrand, '').trim()} ` +
        `with the duration of usage.`

      // ─────────────────────────────────────────────────────────────────
      // PARAGRAPH 3 — Negative drivers
      // ─────────────────────────────────────────────────────────────────
      const insight3Body =
        `Analysis of negative drivers (areas for improvement) indicates issues related ${negativeDriverList}.`

      // ─────────────────────────────────────────────────────────────────
      // BUILD RUNS — 3 flowing paragraphs
      const kiTextRuns: any[] = [
        ...buildInsightRuns(insight1Body),
        ...buildInsightRuns(insight2Body),
        ...buildInsightRuns(insight3Body),
      ]
      // ── Render the insight text on the slide ──
      kiSlide.addText(kiTextRuns, {
        x: 0.6,
        y: 1.2,
        w: 8.8,
        h: 4.0,
        valign: 'top',
        align: 'justify',
        fontFace: 'Arial',
      })


      // ── Diagnostic ──
      console.log('[KEY INSIGHTS]', {
        primaryBrand,
        secondaryBrand,
        primaryNps,
        secondaryNps,
        primaryPassives,
        secondaryPassives,
        primaryDetractors,
        secondaryDetractors,
        firstDuration,
        lastDuration,
        primaryDurationInitial,
        primaryDurationLater,
        secondaryDurationInitial,
        secondaryDurationLater,
        negativeDriverList,
      })
      setPptProgress('Building table of contents...')

      tocSlide.addText('Table of Contents', {
        x: 0.3, y: 0.2, w: 8.0, h: 0.4,
        fontSize: 18, bold: true, color: '1E293B', fontFace: 'Arial',
      })
      tocSlide.addShape(pptx.shapes.LINE, {
        x: 0.3, y: 0.85, w: 9.4, h: 0.0,
        line: { color: '3B82F6', width: 2 },
      })
      tocSlide.addImage({ path: '/assets/logo.png', x: 8.72, y: 0.25, w: 1.0, h: 0.53 })

      // ─── TOC layout config ───
      const slideW = 10
      const slideH = 5.625
      const marginX = 0.5
      const marginRight = 0.5
      const colGap = 0.3
      const rowGap = 0.25

      const cols = 3
      const cardW = (slideW - marginX - marginRight - (cols - 1) * colGap) / cols  // 2.8
      let cardH = 0.95
      let cardStartY = 1.5

      // Auto-shrink if there are more than 9 items (4+ rows needed)
      const rows = Math.ceil(dividerTOC.length / cols)
      if (rows > 3) {
        cardH = 0.75
        cardStartY = 1.35
      }

      // ─── Card style constants ───
      const CARD_BG = 'F1F5F9'
      const CARD_BORDER = 'E2E8F0'
      const ACCENT_BLUE = '3B82F6'
      const NUMBER_COLOR = '3B82F6'
      const TITLE_COLOR = '1E293B'

      dividerTOC.forEach((item, idx) => {
        const row = Math.floor(idx / cols)
        const col = idx % cols

        const cardX = marginX + col * (cardW + colGap)
        const cardY = cardStartY + row * (cardH + rowGap)

        // ── Card background (rounded rect) ──
        tocSlide.addShape(pptx.ShapeType.roundRect, {
          x: cardX,
          y: cardY,
          w: cardW,
          h: cardH,
          fill: { color: CARD_BG },
          line: { color: CARD_BORDER, width: 1 },
          rectRadius: 0.08,
        })

        // ── Left accent strip (thin vertical bar in brand blue) ──
        tocSlide.addShape(pptx.ShapeType.rect, {
          x: cardX,
          y: cardY,
          w: 0.06,
          h: cardH,
          fill: { color: ACCENT_BLUE },
          line: { color: ACCENT_BLUE, width: 0 },
        })

        // ── Number badge (two-digit) ──
        const numberText = String(idx + 1).padStart(2, '0')
        tocSlide.addText(numberText, {
          x: cardX + 0.15,
          y: cardY,
          w: 0.7,
          h: cardH,
          fontSize: 20,
          bold: true,
          color: NUMBER_COLOR,
          fontFace: 'Arial',
          align: 'center',
          valign: 'middle',
        })

        // ── Section title (hyperlink) ──
        tocSlide.addText(item.title, {
          x: cardX + 0.9,
          y: cardY,
          w: cardW - 1.05,
          h: cardH,
          fontSize: 11,
          bold: true,
          color: TITLE_COLOR,
          fontFace: 'Arial',
          align: 'left',
          valign: 'middle',
          hyperlink: { slide: item.slideNumber, tooltip: `Go to ${item.title}` },
        })
      })
      // ─── FINAL SLIDE: Thank You ───
      setPptProgress('Generating Slide: Thank You...')
      const slideThankYou = pptx.addSlide()
      slideThankYou.background = { fill: 'FFFFFF' }

      // Full-bleed background image
      slideThankYou.addImage({
        path: '/assets/Thank.png',
        x: 0,
        y: 0,
        w: 10,
        h: 5.625,
        sizing: { type: 'cover', w: 10, h: 5.625 },
      })

      // Centered "Thank You" text overlay
      slideThankYou.addText(
        [
          { text: 'Thank', options: { breakLine: true } },
          { text: 'You', options: {} },
        ],
        {
          x: -0.1,
          y: -0.2,              // pull the text block upward (negative = above center)
          w: 10,
          h: 5.625,
          align: 'center',
          valign: 'middle',
          fontSize: 55,
          bold: true,
          color: '#1434A4',
          fontFace: 'Calibri',
          lineSpacing: 60,      // keeps the two stacked lines close together
          shadow: {
            type: 'outer',
            color: '000000',
            opacity: 0.5,
            blur: 8,
            offset: 2,
            angle: 45,
          },
        }
      )
      setPptProgress('Saving PowerPoint file...')
      const productCountryIds = Array.isArray(filters.countryId)
        ? filters.countryId
        : (filters.countryId ? [filters.countryId] : [])
      const productRegionIds = Array.isArray(filters.regionId)
        ? filters.regionId
        : (filters.regionId ? [filters.regionId] : [])

      let productCountryName = 'Overall'
      if (productCountryIds.length > 0) {
        const found = countries.find((c) => c.id === productCountryIds[0] || c.name === productCountryIds[0])
        productCountryName = found ? found.name : productCountryIds[0]
      } else if (productRegionIds.length > 0) {
        const found = regions.find((r) => r.id === productRegionIds[0] || r.name === productRegionIds[0])
        productCountryName = found ? found.name : productRegionIds[0]
      }
      const cleanProductCountry = productCountryName.trim().replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, '_') || 'Overall'

      await pptx.writeFile({ fileName: `${cleanProductCountry}_product_${today}.pptx` })

      if (pptCancelRef.current) {
        throw new Error(PPT_CANCELLED)
      }

      setToastSeverity('success')
      setToastMessage('Report downloaded successfully!')
      setToastOpen(true)
    } catch (err: any) {
      if (err && err.message === PPT_CANCELLED) {
        setToastSeverity('info')
        setToastMessage('PPT generation cancelled.')
      } else {
        console.error('PPT Generation Error:', err)
        setToastSeverity('error')
        setToastMessage(`Failed to generate PPT: ${err.message || err}`)
      }
      setToastOpen(true)
    } finally {
      setPptGenerating(false)
      setPptData(null)
    }
  }

  const handleCancelPPT = () => {
    pptCancelRef.current = true
    setPptGenerating(false)
    setPptData(null)
    setToastSeverity('info')
    setToastMessage('Cancelling PPT generation...')
    setToastOpen(true)
  }
  const [allCountriesList, setAllCountriesList] = useState<{ id: string; name: string; region_id?: string }[]>([])

  useEffect(() => {
    responsesApi.filterOptions().then((r) => {
      const regList = (r.data.regions || []).map((x: any) => ({ id: x.id, name: x.name }))
      const countryList = (r.data.countries || []).map((x: any) => ({ id: x.id, name: x.name, region_id: x.region_id }))
      const ibList = (r.data.ib_versions || []).map((x: any) => ({ id: x.id, name: x.name }))
      const brandList = (r.data.brands || []).map((b: string) => ({ id: b, name: b }))
      const cityList = (r.data.locations || []).map((l: string) => ({ id: l, name: l }))

      setRegions(regList)
      setIbVersions(ibList)
      setAllCountriesList(countryList)
      setCountries(countryList)
      setBrands(brandList)
      setCities(cityList)
    })
  }, [])

  useEffect(() => {
    const ids = Array.isArray(filters.regionId) ? filters.regionId : []
    if (ids.length === 0) {
      setCountries(allCountriesList)
      return
    }
    const filtered = allCountriesList.filter(c => !c.region_id || ids.includes(c.region_id))
    setCountries(filtered)
  }, [filters.regionId, allCountriesList])

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const params = {
        region_id: (tab === 0 || tab === 1) ? toParam(filters.regionId) : undefined,
        country_id: (tab === 0 || tab === 1) ? toParam(filters.countryId) : undefined,
        ib_version_id: (tab === 0 || tab === 1) ? toParam(filters.ibVersionId) : undefined,
      }
      const res = await dashboardApi.stats(params)
      setStats(res.data)
    } catch { /* ignore */ }
    setStatsLoading(false)
  }, [filters.regionId, filters.countryId, filters.ibVersionId, tab])

  useEffect(() => { loadStats() }, [loadStats])

  // AG Grid server-side datasource
  const datasource: IDatasource = useMemo(() => ({
    getRows: async (params: IGetRowsParams) => {
      const page = Math.floor(params.startRow / 25) + 1
      try {
        const res = await responsesApi.list({
          page,
          page_size: 25,
          region_id: toParam(filters.regionId),
          country_id: toParam(filters.countryId),
          ib_version_id: toParam(filters.ibVersionId),
          brand_model: toParam(filters.brandModel),
          survey_location: toParam(filters.surveyLocation),
          date_from: filters.dateFrom || undefined,
          date_to: filters.dateTo || undefined,
          search: filters.search || undefined,
        })
        const { data, total } = res.data
        setTotalRows(total)
        // Flatten full_data for AG Grid columns
        const rows = data.map((r: Record<string, unknown>) => ({
          ...r,
          ...(r.full_data as Record<string, unknown> || {}),
        }))
        params.successCallback(rows, total)
      } catch {
        params.failCallback()
      }
    },
  }), [filters])

  const onGridReady = useCallback((e: GridReadyEvent) => {
    setGridApi(e.api)
    e.api.setGridOption('datasource', datasource)
  }, [datasource])

  useEffect(() => {
    if (gridApi) {
      (gridApi as { setGridOption: (key: string, val: unknown) => void }).setGridOption('datasource', datasource)
    }
  }, [datasource, gridApi])

  // Build column definitions dynamically
  const columnDefs: ColDef[] = useMemo(() => {
    const base: ColDef[] = [
      { headerName: '#', valueGetter: 'node.rowIndex + 1', width: 60, pinned: 'left', sortable: false, filter: false },
      {
        field: 'survey_date', headerName: 'Survey Date', width: 130, pinned: 'left',
        valueFormatter: (p) => p.value ? new Date(p.value).toLocaleDateString() : ''
      },
      { field: 'brand_model', headerName: 'Brand & Model', width: 180, filter: 'agTextColumnFilter' },
      { field: 'survey_location', headerName: 'Location', width: 150, filter: 'agTextColumnFilter' },
      { field: 'vin_number', headerName: 'VIN No.', width: 140 },
      { field: 'user_name', headerName: 'User Name', width: 140 },
      {
        field: 'nps_score', headerName: 'NPS Score', width: 110,
        cellStyle: (p) => {
          if (p.value >= 9) return { color: '#4ECCA3', fontWeight: 700 }
          if (p.value >= 7) return { color: '#FFD93D', fontWeight: 700 }
          if (p.value !== null) return { color: '#FF6B6B', fontWeight: 700 }
          return null
        }
      },
      {
        field: 'complaint_groups', headerName: 'Issues', width: 200,
        cellRenderer: (p: { value: string[] }) =>
          p.value?.length ? `${p.value.length} issue(s)` : 'None'
      },
    ]

    // Add columns A-OD from full_data with actual Excel header names
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
    const allCols: string[] = []
    letters.forEach((l) => allCols.push(l))
    letters.forEach((l1) => letters.forEach((l2) => allCols.push(l1 + l2)))
    const excelCols = allCols.slice(0, 422)

    const dynamicCols: ColDef[] = excelCols.slice(8).map((col) => {
      const headerTitle = getColumnHeader(col)
      return {
        field: col,
        headerName: headerTitle,
        width: Math.max(160, Math.min(300, headerTitle.length * 8 + 40)),
        headerTooltip: `[Col ${col}] ${headerTitle}`,
        cellStyle: (p: { value: unknown }) =>
          p.value === 'Yes' ? { color: '#4ECCA3' } :
            p.value === 'No' ? { color: '#FF6B6B' } : null,
      }
    })

    return [...base, ...dynamicCols]
  }, [])

  const defaultColDef: ColDef = {
    resizable: true,
    sortable: true,
    filter: true,
    suppressMovable: false,
    floatingFilter: false,
    cellStyle: { fontSize: '12px' },
  }

  const handleExportCSV = async () => {
    try {
      const res = await responsesApi.exportCsv()
      const blob = res.data
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'survey_responses.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('CSV export failed:', err)
    }
  }

  const showProduct = analysisMode.length === 0 || analysisMode.includes('product')
  const showService = analysisMode.length === 0 || analysisMode.includes('service')

  const availableTabs = [
    ...(showProduct ? [
      { id: 'tab-issues-view', key: 'issues', label: 'Issues Analysis' },
      { id: 'tab-dashboard', key: 'dashboard', label: 'Dashboard' },
      { id: 'tab-comparison', key: 'comparison', label: 'Comparison' },
      { id: 'tab-nps', key: 'nps', label: 'NPS' },
      { id: 'tab-market-feedback', key: 'market-feedback', label: 'Feedback From the Market' },
      { id: 'tab-data-table', key: 'data-table', label: `Data Table (${totalRows.toLocaleString()} rows)` },
    ] : []),
    ...(showService ? [
      { id: 'tab-service-dashboard', key: 'service-dashboard', label: 'Service Dashboard' },
    ] : []),
  ]

  const activeTabKey = availableTabs[tab]?.key ?? availableTabs[0]?.key
  const isServiceActive = activeTabKey === 'service-dashboard' || (analysisMode.length === 1 && analysisMode[0] === 'service')

  return (
    <Box>
      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { title: 'Total Records', value: statsLoading ? '...' : stats.total_records ?? 0, icon: <People />, color: '#6C63FF', subtitle: 'All survey responses' },
          { title: 'Total Complaints', value: statsLoading ? '...' : stats.total_complaints ?? 0, icon: <TrendingUp />, color: '#FF6584', subtitle: 'Issues reported' },
          { title: 'Unique Locations', value: statsLoading ? '...' : stats.unique_locations ?? 0, icon: <LocationOn />, color: '#4ECCA3', subtitle: 'Survey cities' },
          { title: 'Avg NPS Score', value: statsLoading ? '...' : stats.average_nps ?? 0, icon: <Speed />, color: '#FFD93D', subtitle: 'Out of 10' },
          { title: 'Total Brands', value: statsLoading ? '...' : stats.total_brands ?? 0, icon: <DirectionsCar />, color: '#FF8A65', subtitle: 'Vehicle brands' },
          { title: 'File Uploads', value: statsLoading ? '...' : stats.total_uploads ?? 0, icon: <CalendarMonth />, color: '#AB47BC', subtitle: 'Completed uploads' },
        ].map((s) => (
          <Grid size={{ xs: 6, sm: 4, lg: 2 }} key={s.title}>
            <StatCard {...s} />
          </Grid>
        ))}
      </Grid>

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
            <MultiSelectFilter
              id="filter-analysis-mode"
              label="Analysis Mode"
              value={analysisMode}
              options={[
                { id: 'product', name: 'Product' },
                { id: 'service', name: 'Service' },
              ]}
              onChange={(next) => {
                setAnalysisMode(next)
                setTab(0)
              }}
              minWidth={160}
            />

            {regions.length > 0 && (
              <MultiSelectFilter
                id="filter-region"
                label="Region"
                value={filters.regionId}
                options={regions}
                onChange={(next) => {
                  filters.setFilter('regionId', next)
                  filters.setFilter('countryId', [])
                }}
                minWidth={140}
                searchable
              />
            )}

            {countries.length > 0 && (
              <MultiSelectFilter
                id="filter-country"
                label="Country"
                value={filters.countryId}
                options={countries}
                onChange={(next) => filters.setFilter('countryId', next)}
                minWidth={140}
                searchable
              />
            )}

            {ibVersions.length > 1 && (
              <MultiSelectFilter
                id="filter-ib-version"
                label="IB Version"
                value={filters.ibVersionId}
                options={ibVersions}
                onChange={(next) => filters.setFilter('ibVersionId', next)}
                minWidth={120}
                searchable
              />
            )}

            {brands.length > 1 && (
              <MultiSelectFilter
                id="filter-brand"
                label="Brand & Model"
                value={filters.brandModel}
                options={brands}
                onChange={(next) => filters.setFilter('brandModel', next)}
                minWidth={160}
                searchable
                nestedBrandMode   // ← add this
              />
            )}
            {cities.length > 1 && (
              <MultiSelectFilter
                id="filter-city"
                label="City"
                value={filters.surveyLocation}
                options={cities}
                onChange={(next) => filters.setFilter('surveyLocation', next)}
                minWidth={140}
                searchable
              />
            )}

            <TextField
              size="small"
              id="filter-search"
              label="Search"
              placeholder="Brand, VIN, City..."
              value={filters.search}
              onChange={(e) => filters.setFilter('search', e.target.value)}
              sx={{ minWidth: 180 }}
            />

            <DatePicker
              views={['year', 'month']}
              openTo="year"
              value={toMonthPickValue(filters.dateFrom)}
              onChange={(value) => filters.setFilter('dateFrom', fromMonthPickValue(value))}
              format="MMM YYYY"
              slotProps={{
                textField: {
                  id: 'filter-date-from',
                  size: 'small',
                  label: 'From Month',
                  sx: {
                    minWidth: 140,
                    '& .MuiOutlinedInput-root': {
                      color: c.textPrimary,
                    },
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: c.border,
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: c.borderStrong,
                    },
                  },
                },
              }}
            />
            <DatePicker
              views={['year', 'month']}
              openTo="year"
              value={toMonthPickValue(filters.dateTo)}
              onChange={(value) => filters.setFilter('dateTo', fromMonthPickValue(value))}
              format="MMM YYYY"
              slotProps={{
                textField: {
                  id: 'filter-date-to',
                  size: 'small',
                  label: 'To Month',
                  sx: {
                    minWidth: 140,
                    '& .MuiOutlinedInput-root': {
                      color: c.textPrimary,
                    },
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: c.border,
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: c.borderStrong,
                    },
                  },
                },
              }}
            />

            <Button
              id="apply-filters-btn"
              variant="contained"
              size="small"
              onClick={() => {
                if (gridApi) {
                  const api = gridApi as {
                    setGridOption: (key: string, val: unknown) => void
                    refreshInfiniteCache: () => void
                  }
                  api.setGridOption('datasource', datasource)
                  api.refreshInfiniteCache()
                }
                loadStats()
              }}
              sx={{ background: 'linear-gradient(135deg, #6C63FF, #9A94FF)' }}
            >
              Apply
            </Button>

            <Tooltip title={isServiceActive ? "Download Service Presentation (PPT)" : "Download Presentation (PPT)"}>
              <span>
                <Button
                  id="download-ppt-btn"
                  variant="outlined"
                  size="small"
                  disabled={pptGenerating}
                  onClick={isServiceActive ? handleDownloadServicePPT : handleDownloadPPT}
                  startIcon={pptGenerating ? <CircularProgress size={16} /> : <DownloadForOffline />}
                  sx={{
                    borderColor: '#6C63FF',
                    color: '#6C63FF',
                    '&:hover': {
                      borderColor: '#9A94FF',
                      background: 'rgba(108,99,255,0.04)',
                    },
                    ml: 1
                  }}
                >
                  {pptGenerating ? `Generating: ${pptProgress}` : isServiceActive ? 'Download Service PPT' : 'Download PPT'}
                </Button>

              </span>

            </Tooltip>
            {pptGenerating && (
              <Button
                id="cancel-download-ppt-btn"
                variant="outlined"
                size="small"
                color="error"
                onClick={handleCancelPPT}
                startIcon={<Cancel />}
                sx={{
                  borderColor: '#EF4444',
                  color: '#EF4444',
                  '&:hover': {
                    borderColor: '#F87171',
                    background: 'rgba(239,68,68,0.04)',
                  },
                  ml: 1
                }}
              >
                Cancel
              </Button>
            )}
            {/* PPT progress alert
            {pptGenerating && (
              <Alert severity="info" sx={{ mt: 1, display: 'flex', alignItems: 'center', mx: 1 }}>
                Generating PPT Presentation: {pptProgress}
              </Alert>
            )} */}
            <Tooltip title="Reset Filters">
              <IconButton id="reset-filters-btn" size="small" onClick={() => {
                filters.resetFilters()
                if (gridApi) {
                  const api = gridApi as {
                    setGridOption: (key: string, val: unknown) => void
                    refreshInfiniteCache: () => void
                  }
                  api.setGridOption('datasource', datasource)
                  api.refreshInfiniteCache()
                }
                loadStats()
              }} sx={{ color: c.secondary }}>
                <ClearAll />
              </IconButton>
            </Tooltip>

          </Box>
        </CardContent>
      </Card>


      <Box sx={{ mb: 2 }}>
        <Tabs
          key={`tabs-${analysisMode.join(',')}-${totalRows}`}
          value={tab < availableTabs.length ? tab : 0}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            minHeight: 42,
            p: 0.5,
            borderRadius: 2,
            background: c.isDarkTheme ? 'rgba(255,255,255,0.03)' : 'rgba(108,99,255,0.04)',
            border: `1px solid ${c.borderMuted}`,

            // Hide the default underline indicator entirely (MUI v6-safe way)
            '& .MuiTabs-indicator': {
              display: 'none',
            },

            '& .MuiTabs-flexContainer': {
              gap: 0.5,
            },

            '& .MuiTab-root': {
              color: c.textSecondary,
              fontWeight: 600,
              minWidth: 'auto',
              minHeight: 34,
              px: 2,
              borderRadius: 1.5,
              textTransform: 'none',
              transition: 'all 0.18s ease',
              '&:hover': {
                background: c.isDarkTheme ? 'rgba(255,255,255,0.05)' : 'rgba(108,99,255,0.08)',
                color: c.textPrimary,
              },
            },

            '& .Mui-selected': {
              color: '#fff !important',
              background: 'linear-gradient(135deg, #6C63FF, #9A94FF)',
              boxShadow: '0 4px 12px rgba(108,99,255,0.35)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5B52F0, #8B84FF)',
              },
            },
          }}
        >
          {availableTabs.map((t) => (
            <Tab key={t.id} id={t.id} label={t.label} disableRipple />
          ))}
        </Tabs>
      </Box>

      {/* Dynamic Tab Content */}
      {activeTabKey === 'service-dashboard' && (
        <ServiceDashboardTab onDownloadPPT={handleDownloadServicePPT} pptGenerating={pptGenerating} />
      )}
      {activeTabKey === 'issues' && <IssuesTab filters={filters} />}
      {activeTabKey === 'dashboard' && <DashboardAnalytics filters={filters} />}
      {activeTabKey === 'comparison' && <ComparisonTab filters={filters} />}
      {activeTabKey === 'nps' && <NpsTab />}
      {activeTabKey === 'market-feedback' && <MarketFeedbackTab filters={filters} />}
      {activeTabKey === 'data-table' && (
        <Card>
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1, borderBottom: `1px solid ${c.borderMuted}` }}>
              <Typography variant="body2" sx={{ color: c.textSecondary, flex: 1 }}>
                Showing all 422 columns • Horizontally scrollable • Server-side pagination
              </Typography>
              <Tooltip title="Export CSV">
                <IconButton id="export-csv-btn" size="small" onClick={handleExportCSV} sx={{ color: c.success }}>
                  <FileDownload />
                </IconButton>
              </Tooltip>
              <Tooltip title="Refresh">
                <IconButton id="refresh-table-btn" size="small" onClick={() => (gridApi as { refreshInfiniteCache: () => void } | null)?.refreshInfiniteCache()} sx={{ color: c.textSecondary }}>
                  <Refresh />
                </IconButton>
              </Tooltip>
            </Box>
            <Box
              className={c.isDarkTheme ? 'ag-theme-alpine-dark' : 'ag-theme-alpine'}
              sx={{
                height: 600,
                width: '100%',
                '--ag-background-color': c.agGridBg,
                '--ag-odd-row-background-color': c.agGridOddRow,
                '--ag-header-background-color': c.agGridHeader,
                '--ag-border-color': c.agBorder,
                '--ag-row-hover-color': c.agRowHover,
                '--ag-selected-row-background-color': c.agSelectedRow,
                '--ag-font-size': '12px',
                '--ag-foreground-color': c.textPrimary,
                '--ag-header-foreground-color': c.textSecondary,
                '--ag-secondary-foreground-color': c.textSecondary,
              } as React.CSSProperties}
            >
              <AgGridReact
                datasource={datasource}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                rowModelType="infinite"
                cacheBlockSize={25}
                maxBlocksInCache={10}
                onGridReady={onGridReady}
                animateRows={true}
                rowSelection="multiple"
                suppressRowClickSelection={true}
                enableCellTextSelection={true}
                tooltipShowDelay={500}
              />
            </Box>
          </CardContent>
        </Card>
      )}

      {/* PPT progress alert
      {pptGenerating && (
        <Alert severity="info" sx={{ mt: 2, display: 'flex', alignItems: 'center', mx: 2 }}>
          Generating PPT Presentation: {pptProgress}
        </Alert>
      )} */}

      {/* Snackbar notification toast */}
      <Snackbar
        open={toastOpen}
        autoHideDuration={6000}
        onClose={() => setToastOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setToastOpen(false)} severity={toastSeverity} sx={{ width: '100%' }}>
          {toastMessage}
        </Alert>
      </Snackbar>

      {/* Hidden off-screen container for rendering charts to capture */}


      {/* Hidden off-screen container for rendering charts to capture */}
      {pptGenerating && pptData && (
        <Box
          id="ppt-capture-container"
          sx={{
            position: 'absolute',
            left: -9999,
            top: -9999,
            width: 1000,
            background: '#ffffff',
            color: '#000000',
            p: 4
          }}
        >
          {/* Slide 2: Age Group Chart - NO TITLE */}
          <Box id="capture-age-group" sx={{ width: 800, height: 400, p: 2, background: '#fff' }}>
            {/* REMOVED: <Typography variant="h6" align="center" sx={{ color: '#333', mb: 2 }}>Age Group Distribution</Typography> */}
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={pptData.analytics.age_group.chart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Bar dataKey="TVS HLX 125_pct" name="TVS HLX 125" fill="#4FC3F7" />
                <Bar dataKey="Bajaj BM 125 / Bajaj CT 125_pct" name="Bajaj BM 125" fill="#66BB6A" />
              </BarChart>
            </ResponsiveContainer>
          </Box>

          {/* Slide 3: Age City Chart - NO TITLE */}
          <Box id="capture-age-city" sx={{ width: 800, height: 400, p: 2, background: '#fff' }}>
            {/* REMOVED: <Typography variant="h6" align="center" sx={{ color: '#333', mb: 2 }}>Age Group by City & Brand</Typography> */}
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={pptData.analytics.age_city.chart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" tickFormatter={(v) => v.split('|').join(' / ')} />
                <YAxis />
                <Bar dataKey="TVS HLX 125_count" name="TVS HLX 125" fill="#4FC3F7" />
                <Bar dataKey="Bajaj BM 125 / Bajaj CT 125_count" name="Bajaj BM 125" fill="#66BB6A" />
              </BarChart>
            </ResponsiveContainer>
          </Box>

          {/* Slide 4: Purchase & Ownership - NO TITLES */}
          <Box id="capture-purchase-ownership" sx={{ width: 800, height: 400, p: 2, background: '#fff', display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              {/* REMOVED: <Typography variant="subtitle2" align="center" sx={{ color: '#333', mb: 1 }}>Mode of Purchase</Typography> */}
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={pptData.analytics.mode_of_purchase.chart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Bar dataKey="TVS HLX 125_pct" name="TVS" fill="#4FC3F7" />
                  <Bar dataKey="Bajaj BM 125 / Bajaj CT 125_pct" name="Bajaj" fill="#66BB6A" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
            <Box sx={{ flex: 1 }}>
              {/* REMOVED: <Typography variant="subtitle2" align="center" sx={{ color: '#333', mb: 1 }}>Ownership</Typography> */}
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={pptData.analytics.ownership.chart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Bar dataKey="TVS HLX 125_count" name="TVS" fill="#4FC3F7" />
                  <Bar dataKey="Bajaj BM 125 / Bajaj CT 125_count" name="Bajaj" fill="#66BB6A" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Box>

          {/* Slide 5: Profession Chart - NO TITLE */}
          <Box id="capture-profession" sx={{ width: 800, height: 400, p: 2, background: '#fff' }}>
            {/* REMOVED: <Typography variant="h6" align="center" sx={{ color: '#333', mb: 2 }}>User Profession Distribution</Typography> */}
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={pptData.analytics.profession.chart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Bar dataKey="TVS HLX 125_pct" name="TVS HLX 125" fill="#4FC3F7" />
                <Bar dataKey="Bajaj BM 125 / Bajaj CT 125_pct" name="Bajaj BM 125" fill="#66BB6A" />
              </BarChart>
            </ResponsiveContainer>
          </Box>

          {/* Issues Charts - NO TITLES */}
          {pptData.issues.map((issue: any, idx: number) => {
            const chartData = issue.sub_issues?.map((sub: any) => {
              const tvsCount = sub.brands.find((b: any) => b.name === "TVS HLX 125")?.count || 0
              const bajajCount = sub.brands.find((b: any) => b.name === "Bajaj BM 125 / Bajaj CT 125")?.count || 0
              const total = sub.total || 1
              return {
                sub_issue: sub.sub_issue,
                "TVS HLX 125": tvsCount,
                "Bajaj BM 125 / Bajaj CT 125": bajajCount,
                tvsPercentage: ((tvsCount / total) * 100).toFixed(1) + "%",
                bajajPercentage: ((bajajCount / total) * 100).toFixed(1) + "%"
              }
            }) || []

            return (
              <Box key={issue.issue_name} id={`capture-issue-${idx}`} sx={{ width: 800, height: 400, p: 2, background: '#fff' }}>
                {/* REMOVED: <Typography variant="h6" align="center" sx={{ color: '#333', mb: 2 }}>{issue.issue_name}</Typography> */}
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={chartData} margin={{ top: 20, right: 10, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="sub_issue" tick={{ fontSize: 9 }} />
                    <YAxis />
                    <Bar dataKey="TVS HLX 125" fill="#4FC3F7" />
                    <Bar dataKey="Bajaj BM 125 / Bajaj CT 125" fill="#66BB6A" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            )
          })}

          {/* Comparison charts - NO TITLES */}
          <Box id="capture-comparison" sx={{ width: 800, height: 400, p: 2, background: '#fff' }}>
            {/* REMOVED: <Typography variant="h6" align="center" sx={{ color: '#333', mb: 2 }}>Brand-wise Comparison: Passive vs Issues</Typography> */}
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={pptData.comparison} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="brand" />
                <Bar dataKey="passive_count" name="Passive" stackId="a" fill="#4FC3F7" />
                <Bar dataKey="issues_count" name="Issues" stackId="a" fill="#FF6584" />
              </BarChart>
            </ResponsiveContainer>
          </Box>

          <Box id="capture-comparison-passive" sx={{ width: 800, height: 400, p: 2, background: '#fff' }}>
            {/* REMOVED: <Typography variant="h6" align="center" sx={{ color: '#333', mb: 2 }}>Passive (Good) by Brand</Typography> */}
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={pptData.comparison} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="brand" />
                <Bar dataKey="passive_count" name="Passive" fill="#4FC3F7" />
              </BarChart>
            </ResponsiveContainer>
          </Box>

          <Box id="capture-comparison-issues" sx={{ width: 800, height: 400, p: 2, background: '#fff' }}>
            {/* REMOVED: <Typography variant="h6" align="center" sx={{ color: '#333', mb: 2 }}>Issues (Complaints) by Brand</Typography> */}
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={pptData.comparison} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="brand" />
                <Bar dataKey="issues_count" name="Issues" fill="#FF6584" />
              </BarChart>
            </ResponsiveContainer>
          </Box>

          {/* Topics charts per brand - KEEP THE TITLES HERE */}
          {pptData.topics.map((bTopic: any, bIdx: number) => {
            const passiveData = Object.entries(bTopic.passive_topics)
              .map(([topic, count]) => ({ topic, count }))
              .sort((a: any, b: any) => b.count - a.count)
            const issuesData = Object.entries(bTopic.issues_topics)
              .map(([topic, count]) => ({ topic, count }))
              .sort((a: any, b: any) => b.count - a.count)

            return (
              <Box key={bTopic.brand} id={`capture-topics-${bIdx}`} sx={{ width: 800, height: 400, p: 2, background: '#fff', display: 'flex', gap: 2 }}>
                <Box sx={{ flex: 1 }}>
                  {/* KEEP THIS TITLE */}
                  <Typography variant="subtitle2" align="center" sx={{ color: '#333', mb: 1, fontWeight: 'bold' }}>
                    {bTopic.brand} - Positive Feedback Topics
                  </Typography>
                  {passiveData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={passiveData} layout="vertical" margin={{ left: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="topic" tick={{ fontSize: 8 }} />
                        <Bar dataKey="count" fill="#4FC3F7" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Typography variant="caption" display="block" align="center" sx={{ mt: 10, color: '#666' }}>No positive topic data</Typography>
                  )}
                </Box>
                <Box sx={{ flex: 1 }}>
                  {/* KEEP THIS TITLE */}
                  <Typography variant="subtitle2" align="center" sx={{ color: '#333', mb: 1, fontWeight: 'bold' }}>
                    {bTopic.brand} - Issues Topics
                  </Typography>
                  {issuesData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={issuesData} layout="vertical" margin={{ left: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="topic" tick={{ fontSize: 8 }} />
                        <Bar dataKey="count" fill="#FF6584" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Typography variant="caption" display="block" align="center" sx={{ mt: 10, color: '#666' }}>No issues topic data</Typography>
                  )}
                </Box>
              </Box>
            )
          })}
        </Box>
      )}
    </Box>
  )
}