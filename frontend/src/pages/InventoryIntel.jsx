import React, { useEffect, useState, useMemo } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import api from '../utils/api'
import KpiCard from '../components/KpiCard'
import ChartCard from '../components/ChartCard'
import DataTable from '../components/DataTable'
import PageFilters from '../components/PageFilters'
import { fc, fmtPct } from '../utils/formatters'
import useSettingsStore from '../store/settingsStore'
import useFilterStore from '../store/filterStore'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend)

const TABS = ['Variance Analysis', 'Item-wise Consumption']

export default function InventoryIntel() {
  const { currency, fxRates } = useSettingsStore()
  const { selectedMonths, geo } = useFilterStore()
  const storeCode = geo.outlet || undefined
  const [cogsData, setCogsData] = useState({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(0)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await api.get('/data/cogs', { params: storeCode ? { store_code: storeCode } : {} }).catch(() => ({ data: {} }))
        setCogsData(res.data || {})
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [storeCode])

  const months = Object.keys(cogsData).sort()
  const filteredMonths = selectedMonths.length > 0 ? months.filter(m => selectedMonths.includes(m)) : months

  // Ingredient-level variance analysis
  const ingredientsAgg = useMemo(() => {
    const agg = {}
    filteredMonths.forEach(m => {
      const ingredients = cogsData[m]?.ingredients || []
      ingredients.forEach(item => {
        if (!item?.name) return
        const k = `${item.group}_${item.name}`
        if (!agg[k]) agg[k] = {
          group: item.group || '—',
          ingredient: item.name,
          actual: 0, standard: 0, cost: 0,
        }
        agg[k].actual += item.actual_consumption || 0
        agg[k].standard += item.standard_consumption || 0
        agg[k].cost += item.cost || 0
      })
    })
    return Object.values(agg).map(r => {
      const variance = r.actual - r.standard
      const varPct = r.standard > 0 ? variance / r.standard : 0
      const flag = varPct > 0.1 ? '🔴' : varPct < -0.05 ? '🟡' : '✅'
      return {
        ...r,
        variance_rs: fc(r.cost * varPct, false, currency, fxRates),
        variance_raw: r.cost * varPct,
        var_pct: fmtPct(varPct),
        varPct_raw: varPct,
        flag,
      }
    })
  }, [cogsData, filteredMonths, currency, fxRates])

  const overConsumed = ingredientsAgg.filter(r => r.varPct_raw > 0.1).sort((a, b) => b.varPct_raw - a.varPct_raw)
  const underConsumed = ingredientsAgg.filter(r => r.varPct_raw < -0.05)
  const totalVarCost = ingredientsAgg.reduce((s, r) => s + (r.variance_raw || 0), 0)

  // Consumption table
  const consumptionData = useMemo(() => {
    const agg = {}
    filteredMonths.forEach(m => {
      const ingredients = cogsData[m]?.ingredients || []
      ingredients.forEach(item => {
        if (!item?.name) return
        const k = item.name
        if (!agg[k]) agg[k] = {
          ingredient: k, unit: item.unit || '—',
          opening: 0, purchased: 0, consumed: 0, closing: 0, waste: 0, cost: 0,
        }
        agg[k].opening += item.opening_stock || 0
        agg[k].purchased += item.purchased || 0
        agg[k].consumed += item.actual_consumption || 0
        agg[k].closing += item.closing_stock || 0
        agg[k].waste += item.waste || 0
        agg[k].cost += item.cost || 0
      })
    })
    return Object.values(agg).map(r => {
      const available = r.opening + r.purchased
      const wastePct = r.consumed > 0 ? r.waste / r.consumed : 0
      return {
        ingredient: r.ingredient,
        unit: r.unit,
        opening: r.opening?.toFixed(2),
        purchased: r.purchased?.toFixed(2),
        available: available?.toFixed(2),
        consumed: r.consumed?.toFixed(2),
        closing: r.closing?.toFixed(2),
        waste: r.waste?.toFixed(2),
        cost: fc(r.cost, false, currency, fxRates),
        waste_pct: fmtPct(wastePct),
        wastePct_raw: wastePct,
      }
    })
  }, [cogsData, filteredMonths, currency, fxRates])

  // Top 10 over-consumed horizontal bar
  const top10Over = overConsumed.slice(0, 10)

  if (!loading && months.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <span className="text-5xl">🔍</span>
        <h2 className="font-sans font-semibold text-t1 text-xl">No COGS Data Uploaded</h2>
        <p className="text-t2 font-sans text-sm">Upload COGS data in Admin to get started.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageFilters months={months} categories={[]} channels={[]} />

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1.5 w-fit" style={{ border: '1px solid #f0eefb' }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)}
            className="px-4 py-2 rounded-lg text-sm font-sans font-medium transition-colors"
            style={{ background: tab === i ? '#6958C2' : 'transparent', color: tab === i ? '#fff' : '#6b6890', cursor: 'pointer' }}>
            {t}
          </button>
        ))}
      </div>

      {tab === 0 && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard title="Items Over-Consumed" value={overConsumed.length?.toString()}
              subtitle=">10% over standard" icon="🔴" color="#ef4444" loading={loading} />
            <KpiCard title="Items Under-Consumed" value={underConsumed.length?.toString()}
              subtitle=">5% under standard" icon="🟡" color="#f59e0b" loading={loading} />
            <KpiCard title="Total COG Variance" value={fc(Math.abs(totalVarCost), true, currency, fxRates)}
              subtitle={totalVarCost > 0 ? 'over standard' : 'under standard'} icon="⚠️" color="#6958C2" loading={loading} />
          </div>

          {/* Top 10 over-consumed horizontal bar */}
          {top10Over.length > 0 && (
            <ChartCard title="Top 10 Over-Consumed Ingredients" loading={loading} height={280}>
              <Bar data={{
                labels: top10Over.map(r => r.ingredient),
                datasets: [{
                  label: 'Over-consumption %',
                  data: top10Over.map(r => r.varPct_raw * 100),
                  backgroundColor: '#ef4444cc',
                  borderRadius: 4,
                }]
              }} options={{
                responsive: true, maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: {
                  x: { grid: { color: '#f0eefb' }, ticks: { font: { family: 'DM Sans', size: 11 }, color: '#a8a6c0', callback: v => v.toFixed(0) + '%' } },
                  y: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 11 }, color: '#a8a6c0' } },
                }
              }} />
            </ChartCard>
          )}

          {/* Variance Table */}
          <DataTable
            title="Ingredient Variance Analysis"
            columns={[
              { key: 'group', label: 'Group' },
              { key: 'ingredient', label: 'Ingredient', wrap: true },
              { key: 'actual', label: 'Actual', align: 'right', mono: true },
              { key: 'standard', label: 'Standard', align: 'right', mono: true },
              { key: 'variance_rs', label: 'Variance ₹', align: 'right', mono: true },
              { key: 'var_pct', label: 'Var%', align: 'right' },
              { key: 'flag', label: 'Flag', align: 'center', sortable: false },
            ]}
            data={ingredientsAgg.map(r => ({ ...r, actual: r.actual?.toFixed(2), standard: r.standard?.toFixed(2) }))}
            csvFilename="inventory_variance.csv"
            loading={loading}
            topNOptions={true}
            defaultTopN={20}
          />
        </>
      )}

      {tab === 1 && (
        <DataTable
          title="Item-wise Consumption"
          columns={[
            { key: 'ingredient', label: 'Ingredient', wrap: true },
            { key: 'unit', label: 'Unit', align: 'center' },
            { key: 'opening', label: 'Opening', align: 'right', mono: true },
            { key: 'purchased', label: 'Purchased', align: 'right', mono: true },
            { key: 'available', label: 'Available', align: 'right', mono: true },
            { key: 'consumed', label: 'Consumed', align: 'right', mono: true },
            { key: 'closing', label: 'Closing', align: 'right', mono: true },
            { key: 'waste', label: 'Waste', align: 'right', mono: true },
            { key: 'cost', label: 'Cost', align: 'right', mono: true },
            {
              key: 'waste_pct', label: 'Waste%', align: 'right',
              render: (val, row) => (
                <span style={{ color: row.wastePct_raw > 0.1 ? '#ef4444' : row.wastePct_raw > 0.05 ? '#f59e0b' : '#22c55e', fontWeight: 600 }}>
                  {val}
                </span>
              )
            },
          ]}
          data={consumptionData}
          csvFilename="consumption_report.csv"
          loading={loading}
          topNOptions={true}
          defaultTopN={20}
        />
      )}
    </div>
  )
}
