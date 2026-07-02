import React, { useEffect, useState } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend
} from 'chart.js'
import { Bar, Line, Doughnut } from 'react-chartjs-2'
import api from '../utils/api'
import KpiCard from '../components/KpiCard'
import ChartCard from '../components/ChartCard'
import AlertsPanel from '../components/AlertsPanel'
import PageFilters from '../components/PageFilters'
import { fc, momBadge, fmt12h } from '../utils/formatters'
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

export default function DailyFlash() {
  const { currency, fxRates } = useSettingsStore()
  const { selectedMonths } = useFilterStore()
  const [kpiData, setKpiData] = useState({})
  const [catChData, setCatChData] = useState({})
  const [itemsData, setItemsData] = useState({})
  const [loading, setLoading] = useState(true)
  const [chartType, setChartType] = useState('line')
  const [catToggle, setCatToggle] = useState('donut')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [kRes, cRes, iRes] = await Promise.all([
          api.get('/data/kpi').catch(() => ({ data: {} })),
          api.get('/data/cat-ch').catch(() => ({ data: {} })),
          api.get('/data/items').catch(() => ({ data: {} })),
        ])
        setKpiData(kRes.data || {})
        setCatChData(cRes.data || {})
        setItemsData(iRes.data || {})
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const months = Object.keys(kpiData).sort()
  // Apply filter: if selectedMonths is populated, show only those months
  const filtered = selectedMonths.length > 0 ? selectedMonths : months

  const latestMonth = filtered[filtered.length - 1]
  const prevMonth = filtered[filtered.length - 2]
  const latest = kpiData[latestMonth] || {}
  const prev = kpiData[prevMonth] || {}

  // Monthly trend chart data — filtered months only
  const trendData = {
    labels: filtered,
    datasets: [{
      label: 'Net Revenue',
      data: filtered.map(m => kpiData[m]?.net_revenue || 0),
      borderColor: '#6958C2',
      backgroundColor: chartType === 'bar' ? '#6958C2cc' : 'rgba(105,88,194,0.15)',
      fill: chartType !== 'bar',
      tension: 0.4,
      pointRadius: 4,
      pointBackgroundColor: '#6958C2',
    }]
  }

  // Top 5 items — aggregate over filtered months only
  const allItems = filtered.flatMap(m => itemsData[m] || [])
  const itemAgg = {}
  allItems.forEach(item => {
    if (!item?.item_name) return
    if (!itemAgg[item.item_name]) itemAgg[item.item_name] = 0
    itemAgg[item.item_name] += item.net_revenue || 0
  })
  const top5 = Object.entries(itemAgg).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const top5Data = {
    labels: top5.map(([n]) => n.length > 20 ? n.slice(0, 20) + '…' : n),
    datasets: [{
      label: 'Revenue',
      data: top5.map(([, v]) => v),
      backgroundColor: ['#6958C2', '#8878D8', '#a89ee8', '#c4b8ff', '#e0daff'],
      borderRadius: 6,
    }]
  }

  // Category donut — aggregate over filtered months only
  const catAgg = {}
  filtered.map(m => catChData[m]).filter(Boolean).forEach(monthData => {
    if (!monthData?.categories) return
    Object.entries(monthData.categories).forEach(([cat, val]) => {
      catAgg[cat] = (catAgg[cat] || 0) + (val || 0)
    })
  })
  const catKeys = Object.keys(catAgg)
  const catData = {
    labels: catKeys,
    datasets: [{
      data: catKeys.map(k => catAgg[k]),
      backgroundColor: catKeys.map(k => CAT_COLORS[k] || '#94a3b8'),
      borderWidth: 2,
      borderColor: '#fff',
    }]
  }

  // Channel bar — aggregate over filtered months only
  const chAgg = {}
  filtered.map(m => catChData[m]).filter(Boolean).forEach(monthData => {
    if (!monthData?.channels) return
    Object.entries(monthData.channels).forEach(([ch, val]) => {
      chAgg[ch] = (chAgg[ch] || 0) + (val || 0)
    })
  })
  const chKeys = Object.keys(chAgg)
  const chData = {
    labels: chKeys,
    datasets: [{
      label: 'Revenue',
      data: chKeys.map(k => chAgg[k]),
      backgroundColor: chKeys.map(k => CHANNEL_COLORS[k] || '#94a3b8'),
      borderRadius: 6,
    }]
  }

  const donutOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { font: { family: 'DM Sans', size: 11 }, color: '#6b6890', boxWidth: 12 } }
    }
  }

  const noData = months.length === 0 && !loading

  if (noData) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <span className="text-5xl">📊</span>
        <h2 className="font-sans font-semibold text-t1 text-xl">No Data Uploaded</h2>
        <p className="text-t2 font-sans text-sm">Upload revenue data in Admin to get started.</p>
        <a href="/admin" className="px-5 py-2 rounded-xl text-white font-sans font-semibold text-sm"
          style={{ background: 'linear-gradient(135deg,#6958C2,#8878D8)' }}>
          Go to Admin →
        </a>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageFilters months={months} />

      <AlertsPanel kpiData={kpiData} monthsList={months} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard
          title="Net Revenue"
          value={fc(latest.net_revenue, true, currency, fxRates)}
          trend={momBadge(latest.net_revenue, prev.net_revenue)}
          subtitle={latestMonth}
          icon="💰"
          color="#6958C2"
          loading={loading}
        />
        <KpiCard
          title="Gross Revenue"
          value={fc(latest.gross_revenue, true, currency, fxRates)}
          trend={momBadge(latest.gross_revenue, prev.gross_revenue)}
          subtitle="incl. GST & SC"
          icon="📈"
          color="#22c55e"
          loading={loading}
        />
        <KpiCard
          title="Total Invoices"
          value={latest.total_invoices?.toLocaleString() ?? '—'}
          trend={momBadge(latest.total_invoices, prev.total_invoices)}
          subtitle="covers"
          icon="🧾"
          color="#3b82f6"
          loading={loading}
        />
        <KpiCard
          title="Avg Bill"
          value={fc(latest.avg_bill, false, currency, fxRates)}
          trend={momBadge(latest.avg_bill, prev.avg_bill)}
          subtitle="per invoice"
          icon="🧮"
          color="#f59e0b"
          loading={loading}
        />
        <KpiCard
          title="Cancellations"
          value={latest.cancellations?.toLocaleString() ?? '—'}
          trend={latest.cancellations != null && prev.cancellations != null
            ? { ...momBadge(latest.cancellations, prev.cancellations), positive: (latest.cancellations - prev.cancellations) <= 0 }
            : null}
          subtitle="void invoices"
          icon="❌"
          color="#ec4899"
          loading={loading}
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Monthly Revenue Trend"
          toggles={[{ value: 'line', label: 'Line' }, { value: 'bar', label: 'Bar' }]}
          activeToggle={chartType}
          onToggle={setChartType}
          loading={loading}
          csvData={filtered.map(m => ({ month: m, net_revenue: kpiData[m]?.net_revenue || 0 }))}
          csvFilename="monthly_trend.csv"
        >
          {chartType === 'line'
            ? <Line data={trendData} options={CHART_OPTS} />
            : <Bar data={trendData} options={CHART_OPTS} />
          }
        </ChartCard>

        <ChartCard
          title="Top 5 Items by Revenue"
          toggles={[{ value: 'bar', label: 'Bar' }]}
          activeToggle="bar"
          loading={loading}
          csvData={top5.map(([n, v]) => ({ item: n, revenue: v }))}
          csvFilename="top5_items.csv"
        >
          <Bar
            data={top5Data}
            options={{
              ...CHART_OPTS,
              indexAxis: 'y',
              scales: {
                x: { grid: { color: '#f0eefb' }, ticks: { font: { family: 'DM Sans', size: 11 }, color: '#a8a6c0' } },
                y: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 11 }, color: '#a8a6c0' } },
              }
            }}
          />
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Revenue by Category"
          toggles={[{ value: 'donut', label: 'Donut' }, { value: 'bar', label: 'Bar' }]}
          activeToggle={catToggle}
          onToggle={setCatToggle}
          loading={loading}
          csvData={catKeys.map(k => ({ category: k, revenue: catAgg[k] }))}
          csvFilename="category_revenue.csv"
        >
          {catToggle === 'donut'
            ? <Doughnut data={catData} options={donutOpts} />
            : <Bar data={{
                labels: catKeys,
                datasets: [{ data: catKeys.map(k => catAgg[k]), backgroundColor: catKeys.map(k => CAT_COLORS[k] || '#94a3b8'), borderRadius: 6 }]
              }} options={CHART_OPTS} />
          }
        </ChartCard>

        <ChartCard
          title="Revenue by Channel"
          toggles={[{ value: 'bar', label: 'Bar' }, { value: 'donut', label: 'Donut' }]}
          activeToggle="bar"
          loading={loading}
          csvData={chKeys.map(k => ({ channel: k, revenue: chAgg[k] }))}
          csvFilename="channel_revenue.csv"
        >
          <Bar data={chData} options={CHART_OPTS} />
        </ChartCard>
      </div>
    </div>
  )
}
