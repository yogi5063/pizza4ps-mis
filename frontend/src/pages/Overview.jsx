import React, { useEffect, useState, useMemo } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend
} from 'chart.js'
import { Bar, Line, Doughnut } from 'react-chartjs-2'
import api from '../utils/api'
import KpiCard from '../components/KpiCard'
import ChartCard from '../components/ChartCard'
import FilterBar from '../components/FilterBar'
import AlertsPanel from '../components/AlertsPanel'
import CategoryIconCard from '../components/CategoryIconCard'
import { fc, momBadge, fmt12h, fmtPct } from '../utils/formatters'
import useSettingsStore from '../store/settingsStore'
import useFilterStore from '../store/filterStore'
import { CAT_COLORS, CHANNEL_COLORS } from '../utils/colors'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend)

const CHART_OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 11 }, color: '#a8a6c0' } },
    y: { grid: { color: '#f0eefb' }, ticks: { font: { family: 'DM Sans', size: 11 }, color: '#a8a6c0' } },
  }
}

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function Overview() {
  const { currency, fxRates } = useSettingsStore()
  const { selectedMonths, selectedCategories, selectedChannels } = useFilterStore()
  const [kpiData, setKpiData] = useState({})
  const [catChData, setCatChData] = useState({})
  const [hourlyData, setHourlyData] = useState({})
  const [dailyData, setDailyData] = useState({})
  const [loading, setLoading] = useState(true)
  const [dailyToggle, setDailyToggle] = useState('line')
  const [catToggle, setCatToggle] = useState('donut')
  const [activeCat, setActiveCat] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [kRes, cRes, hRes, dRes] = await Promise.all([
          api.get('/data/kpi').catch(() => ({ data: {} })),
          api.get('/data/cat-ch').catch(() => ({ data: {} })),
          api.get('/data/hourly').catch(() => ({ data: {} })),
          api.get('/data/daily').catch(() => ({ data: {} })),
        ])
        setKpiData(kRes.data || {})
        setCatChData(cRes.data || {})
        setHourlyData(hRes.data || {})
        setDailyData(dRes.data || {})
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const months = Object.keys(kpiData).sort()
  const filteredMonths = selectedMonths.length > 0 ? months.filter(m => selectedMonths.includes(m)) : months

  const latestMonth = filteredMonths[filteredMonths.length - 1]
  const prevMonth = filteredMonths.length >= 2 ? filteredMonths[filteredMonths.length - 2] : null
  const latest = filteredMonths.reduce((acc, m) => {
    const d = kpiData[m] || {}
    acc.net_revenue = (acc.net_revenue || 0) + (d.net_revenue || 0)
    acc.gross_revenue = (acc.gross_revenue || 0) + (d.gross_revenue || 0)
    acc.total_invoices = (acc.total_invoices || 0) + (d.total_invoices || 0)
    acc.total_discount = (acc.total_discount || 0) + (d.total_discount || 0)
    acc.service_charge = (acc.service_charge || 0) + (d.service_charge || 0)
    acc.total_gst = (acc.total_gst || 0) + (d.total_gst || 0)
    acc.cancellations = (acc.cancellations || 0) + (d.cancellations || 0)
    return acc
  }, {})
  latest.avg_bill = latest.total_invoices > 0 ? latest.net_revenue / latest.total_invoices : 0

  const prev = prevMonth ? kpiData[prevMonth] || {} : {}

  // Available options from data
  const availableCategories = [...new Set(Object.values(catChData).flatMap(d => Object.keys(d?.categories || {})))]
  const availableChannels = [...new Set(Object.values(catChData).flatMap(d => Object.keys(d?.channels || {})))]

  // Category aggregation
  const catAgg = {}
  const catQty = {}
  filteredMonths.forEach(m => {
    const d = catChData[m]?.categories || {}
    const q = catChData[m]?.category_qty || {}
    Object.entries(d).forEach(([cat, v]) => {
      if (selectedCategories.length && !selectedCategories.includes(cat)) return
      catAgg[cat] = (catAgg[cat] || 0) + v
      catQty[cat] = (catQty[cat] || 0) + (q[cat] || 0)
    })
  })

  // Channel aggregation
  const chAgg = {}
  filteredMonths.forEach(m => {
    const d = catChData[m]?.channels || {}
    Object.entries(d).forEach(([ch, v]) => {
      if (selectedChannels.length && !selectedChannels.includes(ch)) return
      chAgg[ch] = (chAgg[ch] || 0) + v
    })
  })

  // Daily trend
  const dailyRows = filteredMonths.flatMap(m => dailyData[m] || [])
  const dailyLabels = dailyRows.map(r => r.date || r.day || '')
  const dailyVals = dailyRows.map(r => r.net_revenue || 0)
  const dailyChart = {
    labels: dailyLabels,
    datasets: [{
      label: 'Net Revenue',
      data: dailyVals,
      borderColor: '#6958C2',
      backgroundColor: 'rgba(105,88,194,0.15)',
      fill: true,
      tension: 0.4,
      pointRadius: 2,
    }]
  }

  // Hourly chart
  const hourlyAgg = {}
  filteredMonths.forEach(m => {
    const d = hourlyData[m] || {}
    Object.entries(d).forEach(([h, v]) => {
      hourlyAgg[h] = (hourlyAgg[h] || 0) + v
    })
  })
  const hours = Array.from({ length: 13 }, (_, i) => i + 11) // 11-23
  const hourlyLabels = hours.map(h => fmt12h(h))
  const hourlyVals2 = hours.map(h => hourlyAgg[h] || hourlyAgg[String(h)] || 0)

  // DOW chart
  const dowAgg = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 }
  filteredMonths.forEach(m => {
    const rows = dailyData[m] || []
    rows.forEach(r => {
      const dow = r.day_of_week || r.dow
      if (dow && dowAgg[dow] !== undefined) dowAgg[dow] += r.net_revenue || 0
    })
  })

  const catKeys = Object.keys(catAgg)
  const chKeys = Object.keys(chAgg)

  const donutOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { font: { family: 'DM Sans', size: 11 }, color: '#6b6890', boxWidth: 12 } }
    }
  }

  if (!loading && months.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <span className="text-5xl">📊</span>
        <h2 className="font-sans font-semibold text-t1 text-xl">No Data Uploaded</h2>
        <p className="text-t2 font-sans text-sm">Upload revenue data in Admin to get started.</p>
        <a href="/admin" className="px-5 py-2 rounded-xl text-white font-sans font-semibold text-sm"
          style={{ background: 'linear-gradient(135deg,#6958C2,#8878D8)' }}>Go to Admin →</a>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <AlertsPanel kpiData={kpiData} monthsList={months} />
      <FilterBar months={months} categories={availableCategories} channels={availableChannels} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Net Revenue" value={fc(latest.net_revenue, true, currency, fxRates)}
          trend={momBadge(latest.net_revenue, prev.net_revenue)} subtitle="MoM" icon="💰" color="#6958C2" loading={loading} />
        <KpiCard title="Gross Revenue" value={fc(latest.gross_revenue, true, currency, fxRates)}
          trend={momBadge(latest.gross_revenue, prev.gross_revenue)} icon="📈" color="#22c55e" loading={loading} />
        <KpiCard title="Invoices" value={latest.total_invoices?.toLocaleString() ?? '—'}
          trend={momBadge(latest.total_invoices, prev.total_invoices)} icon="🧾" color="#3b82f6" loading={loading} />
        <KpiCard title="Avg Bill" value={fc(latest.avg_bill, false, currency, fxRates)}
          trend={momBadge(latest.avg_bill, prev.avg_bill)} icon="🧮" color="#f59e0b" loading={loading} />
        <KpiCard title="Total Discount" value={fc(latest.total_discount, true, currency, fxRates)}
          subtitle={latest.gross_revenue ? fmtPct((latest.total_discount||0) / latest.gross_revenue) : '—'} icon="🏷️" color="#ec4899" loading={loading} />
        <KpiCard title="Service Charge" value={fc(latest.service_charge, true, currency, fxRates)}
          icon="🔧" color="#8b5cf6" loading={loading} />
        <KpiCard title="GST Collected" value={fc(latest.total_gst, true, currency, fxRates)}
          icon="🧾" color="#06b6d4" loading={loading} />
        <KpiCard title="Cancellations" value={latest.cancellations?.toLocaleString() ?? '—'}
          trend={latest.cancellations != null && prev.cancellations != null
            ? { ...momBadge(latest.cancellations, prev.cancellations), positive: latest.cancellations <= prev.cancellations }
            : null}
          icon="❌" color="#ef4444" loading={loading} />
      </div>

      {/* Category Icon Cards */}
      {catKeys.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {catKeys.map(cat => (
            <CategoryIconCard
              key={cat}
              category={cat}
              value={catAgg[cat]}
              qty={catQty[cat]}
              selected={activeCat === cat}
              onClick={() => setActiveCat(activeCat === cat ? null : cat)}
            />
          ))}
        </div>
      )}

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Daily Revenue Trend"
          toggles={[{ value: 'line', label: 'Line' }, { value: 'bar', label: 'Bar' }]}
          activeToggle={dailyToggle} onToggle={setDailyToggle} loading={loading}
          csvData={dailyRows.map(r => ({ date: r.date, net_revenue: r.net_revenue }))}
          csvFilename="daily_trend.csv"
        >
          {dailyToggle === 'line'
            ? <Line data={dailyChart} options={CHART_OPTS} />
            : <Bar data={{ ...dailyChart, datasets: [{ ...dailyChart.datasets[0], fill: false, backgroundColor: '#6958C2cc' }] }} options={CHART_OPTS} />
          }
        </ChartCard>

        <ChartCard title="Revenue by Category"
          toggles={[{ value: 'donut', label: 'Donut' }, { value: 'bar', label: 'Bar' }]}
          activeToggle={catToggle} onToggle={setCatToggle} loading={loading}
          csvData={catKeys.map(k => ({ category: k, revenue: catAgg[k] }))}
          csvFilename="category_revenue.csv"
        >
          {catToggle === 'donut'
            ? <Doughnut data={{ labels: catKeys, datasets: [{ data: catKeys.map(k => catAgg[k]), backgroundColor: catKeys.map(k => CAT_COLORS[k] || '#94a3b8'), borderWidth: 2, borderColor: '#fff' }] }} options={donutOpts} />
            : <Bar data={{ labels: catKeys, datasets: [{ data: catKeys.map(k => catAgg[k]), backgroundColor: catKeys.map(k => CAT_COLORS[k] || '#94a3b8'), borderRadius: 6 }] }} options={CHART_OPTS} />
          }
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Revenue by Channel" loading={loading}
          csvData={chKeys.map(k => ({ channel: k, revenue: chAgg[k] }))} csvFilename="channel_revenue.csv"
        >
          <Bar data={{ labels: chKeys, datasets: [{ data: chKeys.map(k => chAgg[k]), backgroundColor: chKeys.map(k => CHANNEL_COLORS[k] || '#94a3b8'), borderRadius: 6 }] }} options={CHART_OPTS} />
        </ChartCard>

        <ChartCard title="Peak Hours (Revenue)" loading={loading}
          csvData={hours.map((h, i) => ({ hour: fmt12h(h), revenue: hourlyVals2[i] }))}
          csvFilename="hourly_revenue.csv"
        >
          <Bar data={{
            labels: hourlyLabels,
            datasets: [{
              data: hourlyVals2,
              backgroundColor: hours.map(h => h >= 11 && h <= 15 ? '#f59e0b' : h >= 18 ? '#6958C2' : '#3b82f6'),
              borderRadius: 4,
            }]
          }} options={CHART_OPTS} />
        </ChartCard>
      </div>

      {/* DOW chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Revenue by Day of Week" loading={loading}
          csvData={DOW.map(d => ({ day: d, revenue: dowAgg[d] }))} csvFilename="dow_revenue.csv"
        >
          <Bar data={{
            labels: DOW,
            datasets: [{
              data: DOW.map(d => dowAgg[d]),
              backgroundColor: '#6958C2cc',
              borderRadius: 6,
            }]
          }} options={CHART_OPTS} />
        </ChartCard>
      </div>
    </div>
  )
}
