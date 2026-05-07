import React, { useEffect, useState } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import api from '../utils/api'
import KpiCard from '../components/KpiCard'
import ChartCard from '../components/ChartCard'
import DataTable from '../components/DataTable'
import FilterBar from '../components/FilterBar'
import { fc, fmtPct, momBadge } from '../utils/formatters'
import useSettingsStore from '../store/settingsStore'
import { CAT_COLORS, CHANNEL_COLORS } from '../utils/colors'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend)

const CHART_OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 10 }, color: '#a8a6c0', maxRotation: 45 } },
    y: { grid: { color: '#f0eefb' }, ticks: { font: { family: 'DM Sans', size: 11 }, color: '#a8a6c0' } },
  }
}

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const DAILY_COLUMNS = [
  { key: 'date', label: 'Date', sortable: true },
  { key: 'day_of_week', label: 'Day', sortable: true },
  { key: 'net_revenue', label: 'Net Revenue', align: 'right', mono: true, sortable: true },
  { key: 'total_invoices', label: 'Invoices', align: 'right', mono: true, sortable: true },
  { key: 'avg_bill', label: 'Avg Bill', align: 'right', mono: true, sortable: true },
  { key: 'total_discount', label: 'Discount', align: 'right', mono: true, sortable: true },
  { key: 'service_charge', label: 'SC', align: 'right', mono: true, sortable: true },
  { key: 'total_gst', label: 'GST', align: 'right', mono: true, sortable: true },
]

