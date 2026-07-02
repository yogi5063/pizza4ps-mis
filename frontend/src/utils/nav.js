// Single source of truth for pages: drives the sidebar, route gating and the
// "view rights" checkboxes on the Users admin page. A page's key is its path
// without the leading slash (e.g. '/overview' -> 'overview').

export const NAV_SECTIONS = [
  {
    label: 'OVERVIEW',
    items: [
      { icon: '⚡', label: 'Daily Flash', path: '/daily-flash' },
    ],
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
    ],
  },
  {
    label: 'FINANCIAL STATEMENTS',
    items: [
      { icon: '📄', label: 'P&L Statement', path: '/pl' },
      { icon: '⚖️', label: 'Balance Sheet', path: '/bs' },
      { icon: '💸', label: 'Cash Flow', path: '/cashflow', stub: true },
    ],
  },
  {
    label: 'SALES ANALYTICS',
    items: [
      { icon: '📈', label: 'Sales vs COGS', path: '/sales-vs-cogs' },
      { icon: '🏷️', label: 'Discount Analysis', path: '/discount' },
      { icon: '❌', label: 'Voids & Cancels', path: '/voids' },
      { icon: '🧾', label: 'GST Summary', path: '/gst' },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { icon: '🪑', label: 'Table Performance', path: '/table-performance' },
      { icon: '🏆', label: 'Top Invoices', path: '/top-invoices' },
      { icon: '👥', label: 'Cover Analytics', path: '/covers' },
    ],
  },
  {
    label: 'INVENTORY',
    items: [
      { icon: '🔍', label: 'Inventory Intel', path: '/inventory' },
      { icon: '⭐', label: 'Menu Engineering', path: '/menu-engineering' },
    ],
  },
  {
    label: 'ADMIN',
    items: [
      { icon: '⚙️', label: 'Data Upload', path: '/admin' },
      { icon: '✅', label: 'Month-End Close', path: '/month-end' },
      { icon: '👤', label: 'Users', path: '/users', superAdminOnly: true },
    ],
  },
]

export const pageKey = (path) => path.replace(/^\//, '')

// Flat list of grantable pages (excludes stubs and super-admin-only pages) —
// used for the view-rights checkboxes.
export function grantablePages() {
  const out = []
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (item.stub || item.superAdminOnly) continue
      out.push({ key: pageKey(item.path), label: item.label, section: section.label })
    }
  }
  return out
}

// Can this user (me) see a given page key?
export function canView(me, key) {
  if (!me) return false
  if (me.role === 'super_admin') return true
  // super-admin-only page for a non-super-admin
  const superOnly = NAV_SECTIONS.some(s =>
    s.items.some(i => pageKey(i.path) === key && i.superAdminOnly))
  if (superOnly) return false
  const allowed = me.allowed_pages || []
  // Empty allow-list = no explicit grant → deny (super_admin handled above).
  return allowed.includes(key)
}

// First page a user is allowed to land on.
export function firstAllowedPath(me) {
  if (me?.role === 'super_admin') return '/daily-flash'
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (item.stub || item.superAdminOnly) continue
      if ((me?.allowed_pages || []).includes(pageKey(item.path))) return item.path
    }
  }
  return '/no-access'
}
