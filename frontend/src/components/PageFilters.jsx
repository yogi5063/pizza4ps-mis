import React, { useEffect, useMemo, useState } from 'react'
import useFilterStore from '../store/filterStore'
import api from '../utils/api'
import { CAT_COLORS, CAT_ICONS, CHANNEL_COLORS } from '../utils/colors'
import { MONTHS, PRESETS, resolveMonths, monthLabel, timeSummary } from '../utils/timeFilter'

const PUR = '#6958C2'
const sel = { background: PUR, color: '#fff', border: `1px solid ${PUR}`, cursor: 'pointer' }
const unsel = { background: '#f5f4fb', color: '#6b6890', border: '1px solid #e8e6f0', cursor: 'pointer' }
const inp = { border: '1px solid #e8e6f0', color: '#1a1830', background: '#fff', borderRadius: 8, padding: '6px 10px', fontSize: 13 }

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

  // geography masters (once)
  useEffect(() => {
    api.get('/masters/tree').then(r => setTree(r.data || { countries: [] })).catch(() => {})
  }, [])

  const monthsKey = months.join(',')
  const availYears = useMemo(
    () => [...new Set(months.map(m => m.slice(0, 4)))].sort(),
    [monthsKey],
  )
  const sortedMonths = useMemo(() => [...months].sort(), [monthsKey])

  // Resolve abstract selection -> concrete selectedMonths whenever inputs change.
  const resolved = useMemo(
    () => resolveMonths(months, s),
    [monthsKey, s.preset, s.timeMode, s.fYear, s.fMonth, s.rFrom, s.rTo],
  )
  useEffect(() => { s.setSelectedMonths(resolved) }, [resolved.join(',')])

  // geography option lists
  const countries = tree.countries || []
  const curCountry = countries.find(c => c.name === s.geo.country)
  const locations = curCountry?.locations || []
  const curLoc = locations.find(l => l.name === s.geo.location)
  const outlets = curLoc?.outlets || []

  function setGeo(patch) { s.setGeo({ ...s.geo, ...patch }) }

  function pickPreset(key) {
    s.setTime({ preset: key, fYear: 'all', fMonth: 'all', rFrom: null, rTo: null })
  }
  function setSingle(patch) { s.setTime({ preset: null, timeMode: 'single', ...patch }) }
  function setRange(patch) { s.setTime({ preset: null, timeMode: 'range', ...patch }) }

  const toggle = (arr, setter, v) => setter(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v])

  const geoSummary = [s.geo.country || 'All Countries', s.geo.location || 'All Locations', s.geo.outlet || 'All Outlets'].join(' / ')
  const nSlicers = s.selectedCategories.length + s.selectedChannels.length

  return (
    <div className="rounded-xl mb-5 overflow-hidden bg-white" style={{ border: '1px solid #e8e6f0' }}>
      {/* toggle header */}
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
        <div className="px-5 pb-5 pt-1 flex flex-col gap-4" style={{ borderTop: '1px solid #f0eefb' }}>
          {/* Geography */}
          <div className="flex flex-wrap items-center gap-2 pt-3">
            <span className="text-xs font-sans font-semibold text-t2 uppercase tracking-wide w-20">Location</span>
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

          {/* Time presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-sans font-semibold text-t2 uppercase tracking-wide w-20">Period</span>
            {PRESETS.map(p => (
              <button key={p.key} onClick={() => pickPreset(p.key)}
                className="px-3 py-1 rounded-lg text-xs font-sans font-medium"
                style={s.preset === p.key ? sel : unsel}>{p.label}</button>
            ))}
          </div>

          {/* Precise pick: single or range */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-sans font-semibold text-t2 uppercase tracking-wide w-20">Or pick</span>
            <div className="flex gap-1 mr-1">
              <button onClick={() => setSingle({})} className="px-3 py-1 rounded-lg text-xs font-sans font-medium"
                style={s.preset === null && s.timeMode === 'single' ? sel : unsel}>Single</button>
              <button onClick={() => setRange({})} className="px-3 py-1 rounded-lg text-xs font-sans font-medium"
                style={s.preset === null && s.timeMode === 'range' ? sel : unsel}>Range</button>
            </div>
            {s.preset === null && s.timeMode === 'single' && (
              <>
                <Dropdown value={s.fYear} onChange={v => setSingle({ fYear: v })} minW={100}>
                  <option value="all">All years</option>
                  {availYears.map(y => <option key={y} value={y}>{y}</option>)}
                </Dropdown>
                <Dropdown value={s.fMonth} onChange={v => setSingle({ fMonth: v })} minW={110}>
                  <option value="all">All months</option>
                  {MONTHS.map(([n, lbl]) => <option key={n} value={n}>{lbl}</option>)}
                </Dropdown>
              </>
            )}
            {s.preset === null && s.timeMode === 'range' && (
              <>
                <Dropdown value={s.rFrom || ''} onChange={v => setRange({ rFrom: v || null })} minW={130}>
                  <option value="">From…</option>
                  {sortedMonths.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
                </Dropdown>
                <span className="text-t3">→</span>
                <Dropdown value={s.rTo || ''} onChange={v => setRange({ rTo: v || null })} minW={130}>
                  <option value="">To…</option>
                  {sortedMonths.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
                </Dropdown>
              </>
            )}
            <span className="text-xs font-sans text-t3 ml-1">{resolved.length} month{resolved.length !== 1 ? 's' : ''} selected</span>
          </div>

          {/* Category / Channel slicers (optional per page) */}
          {(categories.length > 0 || channels.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categories.length > 0 && (
                <div>
                  <div className="text-xs font-sans font-semibold text-t2 uppercase tracking-wide mb-2">Category</div>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map(c => {
                      const color = CAT_COLORS[c] || '#94a3b8'; const on = s.selectedCategories.includes(c)
                      return <button key={c} onClick={() => toggle(s.selectedCategories, s.setCategories, c)}
                        className="px-3 py-1 rounded-lg text-sm font-sans font-medium flex items-center gap-1"
                        style={{ background: on ? color : color + '18', color: on ? '#fff' : color, border: `1px solid ${color}${on ? '' : '44'}`, cursor: 'pointer' }}>
                        <span>{CAT_ICONS[c] || '📦'}</span> {c}</button>
                    })}
                  </div>
                </div>
              )}
              {channels.length > 0 && (
                <div>
                  <div className="text-xs font-sans font-semibold text-t2 uppercase tracking-wide mb-2">Channel</div>
                  <div className="flex flex-wrap gap-1.5">
                    {channels.map(c => {
                      const color = CHANNEL_COLORS[c] || '#94a3b8'; const on = s.selectedChannels.includes(c)
                      return <button key={c} onClick={() => toggle(s.selectedChannels, s.setChannels, c)}
                        className="px-3 py-1 rounded-lg text-sm font-sans font-medium"
                        style={{ background: on ? color : color + '18', color: on ? '#fff' : color, border: `1px solid ${color}${on ? '' : '44'}`, cursor: 'pointer' }}>{c}</button>
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3">
              <span className="text-xs font-sans font-semibold text-t2 uppercase tracking-wide">Status:</span>
              {['Active', 'All', 'Inactive'].map(st => (
                <label key={st} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="pf-status" checked={s.selectedStatus === st}
                    onChange={() => s.setStatus(st)} style={{ accentColor: PUR }} />
                  <span className="text-sm font-sans text-t1">{st}</span>
                </label>
              ))}
            </div>
            <button onClick={s.clearAll} className="text-xs font-sans font-medium px-3 py-1.5 rounded-lg"
              style={{ border: '1px solid #e8e6f0', color: '#6b6890', background: '#fff', cursor: 'pointer' }}>Reset</button>
          </div>
        </div>
      )}
    </div>
  )
}
