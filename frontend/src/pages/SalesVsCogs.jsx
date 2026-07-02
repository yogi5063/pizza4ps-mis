import React, { useEffect, useState, useMemo } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import api from '../utils/api'
import ChartCard from '../components/ChartCard'
import DataTable from '../components/DataTable'
import PageFilters from '../components/PageFilters'
import { fc, fmtPct } from '../utils/formatters'
import useSettingsStore from '../store/settingsStore'
import useFilterStore from '../store/filterStore'
import { CAT_COLORS } from '../utils/colors'
import NoDataScreen from '../components/NoDataScreen'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend)

const CHART_OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { position: 'top', labels: { font: { family: 'DM Sans', size: 11 }, color: '#6b6890' } } },
  scales: {
    x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 11 }, color: '#a8a6c0' } },
    y: { grid: { color: '#f0eefb' }, ticks: { font: { family: 'DM Sans', size: 11 }, color: '#a8a6c0' } },
  }
}

export default function SalesVsCogs() {
  const { currency, fxRates } = useSettingsStore()
  const { selectedMonths, geo } = useFilterStore()
  const storeCode = geo.outlet || undefined
  const [cogsData, setCogsData] = useState({})
  const [catChData, setCatChData] = useState({})
  const [kpiData, setKpiData] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [cRes, catRes, kRes] = await Promise.all([
          api.get('/data/cogs', { params: storeCode ? { store_code: storeCode } : {} }).catch(() => ({ data: {} })),
          api.get('/data/cat-ch', { params: storeCode ? { store_code: storeCode } : {} }).catch(() => ({ data: {} })),
          api.get('/data/kpi', { params: storeCode ? { store_code: storeCode } : {} }).catch(() => ({ data: {} })),
        ])
        setCogsData(cRes.data || {})
        setCatChData(catRes.data || {})
        setKpiData(kRes.data || {})
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [storeCode])

  const months = Object.keys(kpiData).sort()
  const filteredMonths = selectedMonths.length > 0 ? months.filter(m => selectedMonths.includes(m)) : months

  // Build category-level sales vs cogs
  const catTable = useMemo(() => {
    const cats = [...new Set(filteredMonths.flatMap(m => Object.keys(catChData[m]?.categories || {})))]
    const totalSales = filteredMonths.reduce((s, m) => s + (kpiData[m]?.net_revenue || 0), 0)

    return cats.map(cat => {
      const sales = filteredMonths.reduce((s, m) => s + (catChData[m]?.categories?.[cat] || 0), 0)
      // Get per-category COG from cogs groups if available, else estimate
      const cogData = filteredMonths.reduce((s, m) => {
        const groups = cogsData[m]?.groups || {}
        const catGroup = groups[cat] || {}
        return s + (catGroup.accounting || 0)
      }, 0)
      const isEstimate = cogData === 0
      const cog = cogData > 0 ? cogData : sales * 0.35 // fallback 35% estimate
      const gp = sales - cog
      const gpPct = sales > 0 ? gp / sales : 0
      const contribPct = totalSales > 0 ? sales / totalSales : 0

      return {
        category: cat,
        sales_raw: sales,
        cog_raw: cog,
        gp_raw: gp,
        gp_pct_raw: gpPct,
        contrib_pct_raw: contribPct,
        sales: fc(sales, true, currency, fxRates),
        cog: fc(cog, true, currency, fxRates) + (isEstimate ? ' *' : ''),
        gross_profit: fc(gp, true, currency, fxRates),
        gp_pct: fmtPct(gpPct),
        contribution: fmtPct(contribPct),
      }
    }).sort((a, b) => b.sales_raw - a.sales_raw)
  }, [filteredMonths, catChData, cogsData, kpiData, currency, fxRates])

  const catKeys = catTable.map(r => r.category)

  // Stacked bar chart
  const stackedData = {
    labels: catKeys,
    datasets: [
      {
        label: 'COG',
        data: catTable.map(r => r.cog_raw),
        backgroundColor: '#ef4444cc',
        borderRadius: 4,
      },
      {
        label: 'Gross Profit',
        data: catTable.map(r => r.gp_raw),
        backgroundColor: '#22c55ecc',
        borderRadius: 4,
      }
    ]
  }

  const stackedOpts = {
    ...CHART_OPTS,
    scales: {
      ...CHART_OPTS.scales,
      x: { ...CHART_OPTS.scales.x, stacked: true },
      y: { ...CHART_OPTS.scales.y, stacked: true },
    }
  }

  // GP% donut
  const gpDonutData = {
    labels: catKeys,
    datasets: [{
      data: catTable.map(r => r.gp_raw > 0 ? r.gp_raw : 0),
      backgroundColor: catKeys.map(k => CAT_COLORS[k] || '#94a3b8'),
      borderWidth: 2, borderColor: '#fff',
    }]
  }

  const donutOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'right', labels: { font: { family: 'DM Sans', size: 11 }, color: '#6b6890', boxWidth: 12 } } }
  }

  if (!loading && months.length === 0) return <NoDataScreen storeCode={storeCode} />

  return (
    <div className="flex flex-col gap-5">
      <PageFilters months={months} categories={[]} channels={[]} />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Sales vs COG by Category (Stacked)" loading={loading}
          csvData={catTable.map(r => ({ category: r.category, sales: r.sales_raw, cog: r.cog_raw, gp: r.gp_raw }))}
          csvFilename="sales_vs_cogs.csv"
        >
          <Bar data={stackedData} options={stackedOpts} />
        </ChartCard>

        <ChartCard title="Gross Profit Distribution" loading={loading}>
          <Doughnut data={gpDonutData} options={donutOpts} />
        </ChartCard>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #f0eefb', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
        <div className="px-5 py-3 font-sans font-semibold text-t1 text-sm flex items-center justify-between" style={{ borderBottom: '1px solid #f0eefb' }}>
          <span>Category P&L Summary</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-sans">
            <thead>
              <tr style={{ background: '#faf9fd', borderBottom: '1px solid #f0eefb' }}>
                {['Category', 'Sales', 'COG', 'Gross Profit', 'GP%', 'Contribution%', 'Margin'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-t2 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {catTable.map((row, i) => {
                const gpPct = row.gp_pct_raw
                const marginColor = gpPct >= 0.65 ? '#22c55e' : gpPct >= 0.5 ? '#f59e0b' : '#ef4444'
                const marginWidth = Math.max(gpPct * 100, 0)
                return (
                  <tr key={row.category} style={{ borderBottom: '1px solid #f9f8fc', background: i % 2 === 0 ? '#fff' : '#fdfcff' }}>
                    <td className="px-4 py-3 font-medium text-t1">
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CAT_COLORS[row.category] || '#94a3b8' }} />
                        {row.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-t1">{row.sales}</td>
                    <td className="px-4 py-3 text-right font-mono text-t2">{row.cog}</td>
                    <td className="px-4 py-3 text-right font-mono" style={{ color: '#22c55e' }}>{row.gross_profit}</td>
                    <td className="px-4 py-3 text-right font-sans font-semibold" style={{ color: marginColor }}>{row.gp_pct}</td>
                    <td className="px-4 py-3 text-right font-sans text-t2">{row.contribution}</td>
                    <td className="px-4 py-3">
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: '#f0eefb', width: 80 }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(marginWidth, 100)}%`, background: marginColor }} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      {catTable.some(r => r.cog.includes('*')) && (
        <div className="text-xs font-sans text-t3 px-1">* COG estimated at 35% of sales — upload COGS data for actuals.</div>
      )}
    </div>
  )
}
