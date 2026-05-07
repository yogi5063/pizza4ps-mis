export const FX_RATES = {
  INR:1, VND:305, USD:0.012, EUR:0.011, SGD:0.016,
  JPY:1.78, CNY:0.086, GBP:0.0095, AUD:0.018,
  HKD:0.093, MYR:0.056, THB:0.41, AED:0.044, CAD:0.016, KRW:16.1
}

export const FX_SYMBOLS = {
  INR:'₹', VND:'₫', USD:'$', EUR:'€', SGD:'S$', JPY:'¥',
  CNY:'¥', GBP:'£', AUD:'A$', HKD:'HK$', MYR:'RM',
  THB:'฿', AED:'AED ', CAD:'C$', KRW:'₩'
}

export function fc(value, compact=false, currency='INR', fxRates=null) {
  const rates = fxRates || FX_RATES
  const rate = rates[currency] || 1
  const sym = FX_SYMBOLS[currency] || '₹'
  const converted = (value || 0) * rate
  if (compact) {
    if (Math.abs(converted) >= 1e7) return sym + (converted/1e7).toFixed(2) + 'Cr'
    if (Math.abs(converted) >= 1e5) return sym + (converted/1e5).toFixed(2) + 'L'
    if (Math.abs(converted) >= 1e3) return sym + (converted/1e3).toFixed(1) + 'K'
    return sym + Math.round(converted).toLocaleString('en-IN')
  }
  return sym + Math.round(converted).toLocaleString('en-IN')
}

export function fmtPct(value, decimals=2) {
  if (value === null || value === undefined || isNaN(value)) return '—'
  return (value * 100).toFixed(decimals) + '%'
}

export function fmtNum(value) {
  if (value === null || value === undefined) return '—'
  return Math.round(value).toLocaleString('en-IN')
}

export function momBadge(current, previous) {
  if (!previous || previous === 0) return null
  const pct = ((current - previous) / previous) * 100
  const sign = pct >= 0 ? '+' : ''
  return { pct, label: sign + pct.toFixed(1) + '%', positive: pct >= 0 }
}

export function exportCSV(data, filename) {
  if (!data || data.length === 0) return
  const headers = Object.keys(data[0])
  const rows = data.map(row => headers.map(h => {
    const v = row[h]
    if (typeof v === 'string' && v.includes(',')) return `"${v}"`
    return v ?? ''
  }).join(','))
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export function fmt12h(hour) {
  if (hour === 0) return '12 AM'
  if (hour === 12) return '12 PM'
  if (hour < 12) return hour + ' AM'
  return (hour - 12) + ' PM'
}
