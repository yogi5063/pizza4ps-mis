import React from 'react'
import { exportCSV } from '../utils/formatters'

export default function ChartCard({
  title,
  children,
  toggles,
  activeToggle,
  onToggle,
  csvData,
  csvFilename,
  loading = false,
  height,
  extra,
}) {
  return (
    <div
      className="bg-white rounded-xl p-5 flex flex-col"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)', border: '1px solid #f0eefb' }}
    >
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <span className="font-sans font-semibold text-t1 text-sm">{title}</span>
        <div className="flex items-center gap-2">
          {extra}
          {toggles && toggles.length > 0 && (
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #e8e6f0' }}>
              {toggles.map(t => (
                <button
                  key={t.value}
                  onClick={() => onToggle && onToggle(t.value)}
                  className="px-3 py-1 text-xs font-sans font-medium transition-colors"
                  style={{
                    background: activeToggle === t.value ? '#6958C2' : '#fff',
                    color: activeToggle === t.value ? '#fff' : '#6b6890',
                    cursor: 'pointer',
                    border: 'none',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
          {csvData && (
            <button
              onClick={() => exportCSV(csvData, csvFilename || 'export.csv')}
              className="px-3 py-1 text-xs font-sans font-medium rounded-lg transition-colors"
              style={{ border: '1px solid #e8e6f0', color: '#6b6890', background: '#fff', cursor: 'pointer' }}
            >
              CSV ↓
            </button>
          )}
        </div>
      </div>

      <div className="flex-1" style={{ height: height || 260, position: 'relative' }}>
        {loading ? (
          <div
            className="absolute inset-0 rounded-lg animate-pulse flex items-center justify-center"
            style={{ background: '#f8f7fd' }}
          >
            <span className="text-t3 text-sm font-sans">Loading...</span>
          </div>
        ) : children}
      </div>
    </div>
  )
}
