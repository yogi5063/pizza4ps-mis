import React, { useEffect, useState, useMemo } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import api from '../utils/api'
import KpiCard from '../components/KpiCard'
import ChartCard from '../components/ChartCard'
import PageFilters from '../components/PageFilters'
import { fc, fmt12h } from '../utils/formatters'
import useSettingsStore from '../store/settingsStore'
import useFilterStore from '../store/filterStore'
import { goldColor } from '../utils/colors'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend)

const HOURS = Array.from({ length: 13 }, (_, i) => i + 11) // 11-23
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const CHART_OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 11 }, color: '#a8a6c0' } },
    y: { grid: { color: '#f0eefb' }, ticks: { font: { family: 'DM Sans', size: 11 }, color: '#a8a6c0' } },
  }
}

export default function TablePerformance() {
  const { currency, fxRates } = useSettingsStore()
  const { selectedMonths, geo } = useFilterStore()
  const storeCode = geo.outlet || undefined
  const [heatmapData, setHeatmapData] = useState({})
  const [tablePerfData, setTablePerfData] = useState({})
  const [kpiData, setKpiData] = useState({})
  const [loading, setLoading] = useState(true)
  const [cellValue, setCellValue] = useState('revenue')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [hRes, tRes, kRes] = await Promise.all([
          api.get('/data/heatmap', { params: storeCode ? { store_code: storeCode } : {} }).catch(() => ({ data: {} })),
          api.get('/data/table-performance', { params: storeCode ? { store_code: storeCode } : {} }).catch(() => ({ data: {} })),
          api.get('/data/kpi', { params: storeCode ? { store_code: storeCode } : {} }).catch(() => ({ data: {} })),
        ])
        setHeatmapData(hRes.data || {})
        setTablePerfData(tRes.data || {})
        setKpiData(kRes.data || {})
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [storeCode])

  const months = Object.keys(kpiData).sort()
  const filteredMonths = selectedMonths.length > 0 ? months.filter(m => selectedMonths.includes(m)) : months

  // Aggregate heatmap across months
  const heatmapAgg = useMemo(() => {
    const agg = {}
    filteredMonths.forEach(m => {
      const d = heatmapData[m] || {}
      DAYS.forEach(day => {
        HOURS.forEach(h => {
          const key = `${day}_${h}`
          if (!agg[key]) agg[key] = { revenue: 0, invoices: 0, count: 0 }
          const cell = d?.[day]?.[h] || {}
          agg[key].revenue += cell.revenue || 0
          agg[key].invoices += cell.invoices || 0
          agg[key].count += cell.count || 0
        })
      })
    })
    return agg
  }, [heatmapData, filteredMonths])

  // Find max for intensity
  const maxVal = useMemo(() => {
    let max = 0
    Object.values(heatmapAgg).forEach(cell => {
      const v = cellValue === 'revenue' ? cell.revenue : cellValue === 'invoices' ? cell.invoices : (cell.invoices > 0 ? cell.revenue / cell.invoices : 0)
      if (v > max) max = v
    })
    return max || 1
  }, [heatmapAgg, cellValue])

  function getCellValue(day, hour) {
    const cell = heatmapAgg[`${day}_${hour}`] || {}
    if (cellValue === 'revenue') return cell.revenue || 0
    if (cellValue === 'invoices') return cell.invoices || 0
    return cell.invoices > 0 ? Math.round(cell.revenue / cell.invoices) : 0
  }

  function formatCellDisplay(v) {
    if (cellValue === 'revenue') return fc(v, true, currency, fxRates)
    if (cellValue === 'invoices') return v.toLocaleString()
    return fc(v, false, currency, fxRates)
  }

  // Table ranking chart
  const tablePerfRows = useMemo(() => {
    const agg = {}
    filteredMonths.forEach(m => {
      const d = tablePerfData[m]?.tables || {}
      Object.entries(d).forEach(([tbl, v]) => {
        agg[tbl] = (agg[tbl] || 0) + v
      })
    })
    return Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 15)
  }, [tablePerfData, filteredMonths])

  if (!loading && months.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <span className="text-5xl">🪑</span>
        <h2 className="font-sans font-semibold text-t1 text-xl">No Data Uploaded</h2>
        <p className="text-t2 font-sans text-sm">Upload revenue data in Admin to get started.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageFilters months={months} categories={[]} channels={[]} />

      {/* Controls */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-sans font-medium text-t2">Cell Value:</span>
        {[
          { value: 'revenue', label: 'Revenue' },
          { value: 'invoices', label: 'Invoice Count' },
          { value: 'avg_bill', label: 'Avg Bill' },
        ].map(opt => (
          <button key={opt.value} onClick={() => setCellValue(opt.value)}
            className="px-3 py-1.5 rounded-lg text-xs font-sans font-medium transition-colors"
            style={{
              background: cellValue === opt.value ? '#6958C2' : '#fff',
              color: cellValue === opt.value ? '#fff' : '#6b6890',
              border: `1px solid ${cellValue === opt.value ? '#6958C2' : '#e8e6f0'}`,
              cursor: 'pointer',
            }}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Heatmap */}
      <div className="bg-white rounded-xl p-5 overflow-x-auto" style={{ border: '1px solid #f0eefb', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
        <div className="font-sans font-semibold text-t1 text-sm mb-4">Hour × Day-of-Week Heatmap</div>
        <table className="border-collapse" style={{ minWidth: 600 }}>
          <thead>
            <tr>
              <th className="text-xs font-sans text-t3 p-2 text-left w-16">Hour</th>
              {DAYS.map(d => (
                <th key={d} className="text-xs font-sans font-medium text-t2 p-2 text-center">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOURS.map(hour => (
              <tr key={hour}>
                <td className="text-xs font-sans text-t3 p-2 pr-3 whitespace-nowrap">{fmt12h(hour)}</td>
                {DAYS.map(day => {
                  const val = getCellValue(day, hour)
                  const intensity = maxVal > 0 ? val / maxVal : 0
                  const bg = goldColor(intensity)
                  const textColor = intensity > 0.5 ? '#fff' : '#1a1830'
                  return (
                    <td key={day}
                      className="p-1"
                      style={{ minWidth: 72 }}
                    >
                      <div
                        className="rounded-lg flex items-center justify-center text-xs font-mono"
                        style={{
                          background: bg,
                          color: textColor,
                          height: 36,
                          padding: '2px 4px',
                          fontSize: '0.65rem',
                          fontWeight: intensity > 0.3 ? 600 : 400,
                        }}
                      >
                        {val > 0 ? formatCellDisplay(val) : ''}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-4">
          <span className="text-xs font-sans text-t3">Low</span>
          <div className="flex gap-0.5">
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className="w-6 h-3 rounded" style={{ background: goldColor(i / 9) }} />
            ))}
          </div>
          <span className="text-xs font-sans text-t3">High</span>
        </div>
      </div>

      {/* Table ranking bar chart */}
      {tablePerfRows.length > 0 && (
        <ChartCard title="Revenue by Table" loading={loading}
          csvData={tablePerfRows.map(([t, v]) => ({ table: t, revenue: v }))}
          csvFilename="table_performance.csv"
          height={300}
        >
          <Bar data={{
            labels: tablePerfRows.map(([t]) => t),
            datasets: [{
              data: tablePerfRows.map(([, v]) => v),
              backgroundColor: '#6958C2cc',
              borderRadius: 6,
            }]
          }} options={CHART_OPTS} />
        </ChartCard>
      )}
    </div>
  )
}
