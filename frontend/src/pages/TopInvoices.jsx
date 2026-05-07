import React, { useEffect, useState, useMemo } from 'react'
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
import { fc, fmt12h } from '../utils/formatters'
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

const TOP_N_OPTIONS = [10, 20, 30, 50, 100]

export default function TopInvoices() {
  const { currency, fxRates } = useSettingsStore()
  const { selectedMonths } = useFilterStore()
  const [invoicesData, setInvoicesData] = useState({})
  const [kpiData, setKpiData] = useState({})
  const [loading, setLoading] = useState(true)
  const [topN, setTopN] = useState(20)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [iRes, kRes] = await Promise.all([
          api.get('/data/top-invoices').catch(() => ({ data: {} })),
          api.get('/data/kpi').catch(() => ({ data: {} })),
        ])
        setInvoicesData(iRes.data || {})
        setKpiData(kRes.data || {})
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const months = Object.keys(kpiData).sort()
  const filteredMonths = selectedMonths.length > 0 ? months.filter(m => selectedMonths.includes(m)) : months

  const allInvoices = useMemo(() => {
    const rows = []
    filteredMonths.forEach(m => {
      (invoicesData[m] || []).forEach(inv => rows.push(inv))
    })
    return rows.sort((a, b) => (b.net_revenue || b.total || 0) - (a.net_revenue || a.total || 0))
  }, [invoicesData, filteredMonths])

  const topInvoices = allInvoices.slice(0, topN)

  const highestBill = topInvoices[0]?.net_revenue || topInvoices[0]?.total || 0
  const avgTopN = topInvoices.length > 0
    ? topInvoices.reduce((s, r) => s + (r.net_revenue || r.total || 0), 0) / topInvoices.length : 0
  const totalRevAll = filteredMonths.reduce((s, m) => s + (kpiData[m]?.net_revenue || 0), 0)
  const topNTotal = topInvoices.reduce((s, r) => s + (r.net_revenue || r.total || 0), 0)
  const topNPct = totalRevAll > 0 ? topNTotal / totalRevAll : 0

  // Channel donut
  const chAgg = {}
  topInvoices.forEach(r => {
    const ch = r.channel || 'Unknown'
    chAgg[ch] = (chAgg[ch] || 0) + (r.net_revenue || r.total || 0)
  })
  const chKeys = Object.keys(chAgg)

  // Hour bar
  const hourAgg = {}
  topInvoices.forEach(r => {
    if (r.hour != null) {
      const h = parseInt(r.hour)
      hourAgg[h] = (hourAgg[h] || 0) + 1
    }
  })
  const hours = Array.from({ length: 13 }, (_, i) => i + 11)

  const tableData = topInvoices.map((r, i) => ({
    rank: i + 1,
    date: r.date || '—',
    day: r.day_of_week || '—',
    time: r.hour != null ? fmt12h(parseInt(r.hour)) : '—',
    table: r.table || '—',
    channel: r.channel || '—',
    net_revenue: fc(r.net_revenue || 0, false, currency, fxRates),
    discount: fc(r.discount || 0, false, currency, fxRates),
    service_charge: fc(r.service_charge || 0, false, currency, fxRates),
    total: fc((r.net_revenue || 0) + (r.service_charge || 0) + (r.gst || 0), false, currency, fxRates),
  }))

  const donutOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'right', labels: { font: { family: 'DM Sans', size: 11 }, color: '#6b6890', boxWidth: 12 } } }
  }

  if (!loading && months.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <span className="text-5xl">🏆</span>
        <h2 className="font-sans font-semibold text-t1 text-xl">No Data Uploaded</h2>
        <p className="text-t2 font-sans text-sm">Upload revenue data in Admin to get started.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <FilterBar months={months} categories={[]} channels={[]} />

      {/* Top N selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-sans font-medium text-t2">Show Top:</span>
        {TOP_N_OPTIONS.map(n => (
          <button key={n} onClick={() => setTopN(n)}
            className="px-3 py-1.5 rounded-lg text-xs font-sans font-medium transition-colors"
            style={{ background: topN === n ? '#6958C2' : '#fff', color: topN === n ? '#fff' : '#6b6890', border: `1px solid ${topN === n ? '#6958C2' : '#e8e6f0'}`, cursor: 'pointer' }}>
            {n}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard title={`Highest Bill`} value={fc(highestBill, false, currency, fxRates)}
          icon="🏆" color="#6958C2" loading={loading} />
        <KpiCard title={`Avg of Top ${topN}`} value={fc(avgTopN, false, currency, fxRates)}
          icon="📊" color="#22c55e" loading={loading} />
        <KpiCard title={`Top ${topN} as % of Total`} value={topNPct ? (topNPct * 100).toFixed(1) + '%' : '—'}
          subtitle="revenue concentration" icon="📈" color="#f59e0b" loading={loading} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Top Invoices by Channel" loading={loading}>
          <Doughnut data={{ labels: chKeys, datasets: [{ data: chKeys.map(k => chAgg[k]), backgroundColor: chKeys.map(k => CHANNEL_COLORS[k] || '#94a3b8'), borderWidth: 2, borderColor: '#fff' }] }} options={donutOpts} />
        </ChartCard>

        <ChartCard title="Top Invoices by Hour" loading={loading}>
          <Bar data={{
            labels: hours.map(h => fmt12h(h)),
            datasets: [{
              data: hours.map(h => hourAgg[h] || 0),
              backgroundColor: '#6958C2cc',
              borderRadius: 4,
            }]
          }} options={CHART_OPTS} />
        </ChartCard>
      </div>

      {/* Data Table */}
      <DataTable
        title={`Top ${topN} Invoices`}
        columns={[
          { key: 'rank', label: '#', align: 'center', sortable: false },
          { key: 'date', label: 'Date' },
          { key: 'day', label: 'Day' },
          { key: 'time', label: 'Time' },
          { key: 'table', label: 'Table' },
          { key: 'channel', label: 'Channel' },
          { key: 'net_revenue', label: 'Net Revenue', align: 'right', mono: true },
          { key: 'discount', label: 'Discount', align: 'right', mono: true },
          { key: 'service_charge', label: 'SC', align: 'right', mono: true },
          { key: 'total', label: 'Total', align: 'right', mono: true },
        ]}
        data={tableData}
        csvFilename={`top_${topN}_invoices.csv`}
        loading={loading}
        searchable={true}
      />
    </div>
  )
}
