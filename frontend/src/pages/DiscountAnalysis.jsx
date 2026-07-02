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
import PageFilters from '../components/PageFilters'
import { fc, fmtPct, momBadge } from '../utils/formatters'
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

export default function DiscountAnalysis() {
  const { currency, fxRates } = useSettingsStore()
  const { selectedMonths, geo } = useFilterStore()
  const storeCode = geo.outlet || undefined
  const [discountData, setDiscountData] = useState({})
  const [kpiData, setKpiData] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [dRes, kRes] = await Promise.all([
          api.get('/data/discount', { params: storeCode ? { store_code: storeCode } : {} }).catch(() => ({ data: {} })),
          api.get('/data/kpi', { params: storeCode ? { store_code: storeCode } : {} }).catch(() => ({ data: {} })),
        ])
        setDiscountData(dRes.data || {})
        setKpiData(kRes.data || {})
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [storeCode])

  const months = Object.keys(kpiData).sort()
  const filteredMonths = selectedMonths.length > 0 ? months.filter(m => selectedMonths.includes(m)) : months

  const totalDiscount = filteredMonths.reduce((s, m) => s + (kpiData[m]?.total_discount || 0), 0)
  const totalRevenue = filteredMonths.reduce((s, m) => s + (kpiData[m]?.gross_revenue || 0), 0)
  const discPct = totalRevenue > 0 ? totalDiscount / totalRevenue : 0

  const latestMonth = filteredMonths[filteredMonths.length - 1]
  const prevMonth = filteredMonths.length >= 2 ? filteredMonths[filteredMonths.length - 2] : null

  // Channel discount aggregation
  const chAgg = useMemo(() => {
    const agg = {}
    filteredMonths.forEach(m => {
      const d = discountData[m]?.by_channel || {}
      Object.entries(d).forEach(([ch, v]) => {
        agg[ch] = (agg[ch] || 0) + v
      })
    })
    return agg
  }, [discountData, filteredMonths])

  const highestChannel = Object.entries(chAgg).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
  const chKeys = Object.keys(chAgg)

  // Discount% by channel
  const chRevAgg = useMemo(() => {
    const agg = {}
    filteredMonths.forEach(m => {
      const d = discountData[m]?.channel_revenue || {}
      Object.entries(d).forEach(([ch, v]) => { agg[ch] = (agg[ch] || 0) + v })
    })
    return agg
  }, [discountData, filteredMonths])

  const chDiscPct = chKeys.map(ch => chRevAgg[ch] > 0 ? (chAgg[ch] / chRevAgg[ch]) * 100 : 0)

  // Top discounted items
  const itemDiscAgg = useMemo(() => {
    const agg = {}
    filteredMonths.forEach(m => {
      const items = discountData[m]?.by_item || []
      items.forEach(item => {
        if (!item?.item_name) return
        if (!agg[item.item_name]) agg[item.item_name] = { item_name: item.item_name, category: item.category, discount: 0, revenue: 0 }
        agg[item.item_name].discount += item.discount || 0
        agg[item.item_name].revenue += item.revenue || 0
      })
    })
    return Object.values(agg)
      .sort((a, b) => b.discount - a.discount)
      .map(r => ({
        item_name: r.item_name,
        category: r.category,
        discount: fc(r.discount, false, currency, fxRates),
        revenue: fc(r.revenue, false, currency, fxRates),
        disc_pct: fmtPct(r.revenue > 0 ? r.discount / r.revenue : 0),
      }))
  }, [discountData, filteredMonths, currency, fxRates])

  const donutOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'right', labels: { font: { family: 'DM Sans', size: 11 }, color: '#6b6890', boxWidth: 12 } } }
  }

  if (!loading && months.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <span className="text-5xl">🏷️</span>
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
        <KpiCard title="Total Discount" value={fc(totalDiscount, true, currency, fxRates)}
          trend={momBadge(kpiData[latestMonth]?.total_discount, kpiData[prevMonth]?.total_discount)}
          icon="🏷️" color="#ec4899" loading={loading} />
        <KpiCard title="Discount %" value={fmtPct(discPct)}
          subtitle="of gross revenue" icon="📉" color="#f59e0b" loading={loading} />
        <KpiCard title="Highest Channel" value={highestChannel}
          subtitle={chAgg[highestChannel] ? fc(chAgg[highestChannel], true, currency, fxRates) : '—'}
          icon="📊" color="#3b82f6" loading={loading} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Discount by Channel" loading={loading}
          csvData={chKeys.map(k => ({ channel: k, discount: chAgg[k] }))} csvFilename="discount_by_channel.csv"
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

        <ChartCard title="Discount% of Revenue by Channel" loading={loading}>
          <Bar data={{
            labels: chKeys,
            datasets: [{
              label: 'Discount%',
              data: chDiscPct,
              backgroundColor: chKeys.map(k => CHANNEL_COLORS[k] || '#94a3b8'),
              borderRadius: 6,
            }]
          }} options={{
            ...CHART_OPTS,
            scales: {
              x: CHART_OPTS.scales.x,
              y: { ...CHART_OPTS.scales.y, ticks: { ...CHART_OPTS.scales.y.ticks, callback: v => v.toFixed(1) + '%' } }
            }
          }} />
        </ChartCard>
      </div>

      {/* Top Discounted Items */}
      <DataTable
        title="Top Discounted Items"
        columns={[
          { key: 'item_name', label: 'Item', wrap: true },
          { key: 'category', label: 'Category' },
          { key: 'discount', label: 'Discount Amount', align: 'right', mono: true },
          { key: 'revenue', label: 'Revenue', align: 'right', mono: true },
          { key: 'disc_pct', label: 'Disc%', align: 'right' },
        ]}
        data={itemDiscAgg}
        csvFilename="top_discounted_items.csv"
        loading={loading}
        topNOptions={true}
        defaultTopN={20}
      />
    </div>
  )
}
