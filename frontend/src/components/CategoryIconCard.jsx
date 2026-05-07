import React from 'react'
import { CAT_COLORS, CAT_ICONS } from '../utils/colors'
import { fc } from '../utils/formatters'
import useSettingsStore from '../store/settingsStore'

export default function CategoryIconCard({ category, value, qty, selected, onClick }) {
  const { currency, fxRates } = useSettingsStore()
  const color = CAT_COLORS[category] || '#94a3b8'
  const icon = CAT_ICONS[category] || '📦'

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all cursor-pointer"
      style={{
        border: selected ? `2px solid ${color}` : '2px solid transparent',
        background: selected ? color + '12' : '#f8f7fd',
        outline: 'none',
        minWidth: 100,
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
        style={{ background: color + '22' }}
      >
        {icon}
      </div>
      <div className="text-center">
        <div className="text-xs font-sans font-semibold text-t1">{category}</div>
        <div className="font-mono text-sm font-medium mt-0.5" style={{ color }}>
          {fc(value, true, currency, fxRates)}
        </div>
        {qty != null && (
          <div className="text-xs font-sans text-t3 mt-0.5">{qty?.toLocaleString()} qty</div>
        )}
      </div>
    </button>
  )
}
