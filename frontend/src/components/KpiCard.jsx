import React from 'react'

export default function KpiCard({ title, value, subtitle, trend, icon, color = '#6958C2', loading = false }) {
  return (
    <div
      className="bg-white rounded-xl p-5 flex flex-col gap-2"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)', border: '1px solid #f0eefb' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-xs font-sans font-medium uppercase tracking-wide text-t2 truncate">
            {title}
          </span>
          {loading ? (
            <div className="h-7 w-24 rounded animate-pulse" style={{ background: '#f0eefb' }} />
          ) : (
            <span
              className="font-mono font-medium leading-tight"
              style={{ fontSize: '1.5rem', color: '#1a1830' }}
            >
              {value ?? '—'}
            </span>
          )}
        </div>
        {icon && (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
            style={{ background: color + '18' }}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 min-h-5">
        {trend && (
          <span
            className="inline-flex items-center gap-1 text-xs font-sans font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: trend.positive ? '#dcfce7' : '#fee2e2',
              color: trend.positive ? '#16a34a' : '#dc2626',
            }}
          >
            {trend.positive ? '↑' : '↓'} {trend.label}
          </span>
        )}
        {subtitle && (
          <span className="text-xs font-sans text-t3 truncate">{subtitle}</span>
        )}
      </div>
    </div>
  )
}
