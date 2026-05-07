import React, { useEffect, useState, useMemo, useCallback } from 'react'
import {
  BarChart, Bar, LineChart, Line, Area, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import api from '../utils/api'
import { fc } from '../utils/formatters'
import useSettingsStore from '../store/settingsStore'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLevel(code) {
  const s = String(code)
  let trailing = 0
  for (let i = s.length - 1; i >= 0 && s[i] === '0'; i--) trailing++
  if (trailing >= 5) return 0   // 100000, 200000, 300000, 400000, 500000, 700000
  if (trailing >= 4) return 1   // 310000, 210000, 410000 etc.
  if (trailing >= 2) return 2
  return 3
}

function isHigherBetter(code) {
  if (code >= 100000 && code < 200000) return true
  if (code >= 200000 && code < 300000) return false
  if (code === 300000) return true
  if (code >= 310000 && code < 400000) return false
  return true
}

function fmtVal(v, currency, fxRates) {
  if (v === null || v === undefined || v === 0) return '—'
  return fc(v, true, currency, fxRates)
}

function fmtValZero(v, currency, fxRates) {
  if (v === null || v === undefined) return '—'
  return fc(v, true, currency, fxRates)
}

function varBadge(actual, base, higher_is_better) {
  if (!base || base === 0) return null
  const diff = actual - base
  const pct = diff / Math.abs(base)
  const good = higher_is_better ? diff >= 0 : diff <= 0
  return { diff, pct, good }
}

function fmtPct(v) {
  if (v == null) return '—'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${(v * 100).toFixed(1)}%`
}

function monthLabel(mk) {
  if (!mk) return ''
  const [y, m] = mk.split('-')
  return new Date(+y, +m - 1).toLocaleString('en', { month: 'short', year: 'numeric' })
}

function getStoreVal(dataMap, store, code) {
  return (dataMap?.[store] || {})[String(code)] || 0
}

function getPctNetRev(val, nrVal) {
  if (!nrVal || nrVal === 0) return null
  return val / nrVal
}

const GOOD = '#16a34a'
const BAD  = '#dc2626'
const MID  = '#6b6890'
const PUR  = '#6958C2'

// ── KPI Dashboard cards ───────────────────────────────────────────────────────

const KPI_CODES = [
  { code: 100000, label: 'Net Revenue',   pct: false },
  { code: 300000, label: 'Gross Profit',  pct: true  },
  { code: 400000, label: 'EBITDA',        pct: true  },
  { code: 700000, label: 'Net Profit',    pct: true  },
]

function KpiCard({ label, value, pctVal, priorValue, currency, fxRates }) {
  const higherBetter = true
  const badge = varBadge(value, priorValue, higherBetter)
  return (
    <div className="flex flex-col gap-1 px-5 py-4 rounded-xl"
      style={{ background: '#fff', border: '1px solid #ede9fb', minWidth: 180, flex: 1 }}>
      <span className="text-xs font-sans font-medium uppercase tracking-wide" style={{ color: MID }}>{label}</span>
      <span className="text-xl font-sans font-bold" style={{ color: '#1a1830' }}>
        {fc(value, true, currency, fxRates)}
      </span>
      {pctVal != null && (
        <span className="text-sm font-sans" style={{ color: MID }}>
          {(pctVal * 100).toFixed(1)}% of Rev
        </span>
      )}
      {badge && (
        <span className="text-xs font-sans font-medium mt-0.5" style={{ color: badge.good ? GOOD : BAD }}>
          {badge.pct >= 0 ? '▲' : '▼'} {Math.abs(badge.pct * 100).toFixed(1)}% vs prior
        </span>
      )}
    </div>
  )
}

// ── Chart helpers ─────────────────────────────────────────────────────────────
function shortNum(v) {
  if (Math.abs(v) >= 1e7) return `${(v / 1e7).toFixed(1)}Cr`
  if (Math.abs(v) >= 1e5) return `${(v / 1e5).toFixed(1)}L`
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}K`
  return String(Math.round(v))
}

const CHART_COLORS = ['#6958C2', '#10b981', '#f97316', '#3b82f6', '#ec4899', '#a855f7']

const MONTH_NAMES = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ── Insights Panel ────────────────────────────────────────────────────────────

function InsightsPanel({ items }) {
  if (!items || items.length === 0) return null
  return (
    <div className="rounded-xl p-4" style={{ background: 'linear-gradient(135deg,#f5f3ff,#eef2ff)', border: '1px solid #ddd6fe' }}>
      <div className="text-xs font-sans font-semibold uppercase tracking-wide mb-3" style={{ color: '#7c3aed' }}>
        Insights
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((ins, i) => (
          <div key={i} className="flex items-start gap-2 text-xs font-sans rounded-lg px-3 py-2"
            style={{ background: '#fff', border: '1px solid #ede9fb', color: '#374151', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <span className="flex-shrink-0">{ins.icon}</span>
            <span dangerouslySetInnerHTML={{ __html: ins.text }} />
          </div>
        ))}
      </div>
    </div>
  )
}

function buildDashboardInsights(em, currency, fxRates) {
  if (!em || !em.total_revenue) return []
  const items = []
  const rev = em.total_revenue
  items.push({ icon: '📈', text: `Net Revenue: <strong>${fc(rev, true, currency, fxRates)}</strong>` })
  const gpPct = em.gross_profit_pct
  if (gpPct != null) {
    const ok = gpPct >= 0.65
    items.push({ icon: ok ? '✅' : '⚠️', text: `GP Margin: <strong>${(gpPct*100).toFixed(1)}%</strong> ${ok ? '(above 65% benchmark)' : '— below 65% benchmark'}` })
  }
  const fcPct = em.food_cost_pct
  if (fcPct != null) {
    const ok = fcPct <= 0.38
    items.push({ icon: ok ? '✅' : '⚠️', text: `Food Cost: <strong>${(fcPct*100).toFixed(1)}%</strong>${ok ? '' : ' — exceeds 38% target'}` })
  }
  if (em.ebitda != null) {
    const ok = em.ebitda >= 0
    items.push({ icon: ok ? '💰' : '🔴', text: `EBITDA: <strong>${fc(em.ebitda, true, currency, fxRates)}</strong> (${(em.ebitda_pct*100).toFixed(1)}% margin)` })
  }
  const top = (em.top_expenses || [])[0]
  if (top) items.push({ icon: '💸', text: `Biggest Expense: <strong>${top.label}</strong> — ${fc(top.value, true, currency, fxRates)}` })
  return items
}

function buildStatementInsights(pnlGlData, stores, actuals, prior, currency, fxRates) {
  if (!pnlGlData?.available || !stores.length) return []
  const items = []
  const TOTAL = stores.find(s => s.toLowerCase().includes('total')) || stores[0]
  const nr = (actuals?.[TOTAL] || {})['100000'] || 0
  const priorNr = (prior?.[TOTAL] || {})['100000'] || 0
  if (nr > 0) items.push({ icon: '📊', text: `Net Revenue: <strong>${fc(nr, true, currency, fxRates)}</strong>` })
  if (nr > 0 && priorNr > 0) {
    const diff = (nr - priorNr) / priorNr
    const col = diff >= 0 ? '#16a34a' : '#dc2626'
    items.push({ icon: diff >= 0 ? '📈' : '📉', text: `vs Prior Month: <strong style="color:${col}">${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff*100).toFixed(1)}%</strong>` })
  }
  const gp = (actuals?.[TOTAL] || {})['300000'] || 0
  if (nr > 0) {
    const gpPct = gp / nr
    items.push({ icon: gpPct >= 0.65 ? '✅' : '⚠️', text: `GP Margin: <strong>${(gpPct*100).toFixed(1)}%</strong>` })
  }
  const ebitda = (actuals?.[TOTAL] || {})['400000'] || 0
  if (ebitda !== 0) items.push({ icon: ebitda >= 0 ? '💰' : '🔴', text: `EBITDA: <strong>${fc(ebitda, true, currency, fxRates)}</strong>` })
  return items
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PnL() {
  const { currency, fxRates } = useSettingsStore()
  const [glData, setGlData] = useState(null)
  const [glLoading, setGlLoading] = useState(true)
  const [expandedGroup, setExpandedGroup] = useState(null)

  // ── GL dashboard slicer state ───────────────────────────────────────────
  const [glFilterMode, setGlFilterMode] = useState('single')  // 'single' | 'range'
  const [glYear, setGlYear] = useState(null)
  const [glMonth, setGlMonth] = useState(null)
  const [glYearFrom, setGlYearFrom] = useState(null)
  const [glMonthFrom, setGlMonthFrom] = useState(null)
  const [glYearTo, setGlYearTo] = useState(null)
  const [glMonthTo, setGlMonthTo] = useState(null)
  const [glStore, setGlStore] = useState(null)

  // ── P&L Statement period state ─────────────────────────────────────────
  const [periodMode, setPeriodMode] = useState('single')
  const [pnlYear, setPnlYear] = useState(null)
  const [pnlMonth, setPnlMonth] = useState(null)
  const [pnlYearFrom, setPnlYearFrom] = useState(null)
  const [pnlMonthFrom, setPnlMonthFrom] = useState(null)
  const [pnlYearTo, setPnlYearTo] = useState(null)
  const [pnlMonthTo, setPnlMonthTo] = useState(null)
  const [compareMonths, setCompareMonths] = useState([])  // ['YYYY-MM', ...]

  // ── P&L from GL data ───────────────────────────────────────────────────
  const [pnlGlData, setPnlGlData] = useState(null)
  const [pnlGlLoading, setPnlGlLoading] = useState(false)
  const [compareGlData, setCompareGlData] = useState({})  // {mk: pnl_response}

  // Category/group trend chart selection
  const [selectedCategories, setSelectedCategories] = useState([])
  const [selectedGroups, setSelectedGroups] = useState([])

  // Chart type toggles for dashboard charts
  const [trendChartType, setTrendChartType]   = useState('bar')   // monthly trend
  const [catChartType,   setCatChartType]     = useState('line')  // category trend
  const [grpChartType,   setGrpChartType]     = useState('line')  // group trend

  // Year filter for trend charts (null = show all years)
  const [chartYear, setChartYear] = useState(null)

  // Store view + toggles
  const [activeStore, setActiveStore] = useState('consolidated')
  const [colCode, setColCode]     = useState(false)
  const [colBudget, setColBudget] = useState(false)
  const [colPrior, setColPrior]   = useState(true)
  const [colPct, setColPct]       = useState(true)
  const [collapsed, setCollapsed] = useState(new Set())
  const [activeTab, setActiveTab] = useState('table')

  // ════════════════════════════════════════════════════════════════════════
  // DASHBOARD — loads GL data independently, no connection to Statement
  // ════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    async function loadGL() {
      setGlLoading(true)
      try {
        const params = new URLSearchParams()
        if (glFilterMode === 'range') {
          if (glYearFrom) params.set('year_from', glYearFrom)
          if (glMonthFrom) params.set('month_from', glMonthFrom)
          if (glYearTo) params.set('year_to', glYearTo)
          if (glMonthTo) params.set('month_to', glMonthTo)
        } else {
          if (glYear) params.set('year', glYear)
          if (glMonth) params.set('month', glMonth)
        }
        if (glStore) params.set('store', glStore)
        const res = await api.get(`/data/gl-dashboard?${params}`)
          .catch(() => ({ data: { available: false } }))
        setGlData(res.data || { available: false })
      } finally {
        setGlLoading(false)
      }
    }
    loadGL()
  }, [glFilterMode, glYear, glMonth, glYearFrom, glMonthFrom, glYearTo, glMonthTo, glStore])

  // ════════════════════════════════════════════════════════════════════════
  // STATEMENT — loads pnl-from-gl independently, no connection to Dashboard
  // ════════════════════════════════════════════════════════════════════════

  // Derived from Statement's own data (NOT from glData)
  const pnlAvailPeriods = useMemo(() => pnlGlData?.available_periods || [], [pnlGlData])
  const pnlAvailYears   = useMemo(() => [...new Set(pnlAvailPeriods.map(p => p.year))].sort(), [pnlAvailPeriods])
  const pnlMonthsForYear = useCallback((y) =>
    pnlAvailPeriods.filter(p => p.year === y).map(p => p.month).sort((a, b) => a - b),
    [pnlAvailPeriods]
  )

  // On mount: auto-load latest period (backend defaults to latest when no params given)
  useEffect(() => {
    async function initStatement() {
      setPnlGlLoading(true)
      try {
        const res = await api.get('/data/pnl-from-gl').catch(() => ({ data: null }))
        const data = res.data || null
        setPnlGlData(data)
        const periods = data?.available_periods || []
        if (periods.length > 0) {
          const last  = periods[periods.length - 1]
          const first = periods[0]
          setPnlYear(last.year)
          setPnlMonth(last.month)
          setPnlYearFrom(first.year)
          setPnlMonthFrom(first.month)
          setPnlYearTo(last.year)
          setPnlMonthTo(last.month)
          setCompareMonths([`${last.year}-${String(last.month).padStart(2,'0')}`])
        }
      } finally {
        setPnlGlLoading(false)
      }
    }
    initStatement()
  }, []) // runs only once on mount

  // Reload Statement when user changes period (skip if pnlYear not yet set)
  useEffect(() => {
    if (periodMode === 'compare') return
    if (!pnlYear && !pnlYearFrom) return
    async function loadStatement() {
      setPnlGlLoading(true)
      try {
        const params = new URLSearchParams()
        if (periodMode === 'range' && pnlYearFrom && pnlYearTo) {
          params.set('year_from', pnlYearFrom)
          if (pnlMonthFrom) params.set('month_from', pnlMonthFrom)
          params.set('year_to', pnlYearTo)
          if (pnlMonthTo) params.set('month_to', pnlMonthTo)
        } else if (pnlYear && pnlMonth) {
          params.set('year', pnlYear)
          params.set('month', pnlMonth)
        } else if (pnlYear) {
          params.set('year', pnlYear)
        } else return
        const res = await api.get(`/data/pnl-from-gl?${params}`).catch(() => ({ data: null }))
        if (res.data) setPnlGlData(res.data)
      } finally {
        setPnlGlLoading(false)
      }
    }
    loadStatement()
  }, [periodMode, pnlYear, pnlMonth, pnlYearFrom, pnlMonthFrom, pnlYearTo, pnlMonthTo])

  // Compare mode
  useEffect(() => {
    if (periodMode !== 'compare' || compareMonths.length === 0) return
    async function loadCompare() {
      setPnlGlLoading(true)
      try {
        const results = await Promise.all(
          compareMonths.map(async (mk) => {
            const [y, m] = mk.split('-').map(Number)
            const res = await api.get(`/data/pnl-from-gl?year=${y}&month=${m}`).catch(() => ({ data: null }))
            return [mk, res.data]
          })
        )
        const combined = {}
        results.forEach(([mk, data]) => { if (data) combined[mk] = data })
        setCompareGlData(combined)
        const firstData = results.find(([, d]) => d)?.[1]
        if (firstData) setPnlGlData(firstData)
      } finally {
        setPnlGlLoading(false)
      }
    }
    loadCompare()
  }, [periodMode, compareMonths])

  const loading = pnlGlLoading

  const hierarchy = useMemo(() => pnlGlData?.hierarchy || [], [pnlGlData])
  const stores    = useMemo(() => pnlGlData?.stores    || [], [pnlGlData])

  // ── Resolve which stores to display as columns ──────────────────────────
  const resolvedStores = useMemo(() => {
    if (activeStore === 'sidebyside') return stores
    if (activeStore === 'consolidated') {
      const tot = stores.find(s => s.toLowerCase().includes('total'))
      return tot ? [tot] : stores.slice(-1)
    }
    const match = stores.find(s => s === activeStore)
    return match ? [match] : stores.slice(-1)
  }, [activeStore, stores])

  // ── Actuals per month (used in compare mode) ─────────────────────────────
  function getMonthActuals(mk) {
    return compareGlData[mk]?.actuals || {}
  }

  // ── Single/range actuals ─────────────────────────────────────────────────
  const actuals = useMemo(() => {
    if (periodMode === 'single' || periodMode === 'range') return pnlGlData?.actuals || {}
    // compare: use last selected month for main view
    const lastMk = compareMonths[compareMonths.length - 1] || ''
    return getMonthActuals(lastMk)
  }, [pnlGlData, periodMode, compareMonths, compareGlData])

  const prior = useMemo(() => {
    if (periodMode !== 'single') return {}
    return pnlGlData?.prior || {}
  }, [pnlGlData, periodMode])

  const budget = useMemo(() => {
    if (periodMode !== 'single') return {}
    return pnlGlData?.budget || {}
  }, [pnlGlData, periodMode])

  // ── Net Revenue per store ─────────────────────────────────────────────────
  const netRevByStore = useMemo(() => {
    const out = {}
    for (const store of stores) out[store] = getStoreVal(actuals, store, 100000)
    return out
  }, [actuals, stores])

  // ── Visible rows (collapse logic) ────────────────────────────────────────
  const visibleRows = useMemo(() => {
    const result = []
    let hidingAboveLevel = -1
    const levels = hierarchy.map(r => getLevel(r.code))
    const hasChild = hierarchy.map((r, i) =>
      i < hierarchy.length - 1 && levels[i + 1] > levels[i]
    )
    for (let i = 0; i < hierarchy.length; i++) {
      const row = hierarchy[i]
      const level = levels[i]
      if (hidingAboveLevel >= 0 && level <= hidingAboveLevel) hidingAboveLevel = -1
      if (hidingAboveLevel >= 0) continue
      result.push({ ...row, level, hasChild: hasChild[i] })
      if (collapsed.has(row.code)) hidingAboveLevel = level
    }
    return result
  }, [hierarchy, collapsed])

  const toggleCollapse = useCallback((code) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(code) ? next.delete(code) : next.add(code)
      return next
    })
  }, [])

  // Default: collapse level-1 sections on load
  useEffect(() => {
    if (hierarchy.length > 0 && collapsed.size === 0) {
      const level1Codes = new Set(
        hierarchy.filter(r => getLevel(r.code) === 1).map(r => r.code)
      )
      setCollapsed(level1Codes)
    }
  }, [hierarchy])

  function expandAll() { setCollapsed(new Set()) }
  function collapseAll() {
    setCollapsed(new Set(hierarchy.filter(r => getLevel(r.code) === 0).map(r => r.code)))
  }

  function toggleCompareMonth(mk) {
    setCompareMonths(prev =>
      prev.includes(mk) ? prev.filter(m => m !== mk) : [...prev, mk].sort()
    )
  }

  // ── Store tabs ────────────────────────────────────────────────────────────
  function storeShortName(s) {
    if (!s) return ''
    if (s.toLowerCase().includes('total')) return 'Consolidated'
    if (s.includes('IDN') || s.includes('Indiranagar')) return 'BGL-IDN'
    if (s.includes('BSC') || s.includes('Bagmane')) return 'BGL-BSC'
    if (s.includes('Back Office') || s.includes('IND-BO')) return 'Back Office'
    return s.split(' ')[0]
  }

  const storeTabs = [
    { id: 'consolidated', label: 'Consolidated' },
    ...stores
      .filter(s => !s.toLowerCase().includes('total'))
      .map(s => ({ id: s, label: storeShortName(s) })),
    { id: 'sidebyside', label: 'All Stores' },
  ]

  // ── Dashboard section (GL-driven) ────────────────────────────────────────
  function renderDashboard() {
    const gl = glData || {}
    const em = gl.expert_metrics || {}
    const catBreakdown = gl.category_breakdown || []
    const storeBreakdown = gl.store_breakdown || []
    const groupBreakdown = gl.group_breakdown || []
    const monthlyTrend = (gl.monthly_trend || [])
      .filter(m => m.revenue > 0)
      .sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month))

    const glStores = gl.stores || []

    const isLoading = glLoading
    const isAvailable = gl.available !== false

    // ── Slicer bar (data-driven, single/range mode) ───────────────────────
    const glAvailPeriods = gl.available_periods || []
    const glAvailYears   = [...new Set(glAvailPeriods.map(p => p.year))].sort()
    function glMonthsForYear(y) {
      return glAvailPeriods.filter(p => p.year === y).map(p => p.month).sort((a, b) => a - b)
    }
    function SlicerBar() {
      const yearsInGL = glAvailYears
      const singleYearMonths = glYear != null ? glMonthsForYear(glYear) : []
      const fromMonths = glYearFrom != null ? glMonthsForYear(glYearFrom) : []
      const toMonths   = glYearTo   != null ? glMonthsForYear(glYearTo)   : []

      const btnStyle = (active) => ({
        background: active ? PUR : '#f5f4fb',
        color: active ? '#fff' : MID,
        border: `1px solid ${active ? PUR : '#e8e6f0'}`,
        cursor: 'pointer',
      })

      return (
        <div className="bg-white rounded-xl p-4 flex flex-wrap gap-4 items-end" style={{ border: '1px solid #ede9fb' }}>

          {/* Mode toggle */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-sans font-medium text-t3">Period Mode</span>
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #e8e6f0' }}>
              {[['single','Single Period'],['range','Date Range']].map(([m,l]) => (
                <button key={m} onClick={() => setGlFilterMode(m)}
                  className="px-3 py-1.5 text-xs font-sans font-medium"
                  style={{ background: glFilterMode === m ? PUR : '#fff', color: glFilterMode === m ? '#fff' : MID, cursor: 'pointer', borderRight: '1px solid #e8e6f0' }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {glFilterMode === 'single' && (<>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-sans font-medium text-t3">Year</span>
              <div className="flex gap-1">
                <button onClick={() => { setGlYear(null); setGlMonth(null) }}
                  className="px-3 py-1 rounded-lg text-xs font-sans font-medium" style={btnStyle(glYear == null)}>All</button>
                {yearsInGL.map(y => (
                  <button key={y} onClick={() => { setGlYear(y); setGlMonth(null) }}
                    className="px-3 py-1 rounded-lg text-xs font-sans font-medium" style={btnStyle(glYear === y)}>{y}</button>
                ))}
              </div>
            </div>
            {glYear != null && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-sans font-medium text-t3">Month</span>
                <div className="flex flex-wrap gap-1">
                  <button onClick={() => setGlMonth(null)}
                    className="px-2 py-1 rounded-lg text-xs font-sans" style={btnStyle(glMonth == null)}>All</button>
                  {singleYearMonths.map(m => (
                    <button key={m} onClick={() => setGlMonth(glMonth === m ? null : m)}
                      className="px-2 py-1 rounded-lg text-xs font-sans" style={btnStyle(glMonth === m)}>{MONTH_NAMES[m]}</button>
                  ))}
                </div>
              </div>
            )}
          </>)}

          {glFilterMode === 'range' && (
            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-sans font-medium text-t3">From Year</span>
                <div className="flex gap-1">
                  {yearsInGL.map(y => (
                    <button key={y} onClick={() => { setGlYearFrom(y); setGlMonthFrom(null) }}
                      className="px-3 py-1 rounded-lg text-xs font-sans font-medium" style={btnStyle(glYearFrom === y)}>{y}</button>
                  ))}
                </div>
              </div>
              {glYearFrom != null && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-sans font-medium text-t3">From Month</span>
                  <div className="flex flex-wrap gap-1">
                    {fromMonths.map(m => (
                      <button key={m} onClick={() => setGlMonthFrom(glMonthFrom === m ? null : m)}
                        className="px-2 py-1 rounded-lg text-xs font-sans" style={btnStyle(glMonthFrom === m)}>{MONTH_NAMES[m]}</button>
                    ))}
                  </div>
                </div>
              )}
              <span className="text-t3 text-sm mb-1">→</span>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-sans font-medium text-t3">To Year</span>
                <div className="flex gap-1">
                  {yearsInGL.map(y => (
                    <button key={y} onClick={() => { setGlYearTo(y); setGlMonthTo(null) }}
                      className="px-3 py-1 rounded-lg text-xs font-sans font-medium" style={btnStyle(glYearTo === y)}>{y}</button>
                  ))}
                </div>
              </div>
              {glYearTo != null && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-sans font-medium text-t3">To Month</span>
                  <div className="flex flex-wrap gap-1">
                    {toMonths.map(m => (
                      <button key={m} onClick={() => setGlMonthTo(glMonthTo === m ? null : m)}
                        className="px-2 py-1 rounded-lg text-xs font-sans" style={btnStyle(glMonthTo === m)}>{MONTH_NAMES[m]}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Store filter */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-sans font-medium text-t3">Store</span>
            <div className="flex flex-wrap gap-1">
              <button onClick={() => setGlStore(null)}
                className="px-3 py-1 rounded-lg text-xs font-sans" style={btnStyle(glStore == null)}>All</button>
              {glStores.map(s => (
                <button key={s} onClick={() => setGlStore(glStore === s ? null : s)}
                  className="px-3 py-1 rounded-lg text-xs font-sans" style={btnStyle(glStore === s)}>{s}</button>
              ))}
            </div>
          </div>

          {isLoading && <span className="text-xs font-sans text-t3 ml-2">Updating…</span>}
        </div>
      )
    }

    if (!isAvailable) return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <span className="text-4xl">📊</span>
        <p className="font-sans text-t2 text-sm">No GL data yet. Re-upload the P&L file to generate the dashboard.</p>
      </div>
    )

    const totalRev = em.total_revenue || 0

    // KPI cards
    const kpis = [
      { label: 'Net Revenue',  value: totalRev,            pctVal: null,               isRatio: false },
      { label: 'Gross Profit', value: em.gross_profit_pct != null ? totalRev * em.gross_profit_pct : 0, pctVal: em.gross_profit_pct, isRatio: false },
      { label: 'EBITDA',       value: em.ebitda || 0,      pctVal: em.ebitda_pct,      isRatio: false },
      { label: 'Net Profit',   value: em.net_profit != null ? em.net_profit : null,    pctVal: em.net_profit_pct, isRatio: false },
      { label: 'Food Cost %',  value: null,                pctVal: em.food_cost_pct,   isRatio: true },
      { label: 'Labour %',     value: null,                pctVal: em.labour_cost_pct, isRatio: true },
      { label: 'Rev / Day',    value: em.revenue_per_day,  pctVal: null,               isRatio: false },
    ]

    return (
      <div className="flex flex-col gap-5">

        {/* ── Slicer bar ─────────────────────────────────────────────── */}
        <SlicerBar />

        {/* ── KPI cards ──────────────────────────────────────────────── */}
        <div className="flex gap-3 flex-wrap">
          {kpis.map(k => {
            const isNP = k.label === 'Net Profit'
            const valColor = isNP && k.value != null
              ? (k.value >= 0 ? GOOD : BAD)
              : '#1a1830'
            return (
              <div key={k.label} className="flex flex-col gap-1 px-4 py-3 rounded-xl"
                style={{ background: '#fff', border: `1px solid ${isNP && k.value != null && k.value < 0 ? '#fee2e2' : '#ede9fb'}`, minWidth: 150, flex: 1 }}>
                <span className="text-xs font-sans font-medium uppercase tracking-wide" style={{ color: MID }}>{k.label}</span>
                {k.isRatio ? (
                  <span className="text-xl font-sans font-bold" style={{ color: '#1a1830' }}>
                    {k.pctVal != null ? `${(k.pctVal * 100).toFixed(1)}%` : '—'}
                  </span>
                ) : (
                  <span className="text-xl font-sans font-bold" style={{ color: valColor }}>
                    {k.value != null ? fc(k.value, true, currency, fxRates) : '—'}
                  </span>
                )}
                {k.pctVal != null && !k.isRatio && (
                  <span className="text-xs font-sans" style={{ color: isNP && k.pctVal < 0 ? BAD : MID }}>
                    {(k.pctVal * 100).toFixed(1)}% of Rev
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* ── A: Category breakdown table ────────────────────────────── */}
        {catBreakdown.length > 0 && (
          <div className="bg-white rounded-xl p-5" style={{ border: '1px solid #ede9fb' }}>
            <div className="text-sm font-sans font-semibold text-t1 mb-4">Sales by Category</div>
            <table className="w-full text-xs font-sans">
              <thead>
                <tr style={{ borderBottom: '2px solid #f0eefb' }}>
                  <th className="text-left py-2 pr-4 font-semibold text-t2">Category</th>
                  <th className="text-right py-2 px-3 font-semibold" style={{ color: PUR }}>Revenue</th>
                  <th className="text-right py-2 px-3 font-semibold text-t2">COGS</th>
                  <th className="text-right py-2 px-3 font-semibold" style={{ color: GOOD }}>Gross Profit</th>
                  <th className="text-right py-2 px-3 font-semibold text-t2">GP %</th>
                  <th className="py-2 px-3 font-semibold text-t3" style={{ minWidth: 100 }}>Mix</th>
                </tr>
              </thead>
              <tbody>
                {catBreakdown.map((cat, i) => {
                  const isTotal = cat.category === 'Total'
                  const maxRev = catBreakdown.find(c => c.category === 'Total')?.revenue || 1
                  const barPct = isTotal ? 100 : (cat.revenue / maxRev) * 100
                  return (
                    <tr key={cat.category} style={{
                      borderBottom: '1px solid #f5f4fb',
                      background: isTotal ? '#f5f4fb' : 'transparent',
                      borderTop: isTotal ? '2px solid #e8e6f0' : undefined,
                    }}>
                      <td className="py-2.5 pr-4 font-medium" style={{ color: isTotal ? '#1a1830' : '#2d2a4a', fontWeight: isTotal ? 600 : 400 }}>{cat.category}</td>
                      <td className="py-2.5 px-3 text-right font-mono" style={{ color: PUR, fontWeight: isTotal ? 600 : 400 }}>
                        {fc(cat.revenue, true, currency, fxRates)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-t2" style={{ fontWeight: isTotal ? 600 : 400 }}>
                        {cat.cogs > 0 ? fc(cat.cogs, true, currency, fxRates) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono" style={{ color: GOOD, fontWeight: isTotal ? 600 : 400 }}>
                        {fc(cat.gross_profit, true, currency, fxRates)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-sans" style={{ color: cat.gp_pct >= 0.5 ? GOOD : BAD, fontWeight: isTotal ? 600 : 400 }}>
                        {(cat.gp_pct * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3">
                        {!isTotal && (
                          <div className="h-3 rounded overflow-hidden" style={{ background: '#f0eefb' }}>
                            <div style={{ width: `${barPct}%`, height: '100%', background: CHART_COLORS[i] || PUR, borderRadius: 2 }} />
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Chart Year Filter (applies to all trend charts below) ───── */}
        {monthlyTrend.length > 0 && (() => {
          const chartYears = [...new Set(monthlyTrend.map(m => m.year))].sort()
          if (chartYears.length <= 1) return null
          return (
            <div className="flex items-center gap-2 px-1">
              <span className="text-xs font-sans font-medium" style={{ color: MID }}>Chart view:</span>
              <div className="flex gap-1">
                <button onClick={() => setChartYear(null)}
                  className="px-3 py-1 rounded-lg text-xs font-sans font-medium"
                  style={{ background: chartYear == null ? PUR : '#f5f4fb', color: chartYear == null ? '#fff' : MID, border: `1px solid ${chartYear == null ? PUR : '#e8e6f0'}`, cursor: 'pointer' }}>
                  All Years
                </button>
                {chartYears.map(y => (
                  <button key={y} onClick={() => setChartYear(chartYear === y ? null : y)}
                    className="px-3 py-1 rounded-lg text-xs font-sans font-medium"
                    style={{ background: chartYear === y ? PUR : '#f5f4fb', color: chartYear === y ? '#fff' : MID, border: `1px solid ${chartYear === y ? PUR : '#e8e6f0'}`, cursor: 'pointer' }}>
                    {y}
                  </button>
                ))}
              </div>
            </div>
          )
        })()}

        {/* ── B: Monthly trend chart ──────────────────────────────────── */}
        {monthlyTrend.length > 0 && (() => {
          const displayTrend = chartYear ? monthlyTrend.filter(m => m.year === chartYear) : monthlyTrend
          const ChartTypeBtn = ({ t, label }) => (
            <button onClick={() => setTrendChartType(t)}
              className="px-2 py-1 rounded text-xs font-sans"
              style={{ background: trendChartType === t ? PUR : '#f5f4fb', color: trendChartType === t ? '#fff' : MID, border: `1px solid ${trendChartType === t ? PUR : '#e8e6f0'}`, cursor: 'pointer' }}>
              {label}
            </button>
          )
          const tooltipFmt = (v, name) => ['GP %', 'NP %'].includes(name) ? `${(v*100).toFixed(1)}%` : fc(v, true, currency, fxRates)
          const commonProps = { data: displayTrend, margin: { top: 5, right: 30, left: 10, bottom: 5 } }
          const axes = <>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0eefb" />
            <XAxis dataKey="month_label" tick={{ fontSize: 11, fill: MID }} />
            <YAxis yAxisId="rev" tickFormatter={shortNum} tick={{ fontSize: 11, fill: MID }} />
            <YAxis yAxisId="pct" orientation="right" tickFormatter={v => `${(v*100).toFixed(0)}%`} tick={{ fontSize: 11, fill: MID }} domain={[0, 1]} />
            <Tooltip formatter={tooltipFmt} labelStyle={{ fontWeight: 600, color: '#1a1830' }} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e8e6f0' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line yAxisId="pct" type="monotone" dataKey="gp_pct" name="GP %"  stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
            <Line yAxisId="pct" type="monotone" dataKey="np_pct" name="NP %"  stroke="#ec4899" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" />
          </>
          return (
            <div className="bg-white rounded-xl p-5" style={{ border: '1px solid #ede9fb' }}>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="text-sm font-sans font-semibold text-t1">Monthly Revenue & Net Profit Trend</div>
                <div className="flex gap-1">
                  <ChartTypeBtn t="bar"  label="Bar"  />
                  <ChartTypeBtn t="line" label="Line" />
                  <ChartTypeBtn t="area" label="Area" />
                </div>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                {trendChartType === 'line' ? (
                  <ComposedChart {...commonProps}>
                    {axes}
                    <Line yAxisId="rev" type="monotone" dataKey="revenue"      name="Revenue"      stroke={PUR}     strokeWidth={2} dot={{ r: 3 }} />
                    <Line yAxisId="rev" type="monotone" dataKey="gross_profit"  name="Gross Profit"  stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                    <Line yAxisId="rev" type="monotone" dataKey="net_profit"    name="Net Profit"    stroke="#ec4899" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" />
                  </ComposedChart>
                ) : trendChartType === 'area' ? (
                  <ComposedChart {...commonProps}>
                    {axes}
                    <Area yAxisId="rev" type="monotone" dataKey="revenue"      name="Revenue"      stroke={PUR}     fill={PUR}     fillOpacity={0.15} strokeWidth={2} />
                    <Area yAxisId="rev" type="monotone" dataKey="gross_profit"  name="Gross Profit"  stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
                    <Area yAxisId="rev" type="monotone" dataKey="net_profit"    name="Net Profit"    stroke="#ec4899" fill="#ec4899" fillOpacity={0.1}  strokeWidth={2} />
                  </ComposedChart>
                ) : (
                  <ComposedChart {...commonProps}>
                    {axes}
                    <Bar  yAxisId="rev" dataKey="revenue"      name="Revenue"      fill={PUR}     radius={[3,3,0,0]} opacity={0.85} />
                    <Bar  yAxisId="rev" dataKey="gross_profit"  name="Gross Profit"  fill="#10b981" radius={[3,3,0,0]} opacity={0.85} />
                    <Line yAxisId="rev" type="monotone" dataKey="net_profit" name="Net Profit" stroke="#ec4899" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                )}
              </ResponsiveContainer>
            </div>
          )
        })()}

        {/* ── C: Store comparison chart ───────────────────────────────── */}
        {storeBreakdown.length > 1 && (
          <div className="bg-white rounded-xl p-5" style={{ border: '1px solid #ede9fb' }}>
            <div className="text-sm font-sans font-semibold text-t1 mb-4">Store Comparison</div>
            <div className="flex gap-5">
              <div style={{ flex: 2 }}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={storeBreakdown} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0eefb" />
                    <XAxis dataKey="store" tick={{ fontSize: 11, fill: MID }} />
                    <YAxis tickFormatter={shortNum} tick={{ fontSize: 11, fill: MID }} />
                    <Tooltip formatter={v => fc(v, true, currency, fxRates)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e8e6f0' }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="revenue" name="Revenue" fill={PUR} radius={[3,3,0,0]} />
                    <Bar dataKey="gross_profit" name="Gross Profit" fill="#10b981" radius={[3,3,0,0]} />
                    <Bar dataKey="ebitda" name="EBITDA" fill="#f97316" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1 }}>
                <table className="w-full text-xs font-sans">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #f0eefb' }}>
                      <th className="text-left py-1.5 font-semibold text-t2">Store</th>
                      <th className="text-right py-1.5 px-2 font-semibold text-t2">GP%</th>
                      <th className="text-right py-1.5 px-2 font-semibold text-t2">EBITDA%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storeBreakdown.map(s => (
                      <tr key={s.store} style={{ borderBottom: '1px solid #f5f4fb' }}>
                        <td className="py-1.5 font-medium text-t1">{s.store}</td>
                        <td className="py-1.5 px-2 text-right" style={{ color: s.gp_pct >= 0.5 ? GOOD : BAD }}>{(s.gp_pct*100).toFixed(1)}%</td>
                        <td className="py-1.5 px-2 text-right" style={{ color: s.ebitda_pct >= 0 ? GOOD : BAD }}>{(s.ebitda_pct*100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── D: P&L Group drill-down ─────────────────────────────────── */}
        {groupBreakdown.length > 0 && (
          <div className="bg-white rounded-xl p-5" style={{ border: '1px solid #ede9fb' }}>
            <div className="text-sm font-sans font-semibold text-t1 mb-4">P&L Group Breakdown <span className="text-xs font-normal text-t3 ml-1">(click to expand)</span></div>
            <div className="flex flex-col gap-0.5">
              {groupBreakdown.map((g, gi) => {
                const isRev = g.group === 'Net Revenue'
                const amt = isRev ? -g.total : g.total
                const isNeg = !isRev && g.total < 0   // income item stored negative
                const maxAmt = Math.max(...groupBreakdown.map(x => Math.abs(x.total)))
                const barPct = maxAmt ? (Math.abs(g.total) / maxAmt) * 100 : 0
                const color = isRev ? PUR : isNeg ? GOOD : CHART_COLORS[gi % CHART_COLORS.length]
                const expanded = expandedGroup === g.group
                return (
                  <div key={g.group}>
                    <div
                      className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer"
                      style={{ background: expanded ? '#f5f4fb' : 'transparent' }}
                      onClick={() => setExpandedGroup(expanded ? null : g.group)}
                    >
                      <span className="text-xs font-sans w-4 text-t3">{expanded ? '▼' : '▶'}</span>
                      <span className="text-xs font-sans font-medium w-48 flex-shrink-0 text-t1">{g.group}</span>
                      <div className="flex-1 h-4 rounded overflow-hidden" style={{ background: '#f0eefb' }}>
                        <div style={{ width: `${barPct}%`, height: '100%', background: color, borderRadius: 2, opacity: 0.8 }} />
                      </div>
                      <span className="text-xs font-mono w-28 text-right flex-shrink-0" style={{ color: isRev ? PUR : '#1a1830' }}>
                        {fc(Math.abs(g.total), true, currency, fxRates)}
                      </span>
                      {totalRev > 0 && (
                        <span className="text-xs font-sans w-12 text-right flex-shrink-0" style={{ color: MID }}>
                          {(Math.abs(g.total) / totalRev * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                    {expanded && g.items.length > 0 && (
                      <div className="ml-8 mb-1 flex flex-col gap-0.5">
                        {g.items.map(item => {
                          const iPct = Math.abs(g.total) ? (Math.abs(item.value) / Math.abs(g.total)) * 100 : 0
                          return (
                            <div key={item.label} className="flex items-center gap-3 px-3 py-1.5 rounded" style={{ background: '#faf9fd' }}>
                              <span className="text-xs font-sans w-44 flex-shrink-0 text-t2">{item.label}</span>
                              <div className="flex-1 h-3 rounded overflow-hidden" style={{ background: '#ede9fb' }}>
                                <div style={{ width: `${iPct}%`, height: '100%', background: color, borderRadius: 2, opacity: 0.6 }} />
                              </div>
                              <span className="text-xs font-mono w-28 text-right flex-shrink-0" style={{ color: MID }}>
                                {fc(Math.abs(item.value), true, currency, fxRates)}
                              </span>
                              <span className="text-xs font-sans w-12 text-right flex-shrink-0" style={{ color: MID }}>
                                {iPct.toFixed(1)}%
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── E: Expert analysis ──────────────────────────────────────── */}
        <div className="bg-white rounded-xl p-5" style={{ border: '1px solid #ede9fb' }}>
          <div className="text-sm font-sans font-semibold text-t1 mb-4">Expert Analysis</div>
          <div className="flex gap-5 flex-wrap">

            {/* Margin waterfall */}
            <div style={{ flex: 2, minWidth: 280 }}>
              <div className="text-xs font-sans font-medium text-t2 mb-2">Margin Waterfall</div>
              {[
                { label: 'Net Revenue',  value: totalRev, color: PUR },
                { label: 'Gross Profit', value: totalRev * (em.gross_profit_pct || 0), color: '#10b981' },
                { label: 'EBITDA',       value: em.ebitda || 0, color: (em.ebitda || 0) >= 0 ? '#3b82f6' : BAD },
              ].map(item => {
                const pct = totalRev ? Math.abs(item.value) / totalRev : 0
                return (
                  <div key={item.label} className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-sans w-24 text-t2 flex-shrink-0">{item.label}</span>
                    <div className="flex-1 h-5 rounded overflow-hidden" style={{ background: '#f5f4fb' }}>
                      <div style={{ width: `${Math.min(pct*100,100)}%`, height: '100%', background: item.color, borderRadius: 3 }} />
                    </div>
                    <span className="text-xs font-mono w-28 text-right flex-shrink-0" style={{ color: item.value < 0 ? BAD : '#1a1830' }}>
                      {fc(item.value, true, currency, fxRates)}
                    </span>
                    <span className="text-xs font-sans w-12 text-right flex-shrink-0" style={{ color: MID }}>
                      {(pct * 100).toFixed(1)}%
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Top expenses */}
            <div style={{ flex: 1, minWidth: 200 }}>
              <div className="text-xs font-sans font-medium text-t2 mb-2">Top Expense Categories</div>
              {(em.top_expenses || []).map((e, i) => (
                <div key={e.label} className="flex justify-between items-center py-1.5" style={{ borderBottom: '1px solid #f5f4fb' }}>
                  <span className="text-xs font-sans text-t1">{i + 1}. {e.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono" style={{ color: BAD }}>{fc(e.value, true, currency, fxRates)}</span>
                    {totalRev > 0 && (
                      <span className="text-xs font-sans" style={{ color: MID }}>{(e.value / totalRev * 100).toFixed(1)}%</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Benchmarks */}
            <div style={{ flex: 1, minWidth: 180 }}>
              <div className="text-xs font-sans font-medium text-t2 mb-2">Benchmarks</div>
              {[
                { label: 'Food Cost',  actual: em.food_cost_pct,  target: 0.38, good_when: 'below' },
                { label: 'Labour',     actual: em.labour_cost_pct, target: 0.35, good_when: 'below' },
                { label: 'Gross Profit', actual: em.gross_profit_pct, target: 0.65, good_when: 'above' },
              ].map(b => {
                const pct = (b.actual || 0) * 100
                const tPct = b.target * 100
                const isGood = b.good_when === 'above' ? pct >= tPct : pct <= tPct
                return (
                  <div key={b.label} className="mb-2">
                    <div className="flex justify-between mb-0.5">
                      <span className="text-xs font-sans text-t2">{b.label}</span>
                      <span className="text-xs font-sans font-medium" style={{ color: isGood ? GOOD : BAD }}>
                        {pct.toFixed(1)}% <span style={{ color: MID }}>/ target {tPct.toFixed(0)}%</span>
                      </span>
                    </div>
                    <div className="h-2 rounded overflow-hidden" style={{ background: '#f0eefb', position: 'relative' }}>
                      <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: isGood ? GOOD : BAD, borderRadius: 2 }} />
                    </div>
                  </div>
                )
              })}
            </div>

          </div>
        </div>

        {/* ── F: Category Revenue Trend ──────────────────────────────────── */}
        {(gl.category_monthly_trend || []).length > 0 && (() => {
          const allCats = (gl.category_monthly_trend || []).map(t => t.category)
          const activeCats = selectedCategories.length === 0 ? allCats : selectedCategories
          // Filter by chartYear then pivot to [{month_label, ...categoryValues}]
          const filteredData = chartYear
            ? (gl.category_monthly_trend[0]?.data || []).filter(d => d.year === chartYear)
            : (gl.category_monthly_trend[0]?.data || [])
          const pivoted = filteredData.map((d, idx) => {
            const row = { month_label: d.month_label }
            ;(gl.category_monthly_trend || []).forEach(t => {
              if (activeCats.includes(t.category)) {
                const src = chartYear ? t.data.filter(x => x.year === chartYear) : t.data
                row[t.category] = src[idx]?.value || 0
              }
            })
            return row
          })
          return (
            <div className="bg-white rounded-xl p-5" style={{ border: '1px solid #ede9fb' }}>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="text-sm font-sans font-semibold text-t1">Revenue Category Trend</div>
                <div className="flex flex-wrap gap-1 items-center">
                  {['line','bar','area'].map(t => (
                    <button key={t} onClick={() => setCatChartType(t)}
                      className="px-2 py-1 rounded text-xs font-sans"
                      style={{ background: catChartType === t ? PUR : '#f5f4fb', color: catChartType === t ? '#fff' : MID, border: `1px solid ${catChartType === t ? PUR : '#e8e6f0'}`, cursor: 'pointer' }}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                  <div className="w-px h-4 mx-1" style={{ background: '#e8e6f0' }} />
                  {allCats.map(cat => (
                    <button key={cat}
                      onClick={() => setSelectedCategories(prev =>
                        prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                      )}
                      className="px-2 py-1 rounded text-xs font-sans"
                      style={{
                        background: (selectedCategories.length === 0 || selectedCategories.includes(cat)) ? PUR : '#f5f4fb',
                        color: (selectedCategories.length === 0 || selectedCategories.includes(cat)) ? '#fff' : MID,
                        border: `1px solid ${(selectedCategories.length === 0 || selectedCategories.includes(cat)) ? PUR : '#e8e6f0'}`,
                        cursor: 'pointer',
                      }}>
                      {cat}
                    </button>
                  ))}
                  {selectedCategories.length > 0 && (
                    <button onClick={() => setSelectedCategories([])}
                      className="px-2 py-1 rounded text-xs font-sans"
                      style={{ background: '#f5f4fb', color: MID, border: '1px solid #e8e6f0', cursor: 'pointer' }}>
                      All
                    </button>
                  )}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={pivoted} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0eefb" />
                  <XAxis dataKey="month_label" tick={{ fontSize: 11, fill: MID }} />
                  <YAxis tickFormatter={shortNum} tick={{ fontSize: 11, fill: MID }} width={60} />
                  <Tooltip formatter={(v) => fc(v, true, currency, fxRates)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {activeCats.map((cat, i) => catChartType === 'bar'
                    ? <Bar key={cat} dataKey={cat} name={cat} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[2,2,0,0]} opacity={0.85} />
                    : catChartType === 'area'
                    ? <Area key={cat} type="monotone" dataKey={cat} name={cat} stroke={CHART_COLORS[i % CHART_COLORS.length]} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.12} strokeWidth={2} dot={false} />
                    : <Line key={cat} type="monotone" dataKey={cat} name={cat} stroke={CHART_COLORS[i % CHART_COLORS.length]} dot={false} strokeWidth={2} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )
        })()}

        {/* ── G: Expense Group Trend ─────────────────────────────────────── */}
        {(gl.group_monthly_trend || []).length > 0 && (() => {
          const allGrps = (gl.group_monthly_trend || []).map(t => t.group)
          const activeGrps = selectedGroups.length === 0 ? allGrps.slice(0, 5) : selectedGroups
          const filteredGrpData = chartYear
            ? (gl.group_monthly_trend[0]?.data || []).filter(d => d.year === chartYear)
            : (gl.group_monthly_trend[0]?.data || [])
          const pivoted = filteredGrpData.map((d, idx) => {
            const row = { month_label: d.month_label }
            ;(gl.group_monthly_trend || []).forEach(t => {
              if (activeGrps.includes(t.group)) {
                const src = chartYear ? t.data.filter(x => x.year === chartYear) : t.data
                row[t.group] = src[idx]?.value || 0
              }
            })
            return row
          })
          return (
            <div className="bg-white rounded-xl p-5" style={{ border: '1px solid #ede9fb' }}>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="text-sm font-sans font-semibold text-t1">Expense Group Trend</div>
                <div className="flex flex-wrap gap-1 items-center">
                  {['line','bar','area'].map(t => (
                    <button key={t} onClick={() => setGrpChartType(t)}
                      className="px-2 py-1 rounded text-xs font-sans"
                      style={{ background: grpChartType === t ? '#f97316' : '#f5f4fb', color: grpChartType === t ? '#fff' : MID, border: `1px solid ${grpChartType === t ? '#f97316' : '#e8e6f0'}`, cursor: 'pointer' }}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                  <div className="w-px h-4 mx-1" style={{ background: '#e8e6f0' }} />
                  {allGrps.map(g => (
                    <button key={g}
                      onClick={() => setSelectedGroups(prev =>
                        prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]
                      )}
                      className="px-2 py-1 rounded text-xs font-sans"
                      style={{
                        background: activeGrps.includes(g) ? '#f97316' : '#f5f4fb',
                        color: activeGrps.includes(g) ? '#fff' : MID,
                        border: `1px solid ${activeGrps.includes(g) ? '#f97316' : '#e8e6f0'}`,
                        cursor: 'pointer',
                      }}>
                      {g}
                    </button>
                  ))}
                  {selectedGroups.length > 0 && (
                    <button onClick={() => setSelectedGroups([])}
                      className="px-2 py-1 rounded text-xs font-sans"
                      style={{ background: '#f5f4fb', color: MID, border: '1px solid #e8e6f0', cursor: 'pointer' }}>
                      All
                    </button>
                  )}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={pivoted} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0eefb" />
                  <XAxis dataKey="month_label" tick={{ fontSize: 11, fill: MID }} />
                  <YAxis tickFormatter={shortNum} tick={{ fontSize: 11, fill: MID }} width={60} />
                  <Tooltip formatter={(v) => fc(v, true, currency, fxRates)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {activeGrps.map((g, i) => {
                    const color = CHART_COLORS[(i + 2) % CHART_COLORS.length]
                    return grpChartType === 'bar'
                      ? <Bar  key={g} dataKey={g} name={g} fill={color} radius={[2,2,0,0]} opacity={0.85} />
                      : grpChartType === 'area'
                      ? <Area key={g} type="monotone" dataKey={g} name={g} stroke={color} fill={color} fillOpacity={0.12} strokeWidth={2} dot={false} />
                      : <Line key={g} type="monotone" dataKey={g} name={g} stroke={color} dot={false} strokeWidth={2} />
                  })}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )
        })()}

        {/* ── H: Dashboard Insights ─────────────────────────────────────── */}
        <InsightsPanel items={buildDashboardInsights(em, currency, fxRates)} />

      </div>
    )
  }

  // ── Compare mode table ────────────────────────────────────────────────────
  function renderCompareTable() {
    const selMonths = compareMonths.filter(mk => compareGlData[mk])
    if (selMonths.length === 0) {
      return (
        <div className="px-4 py-10 text-center text-t3 font-sans text-sm">
          Select at least one month to compare.
        </div>
      )
    }

    const store = resolvedStores[0] || stores[stores.length - 1] || ''

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-sans border-collapse">
          <thead>
            <tr style={{ borderBottom: '1px solid #e8e6f0' }}>
              {colCode && (
                <th className="px-3 py-3 text-left text-xs font-semibold text-t3 uppercase tracking-wide sticky left-0"
                  style={{ background: '#faf9fd', minWidth: 80 }}>Code</th>
              )}
              <th className="px-4 py-3 text-left text-xs font-semibold text-t2 uppercase tracking-wide sticky"
                style={{ background: '#faf9fd', minWidth: 220, left: colCode ? 80 : 0 }}>
                Line Item
              </th>
              {selMonths.map(mk => (
                <th key={mk} className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide"
                  style={{ background: '#faf9fd', color: PUR, whiteSpace: 'nowrap' }}>
                  {monthLabel(mk)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(row => {
              const code = row.code
              const level = row.level
              const isTop = level === 0
              const isIncome = row.sub_formula === -1
              const indentPx = level * 16
              const rowBg = isTop ? '#eeecfa' : level === 1 ? '#f8f7fd' : level === 2 ? '#faf9fd' : 'transparent'
              const fw = level <= 1 ? '600' : '400'
              const textColor = isIncome ? PUR : isTop ? '#1a1830' : '#2d2a4a'

              return (
                <tr key={code} style={{ background: rowBg, borderBottom: '1px solid #f0eefb' }}>
                  {colCode && (
                    <td className="px-3 py-2 font-mono text-xs text-t3" style={{ background: rowBg }}>
                      {code}
                    </td>
                  )}
                  <td className="px-4 py-2.5 font-sans" style={{ paddingLeft: 16 + indentPx, background: rowBg }}>
                    <span className="flex items-center gap-1.5">
                      {row.hasChild ? (
                        <button onClick={() => toggleCollapse(code)}
                          className="text-xs w-4 h-4 flex items-center justify-center flex-shrink-0 rounded"
                          style={{ color: PUR, background: '#eeecfa', cursor: 'pointer' }}>
                          {collapsed.has(code) ? '▶' : '▼'}
                        </button>
                      ) : <span className="w-4 flex-shrink-0" />}
                      <span style={{ fontWeight: fw, color: textColor, fontSize: 13 }}>
                        {row.description.trim()}
                      </span>
                    </span>
                  </td>
                  {selMonths.map(mk => {
                    const mActuals = compareGlData[mk]?.actuals || {}
                    const v = getStoreVal(mActuals, store, code)
                    return (
                      <td key={mk} className="px-4 py-2.5 text-right font-mono"
                        style={{ fontSize: 12, color: isIncome ? PUR : textColor, fontWeight: fw }}>
                        {v === 0 ? '—' : fc(v, true, currency, fxRates)}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  // ── Standard table ────────────────────────────────────────────────────────
  function renderHeaders() {
    const isSideBySide = activeStore === 'sidebyside'
    return (
      <tr style={{ borderBottom: '1px solid #e8e6f0' }}>
        {colCode && (
          <th className="px-3 py-3 text-left text-xs font-semibold text-t3 uppercase tracking-wide"
            style={{ background: '#faf9fd', minWidth: 80 }}>Code</th>
        )}
        <th className="px-4 py-3 text-left text-xs font-semibold text-t2 uppercase tracking-wide"
          style={{ background: '#faf9fd', minWidth: 220 }}>
          Line Item
        </th>
        {resolvedStores.map(store => {
          const label = storeShortName(store)
          if (isSideBySide) return (
            <React.Fragment key={store}>
              <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide"
                style={{ background: '#faf9fd', color: PUR, whiteSpace: 'nowrap' }}>{label}</th>
              {colPct && <th className="px-2 py-3 text-right text-xs font-semibold text-t3 uppercase tracking-wide"
                style={{ background: '#faf9fd' }}>%</th>}
            </React.Fragment>
          )
          return (
            <React.Fragment key={store}>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide"
                style={{ background: '#faf9fd', color: PUR }}>Actual</th>
              {colBudget && <>
                <th className="px-3 py-3 text-right text-xs font-semibold text-t2 uppercase tracking-wide"
                  style={{ background: '#faf9fd' }}>Budget</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-t2 uppercase tracking-wide"
                  style={{ background: '#faf9fd' }}>vs Bgt</th>
              </>}
              {colPrior && <>
                <th className="px-3 py-3 text-right text-xs font-semibold text-t2 uppercase tracking-wide"
                  style={{ background: '#faf9fd' }}>Prior</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-t2 uppercase tracking-wide"
                  style={{ background: '#faf9fd' }}>vs Prior</th>
              </>}
              {colPct && <th className="px-3 py-3 text-right text-xs font-semibold text-t3 uppercase tracking-wide"
                style={{ background: '#faf9fd' }}>% Net Rev</th>}
            </React.Fragment>
          )
        })}
      </tr>
    )
  }

  function renderTableRow(row) {
    const code = row.code
    const level = row.level
    const isTop = level === 0
    const isIncome = row.sub_formula === -1
    const higherBetter = isHigherBetter(code)
    const indentPx = level * 16
    const isSideBySide = activeStore === 'sidebyside'
    const rowBg = isTop ? '#eeecfa' : level === 1 ? '#f8f7fd' : level === 2 ? '#faf9fd' : 'transparent'
    const fw = level <= 1 ? '600' : '400'
    const textColor = isIncome ? PUR : isTop ? '#1a1830' : '#2d2a4a'

    return (
      <tr key={code} style={{ background: rowBg, borderBottom: '1px solid #f0eefb' }}>
        {colCode && (
          <td className="px-3 py-2 font-mono text-xs" style={{ color: MID, background: rowBg }}>
            {code}
          </td>
        )}
        <td className="px-4 py-2.5 font-sans" style={{ paddingLeft: 16 + indentPx }}>
          <span className="flex items-center gap-1.5">
            {row.hasChild ? (
              <button onClick={() => toggleCollapse(code)}
                className="text-xs w-4 h-4 flex items-center justify-center flex-shrink-0 rounded"
                style={{ color: PUR, background: '#eeecfa', cursor: 'pointer' }}>
                {collapsed.has(code) ? '▶' : '▼'}
              </button>
            ) : <span className="w-4 flex-shrink-0" />}
            <span style={{ fontWeight: fw, color: textColor, fontSize: 13 }}>
              {row.description.trim()}
            </span>
          </span>
        </td>

        {resolvedStores.map(store => {
          const val = getStoreVal(actuals, store, code)
          const nrVal = netRevByStore[store] || 0
          const pctVal = getPctNetRev(val, nrVal)
          const priorVal = getStoreVal(prior, store, code)
          const budgetVal = getStoreVal(budget, store, code)
          const cellStyle = { fontSize: 12, color: isIncome ? PUR : textColor, fontWeight: fw }

          if (isSideBySide) return (
            <React.Fragment key={store}>
              <td className="px-3 py-2.5 text-right font-mono" style={cellStyle}>
                {val === 0 ? '—' : fc(val, true, currency, fxRates)}
              </td>
              {colPct && <td className="px-2 py-2.5 text-right font-sans" style={{ fontSize: 11, color: MID }}>
                {pctVal != null ? `${(pctVal * 100).toFixed(1)}%` : '—'}
              </td>}
            </React.Fragment>
          )

          const bv = varBadge(val, budgetVal, higherBetter)
          const pv = varBadge(val, priorVal, higherBetter)

          return (
            <React.Fragment key={store}>
              <td className="px-4 py-2.5 text-right font-mono" style={cellStyle}>
                {val === 0 ? '—' : fc(val, true, currency, fxRates)}
              </td>
              {colBudget && <>
                <td className="px-3 py-2.5 text-right font-mono" style={{ fontSize: 11, color: MID }}>
                  {budgetVal === 0 ? '—' : fc(budgetVal, true, currency, fxRates)}
                </td>
                <td className="px-3 py-2.5 text-right font-sans"
                  style={{ fontSize: 11, color: bv ? (bv.good ? GOOD : BAD) : MID }}>
                  {bv ? fmtPct(bv.pct) : '—'}
                </td>
              </>}
              {colPrior && <>
                <td className="px-3 py-2.5 text-right font-mono" style={{ fontSize: 11, color: MID }}>
                  {priorVal === 0 ? '—' : fc(priorVal, true, currency, fxRates)}
                </td>
                <td className="px-3 py-2.5 text-right font-sans"
                  style={{ fontSize: 11, color: pv ? (pv.good ? GOOD : BAD) : MID }}>
                  {pv ? fmtPct(pv.pct) : '—'}
                </td>
              </>}
              {colPct && <td className="px-3 py-2.5 text-right font-sans" style={{ fontSize: 11, color: MID }}>
                {pctVal != null ? `${(pctVal * 100).toFixed(1)}%` : '—'}
              </td>}
            </React.Fragment>
          )
        })}
      </tr>
    )
  }

  function ymLabel(y, m) {
    if (!y || !m) return ''
    return `${MONTH_NAMES[m]} ${y}`
  }

  const periodLabel = periodMode === 'single'
    ? ymLabel(pnlYear, pnlMonth)
    : periodMode === 'compare'
    ? compareMonths.map(mk => { const [y,m] = mk.split('-').map(Number); return ymLabel(y,m) }).join(' vs ')
    : `${ymLabel(pnlYearFrom, pnlMonthFrom)} – ${ymLabel(pnlYearTo, pnlMonthTo)}`

  return (
    <div className="flex flex-col gap-4">

      {/* ── Controls ─── */}
      <div className="bg-white rounded-xl p-4 flex flex-col gap-4" style={{ border: '1px solid #f0eefb' }}>

        {/* Row 1: Period mode */}
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-sans text-t3 font-medium">Period</span>
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #e8e6f0' }}>
              {[['single','Single'], ['compare','Compare Months'], ['range','Range / YTD']].map(([mode, label]) => (
                <button key={mode} onClick={() => setPeriodMode(mode)}
                  className="px-4 py-1.5 text-xs font-sans font-medium"
                  style={{
                    background: periodMode === mode ? PUR : '#fff',
                    color: periodMode === mode ? '#fff' : '#6b6890',
                    cursor: 'pointer',
                    borderRight: '1px solid #e8e6f0',
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {periodMode === 'single' && (
            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-sans text-t3 font-medium">Year</span>
                <select value={pnlYear || ''} onChange={e => { setPnlYear(Number(e.target.value)); setPnlMonth(null) }}
                  className="px-3 py-1.5 rounded-lg text-sm font-sans outline-none"
                  style={{ border: '1px solid #e8e6f0', color: '#1a1830', background: '#fff' }}>
                  {pnlAvailYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-sans text-t3 font-medium">Month</span>
                <select value={pnlMonth || ''} onChange={e => setPnlMonth(Number(e.target.value))}
                  className="px-3 py-1.5 rounded-lg text-sm font-sans outline-none"
                  style={{ border: '1px solid #e8e6f0', color: '#1a1830', background: '#fff' }}>
                  {pnlMonthsForYear(pnlYear).map(m => <option key={m} value={m}>{MONTH_NAMES[m]}</option>)}
                </select>
              </div>
            </div>
          )}

          {periodMode === 'compare' && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-sans text-t3 font-medium">Select months to compare</span>
              <div className="flex flex-wrap gap-2">
                {pnlAvailPeriods.map(p => {
                  const mk = `${p.year}-${String(p.month).padStart(2,'0')}`
                  return (
                    <button key={mk} onClick={() => toggleCompareMonth(mk)}
                      className="px-3 py-1 rounded-lg text-xs font-sans font-medium"
                      style={{
                        background: compareMonths.includes(mk) ? PUR : '#f5f4fb',
                        color: compareMonths.includes(mk) ? '#fff' : '#6b6890',
                        border: `1px solid ${compareMonths.includes(mk) ? PUR : '#e8e6f0'}`,
                        cursor: 'pointer',
                      }}>
                      {MONTH_NAMES[p.month]} {p.year}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {periodMode === 'range' && (
            <div className="flex items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-sans text-t3 font-medium">From</span>
                <div className="flex gap-2">
                  <select value={pnlYearFrom || ''} onChange={e => { setPnlYearFrom(Number(e.target.value)); setPnlMonthFrom(null) }}
                    className="px-3 py-1.5 rounded-lg text-sm font-sans outline-none"
                    style={{ border: '1px solid #e8e6f0', color: '#1a1830', background: '#fff' }}>
                    {pnlAvailYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <select value={pnlMonthFrom || ''} onChange={e => setPnlMonthFrom(Number(e.target.value))}
                    className="px-3 py-1.5 rounded-lg text-sm font-sans outline-none"
                    style={{ border: '1px solid #e8e6f0', color: '#1a1830', background: '#fff' }}>
                    {pnlMonthsForYear(pnlYearFrom).map(m => <option key={m} value={m}>{MONTH_NAMES[m]}</option>)}
                  </select>
                </div>
              </div>
              <span className="text-t3 mb-2">→</span>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-sans text-t3 font-medium">To</span>
                <div className="flex gap-2">
                  <select value={pnlYearTo || ''} onChange={e => { setPnlYearTo(Number(e.target.value)); setPnlMonthTo(null) }}
                    className="px-3 py-1.5 rounded-lg text-sm font-sans outline-none"
                    style={{ border: '1px solid #e8e6f0', color: '#1a1830', background: '#fff' }}>
                    {pnlAvailYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <select value={pnlMonthTo || ''} onChange={e => setPnlMonthTo(Number(e.target.value))}
                    className="px-3 py-1.5 rounded-lg text-sm font-sans outline-none"
                    style={{ border: '1px solid #e8e6f0', color: '#1a1830', background: '#fff' }}>
                    {pnlMonthsForYear(pnlYearTo).map(m => <option key={m} value={m}>{MONTH_NAMES[m]}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Row 2: Store selector + toggles */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs font-sans text-t3 mr-1">View:</span>
            {storeTabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveStore(tab.id)}
                className="px-3 py-1 rounded-lg text-xs font-sans font-medium"
                style={{
                  background: activeStore === tab.id ? PUR : '#f5f4fb',
                  color: activeStore === tab.id ? '#fff' : '#6b6890',
                  border: `1px solid ${activeStore === tab.id ? PUR : '#e8e6f0'}`,
                  cursor: 'pointer',
                }}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-xs font-sans text-t3">Show:</span>
            {[
              ['Code PnL', colCode, setColCode],
              ['Budget', colBudget, setColBudget],
              ['Prior Month', colPrior, setColPrior],
              ['% Net Rev', colPct, setColPct],
            ].map(([label, on, setter]) => (
              <button key={label} onClick={() => setter(v => !v)}
                className="px-2.5 py-1 rounded-lg text-xs font-sans font-medium"
                style={{
                  background: on ? '#eeecfa' : '#f5f4fb',
                  color: on ? PUR : '#a8a6c0',
                  border: `1px solid ${on ? '#c4b8ff' : '#e8e6f0'}`,
                  cursor: 'pointer',
                }}>
                {on ? '✓ ' : ''}{label}
              </button>
            ))}

            <div className="w-px h-4 mx-1" style={{ background: '#e8e6f0' }} />
            <button onClick={expandAll} className="text-xs font-sans text-t2 px-2 py-1 rounded hover:bg-gray-50"
              style={{ cursor: 'pointer' }}>Expand All</button>
            <button onClick={collapseAll} className="text-xs font-sans text-t2 px-2 py-1 rounded hover:bg-gray-50"
              style={{ cursor: 'pointer' }}>Collapse All</button>
          </div>
        </div>
      </div>

      {/* ── Section tabs: Dashboard / P&L Table ─── */}
      <div className="flex gap-1" style={{ borderBottom: '2px solid #f0eefb' }}>
        {[['dashboard', 'Dashboard'], ['table', 'P&L Statement']].map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="px-5 py-2.5 text-sm font-sans font-medium"
            style={{
              color: activeTab === tab ? PUR : '#6b6890',
              borderBottom: activeTab === tab ? `2px solid ${PUR}` : '2px solid transparent',
              marginBottom: -2,
              background: 'transparent',
              cursor: 'pointer',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Content ─── */}
      {(loading || (glLoading && !glData)) ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: PUR, borderTopColor: 'transparent' }} />
        </div>
      ) : activeTab === 'dashboard' ? (
        renderDashboard()
      ) : (
        <div className="flex flex-col gap-4">
          {/* Insights for P&L Statement */}
          <InsightsPanel items={buildStatementInsights(pnlGlData, stores, actuals, prior, currency, fxRates)} />

          {/* Error banner when GL data missing */}
          {pnlGlData?.available === false && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-sans"
              style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c' }}>
              <span className="text-lg">⚠️</span>
              <div>
                <strong>GL India data not available.</strong>
                {' '}Re-upload the P&L file in Admin to compute actuals.
                {pnlGlData.error && <span className="ml-1 text-xs opacity-75">({pnlGlData.error})</span>}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl overflow-hidden"
            style={{ border: '1px solid #f0eefb', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <div className="px-5 py-3 flex items-center justify-between"
              style={{ borderBottom: '1px solid #f0eefb' }}>
              <div>
                <span className="font-sans font-semibold text-t1 text-sm">P&L Statement</span>
                <span className="ml-3 text-xs font-sans text-t3">{periodLabel}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              {periodMode === 'compare'
                ? renderCompareTable()
                : (
                  <table className="w-full text-sm font-sans border-collapse">
                    <thead>{renderHeaders()}</thead>
                    <tbody>
                      {visibleRows.length === 0
                        ? <tr><td colSpan={20} className="px-4 py-10 text-center text-t3 font-sans text-sm">
                            {pnlGlLoading ? 'Loading…' : !pnlYear ? 'Select a period above to view the P&L Statement.' : 'No P&L data for the selected period.'}
                          </td></tr>
                        : visibleRows.map(row => renderTableRow(row))
                      }
                    </tbody>
                  </table>
                )
              }
            </div>
          </div>
        </div>
      )}

      <div className="text-xs font-sans text-t3 px-1">
        Currency: {currency} · All values in {currency === 'INR' ? '₹' : currency}
        {periodMode === 'single' && ' · Prior month from uploaded data or embedded file values'}
      </div>
    </div>
  )
}
