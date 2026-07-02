import React, { useEffect, useState, useMemo } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import api from '../utils/api'
import DataTable from '../components/DataTable'
import ChartCard from '../components/ChartCard'
import PageFilters from '../components/PageFilters'
import CategoryIconCard from '../components/CategoryIconCard'
import { fc, fmtPct } from '../utils/formatters'
import useSettingsStore from '../store/settingsStore'
import useFilterStore from '../store/filterStore'
import { CAT_COLORS } from '../utils/colors'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend)

const CHART_OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 10 }, color: '#a8a6c0', maxRotation: 45 } },
    y: { grid: { color: '#f0eefb' }, ticks: { font: { family: 'DM Sans', size: 11 }, color: '#a8a6c0' } },
  }
}

const TABS = ['Revenue Ranking', 'Period Compare', 'Trend Analysis', 'Category Deep Dive', 'Combo Analysis']

const PALETTE = ['#6958C2', '#22c55e', '#f59e0b', '#3b82f6', '#ec4899']

export default function ItemAnalysis() {
  const { currency, fxRates } = useSettingsStore()
  const { selectedMonths, selectedCategories } = useFilterStore()
  const [itemsData, setItemsData] = useState({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(0)
  const [drillCat, setDrillCat] = useState(null)
  const [trendItems, setTrendItems] = useState([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await api.get('/data/items').catch(() => ({ data: {} }))
        setItemsData(res.data || {})
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const months = Object.keys(itemsData).sort()
  const filteredMonths = selectedMonths.length > 0 ? months.filter(m => selectedMonths.includes(m)) : months

  // Aggregate items across filtered months
  const itemAgg = useMemo(() => {
    const agg = {}
    filteredMonths.forEach(m => {
      (itemsData[m] || []).forEach(item => {
        if (!item?.item_name) return
        if (selectedCategories.length && !selectedCategories.includes(item.category)) return
        const k = item.item_name
        if (!agg[k]) agg[k] = { item_name: k, category: item.category, net_revenue: 0, qty: 0, discount: 0, total_revenue: 0 }
        agg[k].net_revenue += item.net_revenue || 0
        agg[k].qty += item.qty || 0
        agg[k].discount += item.discount || 0
        agg[k].total_revenue += item.gross_revenue || item.net_revenue || 0
      })
    })
    return Object.values(agg)
  }, [itemsData, filteredMonths, selectedCategories])

  const totalRev = itemAgg.reduce((s, r) => s + r.net_revenue, 0)

  const rankingData = useMemo(() =>
    itemAgg.sort((a, b) => b.net_revenue - a.net_revenue).map((r, i) => ({
      rank: i + 1,
      item_name: r.item_name,
      category: r.category,
      net_revenue: fc(r.net_revenue, false, currency, fxRates),
      qty: r.qty?.toLocaleString(),
      avg_price: r.qty > 0 ? fc(r.net_revenue / r.qty, false, currency, fxRates) : '—',
      discount: fc(r.discount, false, currency, fxRates),
      rev_share: fmtPct(totalRev > 0 ? r.net_revenue / totalRev : 0),
    })), [itemAgg, currency, fxRates, totalRev])

  const availableCategories = [...new Set(Object.values(itemsData).flat().map(i => i?.category).filter(Boolean))]
  const catRevMap = useMemo(() => {
    const m = {}
    itemAgg.forEach(r => {
      if (!r.category) return
      m[r.category] = (m[r.category] || 0) + r.net_revenue
    })
    return m
  }, [itemAgg])

  const drillItems = useMemo(() => {
    if (!drillCat) return []
    return itemAgg.filter(r => r.category === drillCat)
      .sort((a, b) => b.net_revenue - a.net_revenue)
      .map(r => ({
        item_name: r.item_name,
        net_revenue: fc(r.net_revenue, false, currency, fxRates),
        qty: r.qty?.toLocaleString(),
      }))
  }, [drillCat, itemAgg, currency, fxRates])

  // Period compare matrix
  const matrixItems = useMemo(() => {
    const allItems = [...new Set(filteredMonths.flatMap(m => (itemsData[m] || []).map(i => i?.item_name).filter(Boolean)))]
    return allItems.slice(0, 30).map(name => {
      const row = { item_name: name }
      filteredMonths.forEach(m => {
        const found = (itemsData[m] || []).find(i => i?.item_name === name)
        row[m] = found ? fc(found.net_revenue, false, currency, fxRates) : '—'
      })
      return row
    })
  }, [filteredMonths, itemsData, currency, fxRates])

  const matrixCols = [
    { key: 'item_name', label: 'Item' },
    ...filteredMonths.map(m => ({ key: m, label: m, align: 'right', mono: true }))
  ]

  // Trend chart for selected items
  const trendData = useMemo(() => {
    const items = trendItems.length > 0 ? trendItems : (itemAgg.slice(0, 3).map(r => r.item_name))
    return {
      labels: filteredMonths,
      datasets: items.map((name, i) => ({
        label: name,
        data: filteredMonths.map(m => {
          const found = (itemsData[m] || []).find(r => r?.item_name === name)
          return found?.net_revenue || 0
        }),
        borderColor: PALETTE[i % PALETTE.length],
        backgroundColor: 'transparent',
        tension: 0.4,
        pointRadius: 4,
      }))
    }
  }, [filteredMonths, itemsData, trendItems, itemAgg])

  if (!loading && months.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <span className="text-5xl">🍽️</span>
        <h2 className="font-sans font-semibold text-t1 text-xl">No Data Uploaded</h2>
        <p className="text-t2 font-sans text-sm">Upload revenue data in Admin to get started.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageFilters months={months} categories={availableCategories} channels={[]} />

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1.5 w-fit" style={{ border: '1px solid #f0eefb' }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)}
            className="px-4 py-2 rounded-lg text-sm font-sans font-medium transition-colors"
            style={{
              background: tab === i ? '#6958C2' : 'transparent',
              color: tab === i ? '#fff' : '#6b6890',
              cursor: 'pointer',
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 0 && (
        <DataTable
          title="Revenue Ranking"
          columns={[
            { key: 'rank', label: '#', align: 'center', sortable: false },
            { key: 'item_name', label: 'Item', wrap: true },
            { key: 'category', label: 'Category' },
            { key: 'net_revenue', label: 'Net Revenue', align: 'right', mono: true },
            { key: 'qty', label: 'Qty', align: 'right', mono: true },
            { key: 'avg_price', label: 'Avg Price', align: 'right', mono: true },
            { key: 'discount', label: 'Discount', align: 'right', mono: true },
            { key: 'rev_share', label: 'Rev Share', align: 'right' },
          ]}
          data={rankingData}
          csvFilename="item_ranking.csv"
          loading={loading}
          topNOptions={true}
          defaultTopN={20}
        />
      )}

      {tab === 1 && (
        <DataTable
          title="Period Comparison"
          columns={matrixCols}
          data={matrixItems}
          csvFilename="item_period_compare.csv"
          loading={loading}
        />
      )}

      {tab === 2 && (
        <div className="flex flex-col gap-5">
          <div className="bg-white rounded-xl p-4 flex flex-col gap-3" style={{ border: '1px solid #f0eefb' }}>
            <div className="text-sm font-sans font-semibold text-t1">Select items to plot trends (top 5 default):</div>
            <div className="flex flex-wrap gap-2">
              {itemAgg.slice(0, 15).map(r => (
                <button key={r.item_name}
                  onClick={() => {
                    if (trendItems.includes(r.item_name)) setTrendItems(trendItems.filter(x => x !== r.item_name))
                    else if (trendItems.length < 5) setTrendItems([...trendItems, r.item_name])
                  }}
                  className="px-3 py-1 rounded-lg text-xs font-sans font-medium transition-colors"
                  style={{
                    background: trendItems.includes(r.item_name) ? '#6958C2' : '#f5f4fb',
                    color: trendItems.includes(r.item_name) ? '#fff' : '#6b6890',
                    border: `1px solid ${trendItems.includes(r.item_name) ? '#6958C2' : '#e8e6f0'}`,
                    cursor: 'pointer',
                  }}>
                  {r.item_name}
                </button>
              ))}
            </div>
          </div>
          <ChartCard title="Item Revenue Trend" loading={loading}>
            <Line data={trendData} options={{ ...CHART_OPTS, plugins: { legend: { position: 'top', labels: { font: { family: 'DM Sans', size: 11 }, color: '#6b6890' } } } }} />
          </ChartCard>
        </div>
      )}

      {tab === 3 && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-3">
            {Object.keys(catRevMap).map(cat => (
              <CategoryIconCard key={cat} category={cat} value={catRevMap[cat]}
                selected={drillCat === cat} onClick={() => setDrillCat(drillCat === cat ? null : cat)} />
            ))}
          </div>
          {drillCat && (
            <DataTable
              title={`${drillCat} — Item Breakdown`}
              columns={[
                { key: 'item_name', label: 'Item', wrap: true },
                { key: 'net_revenue', label: 'Net Revenue', align: 'right', mono: true },
                { key: 'qty', label: 'Qty', align: 'right', mono: true },
              ]}
              data={drillItems}
              csvFilename={`${drillCat}_items.csv`}
              loading={loading}
            />
          )}
        </div>
      )}

      {tab === 4 && (
        <div className="flex flex-col items-center justify-center h-64 gap-3 bg-white rounded-xl" style={{ border: '1px solid #f0eefb' }}>
          <span className="text-4xl">🔗</span>
          <h3 className="font-sans font-semibold text-t1 text-lg">Combo Analysis</h3>
          <p className="text-t2 font-sans text-sm text-center max-w-xs">
            Coming soon — requires invoice-level item pair data. Enable in backend to unlock this feature.
          </p>
        </div>
      )}
    </div>
  )
}
