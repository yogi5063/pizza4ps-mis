import React from 'react'
import { useLocation } from 'react-router-dom'
import useSettingsStore from '../store/settingsStore'
import useFilterStore from '../store/filterStore'
import { FX_RATES } from '../utils/formatters'
import ReportsMenu from './ReportsMenu'

const PAGE_TITLES = {
  '/daily-flash': 'Daily Flash',
  '/overview': 'Overview',
  '/monthly': 'Monthly Detail',
  '/comparison': 'Comparison',
  '/items': 'Item Analysis',
  '/cogs': 'COGS & Margin',
  '/targets': 'Targets & Budget',
  '/pl': 'P&L Statement',
  '/bs': 'Balance Sheet',
  '/cashflow': 'Cash Flow',
  '/sales-vs-cogs': 'Sales vs COGS',
  '/discount': 'Discount Analysis',
  '/voids': 'Voids & Cancels',
  '/gst': 'GST Summary',
  '/table-performance': 'Table Performance',
  '/top-invoices': 'Top Invoices',
  '/covers': 'Cover Analytics',
  '/inventory': 'Inventory Intel',
  '/menu-engineering': 'Menu Engineering',
  '/admin': 'Data Upload',
  '/month-end': 'Month-End Close',
  '/': 'Daily Flash',
}

const CURRENCIES = Object.keys(FX_RATES)

export default function Topbar({ onMenuClick }) {
  const location = useLocation()
  const { currency, setCurrency } = useSettingsStore()
  const { selectedMonths, selectedCategories, selectedChannels } = useFilterStore()
  const title = PAGE_TITLES[location.pathname] || 'Dashboard'

  const filterCount = selectedMonths.length + selectedCategories.length + selectedChannels.length

  return (
    <div
      className="flex items-center justify-between px-6 flex-shrink-0 bg-white"
      style={{ height: 56, borderBottom: '1px solid #e8e6f0', zIndex: 40 }}
    >
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
          style={{ cursor: 'pointer' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect y="3" width="18" height="1.5" rx="0.75" fill="#6b6890"/>
            <rect y="8.25" width="18" height="1.5" rx="0.75" fill="#6b6890"/>
            <rect y="13.5" width="18" height="1.5" rx="0.75" fill="#6b6890"/>
          </svg>
        </button>
        <h1 className="font-sans font-semibold text-t1" style={{ fontSize: '1rem' }}>
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {filterCount > 0 && (
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-sans font-medium"
            style={{ background: '#f0eefb', color: '#6958C2', border: '1px solid #d4cef0' }}
          >
            <span>⚡</span>
            <span>{filterCount} filter{filterCount > 1 ? 's' : ''} active</span>
          </div>
        )}

        {/* PDF Reports */}
        <ReportsMenu />

        {/* Currency selector */}
        <select
          value={currency}
          onChange={e => setCurrency(e.target.value)}
          className="text-sm font-sans font-medium rounded-lg px-3 py-1.5 outline-none transition-colors cursor-pointer"
          style={{
            border: '1px solid #e8e6f0',
            color: '#1a1830',
            background: '#fafafa',
          }}
        >
          {CURRENCIES.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Profile */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center font-sans font-semibold text-white text-sm cursor-pointer"
          style={{ background: 'linear-gradient(135deg, #6958C2, #8878D8)' }}
          title="Profile"
        >
          P
        </div>
      </div>
    </div>
  )
}
