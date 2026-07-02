import React, { useEffect, useState, useMemo } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import api from '../utils/api'
import KpiCard from '../components/KpiCard'
import ChartCard from '../components/ChartCard'
import DataTable from '../components/DataTable'
import PageFilters from '../components/PageFilters'
import { fc, fmtPct } from '../utils/formatters'
import useSettingsStore from '../store/settingsStore'
import useFilterStore from '../store/filterStore'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend)

const CHART_OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { position: 'top', labels: { font: { family: 'DM Sans', size: 11 }, color: '#6b6890' } } },
  scales: {
    x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 11 }, color: '#a8a6c0' } },
    y: { grid: { color: '#f0eefb' }, ticks: { font: { family: 'DM Sans', size: 11 }, color: '#a8a6c0' } },
  }
}

export default function CogsMargin() {
  const { currency, fxRates } = useSettingsStore()
  const { selectedMonths, geo } = useFilterStore()
  const storeCode = geo.outlet || undefined
  const [cogsData, setCogsData] = useState({})
  const [kpiData, setKpiData] = useState({})
  const [loading, setLoading] = useState(true)
  const [pctBase, setPctBase] = useState('excl')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [cRes, kRes] = await Promise.all([
          api.get('/data/cogs', { params: storeCode ? { store_code: storeCode } : {} }).catch(() => ({ data: {} })),
          api.get('/data/kpi', { params: storeCode ? { store_code: storeCode } : {} }).catch(() => ({ data: {} })),
        ])
        setCogsData(cRes.data || {})
        setKpiData(kRes.data || {})
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [storeCode])

  const months = Object.keys(cogsData).sort()
  const filteredMonths = selectedMonths.length > 0 ? months.filter(m => selectedMonths.includes(m)) : months

  // Aggregate COGS across filtered months
  const agg = useMemo(() => {
    let accountingCog = 0, standardCog = 0, wastage = 0, storeVariance = 0, totalAdj = 0, grossMargin = 0
    let salesBase = 0

    filteredMonths.forEach(m => {
      const d = cogsData[m] || {}
      const kpi = kpiData[m] || {}
      const base = pctBase === 'excl' ? (kpi.net_revenue || 0) : (kpi.gross_revenue || 0)
      salesBase += base
      accountingCog += d.accounting_cog || 0
      standardCog += d.standard_cog || 0
      wastage += d.wastage || 0
      storeVariance += d.store_variance || 0
      totalAdj += d.total_adj || 0
    })

    const accountingCogPct = salesBase > 0 ? accountingCog / salesBase : 0
    const standardCogPct = salesBase > 0 ? standardCog / salesBase : 0
    const variance = accountingCog - standardCog
    const variancePct = standardCog > 0 ? variance / standardCog : 0
    grossMargin = salesBase - accountingCog
    const gpPct = salesBase > 0 ? grossMargin / salesBase : 0

    return { accountingCog, standardCog, wastage, storeVariance, totalAdj, grossMargin, salesBase, accountingCogPct, standardCogPct, variance, variancePct, gpPct }
  }, [cogsData, kpiData, filteredMonths, pctBase])

  // Ingredient groups table
  const groupsAgg = useMemo(() => {
    const groups = {}
    filteredMonths.forEach(m => {
      const groupData = cogsData[m]?.groups || {}
      Object.entries(groupData).forEach(([grp, d]) => {
        if (!groups[grp]) groups[grp] = { group: grp, accounting: 0, standard: 0 }
        groups[grp].accounting += d.accounting || 0
        groups[grp].standard += d.standard || 0
      })
    })
    return Object.values(groups).map(g => {
      const variance = g.accounting - g.standard
      const varPct = g.standard > 0 ? variance / g.standard : 0
      const flag = varPct > 0.1 ? '🔴' : varPct < -0.05 ? '🟡' : '✅'
      return {
        group: g.group,
        accounting_cog: fc(g.accounting, false, currency, fxRates),
        standard_cog: fc(g.standard, false, currency, fxRates),
        variance_rs: fc(variance, false, currency, fxRates),
        var_pct: fmtPct(varPct),
        flag,
      }
    })
  }, [cogsData, filteredMonths, currency, fxRates])

  // Trend data
  const trendLabels = months
  const acctTrend = months.map(m => {
    const d = cogsData[m] || {}; const k = kpiData[m] || {}
    const base = pctBase === 'excl' ? (k.net_revenue || 0) : (k.gross_revenue || 0)
    return base > 0 ? (d.accounting_cog || 0) / base * 100 : 0
  })
  const stdTrend = months.map(m => {
    const d = cogsData[m] || {}; const k = kpiData[m] || {}
    const base = pctBase === 'excl' ? (k.net_revenue || 0) : (k.gross_revenue || 0)
    return base > 0 ? (d.standard_cog || 0) / base * 100 : 0
  })

  // Actual vs Standard by group
  const groupKeys = [...new Set(Object.values(cogsData).flatMap(d => Object.keys(d?.groups || {})))]
  const groupActuals = groupKeys.map(g => {
    let s = 0
    filteredMonths.forEach(m => { s += cogsData[m]?.groups?.[g]?.accounting || 0 })
    return s
  })
  const groupStandards = groupKeys.map(g => {
    let s = 0
    filteredMonths.forEach(m => { s += cogsData[m]?.groups?.[g]?.standard || 0 })
    return s
  })

  if (!loading && months.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <span className="text-5xl">📦</span>
        <h2 className="font-sans font-semibold text-t1 text-xl">No COGS Data Uploaded</h2>
        <p className="text-t2 font-sans text-sm">Upload COGS data in Admin to get started.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageFilters months={months} categories={[]} channels={[]} />

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-sans font-medium text-t2">% Base:</span>
        {[{ value: 'excl', label: 'Excl. SC & GST' }, { value: 'incl', label: 'Incl. SC & GST' }].map(opt => (
          <button key={opt.value} onClick={() => setPctBase(opt.value)}
            className="px-3 py-1.5 rounded-lg text-xs font-sans font-medium transition-colors"
            style={{ background: pctBase === opt.value ? '#6958C2' : '#fff', color: pctBase === opt.value ? '#fff' : '#6b6890', border: `1px solid ${pctBase === opt.value ? '#6958C2' : '#e8e6f0'}`, cursor: 'pointer' }}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Accounting COG%" value={fmtPct(agg.accountingCogPct)} icon="📊" color="#6958C2" loading={loading} subtitle="of net revenue" />
        <KpiCard title="Standard COG%" value={fmtPct(agg.standardCogPct)} icon="📐" color="#22c55e" loading={loading} subtitle="theoretical" />
        <KpiCard title="COG Variance%" value={fmtPct(agg.variancePct)}
          trend={{ label: agg.variancePct >= 0 ? '+over' : 'under', positive: agg.variancePct < 0 }}
          icon="⚠️" color="#f59e0b" loading={loading} />
        <KpiCard title="Food Wastage" value={fc(agg.wastage, true, currency, fxRates)} icon="🗑️" color="#ef4444" loading={loading} />
        <KpiCard title="Store Variance" value={fc(agg.storeVariance, true, currency, fxRates)} icon="🏪" color="#8b5cf6" loading={loading} />
        <KpiCard title="Total Adjustments" value={fc(agg.totalAdj, true, currency, fxRates)} icon="🔧" color="#06b6d4" loading={loading} />
        <KpiCard title="Gross Margin" value={fc(agg.grossMargin, true, currency, fxRates)} icon="💹" color="#22c55e" loading={loading} />
        <KpiCard title="GP%" value={fmtPct(agg.gpPct)} icon="⭐" color="#6958C2" loading={loading} subtitle="gross profit %" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Actual vs Standard by group */}
        <ChartCard title="Actual vs Standard COG by Group" loading={loading}
          csvData={groupKeys.map((k, i) => ({ group: k, actual: groupActuals[i], standard: groupStandards[i] }))}
          csvFilename="cog_by_group.csv"
        >
          <Bar data={{
            labels: groupKeys,
            datasets: [
              { label: 'Actual', data: groupActuals, backgroundColor: '#6958C2cc', borderRadius: 4 },
              { label: 'Standard', data: groupStandards, backgroundColor: '#22c55ecc', borderRadius: 4 },
            ]
          }} options={CHART_OPTS} />
        </ChartCard>

        {/* COG% trend */}
        <ChartCard title="COG% Trend" loading={loading}>
          <Line data={{
            labels: trendLabels,
            datasets: [
              { label: 'Accounting COG%', data: acctTrend, borderColor: '#6958C2', backgroundColor: 'transparent', tension: 0.4, pointRadius: 4 },
              { label: 'Standard COG%', data: stdTrend, borderColor: '#22c55e', backgroundColor: 'transparent', tension: 0.4, pointRadius: 4 },
            ]
          }} options={{ ...CHART_OPTS, scales: { x: CHART_OPTS.scales.x, y: { ...CHART_OPTS.scales.y, ticks: { ...CHART_OPTS.scales.y.ticks, callback: v => v.toFixed(1) + '%' } } } }} />
        </ChartCard>
      </div>

      {/* Wastage bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Food Wastage by Month" loading={loading}>
          <Bar data={{
            labels: months,
            datasets: [{
              label: 'Wastage',
              data: months.map(m => cogsData[m]?.wastage || 0),
              backgroundColor: '#ef4444cc',
              borderRadius: 6,
            }]
          }} options={{ ...CHART_OPTS, plugins: { legend: { display: false } } }} />
        </ChartCard>

        <ChartCard title="Store Variance by Month" loading={loading}>
          <Bar data={{
            labels: months,
            datasets: [{
              label: 'Store Variance',
              data: months.map(m => cogsData[m]?.store_variance || 0),
              backgroundColor: months.map(m => (cogsData[m]?.store_variance || 0) > 0 ? '#f59e0bcc' : '#22c55ecc'),
              borderRadius: 6,
            }]
          }} options={{ ...CHART_OPTS, plugins: { legend: { display: false } } }} />
        </ChartCard>
      </div>

      {/* Groups table */}
      <DataTable
        title="Ingredient Group Analysis"
        columns={[
          { key: 'group', label: 'Group' },
          { key: 'accounting_cog', label: 'Accounting COG', align: 'right', mono: true },
          { key: 'standard_cog', label: 'Standard COG', align: 'right', mono: true },
          { key: 'variance_rs', label: 'Variance', align: 'right', mono: true },
          { key: 'var_pct', label: 'Var%', align: 'right' },
          { key: 'flag', label: 'Flag', align: 'center', sortable: false },
        ]}
        data={groupsAgg}
        csvFilename="cogs_groups.csv"
        loading={loading}
      />
    </div>
  )
}
