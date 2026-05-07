import React from 'react'
import useFilterStore from '../store/filterStore'
import { CAT_COLORS, CAT_ICONS, CHANNEL_COLORS } from '../utils/colors'

export default function FilterBar({ months = [], categories = [], channels = [] }) {
  const {
    selectedMonths, selectedYears, selectedCategories, selectedChannels, selectedStatus,
    filtersOpen, setMonths, setYears, setCategories, setChannels, setStatus,
    toggleFilters, clearAll,
  } = useFilterStore()

  const totalActive = selectedMonths.length + selectedYears.length + selectedCategories.length + selectedChannels.length

  function toggleItem(arr, setArr, item) {
    if (arr.includes(item)) setArr(arr.filter(x => x !== item))
    else setArr([...arr, item])
  }

  // Extract unique years from months list
  const availableYears = [...new Set(months.map(m => {
    const parts = m.split('-')
    return parts[1] || parts[0]
  }))].sort()

  const MONTH_LABELS = {
    '01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'May','06':'Jun',
    '07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec'
  }

  return (
    <div
      className="rounded-xl mb-5 overflow-hidden"
      style={{ border: '1px solid #e8e6f0', background: '#fff' }}
    >
      {/* Toggle bar */}
      <button
        onClick={toggleFilters}
        className="w-full flex items-center justify-between px-5 py-3 transition-colors hover:bg-gray-50"
        style={{ cursor: 'pointer', background: 'transparent' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-sans font-semibold text-t1">⚡ Filters & Slicers</span>
          {totalActive > 0 && (
            <span
              className="text-xs font-sans font-medium px-2 py-0.5 rounded-full"
              style={{ background: '#6958C2', color: '#fff' }}
            >
              {totalActive}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Summary pills when collapsed */}
          {!filtersOpen && totalActive > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {selectedMonths.map(m => (
                <span key={m} className="text-xs px-2 py-0.5 rounded-full font-sans"
                  style={{ background: '#f0eefb', color: '#6958C2' }}>{m}</span>
              ))}
              {selectedCategories.map(c => (
                <span key={c} className="text-xs px-2 py-0.5 rounded-full font-sans"
                  style={{ background: (CAT_COLORS[c] || '#94a3b8') + '22', color: CAT_COLORS[c] || '#94a3b8' }}>
                  {CAT_ICONS[c] || ''} {c}
                </span>
              ))}
              {selectedChannels.map(c => (
                <span key={c} className="text-xs px-2 py-0.5 rounded-full font-sans"
                  style={{ background: (CHANNEL_COLORS[c] || '#94a3b8') + '22', color: CHANNEL_COLORS[c] || '#94a3b8' }}>
                  {c}
                </span>
              ))}
            </div>
          )}
          <span className="text-t3 text-sm">{filtersOpen ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Filter panel */}
      {filtersOpen && (
        <div className="px-5 pb-5" style={{ borderTop: '1px solid #f0eefb' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mt-4">

            {/* Year */}
            {availableYears.length > 0 && (
              <div>
                <div className="text-xs font-sans font-semibold text-t2 uppercase tracking-wide mb-2">Year</div>
                <div className="flex flex-wrap gap-1.5">
                  {availableYears.map(y => (
                    <button
                      key={y}
                      onClick={() => toggleItem(selectedYears, setYears, y)}
                      className="px-3 py-1 rounded-lg text-sm font-sans font-medium transition-colors"
                      style={{
                        background: selectedYears.includes(y) ? '#6958C2' : '#f5f4fb',
                        color: selectedYears.includes(y) ? '#fff' : '#6b6890',
                        border: selectedYears.includes(y) ? '1px solid #6958C2' : '1px solid #e8e6f0',
                        cursor: 'pointer',
                      }}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Month */}
            {months.length > 0 && (
              <div>
                <div className="text-xs font-sans font-semibold text-t2 uppercase tracking-wide mb-2">Month</div>
                <div className="flex flex-wrap gap-1.5">
                  {months.map(m => {
                    const parts = m.split('-')
                    const label = parts.length >= 2
                      ? (MONTH_LABELS[parts[0]] || parts[0]) + ' ' + parts[1]
                      : m
                    return (
                      <button
                        key={m}
                        onClick={() => toggleItem(selectedMonths, setMonths, m)}
                        className="px-3 py-1 rounded-lg text-sm font-sans font-medium transition-colors"
                        style={{
                          background: selectedMonths.includes(m) ? '#6958C2' : '#f5f4fb',
                          color: selectedMonths.includes(m) ? '#fff' : '#6b6890',
                          border: selectedMonths.includes(m) ? '1px solid #6958C2' : '1px solid #e8e6f0',
                          cursor: 'pointer',
                        }}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Category */}
            {categories.length > 0 && (
              <div>
                <div className="text-xs font-sans font-semibold text-t2 uppercase tracking-wide mb-2">Category</div>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map(c => {
                    const color = CAT_COLORS[c] || '#94a3b8'
                    const icon = CAT_ICONS[c] || '📦'
                    const sel = selectedCategories.includes(c)
                    return (
                      <button
                        key={c}
                        onClick={() => toggleItem(selectedCategories, setCategories, c)}
                        className="px-3 py-1 rounded-lg text-sm font-sans font-medium transition-colors flex items-center gap-1"
                        style={{
                          background: sel ? color : color + '18',
                          color: sel ? '#fff' : color,
                          border: `1px solid ${color}${sel ? '' : '44'}`,
                          cursor: 'pointer',
                        }}
                      >
                        <span>{icon}</span> {c}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Channel */}
            {channels.length > 0 && (
              <div>
                <div className="text-xs font-sans font-semibold text-t2 uppercase tracking-wide mb-2">Channel</div>
                <div className="flex flex-wrap gap-1.5">
                  {channels.map(c => {
                    const color = CHANNEL_COLORS[c] || '#94a3b8'
                    const sel = selectedChannels.includes(c)
                    return (
                      <button
                        key={c}
                        onClick={() => toggleItem(selectedChannels, setChannels, c)}
                        className="px-3 py-1 rounded-lg text-sm font-sans font-medium transition-colors"
                        style={{
                          background: sel ? color : color + '18',
                          color: sel ? '#fff' : color,
                          border: `1px solid ${color}${sel ? '' : '44'}`,
                          cursor: 'pointer',
                        }}
                      >
                        {c}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Status + Clear */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-sans font-semibold text-t2 uppercase tracking-wide">Status:</span>
              {['Active', 'All', 'Inactive'].map(s => (
                <label key={s} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value={s}
                    checked={selectedStatus === s}
                    onChange={() => setStatus(s)}
                    style={{ accentColor: '#6958C2' }}
                  />
                  <span className="text-sm font-sans text-t1">{s}</span>
                </label>
              ))}
            </div>
            {totalActive > 0 && (
              <button
                onClick={clearAll}
                className="text-xs font-sans font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{ border: '1px solid #e8e6f0', color: '#6b6890', background: '#fff', cursor: 'pointer' }}
              >
                Clear All
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