export default function MonthlyDetail() {
  const { currency, fxRates } = useSettingsStore()
  const [kpiData, setKpiData] = useState({})
  const [dailyData, setDailyData] = useState({})
  const [catChData, setCatChData] = useState({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(null)
  const [catToggle, setCatToggle] = useState('bar')

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
        const months = Object.keys(kRes.data || {}).sort()
        if (months.length > 0) setActiveTab(months[months.length - 1])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const months = Object.keys(kpiData).sort()
  const prevMonthIdx = months.indexOf(activeTab) - 1
  const prevMonthKey = prevMonthIdx >= 0 ? months[prevMonthIdx] : null
  const current = kpiData[activeTab] || {}
  const prev = kpiData[prevMonthKey] || {}

  // Daily data for current tab
  const dailyRows = (dailyData[activeTab] || []).map(r => ({
    ...r,
    net_revenue: fc(r.net_revenue, false, currency, fxRates),
    avg_bill: fc(r.avg_bill, false, currency, fxRates),
    total_discount: fc(r.total_discount, false, currency, fxRates),
    service_charge: fc(r.service_charge, false, currency, fxRates),
    total_gst: fc(r.total_gst, false, currency, fxRates),
  }))

  // Daily bar chart
  const rawDaily = dailyData[activeTab] || []
  const dailyChartData = {
    labels: rawDaily.map(r => r.date || ''),
    datasets: [
      {
        type: 'bar',
        label: 'Net Revenue',
        data: rawDaily.map(r => r.net_revenue || 0),
        backgroundColor: '#6958C2aa',
        borderRadius: 3,
        yAxisID: 'y',
      },
      {
        type: 'line',
        label: 'Avg Bill',
        data: rawDaily.map(r => r.avg_bill || 0),
        borderColor: '#f59e0b',
        backgroundColor: 'transparent',
        pointRadius: 3,
        tension: 0.4,
        yAxisID: 'y1',
      }
    ]
  }

  const dualAxisOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'top', labels: { font: { family: 'DM Sans', size: 11 }, color: '#6b6890' } } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 10 }, color: '#a8a6c0', maxRotation: 45 } },
      y: { grid: { color: '#f0eefb' }, ticks: { font: { family: 'DM Sans', size: 11 }, color: '#6958C2' } },
      y1: { position: 'right', grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 11 }, color: '#f59e0b' } },
    }
  }

  // DOW avg
  const dowAgg = {}; const dowCount = {}
  rawDaily.forEach(r => {
    const d = r.day_of_week
    if (d) {
      dowAgg[d] = (dowAgg[d] || 0) + (r.net_revenue || 0)
      dowCount[d] = (dowCount[d] || 0) + 1
    }
  })

  // Category
  const catData = catChData[activeTab]?.categories || {}
  const catKeys = Object.keys(catData)

  // Channel
  const chData2 = catChData[activeTab]?.channels || {}
  const chKeys = Object.keys(chData2)

  const donutOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'right', labels: { font: { family: 'DM Sans', size: 11 }, color: '#6b6890', boxWidth: 12 } } }
  }

  if (!loading && months.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <span className="text-5xl">📅</span>
        <h2 className="font-sans font-semibold text-t1 text-xl">No Data Uploaded</h2>
        <p className="text-t2 font-sans text-sm">Upload revenue data in Admin to get started.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Month Tabs */}
      <div className="flex gap-2 flex-wrap">
        {months.map(m => (
          <button
            key={m}
            onClick={() => setActiveTab(m)}
            className="px-4 py-2 rounded-xl text-sm font-sans font-medium transition-colors"
            style={{
              background: activeTab === m ? 'linear-gradient(135deg,#6958C2,#8878D8)' : '#fff',
              color: activeTab === m ? '#fff' : '#6b6890',
              border: `1px solid ${activeTab === m ? '#6958C2' : '#e8e6f0'}`,
              cursor: 'pointer',
            }}
          >
            {m}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Net Revenue" value={fc(current.net_revenue, true, currency, fxRates)}
          trend={momBadge(current.net_revenue, prev.net_revenue)} icon="💰" color="#6958C2" loading={loading} />
        <KpiCard title="Gross Revenue" value={fc(current.gross_revenue, true, currency, fxRates)}
          trend={momBadge(current.gross_revenue, prev.gross_revenue)} icon="📈" color="#22c55e" loading={loading} />
        <KpiCard title="Invoices" value={current.total_invoices?.toLocaleString() ?? '—'}
          trend={momBadge(current.total_invoices, prev.total_invoices)} icon="🧾" color="#3b82f6" loading={loading} />
        <KpiCard title="Avg Bill" value={fc(current.avg_bill, false, currency, fxRates)}
          trend={momBadge(current.avg_bill, prev.avg_bill)} icon="🧮" color="#f59e0b" loading={loading} />
        <KpiCard title="Discount" value={fc(current.total_discount, true, currency, fxRates)}
          subtitle={fmtPct((current.total_discount||0) / (current.gross_revenue||1))} icon="🏷️" color="#ec4899" loading={loading} />
        <KpiCard title="Service Charge" value={fc(current.service_charge, true, currency, fxRates)}
          icon="🔧" color="#8b5cf6" loading={loading} />
        <KpiCard title="GST" value={fc(current.total_gst, true, currency, fxRates)}
          icon="🧾" color="#06b6d4" loading={loading} />
        <KpiCard title="Cancellations" value={current.cancellations?.toLocaleString() ?? '—'}
          icon="❌" color="#ef4444" loading={loading} />
      </div>

      {/* Daily bar+line chart */}
      <ChartCard title={`Daily Revenue & Avg Bill — ${activeTab || ''}`} loading={loading} height={280}
        csvData={rawDaily} csvFilename={`daily_${activeTab}.csv`}
      >
        <Bar data={dailyChartData} options={dualAxisOpts} />
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* DOW */}
        <ChartCard title="Revenue by Day of Week" loading={loading}>
          <Bar data={{
            labels: DOW,
            datasets: [{
              data: DOW.map(d => dowAgg[d] ? Math.round(dowAgg[d] / dowCount[d]) : 0),
              backgroundColor: '#6958C2cc', borderRadius: 6
            }]
          }} options={CHART_OPTS} />
        </ChartCard>

        {/* Category */}
        <ChartCard title="Category Mix"
          toggles={[{ value: 'bar', label: 'Bar' }, { value: 'donut', label: 'Donut' }]}
          activeToggle={catToggle} onToggle={setCatToggle} loading={loading}
        >
          {catToggle === 'bar'
            ? <Bar data={{ labels: catKeys, datasets: [{ data: catKeys.map(k => catData[k]), backgroundColor: catKeys.map(k => CAT_COLORS[k] || '#94a3b8'), borderRadius: 6 }] }} options={CHART_OPTS} />
            : <Doughnut data={{ labels: catKeys, datasets: [{ data: catKeys.map(k => catData[k]), backgroundColor: catKeys.map(k => CAT_COLORS[k] || '#94a3b8'), borderWidth: 2, borderColor: '#fff' }] }} options={donutOpts} />
          }
        </ChartCard>

        {/* Channel */}
        <ChartCard title="Channel Mix" loading={loading}>
          <Doughnut data={{ labels: chKeys, datasets: [{ data: chKeys.map(k => chData2[k]), backgroundColor: chKeys.map(k => CHANNEL_COLORS[k] || '#94a3b8'), borderWidth: 2, borderColor: '#fff' }] }} options={donutOpts} />
        </ChartCard>
      </div>

      {/* Daily Summary Table */}
      <DataTable
        title={`Daily Summary — ${activeTab || ''}`}
        columns={DAILY_COLUMNS}
        data={dailyRows}
        csvFilename={`daily_detail_${activeTab}.csv`}
        loading={loading}
        searchable={false}
      />
    </div>
  )
}
