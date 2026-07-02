import React, { useEffect, useState, useMemo } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import api from '../utils/api'
import KpiCard from '../components/KpiCard'
import ChartCard from '../components/ChartCard'
import PageFilters from '../components/PageFilters'
import { fc, fmtPct, fmt12h } from '../utils/formatters'
import useSettingsStore from '../store/settingsStore'
import useFilterStore from '../store/filterStore'
import { CHANNEL_COLORS } from '../utils/colors'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend)

const CHART_OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 11 }, color: '#a8a6c0' } },
    y: { grid: { color: '#f0eefb' }, ticks: { font: { family: 'DM Sans', size: 11 }, color: '#a8a6c0' } },
  }
}

export default function VoidsCancels() {
  const { currency, fxRates } = useSettingsStore()
  const { selectedMonths } = useFilterStore()
  const [voidsData, setVoidsData] = useState({})
  const [kpiData, setKpiData] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [vRes, kRes] = await Promise.all([
          api.get('/data/voids').catch(() => ({ data: {} })),
          api.get('/data/kpi').catch(() => ({ data: {} })),
        ])
        setVoidsData(vRes.data || {})
        setKpiData(kRes.data || {})
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const months = Object.keys(kpiData).sort()
  const filteredMonths = selectedMonths.length > 0 ? months.filter(m => selectedMonths.includes(m)) : months

  const totalCancellations = filteredMonths.reduce((s, m) => s + (kpiData[m]?.cancellations || 0), 0)
  const totalValue = filteredMonths.reduce((s, m) => s + (voidsData[m]?.cancelled_value || 0), 0)
  const totalInvoices = filteredMonths.reduce((s, m) => s + (kpiData[m]?.total_invoices || 0), 0)
  const cancelRate = (totalInvoices + totalCancellations) > 0
    ? totalCancellations / (totalInvoices + totalCancellations) : 0

  // Channel aggregation
  const chAgg = useMemo(() => {
    const agg = {}
    filteredMonths.forEach(m => {
      const d = voidsData[m]?.by_channel || {}
      Object.entries(d).forEach(([ch, v]) => { agg[ch] = (agg[ch] || 0) + v })
    })
    return agg
  }, [voidsData, filteredMonths])

  const chKeys = Object.keys(chAgg)

  // Hourly aggregation
  const hourlyAgg = useMemo(() => {
    const agg = {}
    filteredMonths.forEach(m => {
      const d = voidsData[m]?.by_hour || {}
      Object.entries(d).forEach(([h, v]) => {
        const hNum = parseInt(h)
        agg[hNum] = (agg[hNum] || 0) + v
      })
    })
    return agg
  }, [voidsData, filteredMonths])

  const hours = Array.from({ length: 13 }, (_, i) => i + 11)
  const hourlyVals = hours.map(h => hourlyAgg[h] || 0)

  // Monthly trend
  const trendData = {
    labels: months,
    datasets: [{
      label: 'Cancellations',
      data: months.map(m => kpiData[m]?.cancellations || 0),
      borderColor: '#ef4444',
      backgroundColor: 'rgba(239,68,68,0.15)',
      fill: true,
      tension: 0.4,
      pointRadius: 4,
    }]
  }

  if (!loading && months.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <span className="text-5xl">❌</span>
        <h2 className="font-sans font-semibold text-t1 text-xl">No Data Uploaded</h2>
        <p className="text-t2 font-sans text-sm">Upload revenue data in Admin to get started.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageFilters months={months} categories={[]} channels={[]} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard title="Total Cancellations" value={totalCancellations?.toLocaleString() ?? '—'}
          icon="❌" color="#ef4444" loading={loading} />
        <KpiCard title="Cancelled Value" value={fc(totalValue, true, currency, fxRates)}
          subtitle="revenue lost" icon="💸" color="#f59e0b" loading={loading} />
        <KpiCard title="Cancel Rate" value={fmtPct(cancelRate)}
          subtitle="of total orders" icon="📉" color="#8b5cf6" loading={loading} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Cancellations by Channel" loading={loading}
          csvData={chKeys.map(k => ({ channel: k, cancellations: chAgg[k] }))}
          csvFilename="voids_by_channel.csv"
        >
          <Bar data={{
            labels: chKeys,
            datasets: [{
              data: chKeys.map(k => chAgg[k]),
              backgroundColor: chKeys.map(k => CHANNEL_COLORS[k] || '#94a3b8'),
              borderRadius: 6,
            }]
          }} options={CHART_OPTS} />
        </ChartCard>

        <ChartCard title="Cancellations by Hour" loading={loading}
          csvData={hours.map((h, i) => ({ hour: fmt12h(h), cancellations: hourlyVals[i] }))}
          csvFilename="voids_by_hour.csv"
        >
          <Bar data={{
            labels: hours.map(h => fmt12h(h)),
            datasets: [{
              data: hourlyVals,
              backgroundColor: hours.map(h => h >= 21 ? '#ef4444cc' : '#6958C2cc'),
              borderRadius: 4,
            }]
          }} options={CHART_OPTS} />
        </ChartCard>
      </div>

      {/* Monthly trend */}
      <ChartCard title="Monthly Cancellation Trend" loading={loading}
        csvData={months.map(m => ({ month: m, cancellations: kpiData[m]?.cancellations || 0 }))}
        csvFilename="cancellation_trend.csv"
      >
        <Line data={trendData} options={{ ...CHART_OPTS, plugins: { legend: { display: false } } }} />
      </ChartCard>
    </div>
  )
}
