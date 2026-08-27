import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Box, Card, CardContent, Typography, Tabs, Tab, Grid,
  TextField, Select, MenuItem, FormControl, InputLabel,
  Button, IconButton, Tooltip, CircularProgress, Snackbar, Alert,
} from '@mui/material'
import {
  Refresh, FileDownload, FilterList, ClearAll,
  TrendingUp, People, LocationOn, Speed, DirectionsCar, CalendarMonth,
  DownloadForOffline,
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
import { responsesApi, regionsApi, countriesApi, ibVersionsApi, dashboardApi, comparisonApi, issuesApi } from '../../lib/api'
import { useFilterStore } from '../../store'
import { useThemeColors } from '../../utils/colors'
import IssuesTab from '../../components/dashboard/IssuesTab'
import DashboardAnalytics from '../../components/dashboard/DashboardAnalytics'
import ComparisonTab from '../../components/dashboard/ComparisonTab'

import { getColumnHeader } from '../../utils/columnHeaders'

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
  const [pptProgress, setPptProgress] = useState('')
  const [pptData, setPptData] = useState<any>(null)

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

  const handleDownloadPPT = async () => {
    setPptGenerating(true)
    setPptProgress('Initializing & fetching data...')

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

      // Fetch all required data in parallel
      const [analyticsRes, issuesRes, comparisonRes, topicsRes] = await Promise.all([
        dashboardApi.analytics(filterParams),
        issuesApi.analysis(filterParams),
        comparisonApi.brandPassiveIssues(filterParams),
        comparisonApi.brandTopics(filterParams),
      ])

      const analytics = analyticsRes.data
      const issues = issuesRes.data.data || []
      const issueBrands: string[] = issuesRes.data.brands || []
      const comparison = comparisonRes.data.data || []
      const topics = topicsRes.data.data || []

      if (!analytics || (issues.length === 0 && comparison.length === 0 && topics.length === 0)) {
        setToastSeverity('error')
        setToastMessage('Cannot generate PPT: No data available for the active filters.')
        setToastOpen(true)
        setPptGenerating(false)
        return
      }

      setPptProgress('Preparing charts off-screen...')
      setPptData({ analytics, issues, comparison, topics })

      // Wait for React to render and SVG elements to paint fully
      await new Promise((resolve) => setTimeout(resolve, 2000))

      setPptProgress('Compiling PowerPoint presentation...')
      const pptx = new PptxGenJS()
      pptx.layout = 'LAYOUT_16x9'

      const slide1Bg = { path: '/src/assets/slide1.png' }
      const slideBg = { path: '/src/assets/slides.png' }

      const today = new Date().toISOString().split('T')[0]
      const displayDate = new Date().toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })

      const totalSlides = 1 + 4 + issues.length + 1 + topics.length



      // ─── Helper: Create table from matrix data ───
      const addMatrixTable = (slide: any, matrix: any, title: string, x: number, y: number, w: number, h: number) => {
        if (!matrix || !matrix.table || matrix.table.length === 0) {
          slide.addText('No data available', {
            x, y, w, h,
            fontSize: 12,
            color: '999999',
            align: 'center',
          })
          return
        }

        const tableRows: any[] = []

        // Header row
        const headerRow: any[] = [
          { text: title, options: { bold: true, fill: '4FC3F7', color: 'FFFFFF', align: 'left' } }
        ]
        matrix.brands.forEach((brand: string) => {
          headerRow.push({ text: brand, options: { bold: true, fill: '4FC3F7', color: 'FFFFFF', align: 'right' } })
        })
        headerRow.push({ text: 'Total', options: { bold: true, fill: '4FC3F7', color: 'FFFFFF', align: 'right' } })
        tableRows.push(headerRow)

        // Data rows
        matrix.table.forEach((row: any) => {
          const isTotal = row.category === 'Grand Total'
          const dataRow: any[] = [
            { text: String(row.category), options: { bold: isTotal, fill: isTotal ? 'ECEFF1' : undefined, align: 'left' } }
          ]
          matrix.brands.forEach((brand: string) => {
            const value = row[brand] || 0
            dataRow.push({
              text: typeof value === 'number' ? value.toLocaleString() : String(value),
              options: { bold: isTotal, fill: isTotal ? 'ECEFF1' : undefined, align: 'right' }
            })
          })
          dataRow.push({
            text: typeof row.total === 'number' ? row.total.toLocaleString() : String(row.total || 0),
            options: { bold: true, fill: isTotal ? 'ECEFF1' : undefined, align: 'right' }
          })
          tableRows.push(dataRow)
        })

        slide.addTable(tableRows, {
          x, y, w, h,
          border: { type: 'solid', color: 'E0E0E0', size: 1 },
          fontSize: 8,
          fontFace: 'Arial',
        })
      }

      // ─── Helper: Create age city table ───
      const addAgeCityTable = (slide: any, matrix: any, x: number, y: number, w: number, h: number) => {
        if (!matrix || !matrix.table || matrix.table.length === 0) {
          slide.addText('No data available', {
            x, y, w, h,
            fontSize: 12,
            color: '999999',
            align: 'center',
          })
          return
        }

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
            matrix.brands.forEach((brand: string) => {
              cityAgeMap[city][ageGroup][brand] = Number(row[brand]) || 0
            })
          }
        })

        const sortedAgeGroups = Array.from(allAgeGroups).sort()
        const cities = Object.keys(cityAgeMap)

        const tableRows: any[] = []

        // Complex header
        const headerRow1: any[] = [
          { text: 'City', options: { bold: true, fill: '4FC3F7', color: 'FFFFFF', align: 'left', rowSpan: 2 } }
        ]
        matrix.brands.forEach((brand: string) => {
          headerRow1.push({
            text: brand,
            options: { bold: true, fill: '4FC3F7', color: 'FFFFFF', align: 'center', colSpan: sortedAgeGroups.length + 1 }
          })
        })
        tableRows.push(headerRow1)

        const headerRow2: any[] = [{ text: '', options: { fill: '4FC3F7' } }]
        matrix.brands.forEach(() => {
          sortedAgeGroups.forEach((ageGroup: string) => {
            headerRow2.push({
              text: ageGroup,
              options: { bold: true, fill: '4FC3F7', color: 'FFFFFF', align: 'right', fontSize: 7 }
            })
          })
          headerRow2.push({
            text: 'Total',
            options: { bold: true, fill: '4FC3F7', color: 'FFFFFF', align: 'right', fontSize: 7 }
          })
        })
        tableRows.push(headerRow2)

        // Data rows
        cities.forEach((city) => {
          const brandTotals: Record<string, number> = {}
          matrix.brands.forEach((brand: string) => {
            brandTotals[brand] = 0
            sortedAgeGroups.forEach((ageGroup: string) => {
              brandTotals[brand] += (cityAgeMap[city]?.[ageGroup]?.[brand] || 0)
            })
          })

          const dataRow: any[] = [{ text: city, options: { align: 'left' } }]
          matrix.brands.forEach((brand: string) => {
            sortedAgeGroups.forEach((ageGroup: string) => {
              const value = cityAgeMap[city]?.[ageGroup]?.[brand] || 0
              const total = brandTotals[brand] || 1
              const percentage = total > 0 ? ((value / total) * 100) : 0
              dataRow.push({
                text: percentage.toFixed(1) + '%',
                options: { align: 'right', fontSize: 7 }
              })
            })
            dataRow.push({
              text: '100%',
              options: { bold: true, align: 'right', fontSize: 7 }
            })
          })
          tableRows.push(dataRow)
        })

        // Grand Total row
        const grandRow: any[] = [{ text: 'Grand Total', options: { bold: true, fill: 'ECEFF1', align: 'left' } }]
        matrix.brands.forEach((brand: string) => {
          let grandTotal = 0
          cities.forEach((city) => {
            sortedAgeGroups.forEach((ageGroup: string) => {
              grandTotal += (cityAgeMap[city]?.[ageGroup]?.[brand] || 0)
            })
          })
          const totalPerBrand = grandTotal || 1

          sortedAgeGroups.forEach((ageGroup: string) => {
            let total = 0
            cities.forEach((city) => {
              total += (cityAgeMap[city]?.[ageGroup]?.[brand] || 0)
            })
            const percentage = totalPerBrand > 0 ? ((total / totalPerBrand) * 100) : 0
            grandRow.push({
              text: percentage.toFixed(1) + '%',
              options: { bold: true, fill: 'ECEFF1', align: 'right', fontSize: 7 }
            })
          })
          grandRow.push({
            text: '100%',
            options: { bold: true, fill: 'ECEFF1', align: 'right', fontSize: 7 }
          })
        })
        tableRows.push(grandRow)

        slide.addTable(tableRows, {
          x, y, w, h,
          border: { type: 'solid', color: 'E0E0E0', size: 1 },
          fontSize: 7,
          fontFace: 'Arial',
        })
      }

      let currentSlideNum = 2

      // ─── Slide 1: Title Page ───
      setPptProgress('Generating Slide 1: Title...')
      const slide1 = pptx.addSlide()
      try { slide1.background = slide1Bg } catch (e) { slide1.background = { fill: 'FFFFFF' } }

      slide1.addShape(pptx.shapes.RECTANGLE, {
        x: 0.8,
        y: 1.5,
        w: 8.4,
        h: 2.8,
        fill: { color: '000000', transparency: 60 },
        line: { color: '4FC3F7', width: 2 }
      })

      slide1.addText('Survey Analysis Report', {
        x: 1.0,
        y: 1.7,
        w: 8.0,
        h: 0.8,
        fontSize: 32,
        bold: true,
        color: 'FFFFFF',
        align: 'center',
        fontFace: 'Arial',
      })

      slide1.addText('Brand Performance & Customer Feedback Analysis', {
        x: 1.0,
        y: 2.5,
        w: 8.0,
        h: 0.6,
        fontSize: 16,
        color: '4FC3F7',
        align: 'center',
        fontFace: 'Arial',
      })

      slide1.addText(`Report Generated: ${displayDate}`, {
        x: 1.0,
        y: 3.2,
        w: 8.0,
        h: 0.8,
        fontSize: 11,
        color: 'CCCCCC',
        align: 'center',
        fontFace: 'Arial',
      })

      // ─── Slide 2: Age Group Distribution ───
      setPptProgress('Generating Slide 2: Age Group Distribution...')
      const slide2 = pptx.addSlide()
      try { slide2.background = slideBg } catch (e) { slide2.background = { fill: 'FFFFFF' } }

      slide2.addText('Age Group Distribution', {
        x: 0.5,
        y: 0.3,
        w: 9.0,
        h: 0.5,
        fontSize: 22,
        bold: true,
        color: '333333',
        fontFace: 'Arial',
      })

      // Table (Left)
      if (analytics.age_group) {
        addMatrixTable(slide2, analytics.age_group, 'Age Group', 0.5, 1.0, 4.0, 3.8)
      }

      // Chart (Right) - Just image, no title
      const ageGroupImg = await captureElement('capture-age-group')
      if (ageGroupImg) {
        slide2.addImage({
          data: ageGroupImg,
          x: 4.8,
          y: 1.0,
          w: 4.7,
          h: 3.8,
        })
      }


      // ─── Slide 3: Age Group by City & Brand ───
      setPptProgress('Generating Slide 3: Age Group by City & Brand...')
      const slide3 = pptx.addSlide()
      try { slide3.background = slideBg } catch (e) { slide3.background = { fill: 'FFFFFF' } }

      slide3.addText('Age Group by City & Brand', {
        x: 0.5,
        y: 0.3,
        w: 9.0,
        h: 0.5,
        fontSize: 22,
        bold: true,
        color: '333333',
        fontFace: 'Arial',
      })

      // Age City Table (Top)
      if (analytics.age_city) {
        addAgeCityTable(slide3, analytics.age_city, 0.5, 1.0, 9.0, 2.8)
      }

      // Chart (Bottom) - Just image, no title
      const ageCityImg = await captureElement('capture-age-city')
      if (ageCityImg) {
        slide3.addImage({
          data: ageCityImg,
          x: 0.5,
          y: 3.9,
          w: 9.0,
          h: 1.3,
        })
      }


      // ─── Slide 4: Mode of Purchase & Ownership ───
      setPptProgress('Generating Slide 4: Mode of Purchase & Ownership...')
      const slide4 = pptx.addSlide()
      try { slide4.background = slideBg } catch (e) { slide4.background = { fill: 'FFFFFF' } }

      slide4.addText('Mode of Purchase & Ownership', {
        x: 0.5,
        y: 0.3,
        w: 9.0,
        h: 0.5,
        fontSize: 22,
        bold: true,
        color: '333333',
        fontFace: 'Arial',
      })

      // Left: Mode of Purchase Table
      slide4.addText('Mode of Purchase', {
        x: 0.5,
        y: 0.85,
        w: 4.3,
        h: 0.3,
        fontSize: 12,
        bold: true,
        color: '4FC3F7',
        fontFace: 'Arial',
      })
      if (analytics.mode_of_purchase) {
        addMatrixTable(slide4, analytics.mode_of_purchase, 'Mode', 0.5, 1.2, 4.3, 3.5)
      }

      // Right: Ownership Table
      slide4.addText('Ownership', {
        x: 5.0,
        y: 0.85,
        w: 4.5,
        h: 0.3,
        fontSize: 12,
        bold: true,
        color: '66BB6A',
        fontFace: 'Arial',
      })
      if (analytics.ownership) {
        addMatrixTable(slide4, analytics.ownership, 'Ownership', 5.0, 1.2, 4.5, 3.5)
      }

      // Chart (Bottom) - Just image, no title
      const purchaseImg = await captureElement('capture-purchase-ownership')
      if (purchaseImg) {
        slide4.addImage({
          data: purchaseImg,
          x: 0.5,
          y: 4.8,
          w: 9.0,
          h: 0.5,
        })
      }


      // ─── Slide 5: User Profession Distribution ───
      setPptProgress('Generating Slide 5: User Profession Distribution...')
      const slide5 = pptx.addSlide()
      try { slide5.background = slideBg } catch (e) { slide5.background = { fill: 'FFFFFF' } }

      slide5.addText('User Profession Distribution', {
        x: 0.5,
        y: 0.3,
        w: 9.0,
        h: 0.5,
        fontSize: 22,
        bold: true,
        color: '333333',
        fontFace: 'Arial',
      })

      // Table (Left)
      if (analytics.profession) {
        addMatrixTable(slide5, analytics.profession, 'Profession', 0.5, 1.0, 4.0, 3.8)
      }

      // Chart (Right) - Just image, no title
      const professionImg = await captureElement('capture-profession')
      if (professionImg) {
        slide5.addImage({
          data: professionImg,
          x: 4.8,
          y: 1.0,
          w: 4.7,
          h: 3.8,
        })
      }


      // ─── Issues Analysis Slides ───
      // Max data rows per slide (excluding header + grand total).
      // At fontSize 7, each row ≈ 0.17". Available height ≈ 3.8" → ~22 rows max.
      const MAX_ISSUE_ROWS = 20
      const getSubTopic = (name: string): string => {
        if (!name) return ''
        let parts = name.split(" - ")
        let part = parts[0]
        if (part.includes("?")) {
          part = part.split("?")[0]
        }
        if (part.includes("-")) {
          const subParts = part.split("-")
          if (subParts[1] && subParts[1].length > 10) {
            part = subParts[0]
          }
        }
        let cleaned = part.trim()
        if (cleaned.toLowerCase() === "muffler noise" || cleaned.toLowerCase() === "muffler vibration") {
          cleaned = "Muffler"
        }
        return cleaned
      }

      for (let idx = 0; idx < issues.length; idx++) {
        const issue = issues[idx]
        setPptProgress(`Generating Issue: ${issue.issue_name}...`)

        const cleanedTitle = cleanIssueName(issue.issue_name)

        // ── Build hierarchical header row (shared across all pages) ──
        const issueHeaderRow: any[] = [
          { text: `Sub complaint of ${cleanedTitle}`, options: { bold: true, fill: '4FC3F7', color: 'FFFFFF', align: 'left' } },
        ]
        issueBrands.forEach((brandName: string) => {
          issueHeaderRow.push({ text: brandName, options: { bold: true, fill: '4FC3F7', color: 'FFFFFF', align: 'right' } })
        })

        // ── Build flat list of all data rows ──
        interface FlatPptRow {
          sub_topic: string
          brands: { name: string; count: number }[]
        }
        const flatRows: FlatPptRow[] = []

        issue.sub_issues?.forEach((sub: any) => {
          flatRows.push({
            sub_topic: getSubTopic(sub.sub_issue),
            brands: sub.brands || []
          })
        })

        // Convert FlatPptRow → pptxgenjs cell array
        const buildCellRow = (row: FlatPptRow): any[] => {
          const cells: any[] = [
            { text: row.sub_topic, options: { align: 'left', color: '222222', fontSize: 7 } },
          ]
          issueBrands.forEach((b: string) => {
            const cnt = row.brands.find((br: any) => br.name === b)?.count || 0
            cells.push({
              text: cnt.toLocaleString(),
              options: { color: '222222', align: 'right', fontSize: 7 },
            })
          })
          return cells
        }

        // Grand Total row (added only on last page)
        const issueGrandRow: any[] = [
          { text: 'Grand Total', options: { bold: true, fill: 'ECEFF1', color: '222222', align: 'left', fontSize: 7 } },
        ]
        issueBrands.forEach((b: string) => {
          const brandSum = flatRows.reduce((sum, r) => sum + (r.brands.find(br => br.name === b)?.count || 0), 0)
          issueGrandRow.push({ text: brandSum.toLocaleString(), options: { bold: true, fill: 'ECEFF1', align: 'right', fontSize: 7 } })
        })

        // ── Chunk and paginate ──
        const totalPages = Math.max(1, Math.ceil(flatRows.length / MAX_ISSUE_ROWS))
        // Capture chart image ONCE (before creating slides)
        const issueImg = await captureElement(`capture-issue-${idx}`)

        for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
          const isFirstPage = pageIdx === 0
          const isLastPage = pageIdx === totalPages - 1

          const slide = pptx.addSlide()
          try { slide.background = slideBg } catch (e) { slide.background = { fill: 'FFFFFF' } }

          // Title — append "(cont.)" on continuation pages
          const pageTitle = isFirstPage ? cleanedTitle : `${cleanedTitle} (cont.)`
          slide.addText(pageTitle, {
            x: 0.5, y: 0.3, w: 9.0, h: 0.5,
            fontSize: 22, bold: true, color: '333333', fontFace: 'Arial',
          })

          // Slice data rows for this page
          const chunkStart = pageIdx * MAX_ISSUE_ROWS
          const chunkEnd = Math.min(chunkStart + MAX_ISSUE_ROWS, flatRows.length)
          const chunkRows = flatRows.slice(chunkStart, chunkEnd).map(buildCellRow)

          // Table = header + chunk + (grand total on last page)
          const pageTableRows: any[][] = [issueHeaderRow, ...chunkRows]
          if (isLastPage) pageTableRows.push(issueGrandRow)

          slide.addTable(pageTableRows, {
            x: 0.5, y: 1.0,
            w: isFirstPage ? 4.3 : 9.0,  // full-width on continuation pages (no chart)
            h: 3.8,
            border: { type: 'solid', color: 'E0E0E0', size: 1 },
            fontSize: 7,
            fontFace: 'Arial',
          })

          // Chart only on the first page (right side)
          if (isFirstPage && issueImg) {
            slide.addImage({ data: issueImg, x: 5.0, y: 1.0, w: 4.5, h: 3.8 })
          }
        }

      }

      // ─── Comparison Slides ───
      setPptProgress('Generating Comparison slides...')
      const compSlide = pptx.addSlide()
      try { compSlide.background = slideBg } catch (e) { compSlide.background = { fill: 'FFFFFF' } }

      compSlide.addText('Brand-wise Comparison: Passive vs Issues', {
        x: 0.5,
        y: 0.3,
        w: 9.0,
        h: 0.5,
        fontSize: 22,
        bold: true,
        color: '333333',
        fontFace: 'Arial',
      })

      // Comparison Chart (Full width) - Just image, no title
      const stackedImg = await captureElement('capture-comparison')
      if (stackedImg) {
        compSlide.addImage({
          data: stackedImg,
          x: 0.5,
          y: 1.0,
          w: 9.0,
          h: 4.2,
        })
      }


      // ─── Per-Brand Topic Breakdown ───
      for (let bIdx = 0; bIdx < topics.length; bIdx++) {
        const brandTopic = topics[bIdx]
        setPptProgress(`Generating Topic Breakdown for ${brandTopic.brand}...`)
        const slide = pptx.addSlide()
        try { slide.background = slideBg } catch (e) { slide.background = { fill: 'FFFFFF' } }

        slide.addText(`Topic Breakdown: ${brandTopic.brand}`, {
          x: 0.5,
          y: 0.3,
          w: 9.0,
          h: 0.5,
          fontSize: 22,
          bold: true,
          color: '333333',
          fontFace: 'Arial',
        })

        // Topic Chart (Full width) - Just image, no title
        const topicsImg = await captureElement(`capture-topics-${bIdx}`)
        if (topicsImg) {
          slide.addImage({
            data: topicsImg,
            x: 0.5,
            y: 1.0,
            w: 9.0,
            h: 4.2,
          })
        }
      }

      // ─── Follow-up Questions Slides (paginated at a FIXED 9 rows per slide) ───
      setPptProgress('Generating Follow-up Questions slides...')

      const FU_TABLE_X = 0.3
      const FU_TABLE_Y = 1.0
      const FU_TABLE_W = 9.4
      const FU_ROWS_PER_PAGE = 9

      // Reorder issueBrands for follow-up questions: place "TVS NTORQ  125 XP FI" right next to the Answer column
      const orderedFuBrands = [...issueBrands]
      const targetBrand = orderedFuBrands.find(b => {
        const normalized = b.replace(/\s+/g, ' ').trim().toLowerCase()
        return normalized === "tvs ntorq 125 xp fi"
      })
      if (targetBrand) {
        const idx = orderedFuBrands.indexOf(targetBrand)
        if (idx > -1) {
          orderedFuBrands.splice(idx, 1)
          orderedFuBrands.unshift(targetBrand)
        }
      }

      // Build the shared header row
      const fuHeaderRow: any[] = [
        { text: 'Main Issue', options: { bold: true, fill: '4FC3F7', color: 'FFFFFF', align: 'left' } },
        { text: 'Sub-Issue', options: { bold: true, fill: '4FC3F7', color: 'FFFFFF', align: 'left' } },
        { text: 'Follow-up Question', options: { bold: true, fill: '4FC3F7', color: 'FFFFFF', align: 'left' } },
        { text: 'Answer', options: { bold: true, fill: '4FC3F7', color: 'FFFFFF', align: 'left' } },
      ]
      orderedFuBrands.forEach((brandName: string) => {
        fuHeaderRow.push({ text: brandName, options: { bold: true, fill: '4FC3F7', color: 'FFFFFF', align: 'right' } })
      })

      // Build all data rows, one pptx cell array per row.
      const fuRows: any[][] = []

      let lastRenderedIssue = ""
      let lastRenderedSubIssue = ""
      let lastRenderedFollowUp = ""

      issues.forEach((issue: any) => {
        const issueName = cleanIssueName(issue.issue_name)
        
        let issueTvsCount = 0
        issue.sub_issues?.forEach((subObj: any) => {
          subObj.brands?.forEach((br: any) => {
            if (br.name?.toUpperCase().startsWith("TVS")) {
              issueTvsCount += br.count || 0
            }
          })
        })

        issue.sub_issues?.forEach((sub: any) => {
          let subTvsCount = 0
          sub.brands?.forEach((br: any) => {
            if (br.name?.toUpperCase().startsWith("TVS")) {
              subTvsCount += br.count || 0
            }
          })

          if (sub.has_follow_ups && sub.follow_ups) {
            sub.follow_ups.forEach((fu: any) => {
              let fuTvsCount = 0
              fu.answers?.forEach((ans: any) => {
                ans.brands?.forEach((br: any) => {
                  if (br.name?.toUpperCase().startsWith("TVS")) {
                    fuTvsCount += br.count || 0
                  }
                })
              })

              if (fu.answers && fu.answers.length > 0) {
                fu.answers.forEach((ans: any) => {
                  const displayAnswer = ans.answer.startsWith('"') && ans.answer.endsWith('"')
                    ? ans.answer
                    : `"${ans.answer}"`

                  const isIssueNew = issueName !== lastRenderedIssue
                  const isSubNew = sub.sub_issue !== lastRenderedSubIssue
                  const isFuNew = fu.follow_up !== lastRenderedFollowUp

                  const displayIssueText = isIssueNew ? `${issueName} (${issueTvsCount})` : ''
                  const displaySubText = isSubNew ? `${sub.sub_issue} (${subTvsCount})` : ''
                  const displayFuText = isFuNew ? `↳ ${fu.follow_up} (${fuTvsCount})` : ''

                  if (isIssueNew) lastRenderedIssue = issueName
                  if (isSubNew) lastRenderedSubIssue = sub.sub_issue
                  if (isFuNew) lastRenderedFollowUp = fu.follow_up

                  let ansTvsCount = 0
                  ans.brands?.forEach((br: any) => {
                    if (br.name?.toUpperCase().startsWith("TVS")) {
                      ansTvsCount += br.count || 0
                    }
                  })

                  const ansText = ans.is_split ? `${displayAnswer} ` : displayAnswer
                  const ansTextWithCount = `${ansText} (${ansTvsCount})`

                  const ansCellOpts: any = { color: '666666', align: 'left', fontSize: 7 }
                  if (ans.is_split) {
                    ansCellOpts.fill = 'FFF59D'
                  }

                  const dataRow: any[] = [
                    { text: displayIssueText, options: { color: '222222', align: 'left', fontSize: 7 } },
                    { text: displaySubText, options: { color: '333333', align: 'left', fontSize: 7 } },
                    { text: displayFuText, options: { color: '444444', italic: true, align: 'left', fontSize: 7 } },
                    { text: ansTextWithCount, options: ansCellOpts },
                  ]

                  orderedFuBrands.forEach((b: string) => {
                    const cnt = ans.brands?.find((br: any) => br.name === b)?.count || 0
                    const subBrandTotal = sub.brands?.find((br: any) => br.name === b)?.count || 0
                    const pct = subBrandTotal > 0 ? Math.round((cnt / subBrandTotal) * 100) : 0

                    const brandCellOpts: any = { align: 'right', fontSize: 7 }
                    if (ans.is_split) {
                      brandCellOpts.fill = 'FFF59D'
                    }
                    dataRow.push({ text: `${cnt} (${pct}%)`, options: brandCellOpts })
                  })
                  fuRows.push(dataRow)
                })
              } else {
                // Follow-up with no answers
                const isIssueNew = issueName !== lastRenderedIssue
                const isSubNew = sub.sub_issue !== lastRenderedSubIssue
                const isFuNew = fu.follow_up !== lastRenderedFollowUp

                const displayIssueText = isIssueNew ? `${issueName} (${issueTvsCount})` : ''
                const displaySubText = isSubNew ? `${sub.sub_issue} (${subTvsCount})` : ''
                const displayFuText = isFuNew ? `↳ ${fu.follow_up} (${fuTvsCount})` : ''

                if (isIssueNew) lastRenderedIssue = issueName
                if (isSubNew) lastRenderedSubIssue = sub.sub_issue
                if (isFuNew) lastRenderedFollowUp = fu.follow_up

                const dataRow: any[] = [
                  { text: displayIssueText, options: { color: '222222', align: 'left', fontSize: 7 } },
                  { text: displaySubText, options: { color: '333333', align: 'left', fontSize: 7 } },
                  { text: displayFuText, options: { color: '444444', italic: true, align: 'left', fontSize: 7 } },
                  { text: '\u2014', options: { color: '999999', align: 'left', fontSize: 7 } },
                ]

                orderedFuBrands.forEach(() => {
                  dataRow.push({ text: '0 (0%)', options: { align: 'right', fontSize: 7 } })
                })
                fuRows.push(dataRow)
              }
            })
          }
        })
      })

      if (fuRows.length === 0) {
        // No data — single placeholder slide
        const fuSlide = pptx.addSlide()
        try { fuSlide.background = slideBg } catch (e) { fuSlide.background = { fill: 'FFFFFF' } }
        fuSlide.addText('Follow-up Questions Summary', {
          x: 0.5, y: 0.3, w: 9.0, h: 0.5,
          fontSize: 22, bold: true, color: '333333', fontFace: 'Arial',
        })
        fuSlide.addText('No follow-up question data available.', {
          x: 0.5, y: 2.5, w: 9.0, h: 0.5,
          fontSize: 12, color: '999999', align: 'center',
        })
      } else {
        // ── Paginate at a fixed 9 data rows per slide ──
        const fuPages: any[][][] = []
        for (let i = 0; i < fuRows.length; i += FU_ROWS_PER_PAGE) {
          fuPages.push(fuRows.slice(i, i + FU_ROWS_PER_PAGE))
        }

        const fuTotalPages = fuPages.length

        fuPages.forEach((pageRows, fuPageIdx) => {
          const fuSlide = pptx.addSlide()
          try { fuSlide.background = slideBg } catch (e) { fuSlide.background = { fill: 'FFFFFF' } }

          // Title with page indicator on continuation pages
          const fuTitle = fuPageIdx === 0
            ? 'Follow-up Questions Summary'
            : `Follow-up Questions Summary (cont. ${fuPageIdx + 1}/${fuTotalPages})`
          fuSlide.addText(fuTitle, {
            x: 0.5, y: 0.3, w: 9.0, h: 0.5,
            fontSize: 22, bold: true, color: '333333', fontFace: 'Arial',
          })

          const pageTableRows: any[][] = [fuHeaderRow, ...pageRows]
          if (fuPageIdx === fuTotalPages - 1) {
            // Build the grand total row!
            const fuGrandRow: any[] = [
              { text: 'Grand Total', options: { bold: true, fill: 'ECEFF1', color: '222222', align: 'left', fontSize: 7 } },
              { text: '', options: { fill: 'ECEFF1' } },
              { text: '', options: { fill: 'ECEFF1' } },
              { text: '', options: { fill: 'ECEFF1' } },
            ]
            issueBrands.forEach((b: string) => {
              let brandTotalAnswers = 0
              issues.forEach((issueObj: any) => {
                issueObj.sub_issues?.forEach((subObj: any) => {
                  subObj.follow_ups?.forEach((fuObj: any) => {
                    fuObj.answers?.forEach((ansObj: any) => {
                      brandTotalAnswers += ansObj.brands?.find((br: any) => br.name === b)?.count || 0
                    })
                  })
                })
              })
              fuGrandRow.push({ text: `${brandTotalAnswers} (100%)`, options: { bold: true, fill: 'ECEFF1', align: 'right', fontSize: 7 } })
            })
            pageTableRows.push(fuGrandRow)
          }

          fuSlide.addTable(pageTableRows, {
            x: FU_TABLE_X, y: FU_TABLE_Y, w: FU_TABLE_W,
            border: { type: 'solid', color: 'E0E0E0', size: 1 },
            fontSize: 7,
            fontFace: 'Arial',
          })
        })
      }

      setPptProgress('Saving PowerPoint file...')
      await pptx.writeFile({ fileName: `Survey_Analysis_Report_${today}.pptx` })

      setToastSeverity('success')
      setToastMessage('Report downloaded successfully!')
      setToastOpen(true)
    } catch (err: any) {
      console.error('PPT Generation Error:', err)
      setToastSeverity('error')
      setToastMessage(`Failed to generate PPT: ${err.message || err}`)
      setToastOpen(true)
    } finally {
      setPptGenerating(false)
      setPptData(null)
    }
  }
  // Load dropdown options
  useEffect(() => {
    regionsApi.list().then((r) => setRegions(r.data.data || []))
    ibVersionsApi.list().then((r) => setIbVersions(r.data.data || []))
    responsesApi.filterOptions().then((r) => {
      setBrands(r.data.brands || [])
      setCities(r.data.locations || [])
    })
  }, [])

  useEffect(() => {
    if (filters.regionId) {
      countriesApi.byRegion(filters.regionId).then((r) => setCountries(r.data.data || []))
    } else {
      setCountries([])
    }
  }, [filters.regionId])

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const params = {
        region_id: (tab === 0 || tab === 1) ? (filters.regionId || undefined) : undefined,
        country_id: (tab === 0 || tab === 1) ? (filters.countryId || undefined) : undefined,
        ib_version_id: (tab === 0 || tab === 1) ? (filters.ibVersionId || undefined) : undefined,
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
          region_id: filters.regionId || undefined,
          country_id: filters.countryId || undefined,
          ib_version_id: filters.ibVersionId || undefined,
          brand_model: filters.brandModel || undefined,
          survey_location: filters.surveyLocation || undefined,
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
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Region</InputLabel>
              <Select
                id="filter-region"
                value={filters.regionId}
                onChange={(e) => { filters.setFilter('regionId', e.target.value); filters.setFilter('countryId', '') }}
                label="Region"
              >
                <MenuItem value="">All Regions</MenuItem>
                {regions.map((r) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 140 }} disabled={!filters.regionId}>
              <InputLabel>Country</InputLabel>
              <Select
                id="filter-country"
                value={filters.countryId}
                onChange={(e) => filters.setFilter('countryId', e.target.value)}
                label="Country"
              >
                <MenuItem value="">All Countries</MenuItem>
                {countries.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>IB Version</InputLabel>
              <Select
                id="filter-ib-version"
                value={filters.ibVersionId}
                onChange={(e) => filters.setFilter('ibVersionId', e.target.value)}
                label="IB Version"
              >
                <MenuItem value="">All</MenuItem>
                {ibVersions.map((v) => <MenuItem key={v.id} value={v.id}>{v.name}</MenuItem>)}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Brand & Model</InputLabel>
              <Select
                id="filter-brand"
                value={filters.brandModel}
                onChange={(e) => filters.setFilter('brandModel', e.target.value)}
                label="Brand & Model"
              >
                <MenuItem value="">All Brands</MenuItem>
                {brands.map((b) => <MenuItem key={b} value={b}>{b}</MenuItem>)}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>City</InputLabel>
              <Select
                id="filter-city"
                value={filters.surveyLocation}
                onChange={(e) => filters.setFilter('surveyLocation', e.target.value)}
                label="City"
              >
                <MenuItem value="">All Cities</MenuItem>
                {cities.map((city) => <MenuItem key={city} value={city}>{city}</MenuItem>)}
              </Select>
            </FormControl>

            <TextField
              size="small"
              id="filter-search"
              label="Search"
              placeholder="Brand, VIN, City..."
              value={filters.search}
              onChange={(e) => filters.setFilter('search', e.target.value)}
              sx={{ minWidth: 180 }}
            />

            <TextField
              size="small"
              id="filter-date-from"
              label="From Date"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => filters.setFilter('dateFrom', e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ minWidth: 140 }}
            />
            <TextField
              size="small"
              id="filter-date-to"
              label="To Date"
              type="date"
              value={filters.dateTo}
              onChange={(e) => filters.setFilter('dateTo', e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ minWidth: 140 }}
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

            <Tooltip title="Download Presentation (PPT)">
              <span>
                <Button
                  id="download-ppt-btn"
                  variant="outlined"
                  size="small"
                  disabled={pptGenerating}
                  onClick={handleDownloadPPT}
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
                  {pptGenerating ? 'Generating...' : 'Download PPT'}
                </Button>
              </span>
            </Tooltip>
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

      {/* Tabs */}
      <Box sx={{ borderBottom: `1px solid ${c.border}`, mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            '& .MuiTab-root': { color: c.textSecondary, fontWeight: 600 },
            '& .Mui-selected': { color: c.primaryLight },
            '& .MuiTabs-indicator': { background: 'linear-gradient(90deg, #6C63FF, #FF6584)' },
          }}
        >
          <Tab id="tab-data-table" label={`📋 Data Table (${totalRows.toLocaleString()} rows)`} />
          <Tab id="tab-issues-view" label="📊 Issues Analysis" />
          <Tab id="tab-dashboard" label="📈 Dashboard" />
          <Tab id="tab-comparison" label="🔀 Comparison" />
        </Tabs>
      </Box>

      {/* Tab 1: Data Table */}
      {tab === 0 && (
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

      {/* Tab 2: Issues Analysis */}
      {tab === 1 && <IssuesTab filters={filters} />}

      {/* Tab 3: Dashboard Analytics */}
      {tab === 2 && <DashboardAnalytics filters={filters} />}

      {/* Tab 4: Comparison */}
      {tab === 3 && <ComparisonTab filters={filters} />}

      {/* PPT progress alert */}
      {pptGenerating && (
        <Alert severity="info" sx={{ mt: 2, display: 'flex', alignItems: 'center', mx: 2 }}>
          Generating PPT Presentation: {pptProgress}
        </Alert>
      )}

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