import React, { useEffect, useState, useMemo, useCallback } from 'react'
import {
  BarChart, Bar, LineChart, Line, Area, ComposedChart, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import api from '../utils/api'
import { fc } from '../utils/formatters'
import useSettingsStore from '../store/settingsStore'

// ── Constants ─────────────────────────────────────────────────────────────────

const GOOD = '#16a34a'
const BAD  = '#dc2626'
const MID  = '#6b6890'
const PUR  = '#6958C2'
const MONTH_NAMES = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const CHART_COLORS = ['#6958C2','#10b981','#f97316','#3b82f6','#ec4899','#a855f7','#14b8a6','#f59e0b']

// ── Module-level chart type toggle button — safe to use inside render ─────────
function ChartTypeBtn({ label, active, onClick }) {
  return (
    <button onClick={onClick} className="px-2 py-1 rounded text-xs font-sans"
      style={{ background: active ? PUR : '#f5f4fb', color: active ? '#fff' : MID, border: `1px solid ${active ? PUR : '#e8e6f0'}`, cursor: 'pointer' }}>
      {label}
    </button>
  )
}

// ── Geo tree (will be API-driven later) ───────────────────────────────────────

const GEO_TREE = {
  'India': {
    'Karnataka': ['BGL-IDN', 'BGL-BSC', 'BGL-CF', 'Back Office'],
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortNum(v) {
  if (v == null || isNaN(v)) return '0'
  if (Math.abs(v) >= 1e7) return `${(v / 1e7).toFixed(1)}Cr`
  if (Math.abs(v) >= 1e5) return `${(v / 1e5).toFixed(1)}L`
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}K`
  return String(Math.round(v))
}

function fmtVal(v, currency, fxRates) {
  if (v === null || v === undefined || v === 0) return '—'
  return fc(v, true, currency, fxRates)
}

function varBadge(actual, base) {
  if (!base || base === 0) return null
  const diff = actual - base
  const pct  = diff / Math.abs(base)
  return { diff, pct }
}

function fmtPct(v) {
  if (v == null) return '—'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${(v * 100).toFixed(1)}%`
}

function ymLabel(y, m) {
  if (!y) return ''
  if (!m) return String(y)
  return `${MONTH_NAMES[m]} ${y}`
}

// ── GeoFilterBar ──────────────────────────────────────────────────────────────

function GeoFilterBar({ geoFilter, setGeoFilter, open, setOpen }) {
  const countries = Object.keys(GEO_TREE)
  const states    = geoFilter.country ? Object.keys(GEO_TREE[geoFilter.country] || {}) : []
  const outlets   = (geoFilter.country && geoFilter.state)
    ? (GEO_TREE[geoFilter.country]?.[geoFilter.state] || [])
    : []

  const summary = [
    geoFilter.country || 'All Countries',
    geoFilter.state   || 'All States',
    geoFilter.outlet  || 'All Outlets',
  ].join(' / ')

  const btnActive   = { background: PUR, color: '#fff', border: `1px solid ${PUR}`, cursor: 'pointer' }
  const btnInactive = { background: '#f5f4fb', color: MID, border: '1px solid #e8e6f0', cursor: 'pointer' }

  function setCountry(c) {
    setGeoFilter({ country: c, state: null, outlet: null })
  }
  function setState(s) {
    setGeoFilter(prev => ({ ...prev, state: s, outlet: null }))
  }
  function setOutlet(o) {
    setGeoFilter(prev => ({ ...prev, outlet: o }))
  }

  return (
    <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #ede9fb' }}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        style={{ borderBottom: open ? '1px solid #f0eefb' : 'none' }}
        onClick={() => setOpen(v => !v)}>
        <span className="text-xs font-sans font-semibold uppercase tracking-wide" style={{ color: PUR }}>Filters</span>
        <span className="text-xs font-sans" style={{ color: MID }}>{summary}</span>
        <span className="ml-auto text-xs" style={{ color: MID }}>{open ? '▼' : '▶'}</span>
      </div>

      {open && (
        <div className="px-4 py-3 flex flex-col gap-3">
          {/* Country */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-sans font-medium text-t3 w-16 flex-shrink-0">Country</span>
            <button onClick={() => setGeoFilter({ country: null, state: null, outlet: null })}
              className="px-3 py-1 rounded-lg text-xs font-sans font-medium"
              style={geoFilter.country == null ? btnActive : btnInactive}>All</button>
            {countries.map(c => (
              <button key={c} onClick={() => setCountry(geoFilter.country === c ? null : c)}
                className="px-3 py-1 rounded-lg text-xs font-sans font-medium"
                style={geoFilter.country === c ? btnActive : btnInactive}>{c}</button>
            ))}
          </div>

          {/* State */}
          {states.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-sans font-medium text-t3 w-16 flex-shrink-0">State</span>
              <button onClick={() => setGeoFilter(prev => ({ ...prev, state: null, outlet: null }))}
                className="px-3 py-1 rounded-lg text-xs font-sans font-medium"
                style={geoFilter.state == null ? btnActive : btnInactive}>All</button>
              {states.map(s => (
                <button key={s} onClick={() => setState(geoFilter.state === s ? null : s)}
                  className="px-3 py-1 rounded-lg text-xs font-sans font-medium"
                  style={geoFilter.state === s ? btnActive : btnInactive}>{s}</button>
              ))}
            </div>
          )}

          {/* Outlet */}
          {outlets.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-sans font-medium text-t3 w-16 flex-shrink-0">Outlet</span>
              <button onClick={() => setGeoFilter(prev => ({ ...prev, outlet: null }))}
                className="px-3 py-1 rounded-lg text-xs font-sans font-medium"
                style={geoFilter.outlet == null ? btnActive : btnInactive}>All</button>
              {outlets.map(o => (
                <button key={o} onClick={() => setOutlet(geoFilter.outlet === o ? null : o)}
                  className="px-3 py-1 rounded-lg text-xs font-sans font-medium"
                  style={geoFilter.outlet === o ? btnActive : btnInactive}>{o}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── InsightsPanel ─────────────────────────────────────────────────────────────

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

// ── buildBSInsights ───────────────────────────────────────────────────────────

function buildBSInsights(kpis, currency, fxRates) {
  if (!kpis || !kpis.total_assets) return []
  const items = []

  // 1. Cash
  const cash = kpis.cash || 0
  const cashPrior = kpis.cash_prior || 0
  const cashBadge = varBadge(cash, cashPrior)
  let cashText = `Cash: <strong>${fc(cash, true, currency, fxRates)}</strong>`
  if (cashBadge) {
    const dir = cashBadge.pct >= 0 ? '▲' : '▼'
    const col = cashBadge.pct >= 0 ? GOOD : BAD
    cashText += ` — <span style="color:${col}">${dir} ${Math.abs(cashBadge.pct * 100).toFixed(1)}%</span> vs prior month`
  }
  items.push({ icon: cashBadge && cashBadge.pct >= 0 ? '💵' : '📉', text: cashText })

  // 2. Working Capital
  const wc = (kpis.current_assets || 0) - (kpis.current_liabilities || 0)
  const wcIcon = wc < 0 ? '⚠️' : '✅'
  items.push({
    icon: wcIcon,
    text: `Working Capital: <strong style="color:${wc < 0 ? BAD : GOOD}">${fc(wc, true, currency, fxRates)}</strong>${wc < 0 ? ' — Negative! Review liquidity.' : ''}`,
  })

  // 3. Current Ratio
  const cl = kpis.current_liabilities || 0
  const ca = kpis.current_assets || 0
  if (cl > 0) {
    const ratio = ca / cl
    const ratioIcon = ratio >= 1.5 ? '✅' : ratio >= 1.0 ? '⚠️' : '🔴'
    const ratioCol  = ratio >= 1.5 ? GOOD : ratio >= 1.0 ? '#d97706' : BAD
    items.push({
      icon: ratioIcon,
      text: `Current Ratio: <strong style="color:${ratioCol}">${ratio.toFixed(2)}x</strong>${ratio < 1.0 ? ' — Below 1.0, high short-term risk' : ratio < 1.5 ? ' — Adequate but watch closely' : ' — Healthy'}`,
    })
  }

  // 4. Inventory MoM
  const inv = kpis.inventory || 0
  const invPrior = kpis.inventory_prior || 0
  const invBadge = varBadge(inv, invPrior)
  let invText = `Inventory: <strong>${fc(inv, true, currency, fxRates)}</strong>`
  if (invBadge) {
    const dir = invBadge.pct >= 0 ? '▲' : '▼'
    invText += ` <span style="color:${MID}">${dir} ${Math.abs(invBadge.pct * 100).toFixed(1)}% MoM</span>`
  }
  items.push({ icon: '📦', text: invText })

  // 5. Equity & accumulated loss
  const equity = kpis.total_equity || 0
  const accLoss = kpis.retained_earnings || 0
  items.push({
    icon: equity >= 0 ? '🏦' : '🔴',
    text: `Net Worth: <strong style="color:${equity >= 0 ? GOOD : BAD}">${fc(equity, true, currency, fxRates)}</strong>${accLoss < 0 ? ` | Accumulated Loss: <strong style="color:${BAD}">${fc(accLoss, true, currency, fxRates)}</strong>` : ''}`,
  })

  // 6. Trade Payables MoM
  const tp = kpis.trade_payables || 0
  const tpPrior = kpis.trade_payables_prior || 0
  const tpBadge = varBadge(tp, tpPrior)
  let tpText = `Trade Payables: <strong>${fc(tp, true, currency, fxRates)}</strong>`
  if (tpBadge) {
    const dir = tpBadge.pct >= 0 ? '▲' : '▼'
    const col = tpBadge.pct >= 0 ? BAD : GOOD  // higher payables = worse
    tpText += ` — <span style="color:${col}">${dir} ${Math.abs(tpBadge.pct * 100).toFixed(1)}%</span> vs prior`
  }
  items.push({ icon: '📋', text: tpText })

  // 7. Capital injection
  const sc = kpis.share_capital || 0
  const scPrior = kpis.share_capital_prior || 0
  if (sc > scPrior && scPrior > 0) {
    items.push({
      icon: '💰',
      text: `Capital injection this period: <strong style="color:${GOOD}">${fc(sc - scPrior, true, currency, fxRates)}</strong>`,
    })
  }

  return items
}

// ── Main BalanceSheet component ───────────────────────────────────────────────

export default function BalanceSheet() {
  const { currency, fxRates } = useSettingsStore()

  // Geo filter
  const [geoFilter, setGeoFilter] = useState({ country: null, state: null, outlet: null })
  const [geoOpen,   setGeoOpen]   = useState(false)

  // Dashboard state
  const [bsData,       setBsData]       = useState(null)
  const [bsLoading,    setBsLoading]    = useState(true)
  const [bsFilterMode, setBsFilterMode] = useState('single')
  const [bsYear,       setBsYear]       = useState(null)
  const [bsMonth,      setBsMonth]      = useState(null)
  const [bsYearFrom,   setBsYearFrom]   = useState(null)
  const [bsMonthFrom,  setBsMonthFrom]  = useState(null)
  const [bsYearTo,     setBsYearTo]     = useState(null)
  const [bsMonthTo,    setBsMonthTo]    = useState(null)

  // Chart options
  const [chartYear,          setChartYear]          = useState(null)
  const [cashChartType,      setCashChartType]      = useState('line')
  const [wcChartType,        setWcChartType]        = useState('line')
  const [assetCompChartType, setAssetCompChartType] = useState('bar')
  const [equityChartType,    setEquityChartType]    = useState('area')

  // Statement state
  const [stmtData,         setStmtData]         = useState(null)
  const [stmtLoading,      setStmtLoading]      = useState(false)
  const [stmtMode,         setStmtMode]         = useState('single')
  const [stmtYear,         setStmtYear]         = useState(null)
  const [stmtMonth,        setStmtMonth]        = useState(null)
  const [stmtYearFrom,     setStmtYearFrom]     = useState(null)
  const [stmtMonthFrom,    setStmtMonthFrom]    = useState(null)
  const [stmtYearTo,       setStmtYearTo]       = useState(null)
  const [stmtMonthTo,      setStmtMonthTo]      = useState(null)
  const [stmtCompareMonths,setStmtCompareMonths]= useState([])
  const [collapsed,        setCollapsed]        = useState(new Set([100, 200, 300, 310, 330, 400]))

  // UI
  const [activeTab, setActiveTab] = useState('dashboard')
  const [colPct,    setColPct]    = useState(true)

  // ── Dashboard effect — fetches ONCE (full trend), period selection is client-side ──
  useEffect(() => {
    async function loadBS() {
      setBsLoading(true)
      try {
        const params = new URLSearchParams()
        if (geoFilter.outlet) params.set('store', geoFilter.outlet)
        const res = await api.get(`/data/bs-dashboard?${params}`).catch(() => ({ data: { available: false } }))
        setBsData(res.data || { available: false })
      } finally {
        setBsLoading(false)
      }
    }
    loadBS()
  }, [geoFilter.outlet])

  // ── Statement init effect (mount only) ─────────────────────────────────────
  useEffect(() => {
    async function initStmt() {
      setStmtLoading(true)
      try {
        const res = await api.get('/data/bs-statement').catch(() => ({ data: null }))
        const data = res.data
        if (data?.available_periods?.length > 0) {
          const last  = data.available_periods[data.available_periods.length - 1]
          const first = data.available_periods[0]
          setStmtYear(last.year);  setStmtMonth(last.month)
          setStmtYearFrom(first.year); setStmtMonthFrom(first.month)
          setStmtYearTo(last.year);    setStmtMonthTo(last.month)
        }
        setStmtData(data)
      } finally {
        setStmtLoading(false)
      }
    }
    initStmt()
  }, [])

  // ── Statement reload effect ─────────────────────────────────────────────────
  useEffect(() => {
    if (!stmtYear && !stmtYearFrom) return
    if (stmtMode === 'compare') return
    async function loadStmt() {
      setStmtLoading(true)
      try {
        const params = new URLSearchParams()
        if (stmtMode === 'range' && stmtYearFrom && stmtYearTo) {
          params.set('year_from', stmtYearFrom)
          if (stmtMonthFrom) params.set('month_from', stmtMonthFrom)
          params.set('year_to', stmtYearTo)
          if (stmtMonthTo) params.set('month_to', stmtMonthTo)
        } else if (stmtMode === 'year' && stmtYear) {
          params.set('year', stmtYear)
        } else if (stmtYear && stmtMonth) {
          params.set('year', stmtYear)
          params.set('month', stmtMonth)
        } else return
        const res = await api.get(`/data/bs-statement?${params}`).catch(() => ({ data: null }))
        if (res.data) setStmtData(res.data)
      } finally {
        setStmtLoading(false)
      }
    }
    loadStmt()
  }, [stmtMode, stmtYear, stmtMonth, stmtYearFrom, stmtMonthFrom, stmtYearTo, stmtMonthTo])

  // ── Compare mode effect ─────────────────────────────────────────────────────
  useEffect(() => {
    if (stmtMode !== 'compare' || stmtCompareMonths.length === 0) return
    async function loadCompare() {
      setStmtLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('compare_months', stmtCompareMonths.join(','))
        const res = await api.get(`/data/bs-statement?${params}`).catch(() => ({ data: null }))
        if (res.data) setStmtData(res.data)
      } finally {
        setStmtLoading(false)
      }
    }
    loadCompare()
  }, [stmtMode, stmtCompareMonths])

  // ── Derived values ──────────────────────────────────────────────────────────
  const stmtAvailPeriods = useMemo(() => stmtData?.available_periods || [], [stmtData])
  const stmtAvailYears   = useMemo(() => [...new Set(stmtAvailPeriods.map(p => p.year))].sort(), [stmtAvailPeriods])
  const stmtMonthsForYear = useCallback((y) =>
    stmtAvailPeriods.filter(p => p.year === y).map(p => p.month).sort((a, b) => a - b),
    [stmtAvailPeriods]
  )

  const bsAvailPeriods = useMemo(() => bsData?.available_periods || [], [bsData])
  const bsAvailYears   = useMemo(() => [...new Set(bsAvailPeriods.map(p => p.year))].sort(), [bsAvailPeriods])
  function bsMonthsForYear(y) {
    return bsAvailPeriods.filter(p => p.year === y).map(p => p.month).sort((a, b) => a - b)
  }

  // Collapse helpers
  const hierarchy = useMemo(() => stmtData?.hierarchy || [], [stmtData])

  const toggleCollapse = useCallback((code) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(code) ? next.delete(code) : next.add(code)
      return next
    })
  }, [])

  function expandAll()   { setCollapsed(new Set()) }
  function collapseAll() {
    setCollapsed(new Set(hierarchy.filter(r => r.level === 0 || r.code < 500).map(r => r.code)))
  }

  // Visible rows (collapse logic) — BS hierarchy uses level field from backend
  const visibleRows = useMemo(() => {
    const result = []
    let hidingAboveLevel = -1
    for (let i = 0; i < hierarchy.length; i++) {
      const row   = hierarchy[i]
      const level = row.level ?? 0
      if (hidingAboveLevel >= 0 && level <= hidingAboveLevel) hidingAboveLevel = -1
      if (hidingAboveLevel >= 0) continue
      // Check if this row has a child
      const nextLevel = hierarchy[i + 1]?.level ?? -1
      const hasChild  = nextLevel > level
      result.push({ ...row, level, hasChild })
      if (collapsed.has(row.code)) hidingAboveLevel = level
    }
    return result
  }, [hierarchy, collapsed])

  function toggleStmtCompareMonth(mk) {
    setStmtCompareMonths(prev =>
      prev.includes(mk) ? prev.filter(m => m !== mk) : [...prev, mk].sort()
    )
  }

  // ── renderDashboard ─────────────────────────────────────────────────────────
  function renderDashboard() {
    const bs          = bsData || {}
    const isAvailable = bs.available !== false

    // Use spread to avoid mutating the state array
    const monthlyTrend = [...(bs.monthly_trend || [])]
      .sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month))

    const displayTrendAll = monthlyTrend
    const chartYears = [...new Set(monthlyTrend.map(m => m.year))].sort()

    // ── Dynamic KPI selection from monthly_trend ─────────────────────────────
    // Pick the relevant trend entry based on the slicer, falling back to latest
    let kpiEntry = null
    let priorEntry = null
    if (monthlyTrend.length > 0) {
      if (bsFilterMode === 'single' && bsYear) {
        // Single period: find exact match, or latest in selected year
        if (bsMonth) {
          kpiEntry = monthlyTrend.find(m => m.year === bsYear && m.month === bsMonth) || null
        } else {
          const inYear = monthlyTrend.filter(m => m.year === bsYear)
          kpiEntry = inYear[inYear.length - 1] || null
        }
      } else if (bsFilterMode === 'range' && bsYearFrom && bsYearTo) {
        // Range: KPI card = last month in range
        const lo = bsYearFrom * 100 + (bsMonthFrom || 1)
        const hi = bsYearTo   * 100 + (bsMonthTo   || 12)
        const inRange = monthlyTrend.filter(m => {
          const key = m.year * 100 + m.month
          return key >= lo && key <= hi
        })
        kpiEntry = inRange[inRange.length - 1] || null
      }
      if (!kpiEntry) kpiEntry = monthlyTrend[monthlyTrend.length - 1]

      // Prior = the month immediately before kpiEntry
      if (kpiEntry) {
        const ki = monthlyTrend.indexOf(kpiEntry)
        priorEntry = ki > 0 ? monthlyTrend[ki - 1] : null
      }
    }

    // Merge with static kpis for fields not in monthly_trend (trade_payables, inventory from DW)
    const staticKpis = bs.kpis || {}
    const kpis = kpiEntry ? {
      cash:                kpiEntry.cash,
      cash_prior:          priorEntry?.cash,
      total_assets:        kpiEntry.total_assets,
      total_assets_prior:  priorEntry?.total_assets,
      total_equity:        kpiEntry.total_equity,
      total_equity_prior:  priorEntry?.total_equity,
      working_capital:     kpiEntry.working_capital,
      current_ratio:       kpiEntry.current_ratio,
      total_debt:          kpiEntry.total_debt,
      total_debt_prior:    priorEntry?.total_debt,
      inventory:           kpiEntry.inventory ?? staticKpis.inventory,
      inventory_prior:     priorEntry?.inventory ?? staticKpis.inventory_prior,
      trade_payables:      kpiEntry.trade_payables ?? staticKpis.trade_payables,
      trade_payables_prior:priorEntry?.trade_payables ?? staticKpis.trade_payables_prior,
      current_assets:            kpiEntry.current_assets,
      current_liabilities:       kpiEntry.current_liabilities,
      current_assets_prior:      priorEntry?.current_assets,
      current_liabilities_prior: priorEntry?.current_liabilities,
      total_liabilities:         kpiEntry.total_liabilities,
      retained_earnings:         kpiEntry.retained_earnings,
      share_capital:             staticKpis.share_capital,
      share_capital_prior:       staticKpis.share_capital_prior,
    } : staticKpis

    // Filter trend for charts based on chartYear toggle
    const displayTrend = chartYear
      ? displayTrendAll.filter(m => m.year === chartYear)
      : displayTrendAll

    // ── SlicerBar (inline) ─────────────────────────────────────────────────
    const btnStyle = (active) => ({
      background: active ? PUR : '#f5f4fb',
      color: active ? '#fff' : MID,
      border: `1px solid ${active ? PUR : '#e8e6f0'}`,
      cursor: 'pointer',
    })

    function renderSlicerBar() {
      const yearsInBS       = bsAvailYears
      const singleYearMonths = bsYear != null ? bsMonthsForYear(bsYear) : []
      const fromMonths       = bsYearFrom != null ? bsMonthsForYear(bsYearFrom) : []
      const toMonths         = bsYearTo   != null ? bsMonthsForYear(bsYearTo)   : []
      return (
        <div className="bg-white rounded-xl p-4 flex flex-wrap gap-4 items-end" style={{ border: '1px solid #ede9fb' }}>
          {/* Mode */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-sans font-medium text-t3">Period Mode</span>
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #e8e6f0' }}>
              {[['single','Single Period'],['range','Date Range']].map(([m, l]) => (
                <button key={m} onClick={() => setBsFilterMode(m)}
                  className="px-3 py-1.5 text-xs font-sans font-medium"
                  style={{ background: bsFilterMode === m ? PUR : '#fff', color: bsFilterMode === m ? '#fff' : MID, cursor: 'pointer', borderRight: '1px solid #e8e6f0' }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {bsFilterMode === 'single' && (<>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-sans font-medium text-t3">Year</span>
              <div className="flex gap-1">
                <button onClick={() => { setBsYear(null); setBsMonth(null) }}
                  className="px-3 py-1 rounded-lg text-xs font-sans font-medium" style={btnStyle(bsYear == null)}>All</button>
                {yearsInBS.map(y => (
                  <button key={y} onClick={() => { setBsYear(y); setBsMonth(null) }}
                    className="px-3 py-1 rounded-lg text-xs font-sans font-medium" style={btnStyle(bsYear === y)}>{y}</button>
                ))}
              </div>
            </div>
            {bsYear != null && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-sans font-medium text-t3">Month</span>
                <div className="flex flex-wrap gap-1">
                  <button onClick={() => setBsMonth(null)}
                    className="px-2 py-1 rounded-lg text-xs font-sans" style={btnStyle(bsMonth == null)}>All</button>
                  {singleYearMonths.map(m => (
                    <button key={m} onClick={() => setBsMonth(bsMonth === m ? null : m)}
                      className="px-2 py-1 rounded-lg text-xs font-sans" style={btnStyle(bsMonth === m)}>{MONTH_NAMES[m]}</button>
                  ))}
                </div>
              </div>
            )}
          </>)}

          {bsFilterMode === 'range' && (
            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-sans font-medium text-t3">From Year</span>
                <div className="flex gap-1">
                  {yearsInBS.map(y => (
                    <button key={y} onClick={() => { setBsYearFrom(y); setBsMonthFrom(null) }}
                      className="px-3 py-1 rounded-lg text-xs font-sans font-medium" style={btnStyle(bsYearFrom === y)}>{y}</button>
                  ))}
                </div>
              </div>
              {bsYearFrom != null && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-sans font-medium text-t3">From Month</span>
                  <div className="flex flex-wrap gap-1">
                    {fromMonths.map(m => (
                      <button key={m} onClick={() => setBsMonthFrom(bsMonthFrom === m ? null : m)}
                        className="px-2 py-1 rounded-lg text-xs font-sans" style={btnStyle(bsMonthFrom === m)}>{MONTH_NAMES[m]}</button>
                    ))}
                  </div>
                </div>
              )}
              <span className="text-t3 text-sm mb-1">→</span>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-sans font-medium text-t3">To Year</span>
                <div className="flex gap-1">
                  {yearsInBS.map(y => (
                    <button key={y} onClick={() => { setBsYearTo(y); setBsMonthTo(null) }}
                      className="px-3 py-1 rounded-lg text-xs font-sans font-medium" style={btnStyle(bsYearTo === y)}>{y}</button>
                  ))}
                </div>
              </div>
              {bsYearTo != null && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-sans font-medium text-t3">To Month</span>
                  <div className="flex flex-wrap gap-1">
                    {toMonths.map(m => (
                      <button key={m} onClick={() => setBsMonthTo(bsMonthTo === m ? null : m)}
                        className="px-2 py-1 rounded-lg text-xs font-sans" style={btnStyle(bsMonthTo === m)}>{MONTH_NAMES[m]}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {bsLoading && <span className="text-xs font-sans text-t3 ml-2">Updating…</span>}
        </div>
      )
    }

    if (bsLoading && !bsData) {
      return (
        <div className="flex flex-col gap-5">
          { renderSlicerBar() }
          <div className="flex justify-center items-center h-64">
            <div className="w-8 h-8 rounded-full border-2 animate-spin"
              style={{ borderColor: PUR, borderTopColor: 'transparent' }} />
          </div>
        </div>
      )
    }

    if (!isAvailable) return (
      <div className="flex flex-col gap-5">
        { renderSlicerBar() }
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <span className="text-4xl">🏦</span>
          <p className="font-sans text-t2 text-sm">No Balance Sheet data uploaded. Upload a BS file in Admin.</p>
        </div>
      </div>
    )

    // Derived snapshot KPIs
    const wc      = (kpis.current_assets || 0) - (kpis.current_liabilities || 0)
    const wcPrior = (kpis.current_assets_prior || 0) - (kpis.current_liabilities_prior || 0)
    const cr      = kpis.current_liabilities > 0 ? kpis.current_assets / kpis.current_liabilities : null
    const crPrior = (kpis.current_liabilities_prior || 0) > 0
      ? (kpis.current_assets_prior || 0) / kpis.current_liabilities_prior : null

    const kpiCards = [
      {
        label: 'Cash & Cash Eq.',
        value: kpis.cash,
        prior: kpis.cash_prior,
        higherBetter: true,
        format: 'currency',
      },
      {
        label: 'Working Capital',
        value: wc,
        prior: wcPrior,
        higherBetter: true,
        format: 'currency',
      },
      {
        label: 'Current Ratio',
        value: cr,
        prior: crPrior,
        higherBetter: true,
        format: 'ratio',
      },
      {
        label: 'Inventory',
        value: kpis.inventory,
        prior: kpis.inventory_prior,
        higherBetter: null,
        format: 'currency',
      },
      {
        label: 'Total Assets',
        value: kpis.total_assets,
        prior: kpis.total_assets_prior,
        higherBetter: true,
        format: 'currency',
      },
      {
        label: 'Net Worth',
        value: kpis.total_equity,
        prior: kpis.total_equity_prior,
        higherBetter: true,
        format: 'currency',
      },
      {
        label: 'Trade Payables',
        value: kpis.trade_payables,
        prior: kpis.trade_payables_prior,
        higherBetter: false,   // lower = better
        format: 'currency',
      },
      {
        label: 'Total Debt',
        value: kpis.total_debt,
        prior: kpis.total_debt_prior,
        higherBetter: false,
        format: 'currency',
      },
    ]

    // Capital structure data for horizontal bar
    const capStructData = [
      { name: 'Total Assets',      value: Math.abs(kpis.total_assets || 0),      fill: PUR },
      { name: 'Total Liabilities', value: Math.abs(kpis.total_liabilities || 0), fill: BAD },
      { name: 'Total Equity',      value: Math.abs(kpis.total_equity || 0),      fill: GOOD },
    ]

    return (
      <div className="flex flex-col gap-5">

        {/* ── Slicer bar ───────────────────────────────────────────── */}
        { renderSlicerBar() }

        {/* ── KPI Cards ────────────────────────────────────────────── */}
        <div className="flex gap-3 flex-wrap">
          {kpiCards.map(k => {
            const badge = varBadge(k.value, k.prior)
            const isNeg = k.value != null && k.value < 0
            const borderColor = isNeg ? '#fee2e2' : '#ede9fb'
            const valColor = k.value == null ? '#1a1830'
              : k.higherBetter === true  ? (k.value >= 0 ? '#1a1830' : BAD)
              : k.higherBetter === false ? '#1a1830'
              : '#1a1830'

            let badgeColor = MID
            if (badge && k.higherBetter !== null) {
              const good = k.higherBetter ? badge.pct >= 0 : badge.pct <= 0
              badgeColor = good ? GOOD : BAD
            }

            return (
              <div key={k.label} className="flex flex-col gap-1 px-4 py-3 rounded-xl"
                style={{ background: '#fff', border: `1px solid ${borderColor}`, minWidth: 150, flex: 1 }}>
                <span className="text-xs font-sans font-medium uppercase tracking-wide" style={{ color: MID }}>{k.label}</span>
                <span className="text-xl font-sans font-bold" style={{ color: valColor }}>
                  {k.value == null ? '—'
                    : k.format === 'ratio' ? `${k.value.toFixed(2)}x`
                    : fc(k.value, true, currency, fxRates)}
                </span>
                {k.prior != null && (
                  <span className="text-xs font-sans" style={{ color: MID }}>
                    Prior: {k.format === 'ratio' ? `${k.prior.toFixed(2)}x` : fc(k.prior, true, currency, fxRates)}
                  </span>
                )}
                {badge && (
                  <span className="text-xs font-sans font-medium mt-0.5" style={{ color: badgeColor }}>
                    {badge.pct >= 0 ? '▲' : '▼'} {Math.abs(badge.pct * 100).toFixed(1)}% vs prior
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* ── Chart Year Filter ─────────────────────────────────────── */}
        {chartYears.length > 1 && (
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
        )}

        {/* ── Chart A: Cash Trend ───────────────────────────────────── */}
        {displayTrend.length > 0 && (
          <div className="bg-white rounded-xl p-5" style={{ border: '1px solid #ede9fb' }}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="text-sm font-sans font-semibold text-t1">Cash & Cash Equivalents Trend</div>
              <div className="flex gap-1">
                {['line','bar','area'].map(t => <ChartTypeBtn key={t} label={t[0].toUpperCase()+t.slice(1)} active={cashChartType === t} onClick={() => setCashChartType(t)} />)}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={displayTrend} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0eefb" />
                <XAxis dataKey="month_label" tick={{ fontSize: 11, fill: MID }} />
                <YAxis tickFormatter={shortNum} tick={{ fontSize: 11, fill: MID }} />
                <Tooltip formatter={v => fc(v, true, currency, fxRates)} labelStyle={{ fontWeight: 600 }} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e8e6f0' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {cashChartType === 'area'
                  ? <Area type="monotone" dataKey="cash" name="Cash" stroke={PUR} fill={PUR} fillOpacity={0.15} strokeWidth={2} />
                  : cashChartType === 'bar'
                  ? <Bar dataKey="cash" name="Cash" fill={PUR} radius={[3,3,0,0]} opacity={0.85} />
                  : <Line type="monotone" dataKey="cash" name="Cash" stroke={PUR} strokeWidth={2} dot={{ r: 3 }} />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Chart B: Working Capital Trend ───────────────────────── */}
        {displayTrend.length > 0 && (
          <div className="bg-white rounded-xl p-5" style={{ border: '1px solid #ede9fb' }}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="text-sm font-sans font-semibold text-t1">Working Capital Trend</div>
              <div className="flex gap-1">
                {['line','bar','area'].map(t => <ChartTypeBtn key={t} label={t[0].toUpperCase()+t.slice(1)} active={wcChartType === t} onClick={() => setWcChartType(t)} />)}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={displayTrend} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0eefb" />
                <XAxis dataKey="month_label" tick={{ fontSize: 11, fill: MID }} />
                <YAxis tickFormatter={shortNum} tick={{ fontSize: 11, fill: MID }} />
                <Tooltip formatter={v => fc(v, true, currency, fxRates)} labelStyle={{ fontWeight: 600 }} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e8e6f0' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={1.5} />
                {wcChartType === 'area'
                  ? <Area type="monotone" dataKey="working_capital" name="Working Capital" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
                  : wcChartType === 'bar'
                  ? <Bar dataKey="working_capital" name="Working Capital" radius={[3,3,0,0]} opacity={0.85}>
                      {displayTrend.map((e, i) => <Cell key={i} fill={e.working_capital >= 0 ? '#10b981' : BAD} />)}
                    </Bar>
                  : <Line type="monotone" dataKey="working_capital" name="Working Capital" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Chart C: Assets Composition ──────────────────────────── */}
        {displayTrend.length > 0 && (
          <div className="bg-white rounded-xl p-5" style={{ border: '1px solid #ede9fb' }}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="text-sm font-sans font-semibold text-t1">Assets Composition</div>
              <div className="flex gap-1">
                {['bar','line','area'].map(t => <ChartTypeBtn key={t} label={t[0].toUpperCase()+t.slice(1)} active={assetCompChartType === t} onClick={() => setAssetCompChartType(t)} />)}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              {assetCompChartType === 'bar' ? (
                <BarChart data={displayTrend} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0eefb" />
                  <XAxis dataKey="month_label" tick={{ fontSize: 11, fill: MID }} />
                  <YAxis tickFormatter={shortNum} tick={{ fontSize: 11, fill: MID }} />
                  <Tooltip formatter={v => fc(v, true, currency, fxRates)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e8e6f0' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="current_assets" name="Current Assets" stackId="a" fill={PUR} opacity={0.85} />
                  <Bar dataKey="non_current_assets" name="Non-Current Assets" stackId="a" fill="#3b82f6" radius={[3,3,0,0]} opacity={0.85} />
                </BarChart>
              ) : (
                <ComposedChart data={displayTrend} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0eefb" />
                  <XAxis dataKey="month_label" tick={{ fontSize: 11, fill: MID }} />
                  <YAxis tickFormatter={shortNum} tick={{ fontSize: 11, fill: MID }} />
                  <Tooltip formatter={v => fc(v, true, currency, fxRates)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e8e6f0' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {assetCompChartType === 'area'
                    ? <><Area type="monotone" dataKey="current_assets" name="Current Assets" stroke={PUR} fill={PUR} fillOpacity={0.15} strokeWidth={2} />
                        <Area type="monotone" dataKey="non_current_assets" name="Non-Current Assets" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.12} strokeWidth={2} /></>
                    : <><Line type="monotone" dataKey="current_assets" name="Current Assets" stroke={PUR} strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="non_current_assets" name="Non-Current Assets" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} /></>}
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Chart D: Equity Trend ─────────────────────────────────── */}
        {displayTrend.length > 0 && (
          <div className="bg-white rounded-xl p-5" style={{ border: '1px solid #ede9fb' }}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="text-sm font-sans font-semibold text-t1">Equity Trend</div>
              <div className="flex gap-1">
                {['area','line','bar'].map(t => <ChartTypeBtn key={t} label={t[0].toUpperCase()+t.slice(1)} active={equityChartType === t} onClick={() => setEquityChartType(t)} />)}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={displayTrend} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0eefb" />
                <XAxis dataKey="month_label" tick={{ fontSize: 11, fill: MID }} />
                <YAxis tickFormatter={shortNum} tick={{ fontSize: 11, fill: MID }} />
                <Tooltip formatter={v => fc(v, true, currency, fxRates)} labelStyle={{ fontWeight: 600 }} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e8e6f0' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={1} />
                {equityChartType === 'area'
                  ? <Area type="monotone" dataKey="total_equity" name="Total Equity" stroke={GOOD} fill={GOOD} fillOpacity={0.12} strokeWidth={2} />
                  : equityChartType === 'bar'
                  ? <Bar dataKey="total_equity" name="Total Equity" fill={GOOD} radius={[3,3,0,0]} opacity={0.85} />
                  : <Line type="monotone" dataKey="total_equity" name="Total Equity" stroke={GOOD} strokeWidth={2} dot={{ r: 3 }} />}
                <Line type="monotone" dataKey="retained_earnings" name="Retained Earnings" stroke="#ec4899" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Charts E + F + G: Breakdown donuts + Capital structure ── */}
        {(bs.assets_breakdown?.length > 0 || bs.liabilities_breakdown?.length > 0 || capStructData.some(d => d.value > 0)) && (
          <div className="bg-white rounded-xl p-5" style={{ border: '1px solid #ede9fb' }}>
            <div className="text-sm font-sans font-semibold text-t1 mb-4">Balance Sheet Composition</div>
            <div className="flex gap-5 flex-wrap">

              {/* Chart E: Assets Breakdown donut */}
              {(bs.assets_breakdown || []).length > 0 && (
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div className="text-xs font-sans font-medium text-t2 mb-2 text-center">Assets</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={bs.assets_breakdown}
                        dataKey="value"
                        nameKey="label"
                        cx="50%" cy="50%"
                        innerRadius={55} outerRadius={90}
                        paddingAngle={2}
                      >
                        {bs.assets_breakdown.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={v => fc(v, true, currency, fxRates)} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e8e6f0' }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Chart F: Liabilities Breakdown donut */}
              {(bs.liabilities_breakdown || []).length > 0 && (
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div className="text-xs font-sans font-medium text-t2 mb-2 text-center">Liabilities</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={bs.liabilities_breakdown}
                        dataKey="value"
                        nameKey="label"
                        cx="50%" cy="50%"
                        innerRadius={55} outerRadius={90}
                        paddingAngle={2}
                      >
                        {bs.liabilities_breakdown.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[(i + 3) % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={v => fc(v, true, currency, fxRates)} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e8e6f0' }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Chart G: Capital Structure horizontal bar */}
              {capStructData.some(d => d.value > 0) && (
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div className="text-xs font-sans font-medium text-t2 mb-2 text-center">Capital Structure</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={capStructData}
                      layout="vertical"
                      margin={{ top: 10, right: 30, left: 80, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0eefb" horizontal={false} />
                      <XAxis type="number" tickFormatter={shortNum} tick={{ fontSize: 11, fill: MID }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: MID }} width={80} />
                      <Tooltip formatter={v => fc(v, true, currency, fxRates)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e8e6f0' }} />
                      <Bar dataKey="value" name="Value" radius={[0,3,3,0]}>
                        {capStructData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Insights ────────────────────────────────────────────────── */}
        <InsightsPanel items={buildBSInsights(kpis, currency, fxRates)} />

      </div>
    )
  }

  // ── renderStatement ─────────────────────────────────────────────────────────
  function renderStatement() {
    const stmt      = stmtData || {}
    const isAvail   = stmt.available !== false && stmtData != null
    // Backend returns: stmt.periods = ["YYYY-MM", ...], each row has row.values and row.prior dicts
    const stmtPeriods = stmt.periods || []
    const period0   = stmtPeriods[0] || (stmtYear && stmtMonth ? `${stmtYear}-${String(stmtMonth).padStart(2,'0')}` : '')
    // Derive columns for year/range/compare multi-column modes
    const columns   = stmtPeriods.map(p => ({
      key: p,
      label: (() => { const [y, m] = p.split('-').map(Number); return `${MONTH_NAMES[m]} ${y}` })()
    }))
    // Total assets: find code 270 row
    const taRow     = (stmt.hierarchy || []).find(r => r.code === 270)
    const totalAssets = taRow?.values?.[period0] || taRow?.values?.range || 0

    const periodLabel = stmtMode === 'single'
      ? ymLabel(stmtYear, stmtMonth)
      : stmtMode === 'compare'
      ? stmtCompareMonths.map(mk => { const [y,m] = mk.split('-').map(Number); return ymLabel(y,m) }).join(' vs ')
      : stmtMode === 'year'
      ? String(stmtYear || '')
      : `${ymLabel(stmtYearFrom, stmtMonthFrom)} – ${ymLabel(stmtYearTo, stmtMonthTo)}`

    return (
      <div className="flex flex-col gap-4">

        {/* ── Controls ────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl p-4 flex flex-col gap-4" style={{ border: '1px solid #f0eefb' }}>

          {/* Period mode tabs */}
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-sans text-t3 font-medium">Period</span>
              <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #e8e6f0' }}>
                {[['single','Single'], ['compare','Compare'], ['range','Range / YTD'], ['year','Full Year']].map(([mode, label]) => (
                  <button key={mode} onClick={() => setStmtMode(mode)}
                    className="px-4 py-1.5 text-xs font-sans font-medium"
                    style={{
                      background: stmtMode === mode ? PUR : '#fff',
                      color: stmtMode === mode ? '#fff' : MID,
                      cursor: 'pointer',
                      borderRight: '1px solid #e8e6f0',
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Single mode: year + month dropdowns */}
            {stmtMode === 'single' && (
              <div className="flex items-end gap-2">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-sans text-t3 font-medium">Year</span>
                  <select value={stmtYear || ''} onChange={e => { setStmtYear(Number(e.target.value)); setStmtMonth(null) }}
                    className="px-3 py-1.5 rounded-lg text-sm font-sans outline-none"
                    style={{ border: '1px solid #e8e6f0', color: '#1a1830', background: '#fff' }}>
                    {stmtAvailYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-sans text-t3 font-medium">Month</span>
                  <select value={stmtMonth || ''} onChange={e => setStmtMonth(Number(e.target.value))}
                    className="px-3 py-1.5 rounded-lg text-sm font-sans outline-none"
                    style={{ border: '1px solid #e8e6f0', color: '#1a1830', background: '#fff' }}>
                    {stmtMonthsForYear(stmtYear).map(m => <option key={m} value={m}>{MONTH_NAMES[m]}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* Compare mode: period toggle buttons */}
            {stmtMode === 'compare' && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-sans text-t3 font-medium">Select months to compare</span>
                <div className="flex flex-wrap gap-2">
                  {stmtAvailPeriods.map(p => {
                    const mk = `${p.year}-${String(p.month).padStart(2, '0')}`
                    return (
                      <button key={mk} onClick={() => toggleStmtCompareMonth(mk)}
                        className="px-3 py-1 rounded-lg text-xs font-sans font-medium"
                        style={{
                          background: stmtCompareMonths.includes(mk) ? PUR : '#f5f4fb',
                          color: stmtCompareMonths.includes(mk) ? '#fff' : MID,
                          border: `1px solid ${stmtCompareMonths.includes(mk) ? PUR : '#e8e6f0'}`,
                          cursor: 'pointer',
                        }}>
                        {MONTH_NAMES[p.month]} {p.year}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Range mode */}
            {stmtMode === 'range' && (
              <div className="flex items-end gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-sans text-t3 font-medium">From</span>
                  <div className="flex gap-2">
                    <select value={stmtYearFrom || ''} onChange={e => { setStmtYearFrom(Number(e.target.value)); setStmtMonthFrom(null) }}
                      className="px-3 py-1.5 rounded-lg text-sm font-sans outline-none"
                      style={{ border: '1px solid #e8e6f0', color: '#1a1830', background: '#fff' }}>
                      {stmtAvailYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select value={stmtMonthFrom || ''} onChange={e => setStmtMonthFrom(Number(e.target.value))}
                      className="px-3 py-1.5 rounded-lg text-sm font-sans outline-none"
                      style={{ border: '1px solid #e8e6f0', color: '#1a1830', background: '#fff' }}>
                      {stmtMonthsForYear(stmtYearFrom).map(m => <option key={m} value={m}>{MONTH_NAMES[m]}</option>)}
                    </select>
                  </div>
                </div>
                <span className="text-t3 mb-2">→</span>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-sans text-t3 font-medium">To</span>
                  <div className="flex gap-2">
                    <select value={stmtYearTo || ''} onChange={e => { setStmtYearTo(Number(e.target.value)); setStmtMonthTo(null) }}
                      className="px-3 py-1.5 rounded-lg text-sm font-sans outline-none"
                      style={{ border: '1px solid #e8e6f0', color: '#1a1830', background: '#fff' }}>
                      {stmtAvailYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select value={stmtMonthTo || ''} onChange={e => setStmtMonthTo(Number(e.target.value))}
                      className="px-3 py-1.5 rounded-lg text-sm font-sans outline-none"
                      style={{ border: '1px solid #e8e6f0', color: '#1a1830', background: '#fff' }}>
                      {stmtMonthsForYear(stmtYearTo).map(m => <option key={m} value={m}>{MONTH_NAMES[m]}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Year mode */}
            {stmtMode === 'year' && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-sans text-t3 font-medium">Year</span>
                <select value={stmtYear || ''} onChange={e => setStmtYear(Number(e.target.value))}
                  className="px-3 py-1.5 rounded-lg text-sm font-sans outline-none"
                  style={{ border: '1px solid #e8e6f0', color: '#1a1830', background: '#fff' }}>
                  {stmtAvailYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Table option toggles */}
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-xs font-sans text-t3">Show:</span>
            {[['✓ % of Assets', '% of Assets', colPct, setColPct]].map(([onLabel, offLabel, on, setter]) => (
              <button key={offLabel} onClick={() => setter(v => !v)}
                className="px-2.5 py-1 rounded-lg text-xs font-sans font-medium"
                style={{
                  background: on ? '#eeecfa' : '#f5f4fb',
                  color: on ? PUR : '#a8a6c0',
                  border: `1px solid ${on ? '#c4b8ff' : '#e8e6f0'}`,
                  cursor: 'pointer',
                }}>
                {on ? onLabel : offLabel}
              </button>
            ))}
            <div className="w-px h-4 mx-1" style={{ background: '#e8e6f0' }} />
            <button onClick={expandAll} className="text-xs font-sans text-t2 px-2 py-1 rounded hover:bg-gray-50"
              style={{ cursor: 'pointer' }}>Expand All</button>
            <button onClick={collapseAll} className="text-xs font-sans text-t2 px-2 py-1 rounded hover:bg-gray-50"
              style={{ cursor: 'pointer' }}>Collapse All</button>
            {stmtLoading && <span className="text-xs font-sans text-t3 ml-2">Loading…</span>}
          </div>
        </div>

        {/* ── Statement table card ─────────────────────────────────────── */}
        <div className="bg-white rounded-xl overflow-hidden"
          style={{ border: '1px solid #f0eefb', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #f0eefb' }}>
            <div>
              <span className="font-sans font-semibold text-t1 text-sm">Balance Sheet Statement</span>
              <span className="ml-3 text-xs font-sans text-t3">{periodLabel}</span>
            </div>
          </div>

          {stmtLoading ? (
            <div className="flex justify-center items-center h-48">
              <div className="w-7 h-7 rounded-full border-2 animate-spin"
                style={{ borderColor: PUR, borderTopColor: 'transparent' }} />
            </div>
          ) : !isAvail ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <span className="text-3xl">🏦</span>
              <p className="text-sm font-sans text-t2">No Balance Sheet data uploaded. Upload a BS file in Admin.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {stmtMode === 'compare' ? (
                /* ── Compare table ── */
                <table className="w-full text-sm font-sans border-collapse">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e8e6f0' }}>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-t2 uppercase tracking-wide"
                        style={{ background: '#faf9fd', minWidth: 240 }}>Line Item</th>
                      {stmtCompareMonths.map(mk => {
                        const [y, m] = mk.split('-').map(Number)
                        return (
                          <th key={mk} className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide"
                            style={{ background: '#faf9fd', color: PUR, whiteSpace: 'nowrap' }}>
                            {MONTH_NAMES[m]} {y}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.length === 0 ? (
                      <tr><td colSpan={20} className="px-4 py-10 text-center text-t3 font-sans text-sm">
                        Select months above to compare.
                      </td></tr>
                    ) : visibleRows.map(row => {
                      const level   = row.level ?? 0
                      const isTop   = level === 0
                      const isSubtot = row.is_subtotal
                      const indentPx = level * 12
                      const rowBg   = isTop ? '#f5f4fb' : isSubtot ? '#f8f7fd' : 'transparent'
                      const fw      = isTop ? '700' : isSubtot ? '600' : level === 1 ? '600' : '400'
                      const textCol = isTop ? PUR : '#2d2a4a'
                      return (
                        <tr key={row.code} style={{ background: rowBg, borderBottom: '1px solid #f0eefb' }}>
                          <td className="px-4 py-2.5 font-sans" style={{ paddingLeft: 16 + indentPx }}>
                            <span className="flex items-center gap-1.5">
                              {row.hasChild ? (
                                <button onClick={() => toggleCollapse(row.code)}
                                  className="text-xs w-4 h-4 flex items-center justify-center flex-shrink-0 rounded"
                                  style={{ color: PUR, background: '#eeecfa', cursor: 'pointer' }}>
                                  {collapsed.has(row.code) ? '▶' : '▼'}
                                </button>
                              ) : <span className="w-4 flex-shrink-0" />}
                              <span style={{ fontWeight: fw, color: textCol, fontSize: 13 }}>{row.label || row.description}</span>
                            </span>
                          </td>
                          {stmtCompareMonths.map(mk => {
                            const v = row.values?.[mk] ?? null
                            return (
                              <td key={mk} className="px-4 py-2.5 text-right font-mono"
                                style={{ fontSize: 12, color: isTop ? PUR : '#2d2a4a', fontWeight: fw }}>
                                {v == null ? '—' : v === 0 ? '—' : fc(v, true, currency, fxRates)}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                /* ── Single / Range / Year table ── */
                <table className="w-full text-sm font-sans border-collapse">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e8e6f0' }}>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-t2 uppercase tracking-wide"
                        style={{ background: '#faf9fd', minWidth: 240 }}>Line Item</th>
                      {(stmtMode === 'year' || stmtMode === 'range') && stmtPeriods.length > 1
                        ? columns.map(col => (
                            <th key={col.key} className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide"
                              style={{ background: '#faf9fd', color: PUR, whiteSpace: 'nowrap' }}>
                              {col.label}
                            </th>
                          ))
                        : (<>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide"
                              style={{ background: '#faf9fd', color: PUR }}>Value</th>
                            <th className="px-3 py-3 text-right text-xs font-semibold text-t2 uppercase tracking-wide"
                              style={{ background: '#faf9fd' }}>Prior Month</th>
                            <th className="px-3 py-3 text-right text-xs font-semibold text-t2 uppercase tracking-wide"
                              style={{ background: '#faf9fd' }}>Variance</th>
                            <th className="px-3 py-3 text-right text-xs font-semibold text-t2 uppercase tracking-wide"
                              style={{ background: '#faf9fd' }}>Var %</th>
                            {colPct && (
                              <th className="px-3 py-3 text-right text-xs font-semibold text-t3 uppercase tracking-wide"
                                style={{ background: '#faf9fd' }}>% Assets</th>
                            )}
                          </>)
                      }
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.length === 0 ? (
                      <tr><td colSpan={20} className="px-4 py-10 text-center text-t3 font-sans text-sm">
                        {stmtLoading ? 'Loading…' : !stmtYear ? 'Select a period to view the Balance Sheet.' : 'No data for the selected period.'}
                      </td></tr>
                    ) : visibleRows.map(row => {
                      const level    = row.level ?? 0
                      const isTop    = level === 0
                      const isSubtot = row.is_subtotal
                      const indentPx = level * 12
                      const rowBg    = isTop ? '#f5f4fb' : isSubtot ? '#f8f7fd' : level === 1 ? '#faf9fd' : 'transparent'
                      const fw       = isTop ? '700' : isSubtot ? '600' : level === 1 ? '600' : '400'
                      const textCol  = isTop ? PUR : '#2d2a4a'

                      // Values from hierarchy row — backend returns row.values and row.prior keyed by YYYY-MM
                      const val      = row.values?.[period0] ?? row.values?.range ?? null
                      const priorVal = row.prior?.[period0]  ?? null
                      const badge    = varBadge(val, priorVal)
                      const pctOfAssets = (colPct && totalAssets > 0 && val != null)
                        ? (val / totalAssets) * 100 : null

                      const isMultiCol = (stmtMode === 'year' || stmtMode === 'range') && stmtPeriods.length > 1

                      return (
                        <tr key={row.code} style={{ background: rowBg, borderBottom: '1px solid #f0eefb' }}>
                          <td className="px-4 py-2.5 font-sans" style={{ paddingLeft: 16 + indentPx }}>
                            <span className="flex items-center gap-1.5">
                              {row.hasChild ? (
                                <button onClick={() => toggleCollapse(row.code)}
                                  className="text-xs w-4 h-4 flex items-center justify-center flex-shrink-0 rounded"
                                  style={{ color: PUR, background: '#eeecfa', cursor: 'pointer' }}>
                                  {collapsed.has(row.code) ? '▶' : '▼'}
                                </button>
                              ) : <span className="w-4 flex-shrink-0" />}
                              <span style={{ fontWeight: fw, color: textCol, fontSize: 13 }}>{row.label || row.description}</span>
                            </span>
                          </td>

                          {isMultiCol ? (
                            columns.map(col => {
                              const cv = row.values?.[col.key] ?? null
                              return (
                                <td key={col.key} className="px-4 py-2.5 text-right font-mono"
                                  style={{ fontSize: 12, color: isTop ? PUR : textCol, fontWeight: fw }}>
                                  {cv == null || cv === 0 ? '—' : fc(cv, true, currency, fxRates)}
                                </td>
                              )
                            })
                          ) : (<>
                            <td className="px-4 py-2.5 text-right font-mono"
                              style={{ fontSize: 12, color: isTop ? PUR : textCol, fontWeight: fw }}>
                              {val == null || val === 0 ? '—' : fc(val, true, currency, fxRates)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono" style={{ fontSize: 11, color: MID }}>
                              {priorVal == null || priorVal === 0 ? '—' : fc(priorVal, true, currency, fxRates)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono"
                              style={{ fontSize: 11, color: badge ? (badge.diff >= 0 ? GOOD : BAD) : MID }}>
                              {badge ? fc(badge.diff, true, currency, fxRates) : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right font-sans"
                              style={{ fontSize: 11, color: badge ? (badge.pct >= 0 ? GOOD : BAD) : MID }}>
                              {badge ? fmtPct(badge.pct) : '—'}
                            </td>
                            {colPct && (
                              <td className="px-3 py-2.5 text-right font-sans" style={{ fontSize: 11, color: MID }}>
                                {pctOfAssets != null && isTop === false
                                  ? `${pctOfAssets.toFixed(1)}%`
                                  : '—'}
                              </td>
                            )}
                          </>)}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Main return ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">

      {/* Page title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-sans font-bold text-t1">Balance Sheet</h1>
          <p className="text-xs font-sans text-t3 mt-0.5">4PS India — Financial Position</p>
        </div>
      </div>

      {/* Geo Filter */}
      <GeoFilterBar
        geoFilter={geoFilter}
        setGeoFilter={setGeoFilter}
        open={geoOpen}
        setOpen={setGeoOpen}
      />

      {/* Tab selector */}
      <div className="flex gap-1" style={{ borderBottom: '2px solid #f0eefb' }}>
        {[['dashboard', 'Dashboard'], ['statement', 'BS Statement']].map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="px-5 py-2.5 text-sm font-sans font-medium"
            style={{
              color: activeTab === tab ? PUR : MID,
              borderBottom: activeTab === tab ? `2px solid ${PUR}` : '2px solid transparent',
              marginBottom: -2,
              background: 'transparent',
              cursor: 'pointer',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'dashboard' ? renderDashboard() : renderStatement()}

      {/* Footer */}
      <div className="text-xs font-sans text-t3 px-1">
        Currency: {currency} · All values in {currency === 'INR' ? '₹' : currency}
        {stmtMode === 'single' && activeTab === 'statement' && ' · Prior month from uploaded Balance Sheet data'}
      </div>
    </div>
  )
}
