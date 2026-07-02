// Resolve the abstract time selection into the concrete list of "YYYY-MM"
// months a page should show, given the months actually available in its data.

export const MONTHS = [
  ['01', 'Jan'], ['02', 'Feb'], ['03', 'Mar'], ['04', 'Apr'], ['05', 'May'], ['06', 'Jun'],
  ['07', 'Jul'], ['08', 'Aug'], ['09', 'Sep'], ['10', 'Oct'], ['11', 'Nov'], ['12', 'Dec'],
]

export const PRESETS = [
  { key: 'latest', label: 'Latest month' },
  { key: 'l3', label: 'Last 3 months' },
  { key: 'l6', label: 'Last 6 months' },
  { key: 'ytd', label: 'This year' },
  { key: 'lastyear', label: 'Last year' },
  { key: 'all', label: 'All time' },
]

export function monthLabel(mk) {
  const [y, m] = mk.split('-')
  const nm = MONTHS.find(([n]) => n === m)
  return nm ? `${nm[1]} ${y}` : mk
}

export function resolveMonths(available, s) {
  const sorted = [...(available || [])].filter(Boolean).sort()
  if (!sorted.length) return []
  const years = [...new Set(sorted.map(m => m.slice(0, 4)))].sort()
  const maxYear = years[years.length - 1]

  if (s.preset) {
    switch (s.preset) {
      case 'latest': return sorted.slice(-1)
      case 'l3': return sorted.slice(-3)
      case 'l6': return sorted.slice(-6)
      case 'ytd': return sorted.filter(m => m.startsWith(maxYear))
      case 'lastyear': {
        const ly = String(Number(maxYear) - 1)
        return sorted.filter(m => m.startsWith(ly))
      }
      case 'all': return sorted
      default: break
    }
  }

  if (s.timeMode === 'range' && s.rFrom && s.rTo) {
    const lo = s.rFrom <= s.rTo ? s.rFrom : s.rTo
    const hi = s.rFrom <= s.rTo ? s.rTo : s.rFrom
    return sorted.filter(m => m >= lo && m <= hi)
  }

  // single mode
  let out = sorted
  if (s.fYear && s.fYear !== 'all') out = out.filter(m => m.startsWith(s.fYear))
  if (s.fMonth && s.fMonth !== 'all') out = out.filter(m => m.slice(5, 7) === s.fMonth)
  return out
}

// Short human summary of the current selection for the collapsed bar.
export function timeSummary(available, s, resolved) {
  if (s.preset) return (PRESETS.find(p => p.key === s.preset) || {}).label || 'All'
  if (s.timeMode === 'range' && s.rFrom && s.rTo) return `${monthLabel(s.rFrom)} → ${monthLabel(s.rTo)}`
  const y = s.fYear === 'all' ? 'All years' : s.fYear
  const m = s.fMonth === 'all' ? 'all months' : (MONTHS.find(([n]) => n === s.fMonth) || [])[1]
  if (s.fYear === 'all' && s.fMonth === 'all') return 'All time'
  return `${m || ''} ${y}`.trim()
}
