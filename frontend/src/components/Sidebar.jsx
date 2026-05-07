import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const NAV_SECTIONS = [
  {
    label: 'OVERVIEW',
    items: [
      { icon: '⚡', label: 'Daily Flash', path: '/daily-flash' },
    ]
  },
  {
    label: 'REVENUE INTELLIGENCE',
    items: [
      { icon: '📊', label: 'Overview', path: '/overview' },
      { icon: '📅', label: 'Monthly Detail', path: '/monthly' },
      { icon: '⚖️', label: 'Comparison', path: '/comparison' },
      { icon: '🍽️', label: 'Item Analysis', path: '/items' },
      { icon: '📦', label: 'COGS & Margin', path: '/cogs' },
      { icon: '🎯', label: 'Targets & Budget', path: '/targets' },
    ]
  },
  {
    label: 'FINANCIAL STATEMENTS',
    items: [
      { icon: '📄', label: 'P&L Statement', path: '/pl' },
      { icon: '⚖️', label: 'Balance Sheet', path: '/bs' },
      { icon: '💸', label: 'Cash Flow', path: '/cashflow', stub: true },
    ]
  },
  {
    label: 'SALES ANALYTICS',
    items: [
      { icon: '📈', label: 'Sales vs COGS', path: '/sales-vs-cogs' },
      { icon: '🏷️', label: 'Discount Analysis', path: '/discount' },
      { icon: '❌', label: 'Voids & Cancels', path: '/voids' },
      { icon: '🧾', label: 'GST Summary', path: '/gst' },
    ]
  },
  {
    label: 'OPERATIONS',
    items: [
      { icon: '🪑', label: 'Table Performance', path: '/table-performance' },
      { icon: '🏆', label: 'Top Invoices', path: '/top-invoices' },
      { icon: '👥', label: 'Cover Analytics', path: '/covers' },
    ]
  },
  {
    label: 'INVENTORY',
    items: [
      { icon: '🔍', label: 'Inventory Intel', path: '/inventory' },
      { icon: '⭐', label: 'Menu Engineering', path: '/menu-engineering' },
    ]
  },
  {
    label: 'ADMIN',
    items: [
      { icon: '⚙️', label: 'Data Upload', path: '/admin' },
      { icon: '✅', label: 'Month-End Close', path: '/month-end' },
    ]
  },
]

export default function Sidebar({ collapsed, onToggle }) {
  const navigate = useNavigate()
  const location = useLocation()

  function handleNav(path, stub) {
    if (stub) return
    navigate(path)
  }

  function handleLogout() {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div
      className="flex flex-col h-screen flex-shrink-0 transition-all duration-300 overflow-hidden"
      style={{
        width: collapsed ? 64 : 256,
        background: '#0d0c18',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Brand header */}
      <div
        className="flex items-center gap-3 flex-shrink-0 px-4"
        style={{ height: 56, borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #6958C2, #8878D8)' }}
        >
          🍕
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-white font-sans font-semibold text-sm truncate">Pizza 4P's</div>
            <div className="text-gray-500 font-sans text-xs truncate">MIS Dashboard</div>
          </div>
        )}
      </div>

      {/* Nav items */}
      <div className="flex-1 overflow-y-auto py-3" style={{ scrollbarWidth: 'none' }}>
        {NAV_SECTIONS.map((section, si) => (
          <div key={si} className="mb-1">
            {!collapsed && (
              <div
                className="px-4 py-1.5 font-sans font-semibold"
                style={{ fontSize: '0.6rem', color: '#4a4870', letterSpacing: '0.12em' }}
              >
                {section.label}
              </div>
            )}
            {collapsed && si > 0 && (
              <div className="mx-4 my-2 h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />
            )}
            {section.items.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <button
                  key={item.path}
                  onClick={() => handleNav(item.path, item.stub)}
                  title={collapsed ? item.label : undefined}
                  className="w-full flex items-center gap-3 relative transition-colors duration-150"
                  style={{
                    padding: collapsed ? '8px 0' : '8px 16px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    background: isActive ? 'linear-gradient(90deg, rgba(105,88,194,0.3), rgba(105,88,194,0.1))' : 'transparent',
                    cursor: item.stub ? 'default' : 'pointer',
                    opacity: item.stub ? 0.4 : 1,
                  }}
                >
                  {isActive && (
                    <div
                      className="absolute left-0 top-1 bottom-1 rounded-r-full"
                      style={{ width: 3, background: '#6958C2' }}
                    />
                  )}
                  <span className="text-base flex-shrink-0" style={{ lineHeight: 1 }}>{item.icon}</span>
                  {!collapsed && (
                    <span
                      className="font-sans text-sm truncate"
                      style={{ color: isActive ? '#c4b8ff' : '#7a779a' }}
                    >
                      {item.label}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Bottom: logout */}
      <div className="flex-shrink-0 p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2 transition-colors"
          style={{
            justifyContent: collapsed ? 'center' : 'flex-start',
            background: 'transparent',
            cursor: 'pointer',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          title={collapsed ? 'Sign Out' : undefined}
        >
          <span className="text-base">🚪</span>
          {!collapsed && (
            <span className="font-sans text-sm" style={{ color: '#7a779a' }}>Sign Out</span>
          )}
        </button>
      </div>
    </div>
  )
}
