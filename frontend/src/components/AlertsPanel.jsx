import React, { useMemo } from 'react'

export default function AlertsPanel({ kpiData, monthsList = [] }) {
  const alerts = useMemo(() => {
    const list = []
    if (!kpiData || !monthsList || monthsList.length < 2) return list

    const sorted = [...monthsList].sort()
    const latest = kpiData[sorted[sorted.length - 1]]
    const prev = kpiData[sorted[sorted.length - 2]]

    if (!latest || !prev) return list

    // Revenue decline >5%
    if (prev.net_revenue > 0) {
      const revChg = (latest.net_revenue - prev.net_revenue) / prev.net_revenue
      if (revChg < -0.05) {
        list.push({
          type: 'red',
          icon: '⚠️',
          text: `Revenue declined ${(revChg * 100).toFixed(1)}% vs previous month (${prev.net_revenue?.toLocaleString('en-IN')} → ${latest.net_revenue?.toLocaleString('en-IN')})`,
        })
      } else if (revChg > 0.1) {
        list.push({
          type: 'green',
          icon: '✅',
          text: `Revenue up ${(revChg * 100).toFixed(1)}% vs previous month — strong performance`,
        })
      }
    }

    // Cancellations up >30%
    if (prev.cancellations > 0 && latest.cancellations > 0) {
      const cancelChg = (latest.cancellations - prev.cancellations) / prev.cancellations
      if (cancelChg > 0.3) {
        list.push({
          type: 'red',
          icon: '⚠️',
          text: `Cancellations up ${(cancelChg * 100).toFixed(1)}% — investigate service issues`,
        })
      }
    }

    // Avg bill dropped >10%
    if (prev.avg_bill > 0) {
      const billChg = (latest.avg_bill - prev.avg_bill) / prev.avg_bill
      if (billChg < -0.1) {
        list.push({
          type: 'amber',
          icon: '🔶',
          text: `Average bill dropped ${Math.abs(billChg * 100).toFixed(1)}% — review upselling`,
        })
      }
    }

    // Discount % up
    if (prev.net_revenue > 0 && latest.net_revenue > 0 && prev.total_discount != null && latest.total_discount != null) {
      const prevDiscPct = prev.total_discount / prev.gross_revenue
      const latDiscPct = latest.total_discount / latest.gross_revenue
      if (latDiscPct - prevDiscPct > 0.02) {
        list.push({
          type: 'amber',
          icon: '🏷️',
          text: `Discount % increased from ${(prevDiscPct * 100).toFixed(1)}% to ${(latDiscPct * 100).toFixed(1)}% — monitor promotions`,
        })
      }
    }

    // GP% improved
    if (prev.gp_pct != null && latest.gp_pct != null && latest.gp_pct > prev.gp_pct + 0.01) {
      list.push({
        type: 'green',
        icon: '✅',
        text: `Gross Profit % improved from ${(prev.gp_pct * 100).toFixed(1)}% to ${(latest.gp_pct * 100).toFixed(1)}%`,
      })
    }

    return list
  }, [kpiData, monthsList])

  if (alerts.length === 0) return null

  const colorMap = {
    red: { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626', bar: '#ef4444' },
    amber: { bg: '#fffbeb', border: '#fcd34d', text: '#d97706', bar: '#f59e0b' },
    green: { bg: '#f0fdf4', border: '#86efac', text: '#16a34a', bar: '#22c55e' },
  }

  return (
    <div className="mb-5 flex flex-col gap-2">
      {alerts.map((alert, i) => {
        const c = colorMap[alert.type] || colorMap.amber
        return (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl px-4 py-3 relative overflow-hidden"
            style={{ background: c.bg, border: `1px solid ${c.border}` }}
          >
            <div
              className="absolute left-0 top-0 bottom-0 rounded-l-xl"
              style={{ width: 4, background: c.bar }}
            />
            <span className="text-base flex-shrink-0 ml-1">{alert.icon}</span>
            <span className="text-sm font-sans" style={{ color: c.text }}>{alert.text}</span>
          </div>
        )
      })}
    </div>
  )
}
