import React, { useEffect, useState } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import api from '../utils/api'
import KpiCard from '../components/KpiCard'
import ChartCard from '../components/ChartCard'
import PageFilters from '../components/PageFilters'
import { fc, fmtPct } from '../utils/formatters'
import useSettingsStore from '../store/settingsStore'
import useFilterStore from '../store/filterStore'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend)

const CHART_OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { position: 'top', labels: { font: { family: 'DM Sans', size: 11 }, color: '#6b6890' } } },
  scales: {
    x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 11 }, color: '#a8a6c0' } },
    y: { grid: { color: '#f0eefb' }, ticks: { font: { family: 'DM Sans', size: 11 }, color: '#a8a6c0' } },
  }
}

export default function Targets() {
  const { currency, fxRates } = useSettingsStore()
  const { selectedMonths, geo } = useFilterStore()
  const storeCode = geo.outlet || undefined
  const [kpiData, setKpiData] = useState({})
  const [targets, setTargets] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [kRes, tRes] = await Promise.all([
          api.get('/data/kpi', { params: storeCode ? { store_code: storeCode } : {} }).catch(() => ({ data: {} })),
          api.get('/settings/targets').catch(() => ({ data: {} })),
        ])
        setKpiData(kRes.data || {})
        setTargets(tRes.data || {})
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [storeCode])

  const months = Object.keys(kpiData).sort()
  // Apply filter — show only selected months; fall back to all
  const filtered = selectedMonths.length > 0
    ? selectedMonths.filter(m => months.includes(m))
    : months

  async function saveTargets() {
    setSaving(true)
    try {
      await api.post('/settings/targets', targets)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  function handleTargetChange(month, value) {
    setTargets(prev => ({ ...prev, [month]: parseFloat(value) || 0 }))
  }

  // Summary KPIs from latest filtered month
  const latestMonth = filtered[filtered.length - 1]
  const latest = kpiData[latestMonth] || {}
  const latestTarget = targets[latestMonth] || 0
  const achieved = latestTarget > 0 ? latest.net_revenue / latestTarget : 0
  const daysInMonth = 30
  const dayOfMonth = new Date().getDate()
  const projected = latest.net_revenue > 0 ? (latest.net_revenue / dayOfMonth) * daysInMonth : 0

  // Chart — filtered months only
  const chartData = {
    labels: filtered,
    datasets: [
      {
        label: 'Actual Revenue',
        data: filtered.map(m => kpiData[m]?.net_revenue || 0),
        backgroundColor: '#6958C2cc',
        borderRadius: 6,
      },
      {
        label: 'Target',
        data: filtered.map(m => targets[m] || 0),
        backgroundColor: '#22c55ecc',
        borderRadius: 6,
      }
    ]
  }

  if (!loading && months.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <span className="text-5xl">🎯</span>
        <h2 className="font-sans font-semibold text-t1 text-xl">No Data Uploaded</h2>
        <p className="text-t2 font-sans text-sm">Upload revenue data in Admin to get started.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageFilters months={months} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Latest Month Revenue" value={fc(latest.net_revenue, true, currency, fxRates)} icon="💰" color="#6958C2" loading={loading} />
        <KpiCard title="Latest Month Target" value={fc(latestTarget, true, currency, fxRates)} icon="🎯" color="#22c55e" loading={loading} />
        <KpiCard title="Achievement%" value={fmtPct(achieved)} icon="📊"
          color={achieved >= 1 ? '#22c55e' : achieved >= 0.8 ? '#f59e0b' : '#ef4444'} loading={loading} />
        <KpiCard title="Projected Month-End" value={fc(projected, true, currency, fxRates)} icon="🔮" color="#8b5cf6" loading={loading} subtitle={`based on ${dayOfMonth} days`} />
      </div>

      {/* Chart — filtered months */}
      <ChartCard title="Actual vs Target Revenue"
        csvData={filtered.map(m => ({ month: m, actual: kpiData[m]?.net_revenue || 0, target: targets[m] || 0 }))}
        csvFilename="targets.csv" loading={loading}
      >
        <Bar data={chartData} options={CHART_OPTS} />
      </ChartCard>

      {/* Target input fields + progress — all months so you can set targets for any month */}
      <div className="bg-white rounded-xl p-6 flex flex-col gap-5" style={{ border: '1px solid #f0eefb', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
        <div className="flex items-center justify-between">
          <h3 className="font-sans font-semibold text-t1">Monthly Targets</h3>
          <button
            onClick={saveTargets}
            disabled={saving}
            className="px-5 py-2 rounded-xl text-white font-sans font-semibold text-sm transition-all"
            style={{ background: saving ? '#a8a6c0' : 'linear-gradient(135deg,#6958C2,#8878D8)', cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Saving...' : 'Save Targets'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {months.map(month => {
            const actual = kpiData[month]?.net_revenue || 0
            const target = targets[month] || 0
            const pct = target > 0 ? Math.min(actual / target, 1) : 0
            const color = pct >= 1 ? '#22c55e' : pct >= 0.8 ? '#f59e0b' : '#6958C2'

            return (
              <div key={month} className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="font-sans font-semibold text-t1 text-sm">{month}</span>
                  <span className="font-mono text-sm text-t2">
                    {fc(actual, true, currency, fxRates)} / {target > 0 ? fc(target, true, currency, fxRates) : 'no target'}
                  </span>
                </div>
                <input
                  type="number"
                  value={targets[month] || ''}
                  onChange={e => handleTargetChange(month, e.target.value)}
                  placeholder="Enter target revenue (INR)"
                  className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
                  style={{ border: '1px solid #e8e6f0', color: '#1a1830' }}
                />
                {target > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-sans text-t3">Progress</span>
                      <span className="text-xs font-sans font-medium" style={{ color }}>
                        {(pct * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: '#f0eefb' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct * 100}%`, background: color }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
