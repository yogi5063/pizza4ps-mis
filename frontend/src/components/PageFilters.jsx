import React, { useEffect, useMemo, useState } from 'react'
import useFilterStore from '../store/filterStore'
import api from '../utils/api'
import { CAT_COLORS, CAT_ICONS, CHANNEL_COLORS } from '../utils/colors'
import { MONTHS, PRESETS, resolveMonths, monthLabel, timeSummary } from '../utils/timeFilter'

const PUR = '#6958C2'
const sel = { background: PUR, color: '#fff', border: `1px solid ${PUR}`, cursor: 'pointer' }
const unsel = { background: '#f5f4fb', color: '#6b6890', border: '1px solid #e8e6f0', cursor: 'pointer' }
const inp = { border: '1px solid #e8e6f0', color: '#1a1830', background: '#fff', borderRadius: 8, padding: '6px 10px', fontSize: 13 }

function Btn({ active, onClick, children, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="px-3 py-1 rounded-lg text-xs font-sans font-medium"
      style={active ? sel : unsel}>
      {children}
    </button>
  )
}

function Dropdown({ value, onChange, children, minW = 120 }) {
  return (
    <select value={value ?? ''} onChange={e => onChange(e.target.value)}
      className="font-sans outline-none" style={{ ...inp, minWidth: minW }}>
      {children}
    </select>
  )
}

