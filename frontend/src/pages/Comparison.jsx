import React, { useEffect, useState } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import api from '../utils/api'
import KpiCard from '../components/KpiCard'
import ChartCard from '../components/ChartCard'
import PageFilters from '../components/PageFilters'
import { fc, momBadge } from '../utils/formatters'
import useSettingsStore from '../store/settingsStore'
import useFilterStore from '../store/filterStore'
import { CAT_COLORS, CHANNEL_COLORS } from '../utils/colors'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend)

const PALETTE = ['#6958C2', '#22c55e', '#f59e0b', '#3b82f6']

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const CHART_OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { position: 'top', labels: { font: { family: 'DM Sans', size: 11 }, color: '#6b6890' } } },
  scales: {
    x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 10 }, color: '#a8a6c0' } },
    y: { grid: { color: '#f0eefb' }, ticks: { font: { family: 'DM Sans', size: 11 }, color: '#a8a6c0' } },
  }
}

export default function Comparison() {
  const { currency, fxRates } = useSettingsStore()
  const { selectedMonths } = useFilterStore()
  const [kpiData, setKpiData] = useState({})
  const [dailyData, setDailyData] = useState({})
  const [catChData, setCatChData] = useState({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [kRes, dRes, cRes] = await Promise.all([
          api.get('/data/kpi').catch(() => ({ data: {} })),
          api.get('/data/daily').catch(() => ({ data: {} })),
          api.get('/data/cat-ch').catch(() => ({ data: {} })),
        ])
        setKpiData(kRes.data || {})
        setDailyData(dRes.data || {})
        setCatChData(cRes.data || {})
        const ms = Object.keys(kRes.data || {}).sort()
        setSelected(ms.slice(-2))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const months = Object.keys(kpiData).sort()
  // PageFilters controls the pool of months available to compare
  const filtered = selectedMonths.length > 0
    ? selectedMonths.filter(m => months.includes(m))
    : months

  // When the available pool changes, keep the intersection; default to last 2 if empty
  useEffect(() => {
    if (filtered.length === 0) return
    setSelected(prev => {
      const kept = prev.filter(m => filtered.includes(m))
      return kept.length > 0 ? kept : filtered.slice(-2)
    })
  }, [filtered.join(',')])

  function toggleMonth(m) {
    if (selected.includes(m)) {
      setSelected(selected.filter(x => x !== m))
    } else if (selected.length < 4) {
      setSelected([...selected, m])
    }
  }

  // Daily overlay
  const maxDays = Math.max(...selected.map(m => (dailyData[m] || []).length), 0)
  const dailyLabels = Array.from({ length: maxDays }, (_, i) => `Day ${i + 1}`)
  const dailyDatasets = selected.map((m, i) => ({
    label: m,
    data: (dailyData[m] || []).map(r => r.net_revenue || 0),
    borderColor: PALETTE[i],
    backgroundColor: PALETTE[i] + '22',
    fill: false,
    tension: 0.4,
    pointRadius: 3,
  }))

  // Category grouped bar
  const allCats = [...new Set(selected.flatMap(m => Object.keys(catChData[m]?.categories || {})))]
  const catDatasets = selected.map((m, i) => ({
    label: m,
    data: allCats.map(c => catChData[m]?.categories?.[c] || 0),
    backgroundColor: PALETTE[i],
    borderRadius: 4,
  }))

  // Channel grouped bar
  const allChs = [...new Set(selected.flatMap(m => Object.keys(catChData[m]?.channels || {})))]
  const chDatasets = selected.map((m, i) => ({
    label: m,
    data: allChs.map(c => catChData[m]?.channels?.[c] || 0),
    backgroundColor: PALETTE[i],
    borderRadius: 4,
  }))

  // DOW grouped bar
  const dowDatasets = selected.map((m, i) => {
    const rows = dailyData[m] || []
    const dowAgg = {}
    rows.forEach(r => { if (r.day_of_week) dowAgg[r.day_of_week] = (dowAgg[r.day_of_week] || 0) + (r.net_revenue || 0) })
    return {
      label: m,
      data: DOW.map(d => dowAgg[d] || 0),
      backgroundColor: PALETTE[i],
      borderRadius: 4,
    }
  })

  const KPI_KEYS = [
    { key: 'net_revenue', label: 'Net Revenue', format: (v) => fc(v, true, currency, fxRates) },
    { key: 'gross_revenue', label: 'Gross Revenue', format: (v) => fc(v, true, currency, fxRates) },
    { key: 'total_invoices', label: 'Invoices', format: (v) => v?.toLocaleString() ?? '—' },
    { key: 'avg_bill', label: 'Avg Bill', format: (v) => fc(v, false, currency, fxRates) },
    { key: 'total_discount', label: 'Discount', format: (v) => fc(v, true, currency, fxRates) },
    { key: 'service_charge', label: 'Service Charge', format: (v) => fc(v, true, currency, fxRates) },
  ]

  if (!loading && months.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <span className="text-5xl">⚖️</span>
        <h2 className="font-sans font-semibold text-t1 text-xl">No Data Uploaded</h2>
        <p className="text-t2 font-sans text-sm">Upload revenue data in Admin to get started.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageFilters months={months} />

      {/* Month selector — picks from filtered pool */}
      <div className="bg-white rounded-xl p-4 flex flex-col gap-3" style={{ border: '1px solid #f0eefb' }}>
        <div className="text-sm font-sans font-semibold text-t1">
          Select months to compare (max 4)
          {filtered.length < months.length && (
            <span className="ml-2 text-xs font-normal text-t3">— showing {filtered.length} of {months.length} months from filter above</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {filtered.map((m) => {
            const idx = selected.indexOf(m)
            const isSel = idx >= 0
            const color = isSel ? PALETTE[idx] : '#6b6890'
            return (
              <button
                key={m}
                onClick={() => toggleMonth(m)}
                className="px-4 py-1.5 rounded-xl text-sm font-sans font-medium transition-all"
                style={{
                  background: isSel ? color : '#f5f4fb',
                  color: isSel ? '#fff' : '#6b6890',
                  border: `1px solid ${isSel ? color : '#e8e6f0'}`,
                  cursor: 'pointer',
                }}
              >
                {m}
              </button>
            )
          })}
        </div>
      </div>

      {/* Side-by-side KPI comparison */}
      {selected.length > 0 && (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #f0eefb', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <div className="px-5 py-3 font-sans font-semibold text-t1 text-sm" style={{ borderBottom: '1px solid #f0eefb' }}>
            KPI Comparison
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans">
              <thead>
                <tr style={{ background: '#faf9fd', borderBottom: '1px solid #f0eefb' }}>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-t2 uppercase tracking-wide">Metric</th>
                  {selected.map((m, i) => (
                    <th key={m} className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide"
                      style={{ color: PALETTE[i] }}>
                      {m}
                    </th>
                  ))}
                  {selected.length === 2 && (
                    <th className="px-5 py-3 text-right text-xs font-semibold text-t2 uppercase tracking-wide">Change</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {KPI_KEYS.map(({ key, label, format }) => {
                  const badge = selected.length === 2
                    ? momBadge(kpiData[selected[1]]?.[key], kpiData[selected[0]]?.[key])
                    : null
                  return (
                    <tr key={key} style={{ borderBottom: '1px solid #f9f8fc' }}>
                      <td className="px-5 py-3 font-medium text-t1">{label}</td>
                      {selected.map((m, i) => (
                        <td key={m} className="px-5 py-3 text-right font-mono" style={{ color: PALETTE[i] }}>
                          {format(kpiData[m]?.[key])}
                        </td>
                      ))}
                      {selected.length === 2 && badge && (
                        <td className="px-5 py-3 text-right">
                          <span
                            className="inline-flex items-center gap-1 text-xs font-sans font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: badge.positive ? '#dcfce7' : '#fee2e2', color: badge.positive ? '#16a34a' : '#dc2626' }}
                          >
                            {badge.positive ? '↑' : '↓'} {badge.label}
                          </span>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Charts */}
      {selected.length > 0 && (
        <>
          <ChartCard title="Daily Revenue Overlay" loading={loading}
            csvData={selected.flatMap(m => (dailyData[m] || []).map((r, i) => ({ month: m, day: i + 1, date: r.date, net_revenue: r.net_revenue })))}
            csvFilename="daily_comparison.csv"
          >
            <Line data={{ labels: dailyLabels, datasets: dailyDatasets }} options={CHART_OPTS} />
          </ChartCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Revenue by Category (Grouped)" loading={loading}>
              <Bar data={{ labels: allCats, datasets: catDatasets }} options={{ ...CHART_OPTS, plugins: { ...CHART_OPTS.plugins, legend: { position: 'top', labels: { font: { family: 'DM Sans', size: 11 }, color: '#6b6890' } } } }} />
            </ChartCard>
            <ChartCard title="Revenue by Channel (Grouped)" loading={loading}>
              <Bar data={{ labels: allChs, datasets: chDatasets }} options={{ ...CHART_OPTS, plugins: { ...CHART_OPTS.plugins, legend: { position: 'top', labels: { font: { family: 'DM Sans', size: 11 }, color: '#6b6890' } } } }} />
            </ChartCard>
          </div>

          <ChartCard title="Revenue by Day of Week (Grouped)" loading={loading}>
            <Bar data={{ labels: DOW, datasets: dowDatasets }} options={{ ...CHART_OPTS, plugins: { ...CHART_OPTS.plugins, legend: { position: 'top', labels: { font: { family: 'DM Sans', size: 11 }, color: '#6b6890' } } } }} />
          </ChartCard>
        </>
      )}
    </div>
  )
}
