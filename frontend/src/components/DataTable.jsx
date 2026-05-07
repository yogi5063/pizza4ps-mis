import React, { useState, useMemo } from 'react'
import { exportCSV } from '../utils/formatters'

const TOP_N_OPTIONS = [
  { label: 'All', value: 0 },
  { label: 'Top 10', value: 10 },
  { label: 'Top 20', value: 20 },
  { label: 'Top 50', value: 50 },
]

export default function DataTable({
  columns = [],
  data = [],
  csvFilename,
  loading = false,
  topNOptions = false,
  defaultTopN = 0,
  searchable = true,
  title,
  compact = false,
}) {
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('desc')
  const [search, setSearch] = useState('')
  const [topN, setTopN] = useState(defaultTopN)

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const filtered = useMemo(() => {
    let d = [...data]
    if (search.trim()) {
      const q = search.toLowerCase()
      d = d.filter(row =>
        columns.some(col => String(row[col.key] ?? '').toLowerCase().includes(q))
      )
    }
    if (sortKey) {
      d.sort((a, b) => {
        const av = a[sortKey]
        const bv = b[sortKey]
        if (typeof av === 'number' && typeof bv === 'number') {
          return sortDir === 'asc' ? av - bv : bv - av
        }
        return sortDir === 'asc'
          ? String(av ?? '').localeCompare(String(bv ?? ''))
          : String(bv ?? '').localeCompare(String(av ?? ''))
      })
    }
    if (topN > 0) d = d.slice(0, topN)
    return d
  }, [data, search, sortKey, sortDir, topN, columns])

  const exportData = useMemo(() => {
    return filtered.map(row => {
      const obj = {}
      columns.forEach(col => { obj[col.label] = row[col.key] ?? '' })
      return obj
    })
  }, [filtered, columns])

  return (
    <div
      className="bg-white rounded-xl overflow-hidden"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)', border: '1px solid #f0eefb' }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 flex-wrap" style={{ borderBottom: '1px solid #f0eefb' }}>
        <span className="font-sans font-semibold text-t1 text-sm">{title || ''}</span>
        <div className="flex items-center gap-2">
          {topNOptions && (
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #e8e6f0' }}>
              {TOP_N_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTopN(opt.value)}
                  className="px-2 py-1 text-xs font-sans font-medium transition-colors"
                  style={{
                    background: topN === opt.value ? '#6958C2' : '#fff',
                    color: topN === opt.value ? '#fff' : '#6b6890',
                    cursor: 'pointer',
                    border: 'none',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          {searchable && (
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="text-xs font-sans px-3 py-1.5 rounded-lg outline-none"
              style={{ border: '1px solid #e8e6f0', width: 140, color: '#1a1830' }}
            />
          )}
          {csvFilename && (
            <button
              onClick={() => exportCSV(exportData, csvFilename)}
              className="px-3 py-1.5 text-xs font-sans font-medium rounded-lg transition-colors"
              style={{ border: '1px solid #e8e6f0', color: '#6b6890', background: '#fff', cursor: 'pointer' }}
            >
              CSV ↓
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-sans">
          <thead>
            <tr style={{ background: '#faf9fd' }}>
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  className="px-4 font-medium text-t2 select-none"
                  style={{
                    padding: compact ? '8px 12px' : '10px 16px',
                    textAlign: col.align || 'left',
                    cursor: col.sortable !== false ? 'pointer' : 'default',
                    whiteSpace: 'nowrap',
                    fontSize: '0.72rem',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    borderBottom: '1px solid #f0eefb',
                    color: sortKey === col.key ? '#6958C2' : '#6b6890',
                  }}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f9f8fc' }}>
                  {columns.map(col => (
                    <td key={col.key} style={{ padding: compact ? '8px 12px' : '10px 16px' }}>
                      <div className="h-4 rounded animate-pulse" style={{ background: '#f0eefb', width: '60%' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-12 text-t3 font-sans text-sm"
                >
                  {data.length === 0 ? 'No data available. Upload data in Admin to get started.' : 'No results found.'}
                </td>
              </tr>
            ) : (
              filtered.map((row, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: '1px solid #f9f8fc',
                    background: i % 2 === 0 ? '#fff' : '#fdfcff',
                  }}
                >
                  {columns.map(col => (
                    <td
                      key={col.key}
                      style={{
                        padding: compact ? '7px 12px' : '9px 16px',
                        textAlign: col.align || 'left',
                        color: sortKey === col.key ? '#6958C2' : '#1a1830',
                        whiteSpace: col.wrap ? 'normal' : 'nowrap',
                        fontFamily: col.mono ? '"DM Mono", monospace' : undefined,
                        fontSize: compact ? '0.78rem' : '0.83rem',
                      }}
                    >
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && filtered.length > 0 && (
        <div className="px-5 py-2 text-xs text-t3 font-sans" style={{ borderTop: '1px solid #f0eefb' }}>
          Showing {filtered.length} of {data.length} records
        </div>
      )}
    </div>
  )
}