export default function PageFilters({ months = [], categories = [], channels = [] }) {
  const s = useFilterStore()
  const [tree, setTree] = useState({ countries: [] })

  useEffect(() => {
    api.get('/masters/tree').then(r => setTree(r.data || { countries: [] })).catch(() => {})
  }, [])

  const monthsKey = months.join(',')
  const availYears = useMemo(
    () => [...new Set(months.map(m => m.slice(0, 4)))].sort(),
    [monthsKey],
  )
  const sortedMonths = useMemo(() => [...months].sort(), [monthsKey])

  // Resolve abstract selection → concrete selectedMonths whenever inputs change
  const resolved = useMemo(
    () => resolveMonths(months, s),
    [monthsKey, s.preset, s.timeMode, s.fYear, s.fMonth, s.rFrom, s.rTo],
  )
  useEffect(() => { s.setSelectedMonths(resolved) }, [resolved.join(',')])

  // Geography option lists
  const countries = tree.countries || []
  const curCountry = countries.find(c => c.name === s.geo.country)
  const locations = curCountry?.locations || []
  const curLoc = locations.find(l => l.name === s.geo.location)
  const outlets = curLoc?.outlets || []

  function setGeo(patch) { s.setGeo({ ...s.geo, ...patch }) }
  function pickPreset(key) { s.setTime({ preset: key, fYear: 'all', fMonth: 'all', rFrom: null, rTo: null }) }
  function pickYear(y) { s.setTime({ preset: null, timeMode: 'single', fYear: y }) }
  function pickMonth(m) { s.setTime({ preset: null, timeMode: 'single', fMonth: m }) }
  function switchRange() { s.setTime({ preset: null, timeMode: 'range', rFrom: null, rTo: null }) }
  function switchSingle() { s.setTime({ timeMode: 'single' }) }

  const toggle = (arr, setter, v) => setter(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v])

  const isRange = s.preset === null && s.timeMode === 'range'
  const isSingle = s.timeMode === 'single'

  const geoSummary = [s.geo.outlet ? `Outlet: ${s.geo.outlet}` : s.geo.location ? s.geo.location : s.geo.country || 'All Outlets'].join('')
  const nSlicers = s.selectedCategories.length + s.selectedChannels.length

  return (
    <div className="rounded-xl mb-5 overflow-hidden bg-white" style={{ border: '1px solid #e8e6f0' }}>
      {/* Collapsed header */}
      <button onClick={s.toggleFilters}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50"
        style={{ cursor: 'pointer', background: 'transparent' }}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-sans font-semibold text-t1">🔎 Filters</span>
          <span className="text-xs font-sans" style={{ color: '#6b6890' }}>
            {geoSummary} · {timeSummary(months, s, resolved)}
            {nSlicers > 0 ? ` · ${nSlicers} slicer${nSlicers > 1 ? 's' : ''}` : ''}
          </span>
        </div>
        <span className="text-t3 text-sm">{s.filtersOpen ? '▲' : '▼'}</span>
      </button>

      {s.filtersOpen && (
        <div className="px-5 pb-5 pt-3 flex flex-col gap-4" style={{ borderTop: '1px solid #f0eefb' }}>

          {/* Location / Outlet */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-sans font-semibold text-t2 uppercase tracking-wide" style={{ width: 80 }}>Outlet</span>
            <Dropdown value={s.geo.country || ''} onChange={v => setGeo({ country: v || null, location: null, outlet: null })}>
              <option value="">All Countries</option>
              {countries.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </Dropdown>
            <Dropdown value={s.geo.location || ''} onChange={v => setGeo({ location: v || null, outlet: null })} minW={140}>
              <option value="">All Locations</option>
              {locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
            </Dropdown>
            <Dropdown value={s.geo.outlet || ''} onChange={v => setGeo({ outlet: v || null })} minW={160}>
              <option value="">All Outlets</option>
              {outlets.map(o => <option key={o.id} value={o.code}>{o.name} ({o.code})</option>)}
            </Dropdown>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-sans font-semibold text-t2 uppercase tracking-wide" style={{ width: 80 }}>Quick</span>
            {PRESETS.map(p => (
              <Btn key={p.key} active={s.preset === p.key} onClick={() => pickPreset(p.key)}>{p.label}</Btn>
            ))}
          </div>

          {/* Period Mode toggle */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-sans font-semibold text-t2 uppercase tracking-wide" style={{ width: 80 }}>Period</span>
            <Btn active={isSingle} onClick={switchSingle}>Single Period</Btn>
            <Btn active={isRange} onClick={switchRange}>Date Range</Btn>
          </div>

          {/* Year buttons (shown when not in Date Range mode) */}
          {!isRange && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-sans font-semibold text-t2 uppercase tracking-wide" style={{ width: 80 }}>Year</span>
              <Btn active={s.preset !== null || s.fYear === 'all'} onClick={() => pickYear('all')}>All</Btn>
              {availYears.map(y => (
                <Btn key={y} active={s.preset === null && s.fYear === y} onClick={() => pickYear(y)}>{y}</Btn>
              ))}
            </div>
          )}

          {/* Month buttons (shown when not in Date Range mode) */}
          {!isRange && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-sans font-semibold text-t2 uppercase tracking-wide" style={{ width: 80 }}>Month</span>
              <Btn active={s.preset !== null || s.fMonth === 'all'} onClick={() => pickMonth('all')}>All</Btn>
              {MONTHS.map(([n, lbl]) => (
                <Btn key={n} active={s.preset === null && s.fMonth === n} onClick={() => pickMonth(n)}>{lbl}</Btn>
              ))}
            </div>
          )}

          {/* Date range: From / To dropdowns */}
          {isRange && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-sans font-semibold text-t2 uppercase tracking-wide" style={{ width: 80 }}>Range</span>
              <Dropdown value={s.rFrom || ''} onChange={v => s.setTime({ rFrom: v || null })} minW={130}>
                <option value="">From…</option>
                {sortedMonths.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </Dropdown>
              <span className="text-t3 font-sans">→</span>
              <Dropdown value={s.rTo || ''} onChange={v => s.setTime({ rTo: v || null })} minW={130}>
                <option value="">To…</option>
                {sortedMonths.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </Dropdown>
            </div>
          )}

          {/* Category / Channel slicers (optional per page) */}
          {(categories.length > 0 || channels.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categories.length > 0 && (
                <div>
                  <div className="text-xs font-sans font-semibold text-t2 uppercase tracking-wide mb-2">Category</div>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map(c => {
                      const color = CAT_COLORS[c] || '#94a3b8'
                      const on = s.selectedCategories.includes(c)
                      return (
                        <button key={c} onClick={() => toggle(s.selectedCategories, s.setCategories, c)}
                          className="px-3 py-1 rounded-lg text-sm font-sans font-medium flex items-center gap-1"
                          style={{ background: on ? color : color + '18', color: on ? '#fff' : color, border: `1px solid ${color}${on ? '' : '44'}`, cursor: 'pointer' }}>
                          <span>{CAT_ICONS[c] || '📦'}</span> {c}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              {channels.length > 0 && (
                <div>
                  <div className="text-xs font-sans font-semibold text-t2 uppercase tracking-wide mb-2">Channel</div>
                  <div className="flex flex-wrap gap-1.5">
                    {channels.map(c => {
                      const color = CHANNEL_COLORS[c] || '#94a3b8'
                      const on = s.selectedChannels.includes(c)
                      return (
                        <button key={c} onClick={() => toggle(s.selectedChannels, s.setChannels, c)}
                          className="px-3 py-1 rounded-lg text-sm font-sans font-medium"
                          style={{ background: on ? color : color + '18', color: on ? '#fff' : color, border: `1px solid ${color}${on ? '' : '44'}`, cursor: 'pointer' }}>
                          {c}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-sans" style={{ color: '#6b6890' }}>
              {resolved.length} month{resolved.length !== 1 ? 's' : ''} selected
            </span>
            <button onClick={s.clearAll} className="text-xs font-sans font-medium px-3 py-1.5 rounded-lg"
              style={{ border: '1px solid #e8e6f0', color: '#6b6890', background: '#fff', cursor: 'pointer' }}>
              Reset filters
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
