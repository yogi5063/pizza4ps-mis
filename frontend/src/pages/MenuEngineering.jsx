import React, { useEffect, useState, useMemo } from 'react'
import {
  Chart as ChartJS, LinearScale, PointElement, LineElement, Tooltip, Legend
} from 'chart.js'
import { Scatter } from 'react-chartjs-2'
import api from '../utils/api'
import DataTable from '../components/DataTable'
import PageFilters from '../components/PageFilters'
import { fc, fmtPct } from '../utils/formatters'
import useSettingsStore from '../store/settingsStore'
import useFilterStore from '../store/filterStore'
import { CAT_COLORS } from '../utils/colors'

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend)

const QUADRANT_COLORS = {
  Star: '#22c55e',
  'Plow Horse': '#3b82f6',
  Puzzle: '#f59e0b',
  Dog: '#ef4444',
}

function getQuadrant(qty, gpPct, avgQty, targetGp) {
  const highQty = qty >= avgQty
  const highGp = gpPct >= targetGp
  if (highQty && highGp) return 'Star'
  if (highQty && !highGp) return 'Plow Horse'
  if (!highQty && highGp) return 'Puzzle'
  return 'Dog'
}

export default function MenuEngineering() {
  const { currency, fxRates } = useSettingsStore()
  const { selectedMonths, selectedCategories } = useFilterStore()
  const [menuData, setMenuData] = useState([])
  const [loading, setLoading] = useState(true)
  const [targetGp, setTargetGp] = useState(0.65)
  const [noDataMsg, setNoDataMsg] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await api.get('/data/menu').catch(() => ({ data: {} }))
        const data = res.data || {}
        const menuItems = data.menu_engineering || []
        setMenuData(Array.isArray(menuItems) ? menuItems : [])
        if (menuItems.length === 0) setNoDataMsg(true)
      } catch {
        setMenuData([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filteredMenu = useMemo(() => {
    let d = menuData
    if (selectedCategories.length) d = d.filter(r => selectedCategories.includes(r.category))
    return d
  }, [menuData, selectedCategories])

  const availableCategories = [...new Set(menuData.map(r => r.category).filter(Boolean))]

  const avgQty = useMemo(() => {
    if (filteredMenu.length === 0) return 0
    return filteredMenu.reduce((s, r) => s + (r.qty || 0), 0) / filteredMenu.length
  }, [filteredMenu])

  const enriched = useMemo(() => {
    return filteredMenu.map(r => {
      const stdCog = r.std_cog || r.cog_per_unit || 0
      const sellingPrice = r.selling_price || r.avg_price || 0
      const cogPct = sellingPrice > 0 ? stdCog / sellingPrice : 0
      const gpPct = 1 - cogPct
      const recPrice = targetGp < 1 ? stdCog / (1 - targetGp) : 0
      const quadrant = getQuadrant(r.qty || 0, gpPct, avgQty, targetGp)
      return { ...r, stdCog, sellingPrice, cogPct, gpPct, recPrice, quadrant }
    })
  }, [filteredMenu, avgQty, targetGp])

  // Scatter data by quadrant
  const scatterDatasets = Object.entries(QUADRANT_COLORS).map(([quad, color]) => {
    const points = enriched.filter(r => r.quadrant === quad)
    return {
      label: `${quad} (${points.length})`,
      data: points.map(r => ({ x: r.qty || 0, y: r.gpPct * 100, label: r.dish_name || r.item_name || r.name || '?' })),
      backgroundColor: color + 'cc',
      pointRadius: 7,
      pointHoverRadius: 9,
    }
  })

  const tableData = useMemo(() => enriched.map(r => ({
    dish: r.dish_name || r.item_name || r.name || '—',
    category: r.category || '—',
    selling_price: fc(r.sellingPrice, false, currency, fxRates),
    std_cog: fc(r.stdCog, false, currency, fxRates),
    cog_pct: fmtPct(r.cogPct),
    gp_pct: fmtPct(r.gpPct),
    qty: (r.qty || 0).toLocaleString(),
    rec_price: r.recPrice > 0 ? fc(r.recPrice, false, currency, fxRates) : '—',
    quadrant: r.quadrant,
    flag: r.quadrant === 'Star' ? '⭐' : r.quadrant === 'Plow Horse' ? '🐴' : r.quadrant === 'Puzzle' ? '🔶' : '🐕',
    gpPct_raw: r.gpPct,
  })), [enriched, currency, fxRates])

  if (!loading && menuData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <span className="text-5xl">⭐</span>
        <h2 className="font-sans font-semibold text-t1 text-xl">No Menu Data Available</h2>
        <p className="text-t2 font-sans text-sm">Menu engineering requires item-level sales + costing data.</p>
        <a href="/admin" className="px-5 py-2 rounded-xl text-white font-sans font-semibold text-sm"
          style={{ background: 'linear-gradient(135deg,#6958C2,#8878D8)' }}>Go to Admin →</a>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageFilters months={[]} categories={availableCategories} channels={[]} />

      {/* Controls */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-sans font-medium text-t2">Target GP%:</label>
          <input
            type="number"
            value={Math.round(targetGp * 100)}
            onChange={e => setTargetGp(Math.min(parseFloat(e.target.value) / 100, 0.99))}
            min={0} max={99} step={1}
            className="w-20 px-3 py-1.5 rounded-lg text-sm font-sans outline-none"
            style={{ border: '1px solid #e8e6f0', color: '#1a1830' }}
          />
          <span className="text-sm font-sans text-t2">%</span>
        </div>

        {/* Quadrant legend */}
        <div className="flex items-center gap-3">
          {Object.entries(QUADRANT_COLORS).map(([q, c]) => (
            <div key={q} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ background: c }} />
              <span className="text-xs font-sans text-t2">{q}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scatter plot */}
      <div className="bg-white rounded-xl p-5" style={{ border: '1px solid #f0eefb', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
        <div className="font-sans font-semibold text-t1 text-sm mb-4">Menu Engineering Matrix (Qty vs GP%)</div>
        <div style={{ height: 420, position: 'relative' }}>
          {loading ? (
            <div className="absolute inset-0 rounded-lg animate-pulse flex items-center justify-center" style={{ background: '#f8f7fd' }}>
              <span className="text-t3 text-sm font-sans">Loading...</span>
            </div>
          ) : (
            <Scatter
              data={{ datasets: scatterDatasets }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top',
                    labels: { font: { family: 'DM Sans', size: 11 }, color: '#6b6890' }
                  },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => {
                        const pt = ctx.raw
                        return `${pt.label}: Qty=${ctx.parsed.x}, GP=${ctx.parsed.y.toFixed(1)}%`
                      }
                    }
                  }
                },
                scales: {
                  x: {
                    grid: { color: '#f0eefb' },
                    ticks: { font: { family: 'DM Sans', size: 11 }, color: '#a8a6c0' },
                    title: { display: true, text: 'Quantity Sold', font: { family: 'DM Sans', size: 11 }, color: '#6b6890' },
                  },
                  y: {
                    grid: { color: '#f0eefb' },
                    ticks: { font: { family: 'DM Sans', size: 11 }, color: '#a8a6c0', callback: v => v + '%' },
                    title: { display: true, text: 'Gross Profit %', font: { family: 'DM Sans', size: 11 }, color: '#6b6890' },
                    min: 0,
                    max: 100,
                  }
                }
              }}
            />
          )}
        </div>

        {/* Quadrant annotations */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            { q: 'Star ⭐', desc: 'High Qty + High GP — Promote', color: '#22c55e' },
            { q: 'Plow Horse 🐴', desc: 'High Qty + Low GP — Reprice', color: '#3b82f6' },
            { q: 'Puzzle 🔶', desc: 'Low Qty + High GP — Market More', color: '#f59e0b' },
            { q: 'Dog 🐕', desc: 'Low Qty + Low GP — Consider Removing', color: '#ef4444' },
          ].map(item => (
            <div key={item.q} className="rounded-lg p-3" style={{ background: item.color + '12', border: `1px solid ${item.color}33` }}>
              <div className="text-xs font-sans font-semibold mb-1" style={{ color: item.color }}>{item.q}</div>
              <div className="text-xs font-sans text-t2">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        title="Menu Engineering Detail"
        columns={[
          { key: 'dish', label: 'Dish', wrap: true },
          { key: 'category', label: 'Category' },
          { key: 'selling_price', label: 'Selling Price', align: 'right', mono: true },
          { key: 'std_cog', label: 'Std COG', align: 'right', mono: true },
          { key: 'cog_pct', label: 'COG%', align: 'right' },
          {
            key: 'gp_pct', label: 'GP%', align: 'right',
            render: (val, row) => (
              <span style={{ color: row.gpPct_raw >= targetGp ? '#22c55e' : row.gpPct_raw >= targetGp * 0.8 ? '#f59e0b' : '#ef4444', fontWeight: 600 }}>
                {val}
              </span>
            )
          },
          { key: 'qty', label: 'Qty Sold', align: 'right', mono: true },
          { key: 'rec_price', label: 'Rec. Price', align: 'right', mono: true },
          { key: 'quadrant', label: 'Quadrant' },
          { key: 'flag', label: 'Flag', align: 'center', sortable: false },
        ]}
        data={tableData}
        csvFilename="menu_engineering.csv"
        loading={loading}
        topNOptions={true}
        defaultTopN={0}
      />
    </div>
  )
}
