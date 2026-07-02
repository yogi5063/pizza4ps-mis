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

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend)

const CHART_OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { position: 'top', labels: { font: { family: 'DM Sans', size: 11 }, color: '#6b6890' } } },
  scales: {
    x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 11 }, color: '#a8a6c0' } },
    y: { grid: { color: '#f0eefb' }, ticks: { font: { family: 'DM Sans', size: 11 }, color: '#a8a6c0' } },
  }
}

// Lunch = 11am - 3pm (hours 11,12,13,14)
// Dinner = 6pm - 11pm (hours 18,19,20,21,22,23)
const LUNCH_HOURS = [11, 12, 13, 14]
const DINNER_HOURS = [18, 19, 20, 21, 22, 23]
const ALL_HOURS = Array.from({ length: 13 }, (_, i) => i + 11)

export default function CoverAnalytics() {
  const { currency, fxRates } = useSettingsStore()
  const { selectedMonths } = useFilterStore()
  const [hourlyData, setHourlyData] = useState({})
  const [kpiData, setKpiData] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [hRes, kRes] = await Promise.all([
          api.get('/data/hourly').catch(() => ({ data: {} })),
          api.get('/data/kpi').catch(() => ({ data: {} })),
        ])
        setHourlyData(hRes.data || {})
        setKpiData(kRes.data || {})
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const months = Object.keys(kpiData).sort()
  const filteredMonths = selectedMonths.length > 0 ? months.filter(m => selectedMonths.includes(m)) : months

  const hourlyAgg = useMemo(() => {
    const agg = {}
    filteredMonths.forEach(m => {
      const d = hourlyData[m] || {}
      Object.entries(d).forEach(([h, v]) => {
        const hNum = parseInt(h)
        agg[hNum] = (agg[hNum] || 0) + (typeof v === 'object' ? v.revenue || 0 : v || 0)
      })
    })
    return agg
  }, [hourlyData, filteredMonths])

  const lunchRev = LUNCH_HOURS.reduce((s, h) => s + (hourlyAgg[h] || 0), 0)
  const dinnerRev = DINNER_HOURS.reduce((s, h) => s + (hourlyAgg[h] || 0), 0)
  const otherRev = ALL_HOURS
    .filter(h => !LUNCH_HOURS.includes(h) && !DINNER_HOURS.includes(h))
    .reduce((s, h) => s + (hourlyAgg[h] || 0), 0)
  const totalRev = lunchRev + dinnerRev + otherRev
  const ratio = dinnerRev > 0 ? lunchRev / dinnerRev : 0

  // Hourly bar chart (colored by period)
  const hourlyColors = ALL_HOURS.map(h => {
    if (LUNCH_HOURS.includes(h)) return '#f59e0bcc'
    if (DINNER_HOURS.includes(h)) return '#3b82f6cc'
    return '#6958C2cc'
  })

  const hourlyBarData = {
    labels: ALL_HOURS.map(h => fmt12h(h)),
    datasets: [
      {
        label: 'Revenue',
        data: ALL_HOURS.map(h => hourlyAgg[h] || 0),
        backgroundColor: hourlyColors,
        borderRadius: 4,
      }
    ]
  }

  // Split bar: lunch vs dinner
  const splitData = {
    labels: ALL_HOURS.map(h => fmt12h(h)),
    datasets: [
      {
        label: 'Lunch',
        data: ALL_HOURS.map(h => LUNCH_HOURS.includes(h) ? hourlyAgg[h] || 0 : 0),
        backgroundColor: '#f59e0bcc',
        borderRadius: 4,
      },
      {
        label: 'Dinner',
        data: ALL_HOURS.map(h => DINNER_HOURS.includes(h) ? hourlyAgg[h] || 0 : 0),
        backgroundColor: '#3b82f6cc',
        borderRadius: 4,
      },
      {
        label: 'Other',
        data: ALL_HOURS.map(h => (!LUNCH_HOURS.includes(h) && !DINNER_HOURS.includes(h)) ? hourlyAgg[h] || 0 : 0),
        backgroundColor: '#6958C2cc',
        borderRadius: 4,
      }
    ]
  }

  if (!loading && months.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <span className="text-5xl">👥</span>
        <h2 className="font-sans font-semibold text-t1 text-xl">No Data Uploaded</h2>
        <p className="text-t2 font-sans text-sm">Upload revenue data in Admin to get started.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageFilters months={months} categories={[]} channels={[]} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Lunch Revenue" value={fc(lunchRev, true, currency, fxRates)}
          subtitle="11AM – 3PM" icon="☀️" color="#f59e0b" loading={loading} />
        <KpiCard title="Dinner Revenue" value={fc(dinnerRev, true, currency, fxRates)}
          subtitle="6PM – 11PM" icon="🌙" color="#3b82f6" loading={loading} />
        <KpiCard title="Lunch/Dinner Ratio"
          value={ratio > 0 ? ratio.toFixed(2) : '—'}
          subtitle={`${totalRev > 0 ? ((lunchRev/totalRev)*100).toFixed(0) : 0}% lunch, ${totalRev > 0 ? ((dinnerRev/totalRev)*100).toFixed(0) : 0}% dinner`}
          icon="⚖️" color="#6958C2" loading={loading} />
        <KpiCard title="Other Hours" value={fc(otherRev, true, currency, fxRates)}
          subtitle="afternoon & late" icon="🕐" color="#22c55e" loading={loading} />
      </div>

      {/* Donut summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lunch/Dinner split visual */}
        <div className="bg-white rounded-xl p-5 flex flex-col gap-4" style={{ border: '1px solid #f0eefb', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <div className="font-sans font-semibold text-t1 text-sm">Revenue Split</div>
          {[
            { label: 'Lunch (11AM–3PM)', value: lunchRev, total: totalRev, color: '#f59e0b' },
            { label: 'Dinner (6PM–11PM)', value: dinnerRev, total: totalRev, color: '#3b82f6' },
            { label: 'Other', value: otherRev, total: totalRev, color: '#6958C2' },
          ].map(item => (
            <div key={item.label} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-sm font-sans">
                <span className="text-t2 font-medium">{item.label}</span>
                <span className="font-mono text-t1 font-semibold">{fc(item.value, true, currency, fxRates)}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: '#f0eefb' }}>
                <div className="h-full rounded-full" style={{ width: `${item.total > 0 ? (item.value / item.total * 100) : 0}%`, background: item.color }} />
              </div>
              <div className="text-xs font-sans text-t3 text-right">
                {item.total > 0 ? ((item.value / item.total) * 100).toFixed(1) : 0}%
              </div>
            </div>
          ))}
        </div>

        {/* Hourly bar (colored) */}
        <div className="lg:col-span-2">
          <ChartCard title="Revenue by Hour — Lunch (Amber) / Dinner (Blue) / Other (Purple)" loading={loading}
            csvData={ALL_HOURS.map(h => ({ hour: fmt12h(h), revenue: hourlyAgg[h] || 0 }))}
            csvFilename="cover_hourly.csv" height={240}
          >
            <Bar data={splitData} options={CHART_OPTS} />
          </ChartCard>
        </div>
      </div>
    </div>
  )
}
