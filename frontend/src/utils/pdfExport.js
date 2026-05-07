/**
 * Pizza 4P's India — Professional PDF Export Engine
 * Generates executive-grade section reports for management presentation.
 * One PDF per dashboard section, designed for C-suite delivery.
 */

import { jsPDF } from 'jspdf'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, ArcElement, Title, Tooltip, Legend,
} from 'chart.js'
import api from './api'
import { fc, fmtPct, fmt12h } from './formatters'
import { CAT_COLORS, CHANNEL_COLORS } from './colors'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend)

/* ─────────────────────────────────────────────────────────────────────
   DESIGN SYSTEM
───────────────────────────────────────────────────────────────────── */
const C = {
  dark:     [13,  12,  24 ],
  purple:   [105, 88,  194],
  purpleL:  [136, 120, 216],
  purpleBg: [240, 238, 251],
  white:    [255, 255, 255],
  lightBg:  [245, 244, 251],
  t1:       [26,  24,  48 ],
  t2:       [107, 104, 144],
  t3:       [168, 166, 192],
  green:    [34,  197, 94 ],
  red:      [239, 68,  68 ],
  amber:    [245, 158, 11 ],
  blue:     [59,  130, 246],
  pink:     [236, 72,  153],
  violet:   [139, 92,  246],
  cyan:     [6,   182, 212],
  border:   [232, 230, 240],
  card:     [30,  28,  52 ],
}
const PW = 210, PH = 297, ML = 16, CW = PW - ML * 2

/* ─────────────────────────────────────────────────────────────────────
   LOW-LEVEL PRIMITIVES
───────────────────────────────────────────────────────────────────── */
function fill(doc, col, x, y, w, h) {
  doc.setFillColor(...col)
  doc.rect(x, y, w, h, 'F')
}

function ln(doc, col, x1, y1, x2, y2, lw = 0.3) {
  doc.setDrawColor(...col)
  doc.setLineWidth(lw)
  doc.line(x1, y1, x2, y2)
}

function txt(doc, s, x, y, { col = C.t1, sz = 10, bold = false, align = 'left', maxW = null } = {}) {
  doc.setTextColor(...col)
  doc.setFontSize(sz)
  doc.setFont('helvetica', bold ? 'bold' : 'normal')
  const opts = { align }
  if (maxW) opts.maxWidth = maxW
  doc.text(String(s ?? ''), x, y, opts)
}

function grad(doc, x, y, w, h, from, to, steps = 24) {
  const sh = h / steps
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    doc.setFillColor(
      Math.round(from[0] + t * (to[0] - from[0])),
      Math.round(from[1] + t * (to[1] - from[1])),
      Math.round(from[2] + t * (to[2] - from[2])),
    )
    doc.rect(x, y + i * sh, w, sh + 0.5, 'F')
  }
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

function colorToRgba(hexOrArray, alpha = 0.85) {
  const [r, g, b] = Array.isArray(hexOrArray) ? hexOrArray : hexToRgb(hexOrArray)
  return `rgba(${r},${g},${b},${alpha})`
}

/* ─────────────────────────────────────────────────────────────────────
   COVER PAGE
───────────────────────────────────────────────────────────────────── */
function drawCover(doc, { abbr, title, subtitle, period, kpis = [] }) {
  fill(doc, C.dark, 0, 0, PW, PH)
  grad(doc, 0, 0, PW, 72, C.purple, C.dark)

  // Left accent bar
  fill(doc, C.purple, 0, 0, 5, PH)

  // Company branding
  txt(doc, "PIZZA 4P'S INDIA", PW / 2, 25, { col: C.white, sz: 22, bold: true, align: 'center' })
  txt(doc, 'INDIRANAGAR  ·  BENGALURU  ·  KARNATAKA', PW / 2, 37, { col: [200, 195, 230], sz: 9, align: 'center' })
  txt(doc, 'Management Information System', PW / 2, 50, { col: [170, 165, 210], sz: 10, align: 'center' })

  // White card
  const cy = 79, ch = 120
  fill(doc, C.white, ML - 4, cy, CW + 8, ch)
  fill(doc, C.purple, ML - 4, cy, CW + 8, 4)

  // Icon circle
  doc.setFillColor(...C.purpleBg)
  doc.circle(PW / 2, cy + 22, 12, 'F')
  txt(doc, abbr, PW / 2, cy + 27, { col: C.purple, sz: 11, bold: true, align: 'center' })

  txt(doc, title.toUpperCase(), PW / 2, cy + 48, { col: C.t1, sz: 19, bold: true, align: 'center' })
  txt(doc, subtitle, PW / 2, cy + 61, { col: C.t2, sz: 10, align: 'center' })

  ln(doc, C.border, ML + 10, cy + 69, PW - ML - 10, cy + 69)

  txt(doc, 'REPORTING PERIOD', PW / 2, cy + 80, { col: C.t3, sz: 7, align: 'center' })
  txt(doc, period, PW / 2, cy + 92, { col: C.purple, sz: 13, bold: true, align: 'center' })
  txt(doc, 'EXECUTIVE MANAGEMENT REPORT', PW / 2, cy + 106, { col: C.t2, sz: 8, align: 'center' })

  // KPI highlight boxes
  if (kpis.length) {
    const ky = cy + ch + 15
    txt(doc, 'KEY PERFORMANCE HIGHLIGHTS', PW / 2, ky, { col: C.t3, sz: 7, align: 'center' })
    const n = Math.min(kpis.length, 4)
    const bw = (CW - (n - 1) * 4) / n
    kpis.slice(0, n).forEach((kpi, i) => {
      const bx = ML + i * (bw + 4), by = ky + 6
      fill(doc, C.card, bx, by, bw, 27)
      fill(doc, kpi.col || C.purple, bx, by, 3, 27)
      txt(doc, kpi.value, bx + bw / 2, by + 12, { col: C.white, sz: 11, bold: true, align: 'center' })
      txt(doc, kpi.label, bx + bw / 2, by + 22, { col: [180, 175, 215], sz: 6.5, align: 'center' })
    })
  }

  // Footer
  ln(doc, [60, 55, 100], ML, PH - 22, PW - ML, PH - 22)
  txt(doc, "© Pizza 4P's India Private Limited  —  Confidential & Proprietary", PW / 2, PH - 13, { col: [120, 115, 160], sz: 7.5, align: 'center' })
  txt(doc, 'This document is intended solely for authorized executive review and must not be distributed externally.', PW / 2, PH - 6, { col: [90, 85, 130], sz: 6.5, align: 'center' })
}

/* ─────────────────────────────────────────────────────────────────────
   PAGE CHROME — HEADER & FOOTER
───────────────────────────────────────────────────────────────────── */
function pageHeader(doc, sectionName, pg, total) {
  fill(doc, C.dark, 0, 0, PW, 17)
  fill(doc, C.purple, 0, 0, 5, 17)
  txt(doc, "PIZZA 4P'S INDIA", 10, 11, { col: C.white, sz: 7.5, bold: true })
  txt(doc, sectionName.toUpperCase(), PW / 2, 11, { col: C.purpleL, sz: 7.5, align: 'center' })
  txt(doc, `PAGE  ${pg} / ${total}`, PW - ML, 11, { col: C.t3, sz: 7.5, align: 'right' })
}

function pageFooter(doc, label) {
  fill(doc, C.purpleBg, 0, PH - 12, PW, 12)
  ln(doc, C.border, 0, PH - 12, PW, PH - 12)
  txt(doc, 'CONFIDENTIAL — FOR INTERNAL USE ONLY', ML, PH - 4, { col: C.t2, sz: 6.5 })
  txt(doc, label, PW / 2, PH - 4, { col: C.t2, sz: 6.5, align: 'center' })
  txt(doc, `Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, PW - ML, PH - 4, { col: C.t2, sz: 6.5, align: 'right' })
}

/* ─────────────────────────────────────────────────────────────────────
   SECTION TITLE BAR
───────────────────────────────────────────────────────────────────── */
function secTitle(doc, title, y) {
  fill(doc, C.purpleBg, ML - 2, y, CW + 4, 11)
  fill(doc, C.purple, ML - 2, y, 4, 11)
  txt(doc, title, ML + 6, y + 7.5, { col: C.t1, sz: 9.5, bold: true })
  return y + 16
}

/* ─────────────────────────────────────────────────────────────────────
   KPI GRID  (4 per row)
───────────────────────────────────────────────────────────────────── */
function kpiGrid(doc, kpis, startY) {
  const cols = 4, bw = (CW - (cols - 1) * 4) / cols, bh = 27, gap = 5
  kpis.forEach((kpi, i) => {
    const col = i % cols, row = Math.floor(i / cols)
    const bx = ML + col * (bw + 4), by = startY + row * (bh + gap)
    fill(doc, C.lightBg, bx, by, bw, bh)
    fill(doc, kpi.col || C.purple, bx, by, bw, 3)
    txt(doc, kpi.value || '—', bx + bw / 2, by + 14, { col: C.t1, sz: 11.5, bold: true, align: 'center' })
    txt(doc, kpi.label, bx + bw / 2, by + 22, { col: C.t2, sz: 6.5, align: 'center' })
    if (kpi.trend) {
      const tc = kpi.trend.positive ? C.green : C.red
      txt(doc, kpi.trend.label, bx + bw - 2, by + 9, { col: tc, sz: 6, align: 'right' })
    }
  })
  return startY + Math.ceil(kpis.length / cols) * (bh + gap) + 5
}

/* ─────────────────────────────────────────────────────────────────────
   OFF-SCREEN CHART RENDERING
───────────────────────────────────────────────────────────────────── */
async function renderChart(type, labels, datasets, opts = {}) {
  return new Promise(resolve => {
    const canvas = document.createElement('canvas')
    canvas.width  = opts.w || 780
    canvas.height = opts.h || 310
    canvas.style.cssText = 'position:absolute;left:-9999px;top:-9999px'
    document.body.appendChild(canvas)

    const isRound = type === 'doughnut' || type === 'pie'
    const chart = new ChartJS(canvas.getContext('2d'), {
      type,
      data: { labels, datasets },
      options: {
        responsive: false, animation: false,
        plugins: {
          legend: {
            display: opts.legend !== false,
            position: opts.legendPos || (isRound ? 'right' : 'bottom'),
            labels: { font: { size: 12, family: 'Arial' }, color: '#6b6890', boxWidth: 13, padding: 14 },
          },
          tooltip: { enabled: false },
        },
        scales: isRound ? {} : {
          x: { grid: { display: false }, ticks: { font: { size: 11, family: 'Arial' }, color: '#a8a6c0', maxRotation: 40 } },
          y: { grid: { color: '#f0eefb' }, ticks: { font: { size: 11, family: 'Arial' }, color: '#a8a6c0' } },
          ...(opts.scales || {}),
        },
        ...(opts.extra || {}),
      },
    })

    // Force white background
    const ctx = canvas.getContext('2d')
    ctx.save()
    ctx.globalCompositeOperation = 'destination-over'
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.restore()

    setTimeout(() => {
      const b64 = canvas.toDataURL('image/png', 1.0)
      chart.destroy()
      if (document.body.contains(canvas)) document.body.removeChild(canvas)
      resolve(b64)
    }, 220)
  })
}

/* ─────────────────────────────────────────────────────────────────────
   CHART BLOCK ON PAGE
───────────────────────────────────────────────────────────────────── */
function addChart(doc, img, x, y, w, h, title) {
  if (title) {
    fill(doc, C.purpleBg, x - 1, y - 1, w + 2, 10)
    txt(doc, title, x + 3, y + 7, { col: C.purple, sz: 8, bold: true })
    y += 12
  }
  ln(doc, C.border, x, y, x + w, y, 0.2)
  ln(doc, C.border, x, y, x, y + h, 0.2)
  ln(doc, C.border, x + w, y, x + w, y + h, 0.2)
  ln(doc, C.border, x, y + h, x + w, y + h, 0.2)
  doc.addImage(img, 'PNG', x + 1, y + 1, w - 2, h - 2)
  return y + h + 6
}

/* ─────────────────────────────────────────────────────────────────────
   DATA TABLE
───────────────────────────────────────────────────────────────────── */
function drawTable(doc, headers, rows, y, widths, rowH = 8) {
  // Header row
  fill(doc, C.purple, ML, y, CW, rowH + 2)
  let cx = ML
  headers.forEach((h, i) => {
    txt(doc, h.toUpperCase(), cx + widths[i] / 2, y + rowH - 0.5, { col: C.white, sz: 6.5, bold: true, align: 'center' })
    cx += widths[i]
  })
  y += rowH + 2

  rows.forEach((row, ri) => {
    if (y > PH - 26) return
    fill(doc, ri % 2 === 0 ? C.white : C.lightBg, ML, y, CW, rowH)
    cx = ML
    row.forEach((cell, ci) => {
      const s = String(cell ?? '—')
      const isNum = s.match(/^[₹$€£¥\d+\-]/) || typeof cell === 'number'
      const xp = isNum ? cx + widths[ci] - 2 : cx + 3
      txt(doc, s, xp, y + rowH - 2, { col: C.t1, sz: 7, align: isNum ? 'right' : 'left' })
      cx += widths[ci]
    })
    ln(doc, C.border, ML, y + rowH, ML + CW, y + rowH, 0.2)
    y += rowH
  })
  return y + 4
}

/* ─────────────────────────────────────────────────────────────────────
   INSIGHT BOX
───────────────────────────────────────────────────────────────────── */
function insightBox(doc, insights, y) {
  const bh = 10 + insights.length * 9.5
  fill(doc, C.purpleBg, ML, y, CW, bh)
  fill(doc, C.purple, ML, y, 4, bh)
  txt(doc, 'EXECUTIVE INSIGHTS', ML + 8, y + 8, { col: C.purple, sz: 7.5, bold: true })
  insights.forEach((ins, i) => {
    txt(doc, `  \u00BB  ${ins}`, ML + 8, y + 17 + i * 9.5, { col: C.t1, sz: 7.5, maxW: CW - 12 })
  })
  return y + bh + 8
}

/* ─────────────────────────────────────────────────────────────────────
   FILTER-AWARE API FETCHER
   Passes active dashboard filters (months, categories, channels) to
   every API call so the PDF matches exactly what's on screen.
───────────────────────────────────────────────────────────────────── */
function buildParams(filters = {}) {
  const p = {}
  if (filters.months?.length)     p.months     = filters.months.join(',')
  if (filters.categories?.length) p.categories = filters.categories.join(',')
  if (filters.channels?.length)   p.channels   = filters.channels.join(',')
  if (filters.status)             p.status     = filters.status
  return Object.keys(p).length ? { params: p } : {}
}

function apiFetch(path, filters) {
  return api.get(path, buildParams(filters)).catch(() => ({ data: {} }))
}

/* ─────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────── */
function mom(a, b) {
  if (!b || b === 0) return null
  const pct = ((a - b) / b) * 100
  return { label: (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%', positive: pct >= 0 }
}

function catColor(cat) {
  const hex = CAT_COLORS[cat]
  return hex ? colorToRgba(hex) : 'rgba(148,163,184,0.85)'
}

function chColor(ch) {
  const hex = CHANNEL_COLORS[ch]
  return hex ? colorToRgba(hex) : 'rgba(148,163,184,0.85)'
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 1 — EXECUTIVE OVERVIEW
═══════════════════════════════════════════════════════════════════ */
export async function exportOverviewPDF(currency = 'INR', fxRates = null, filters = {}) {
  const [kR, cR, iR] = await Promise.all([
    apiFetch('/data/kpi',    filters),
    apiFetch('/data/cat-ch', filters),
    apiFetch('/data/items',  filters),
  ])
  const kpiData = kR.data || {}, catChData = cR.data || {}, itemsData = iR.data || {}
  const months  = Object.keys(kpiData).sort()
  if (!months.length) { alert('No data uploaded. Please upload revenue files first.'); return }

  const TOTAL = 5
  const latest = months[months.length - 1]
  const prev   = months.length >= 2 ? months[months.length - 2] : null
  const lk     = kpiData[latest] || {}
  const pk     = prev ? kpiData[prev] || {} : {}
  const period = filters?.months?.length
    ? filters.months.join('  ·  ')
    : months.length === 1 ? latest : `${months[0]}  —  ${months[months.length - 1]}`

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  // ── Cover ─────────────────────────────────────────────────────
  drawCover(doc, {
    abbr: 'OV', title: 'Executive Overview', subtitle: 'Daily Flash & Revenue Snapshot',
    period,
    kpis: [
      { label: 'Net Revenue',   value: fc(lk.net_revenue,   true, currency, fxRates), col: C.purple },
      { label: 'Gross Revenue', value: fc(lk.gross_revenue, true, currency, fxRates), col: C.green },
      { label: 'Total Invoices',value: (lk.total_invoices || 0).toLocaleString(),     col: C.blue },
      { label: 'Average Bill',  value: fc(lk.avg_bill,     false, currency, fxRates), col: C.amber },
    ],
  })

  // ── Page 2 — KPI Dashboard ────────────────────────────────────
  doc.addPage()
  pageHeader(doc, 'Executive Overview', 2, TOTAL)
  pageFooter(doc, "Executive Overview  —  Pizza 4P's India")
  let y = 24
  y = secTitle(doc, 'Performance Dashboard — Latest Month', y)
  y = kpiGrid(doc, [
    { label: 'Net Revenue',    value: fc(lk.net_revenue,    true, currency, fxRates), col: C.purple,  trend: mom(lk.net_revenue,    pk.net_revenue)    },
    { label: 'Gross Revenue',  value: fc(lk.gross_revenue,  true, currency, fxRates), col: C.green,   trend: mom(lk.gross_revenue,  pk.gross_revenue)  },
    { label: 'Total Invoices', value: (lk.total_invoices || 0).toLocaleString(),       col: C.blue,    trend: mom(lk.total_invoices, pk.total_invoices) },
    { label: 'Average Bill',   value: fc(lk.avg_bill,      false, currency, fxRates), col: C.amber                                                    },
    { label: 'Total Discount', value: fc(lk.total_discount, true, currency, fxRates), col: C.pink                                                     },
    { label: 'Service Charge', value: fc(lk.service_charge, true, currency, fxRates), col: C.violet                                                   },
    { label: 'GST Collected',  value: fc(lk.total_gst,      true, currency, fxRates), col: C.cyan                                                     },
    { label: 'Cancellations',  value: (lk.cancellations || 0).toLocaleString(),        col: C.red,     trend: lk.cancellations != null && pk.cancellations != null ? { label: mom(lk.cancellations, pk.cancellations)?.label || '—', positive: lk.cancellations <= pk.cancellations } : null },
  ], y)

  if (months.length > 1) {
    y = secTitle(doc, 'Month-on-Month Summary', y)
    const rows = months.map(m => {
      const d = kpiData[m] || {}
      return [m, fc(d.net_revenue, true, currency, fxRates), fc(d.gross_revenue, true, currency, fxRates), (d.total_invoices || 0).toLocaleString(), fc(d.avg_bill, false, currency, fxRates), (d.cancellations || 0).toString()]
    })
    drawTable(doc, ['Period', 'Net Revenue', 'Gross Revenue', 'Invoices', 'Avg Bill', 'Cancels'], rows, y, [28, 34, 34, 22, 30, 16])
  }

  // ── Page 3 — Revenue & Category Charts ───────────────────────
  doc.addPage()
  pageHeader(doc, 'Executive Overview', 3, TOTAL)
  pageFooter(doc, "Executive Overview  —  Pizza 4P's India")
  y = 24

  const trendImg = await renderChart('bar', months,
    [{ label: 'Net Revenue', data: months.map(m => kpiData[m]?.net_revenue || 0), backgroundColor: 'rgba(105,88,194,0.85)', borderColor: '#6958C2', borderWidth: 2, borderRadius: 7 }],
    { legend: false, w: 800, h: 310 }
  )
  y = addChart(doc, trendImg, ML, y, CW, 72, 'Monthly Net Revenue Trend')

  const catAgg = {}
  Object.values(catChData).forEach(md => md?.categories && Object.entries(md.categories).forEach(([c, v]) => catAgg[c] = (catAgg[c] || 0) + v))
  const catKeys = Object.keys(catAgg).sort((a, b) => catAgg[b] - catAgg[a])

  const catImg = await renderChart('doughnut', catKeys,
    [{ data: catKeys.map(k => catAgg[k]), backgroundColor: catKeys.map(catColor), borderWidth: 2, borderColor: '#fff' }],
    { legend: true, legendPos: 'right', w: 740, h: 290 }
  )
  y = addChart(doc, catImg, ML, y + 4, CW, 72, 'Revenue Split by Category — All Months')

  // ── Page 4 — Channel & Top Items ─────────────────────────────
  doc.addPage()
  pageHeader(doc, 'Executive Overview', 4, TOTAL)
  pageFooter(doc, "Executive Overview  —  Pizza 4P's India")
  y = 24

  const chAgg = {}
  Object.values(catChData).forEach(md => md?.channels && Object.entries(md.channels).forEach(([c, v]) => chAgg[c] = (chAgg[c] || 0) + v))
  const chKeys = Object.keys(chAgg)

  const chImg = await renderChart('bar', chKeys,
    [{ data: chKeys.map(k => chAgg[k]), backgroundColor: chKeys.map(chColor), borderRadius: 8 }],
    { legend: false, w: 800, h: 290 }
  )
  y = addChart(doc, chImg, ML, y, CW, 68, 'Revenue Distribution by Ordering Channel')

  const itemAgg = {}
  Object.values(itemsData).flat().forEach(item => {
    if (!item?.item_name) return
    itemAgg[item.item_name] = (itemAgg[item.item_name] || 0) + (item.net_revenue || 0)
  })
  const top10 = Object.entries(itemAgg).sort((a, b) => b[1] - a[1]).slice(0, 10)

  const topImg = await renderChart('bar', top10.map(([n]) => n.length > 22 ? n.slice(0, 22) + '…' : n),
    [{ data: top10.map(([, v]) => v), backgroundColor: 'rgba(105,88,194,0.82)', borderRadius: 6 }],
    { legend: false, w: 800, h: 320, extra: { indexAxis: 'y' } }
  )
  y = addChart(doc, topImg, ML, y + 6, CW, 82, 'Top 10 Revenue-Generating Items')

  // ── Page 5 — Insights ─────────────────────────────────────────
  doc.addPage()
  pageHeader(doc, 'Executive Overview', 5, TOTAL)
  pageFooter(doc, "Executive Overview  —  Pizza 4P's India")
  y = 24
  y = secTitle(doc, 'Executive Insights & Observations', y)
  insightBox(doc, [
    `Latest month net revenue: ${fc(lk.net_revenue, true, currency, fxRates)}${prev ? ` (${mom(lk.net_revenue, pk.net_revenue)?.label || '—'} vs ${prev})` : ''}`,
    `Total invoices processed: ${(lk.total_invoices || 0).toLocaleString()} | Average bill: ${fc(lk.avg_bill, false, currency, fxRates)}`,
    `Cancellation rate: ${lk.total_invoices ? ((lk.cancellations || 0) / lk.total_invoices * 100).toFixed(2) + '%' : '—'} of total transactions`,
    `Discount as % of net revenue: ${lk.net_revenue ? fmtPct((lk.total_discount || 0) / lk.net_revenue) : '—'}`,
    `Top revenue category: ${catKeys[0] || '—'} (${catKeys[0] ? fc(catAgg[catKeys[0]], true, currency, fxRates) : '—'})`,
    `Top ordering channel: ${chKeys.sort((a, b) => chAgg[b] - chAgg[a])[0] || '—'}`,
    `Top selling item: ${top10[0]?.[0] || '—'} at ${top10[0] ? fc(top10[0][1], true, currency, fxRates) : '—'}`,
  ], y)

  doc.save(`Pizza4PS_Executive_Overview_${latest}.pdf`)
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 2 — REVENUE INTELLIGENCE
═══════════════════════════════════════════════════════════════════ */
export async function exportRevenueIntelPDF(currency = 'INR', fxRates = null, filters = {}) {
  const [kR, dR, cR, iR] = await Promise.all([
    apiFetch('/data/kpi',    filters),
    apiFetch('/data/daily',  filters),
    apiFetch('/data/cat-ch', filters),
    apiFetch('/data/items',  filters),
  ])
  const kpiData = kR.data || {}, dailyData = dR.data || {}, catChData = cR.data || {}, itemsData = iR.data || {}
  const months  = Object.keys(kpiData).sort()
  if (!months.length) { alert('No data uploaded.'); return }

  const TOTAL  = 6
  const latest = months[months.length - 1]
  const prev   = months.length >= 2 ? months[months.length - 2] : null
  const lk = kpiData[latest] || {}, pk = prev ? kpiData[prev] || {} : {}
  const period = filters?.months?.length
    ? filters.months.join('  ·  ')
    : months.length === 1 ? latest : `${months[0]}  —  ${months[months.length - 1]}`

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  // ── Cover ─────────────────────────────────────────────────────
  drawCover(doc, {
    abbr: 'RI', title: 'Revenue Intelligence', subtitle: 'Deep-Dive Revenue Analytics & Item Performance',
    period,
    kpis: [
      { label: 'Net Revenue',  value: fc(lk.net_revenue, true, currency, fxRates),  col: C.purple },
      { label: 'Invoices',     value: (lk.total_invoices || 0).toLocaleString(),    col: C.blue   },
      { label: 'Average Bill', value: fc(lk.avg_bill, false, currency, fxRates),   col: C.amber  },
      { label: 'MoM Change',   value: mom(lk.net_revenue, pk.net_revenue)?.label || 'N/A', col: lk.net_revenue >= (pk.net_revenue || 0) ? C.green : C.red },
    ],
  })

  // ── Page 2 — KPI Summary ──────────────────────────────────────
  doc.addPage()
  pageHeader(doc, 'Revenue Intelligence', 2, TOTAL)
  pageFooter(doc, "Revenue Intelligence  —  Pizza 4P's India")
  let y = 24
  y = secTitle(doc, 'Revenue KPI Summary — Latest Month', y)
  y = kpiGrid(doc, [
    { label: 'Net Revenue',    value: fc(lk.net_revenue,    true, currency, fxRates), col: C.purple, trend: mom(lk.net_revenue,    pk.net_revenue)   },
    { label: 'Gross Revenue',  value: fc(lk.gross_revenue,  true, currency, fxRates), col: C.green,  trend: mom(lk.gross_revenue,  pk.gross_revenue) },
    { label: 'Invoices',       value: (lk.total_invoices || 0).toLocaleString(),       col: C.blue,   trend: mom(lk.total_invoices, pk.total_invoices)},
    { label: 'Average Bill',   value: fc(lk.avg_bill,      false, currency, fxRates), col: C.amber                                                   },
    { label: 'Total Discount', value: fc(lk.total_discount, true, currency, fxRates), col: C.pink                                                    },
    { label: 'Service Charge', value: fc(lk.service_charge, true, currency, fxRates), col: C.violet                                                  },
    { label: 'GST Collected',  value: fc(lk.total_gst,      true, currency, fxRates), col: C.cyan                                                    },
    { label: 'Cancellations',  value: (lk.cancellations || 0).toLocaleString(),        col: C.red                                                     },
  ], y)

  if (months.length > 1) {
    y = secTitle(doc, 'Month-on-Month Revenue Comparison', y)
    const rows = months.map((m, idx) => {
      const d = kpiData[m] || {}
      const pd = idx > 0 ? kpiData[months[idx - 1]] || {} : {}
      const chg = pd.net_revenue ? ((d.net_revenue - pd.net_revenue) / pd.net_revenue * 100).toFixed(1) + '%' : '—'
      return [m, fc(d.net_revenue, true, currency, fxRates), fc(d.gross_revenue, true, currency, fxRates), (d.total_invoices || 0).toLocaleString(), fc(d.avg_bill, false, currency, fxRates), chg]
    })
    drawTable(doc, ['Period', 'Net Revenue', 'Gross Revenue', 'Invoices', 'Avg Bill', 'MoM Change'], rows, y, [28, 34, 34, 22, 28, 18])
  }

  // ── Page 3 — Daily Trend & Category Mix ──────────────────────
  doc.addPage()
  pageHeader(doc, 'Revenue Intelligence', 3, TOTAL)
  pageFooter(doc, "Revenue Intelligence  —  Pizza 4P's India")
  y = 24

  const allDays = months.flatMap(m => (dailyData[m] || []))
  if (allDays.length) {
    const dailyImg = await renderChart('line',
      allDays.map(r => r.date || r.day || ''),
      [{ label: 'Net Revenue', data: allDays.map(r => r.net_revenue || 0), borderColor: '#6958C2', backgroundColor: 'rgba(105,88,194,0.12)', fill: true, tension: 0.4, pointRadius: 1.5 }],
      { legend: false, w: 820, h: 300 }
    )
    y = addChart(doc, dailyImg, ML, y, CW, 72, 'Daily Revenue Trend — All Loaded Months')
  }

  const allCats = [...new Set(months.flatMap(m => Object.keys(catChData[m]?.categories || {})))]
  const catColArr = allCats.map(catColor)
  const catStackImg = await renderChart('bar', months,
    allCats.map((cat, ci) => ({
      label: cat,
      data: months.map(m => catChData[m]?.categories?.[cat] || 0),
      backgroundColor: catColArr[ci], borderRadius: 4,
    })),
    { legend: true, legendPos: 'bottom', w: 820, h: 300, extra: { scales: { x: { stacked: true }, y: { stacked: true } } } }
  )
  y = addChart(doc, catStackImg, ML, y + 5, CW, 72, 'Revenue by Category per Month — Stacked View')

  // ── Page 4 — Top 20 Items Table ───────────────────────────────
  doc.addPage()
  pageHeader(doc, 'Revenue Intelligence', 4, TOTAL)
  pageFooter(doc, "Revenue Intelligence  —  Pizza 4P's India")
  y = 24
  y = secTitle(doc, 'Top 20 Items by Net Revenue — Ranked', y)

  const itemAgg = {}, itemQty = {}, itemCat = {}
  Object.entries(itemsData).forEach(([, arr]) => {
    ;(Array.isArray(arr) ? arr : []).forEach(item => {
      if (!item?.item_name) return
      itemAgg[item.item_name] = (itemAgg[item.item_name] || 0) + (item.net_revenue || 0)
      itemQty[item.item_name] = (itemQty[item.item_name] || 0) + (item.qty || 0)
      itemCat[item.item_name] = item.category || item.cat || '—'
    })
  })
  const top20   = Object.entries(itemAgg).sort((a, b) => b[1] - a[1]).slice(0, 20)
  const totalRev = top20.reduce((s, [, v]) => s + v, 0)
  const itemRows = top20.map(([name, rev], i) => [
    i + 1,
    name.length > 30 ? name.slice(0, 30) + '…' : name,
    itemCat[name] || '—',
    fc(rev, true, currency, fxRates),
    (itemQty[name] || 0).toLocaleString(),
    totalRev ? (rev / totalRev * 100).toFixed(1) + '%' : '—',
  ])
  drawTable(doc, ['#', 'Item Name', 'Category', 'Net Revenue', 'Qty Sold', 'Rev Share %'], itemRows, y, [10, 70, 24, 32, 20, 16], 7.5)

  // ── Page 5 — Top Items Chart ──────────────────────────────────
  doc.addPage()
  pageHeader(doc, 'Revenue Intelligence', 5, TOTAL)
  pageFooter(doc, "Revenue Intelligence  —  Pizza 4P's India")
  y = 24

  const top15Img = await renderChart('bar',
    top20.slice(0, 15).map(([n]) => n.length > 22 ? n.slice(0, 22) + '…' : n),
    [{ data: top20.slice(0, 15).map(([, v]) => v), backgroundColor: 'rgba(105,88,194,0.82)', borderRadius: 6 }],
    { legend: false, w: 820, h: 420, extra: { indexAxis: 'y' } }
  )
  y = addChart(doc, top15Img, ML, y, CW, 108, 'Top 15 Items — Net Revenue Performance Ranking')

  // ── Page 6 — Insights ─────────────────────────────────────────
  doc.addPage()
  pageHeader(doc, 'Revenue Intelligence', 6, TOTAL)
  pageFooter(doc, "Revenue Intelligence  —  Pizza 4P's India")
  y = 24
  y = secTitle(doc, 'Revenue Intelligence — Executive Insights', y)
  const avgDailyRev = allDays.length ? allDays.reduce((s, r) => s + (r.net_revenue || 0), 0) / allDays.length : 0
  insightBox(doc, [
    `Revenue trajectory: ${months.length > 1 ? `${mom(lk.net_revenue, pk.net_revenue)?.label || '—'} month-on-month` : 'First month on record — no prior period for comparison'}`,
    `Average daily revenue across all loaded months: ${fc(avgDailyRev, false, currency, fxRates)}`,
    `Total unique menu items contributing to revenue: ${Object.keys(itemAgg).length} items`,
    `Top item "${top20[0]?.[0] || '—'}" contributes ${totalRev ? (top20[0][1] / totalRev * 100).toFixed(1) + '%' : '—'} of total ranked revenue`,
    `Top revenue category: ${allCats.reduce((best, c) => { const v = months.reduce((s, m) => s + (catChData[m]?.categories?.[c] || 0), 0); return v > (catChData.__best || 0) ? (catChData.__best = v, c) : best }, '—')}`,
    `Average bill trend: ${fc(lk.avg_bill, false, currency, fxRates)} vs ${prev ? fc(pk.avg_bill, false, currency, fxRates) : 'N/A'} prior month`,
    `Discount intensity: ${lk.net_revenue ? fmtPct((lk.total_discount || 0) / lk.net_revenue) : '—'} of Net Revenue — monitor for margin erosion`,
  ], y)

  doc.save(`Pizza4PS_Revenue_Intelligence_${latest}.pdf`)
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 3 — COGS & MARGIN
═══════════════════════════════════════════════════════════════════ */
export async function exportCOGSMarginPDF(currency = 'INR', fxRates = null, filters = {}) {
  const [kR, cR] = await Promise.all([
    apiFetch('/data/kpi',  filters),
    apiFetch('/data/cogs', filters),
  ])
  const kpiData = kR.data || {}, cogsData = cR.data || {}
  const months  = Object.keys(cogsData).sort()
  if (!months.length) { alert('No COGS data uploaded.'); return }

  const TOTAL  = 5
  const latest = months[months.length - 1]
  const lk = kpiData[latest] || {}, lc = cogsData[latest] || {}
  const period = filters?.months?.length
    ? filters.months.join('  ·  ')
    : months.length === 1 ? latest : `${months[0]}  —  ${months[months.length - 1]}`
  const nr = lk.net_revenue || 0
  const gp = nr - (lc.accounting_cog || 0)

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  drawCover(doc, {
    abbr: 'CM', title: 'COGS & Margin Analysis', subtitle: 'Cost of Goods Sold, Variance & Gross Profit',
    period,
    kpis: [
      { label: 'Net Revenue',    value: fc(nr, true, currency, fxRates),                   col: C.purple },
      { label: 'Accounting COG', value: fc(lc.accounting_cog, true, currency, fxRates),    col: C.red    },
      { label: 'Gross Margin',   value: fc(gp, true, currency, fxRates),                   col: C.green  },
      { label: 'Gross Profit %', value: nr ? fmtPct(gp / nr) : '—',                        col: C.green  },
    ],
  })

  // ── Page 2 — COGS KPIs ────────────────────────────────────────
  doc.addPage()
  pageHeader(doc, 'COGS & Margin', 2, TOTAL)
  pageFooter(doc, "COGS & Margin  —  Pizza 4P's India")
  let y = 24
  y = secTitle(doc, 'COGS Performance Summary — Latest Month', y)
  y = kpiGrid(doc, [
    { label: 'Accounting COG',   value: fc(lc.accounting_cog, true, currency, fxRates),                     col: C.red    },
    { label: 'Standard COG',     value: fc(lc.standard_cog,   true, currency, fxRates),                     col: C.amber  },
    { label: 'COG Variance',     value: fc((lc.accounting_cog || 0) - (lc.standard_cog || 0), true, currency, fxRates), col: C.red  },
    { label: 'Food Wastage',     value: fc(lc.wastage,         true, currency, fxRates),                     col: C.amber  },
    { label: 'Store Variance',   value: fc(lc.store_variance,  true, currency, fxRates),                     col: C.red    },
    { label: 'Total Adjustments',value: fc(lc.total_adj,       true, currency, fxRates),                     col: C.t2     },
    { label: 'Gross Margin',     value: fc(gp, true, currency, fxRates),                                     col: C.green  },
    { label: 'Gross Profit %',   value: nr ? fmtPct(gp / nr) : '—',                                          col: C.green  },
  ], y)

  if (months.length > 1) {
    y = secTitle(doc, 'Month-on-Month COGS Comparison', y)
    const rows = months.map(m => {
      const c = cogsData[m] || {}, k = kpiData[m] || {}
      const nr2 = k.net_revenue || 0
      return [m, fc(nr2, true, currency, fxRates), fc(c.accounting_cog, true, currency, fxRates), nr2 ? fmtPct((c.accounting_cog || 0) / nr2) : '—', fc(c.standard_cog, true, currency, fxRates), fc(nr2 - (c.accounting_cog || 0), true, currency, fxRates), nr2 ? fmtPct((nr2 - (c.accounting_cog || 0)) / nr2) : '—']
    })
    drawTable(doc, ['Period', 'Net Rev', 'Acct COG', 'COG %', 'Std COG', 'Gross Margin', 'GP %'], rows, y, [24, 30, 30, 18, 28, 30, 18])
  }

  // ── Page 3 — Charts ───────────────────────────────────────────
  doc.addPage()
  pageHeader(doc, 'COGS & Margin', 3, TOTAL)
  pageFooter(doc, "COGS & Margin  —  Pizza 4P's India")
  y = 24

  const cogImg = await renderChart('bar', months, [
    { label: 'Accounting COG', data: months.map(m => cogsData[m]?.accounting_cog || 0), backgroundColor: 'rgba(239,68,68,0.82)', borderRadius: 5 },
    { label: 'Standard COG',   data: months.map(m => cogsData[m]?.standard_cog   || 0), backgroundColor: 'rgba(245,158,11,0.80)', borderRadius: 5 },
  ], { legend: true, legendPos: 'bottom', w: 820, h: 310 })
  y = addChart(doc, cogImg, ML, y, CW, 75, 'Actual vs Standard COG — Month Comparison')

  const gpPctData = months.map(m => {
    const nr2 = kpiData[m]?.net_revenue || 0
    const cog = cogsData[m]?.accounting_cog || 0
    return nr2 ? parseFloat(((nr2 - cog) / nr2 * 100).toFixed(2)) : 0
  })
  const gpImg = await renderChart('line', months,
    [{ label: 'Gross Profit %', data: gpPctData, borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.15)', fill: true, tension: 0.4, pointRadius: 5, pointBackgroundColor: '#22c55e' }],
    { legend: false, w: 820, h: 290 }
  )
  y = addChart(doc, gpImg, ML, y + 5, CW, 70, 'Gross Profit % Trend')

  // ── Page 4 — Ingredient Groups ────────────────────────────────
  doc.addPage()
  pageHeader(doc, 'COGS & Margin', 4, TOTAL)
  pageFooter(doc, "COGS & Margin  —  Pizza 4P's India")
  y = 24
  y = secTitle(doc, 'Ingredient Group Breakdown — Latest Month', y)

  const groups = lc.groups || {}
  const gKeys  = Object.keys(groups)
  if (gKeys.length) {
    const gRows = gKeys
      .map(g => {
        const gd = groups[g] || {}
        const act = gd.actual || 0, std = gd.standard || 0
        const varPct = std ? ((act - std) / std * 100).toFixed(1) + '%' : '—'
        const flag = std && act > std * 1.1 ? 'OVER 10%' : std && act < std * 0.95 ? 'UNDER 5%' : 'OK'
        return [g, fc(act, true, currency, fxRates), fc(std, true, currency, fxRates), fc(act - std, true, currency, fxRates), varPct, flag]
      })
      .sort((a, b) => parseFloat(b[1].replace(/[^0-9.]/g, '')) - parseFloat(a[1].replace(/[^0-9.]/g, '')))
    drawTable(doc, ['Ingredient Group', 'Actual COG', 'Standard COG', 'Variance', 'Var %', 'Status'], gRows, y, [44, 32, 32, 28, 20, 18])
    y = y + gRows.length * 8 + 20

    if (gKeys.length >= 2) {
      const gImg = await renderChart('bar', gKeys, [
        { label: 'Actual COG',   data: gKeys.map(g => groups[g]?.actual   || 0), backgroundColor: 'rgba(239,68,68,0.82)', borderRadius: 5 },
        { label: 'Standard COG', data: gKeys.map(g => groups[g]?.standard || 0), backgroundColor: 'rgba(245,158,11,0.80)', borderRadius: 5 },
      ], { legend: true, legendPos: 'bottom', w: 820, h: 290 })
      addChart(doc, gImg, ML, y, CW, 70, 'Actual vs Standard COG by Ingredient Group')
    }
  } else {
    txt(doc, 'Ingredient group data not available for this period.', ML, y + 10, { col: C.t2, sz: 9 })
  }

  // ── Page 5 — Insights ─────────────────────────────────────────
  doc.addPage()
  pageHeader(doc, 'COGS & Margin', 5, TOTAL)
  pageFooter(doc, "COGS & Margin  —  Pizza 4P's India")
  y = 24
  y = secTitle(doc, 'COGS & Margin — Executive Insights', y)
  insightBox(doc, [
    `Gross Profit %: ${nr ? fmtPct(gp / nr) : '—'} of Net Revenue — Industry benchmark for fine dining: 60–70%`,
    `Accounting COG: ${fc(lc.accounting_cog, true, currency, fxRates)} | COG % of Net Revenue: ${nr ? fmtPct((lc.accounting_cog || 0) / nr) : '—'}`,
    `COG Variance (Actual vs Standard): ${fc((lc.accounting_cog || 0) - (lc.standard_cog || 0), true, currency, fxRates)} — investigate root causes`,
    `Food Wastage: ${fc(lc.wastage, true, currency, fxRates)} (${nr ? fmtPct((lc.wastage || 0) / nr) : '—'} of Net Rev) — review portioning standards`,
    `Store Variance after wastage: ${fc(lc.store_variance, true, currency, fxRates)} — may indicate theft or mismeasurement`,
    `Total adjustments (Training / Tasting / Gift): ${fc(lc.total_adj, true, currency, fxRates)}`,
    `Action: Ingredients with >10% over-standard consumption require immediate kitchen review`,
  ], y)

  doc.save(`Pizza4PS_COGS_Margin_${latest}.pdf`)
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 4 — SALES ANALYTICS
═══════════════════════════════════════════════════════════════════ */
export async function exportSalesAnalyticsPDF(currency = 'INR', fxRates = null, filters = {}) {
  const [kR, dscR, vdR, gstR, cR] = await Promise.all([
    apiFetch('/data/kpi',      filters),
    apiFetch('/data/discount', filters),
    apiFetch('/data/voids',    filters),
    apiFetch('/data/gst',      filters),
    apiFetch('/data/cat-ch',   filters),
  ])
  const kpiData = kR.data || {}, discData = dscR.data || {}, voidsData = vdR.data || {}, gstData = gstR.data || {}, catChData = cR.data || {}
  const months  = Object.keys(kpiData).sort()
  if (!months.length) { alert('No data uploaded.'); return }

  const TOTAL  = 5
  const latest = months[months.length - 1]
  const lk = kpiData[latest] || {}, ld = discData[latest] || {}, lv = voidsData[latest] || {}, lg = gstData[latest] || {}
  const period = filters?.months?.length
    ? filters.months.join('  ·  ')
    : months.length === 1 ? latest : `${months[0]}  —  ${months[months.length - 1]}`

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  drawCover(doc, {
    abbr: 'SA', title: 'Sales Analytics', subtitle: 'Discount Intelligence, Voids, GST & Category Profitability',
    period,
    kpis: [
      { label: 'Total Discount', value: fc(lk.total_discount, true, currency, fxRates), col: C.pink   },
      { label: 'Cancellations',  value: (lk.cancellations || 0).toLocaleString(),       col: C.red    },
      { label: 'GST Collected',  value: fc(lk.total_gst, true, currency, fxRates),      col: C.cyan   },
      { label: 'Service Charge', value: fc(lk.service_charge, true, currency, fxRates), col: C.violet },
    ],
  })

  // ── Page 2 — KPI Dashboard ────────────────────────────────────
  doc.addPage()
  pageHeader(doc, 'Sales Analytics', 2, TOTAL)
  pageFooter(doc, "Sales Analytics  —  Pizza 4P's India")
  let y = 24
  y = secTitle(doc, 'Sales Analytics KPIs — Latest Month', y)
  const nr = lk.net_revenue || 0
  y = kpiGrid(doc, [
    { label: 'Total Discount',    value: fc(lk.total_discount, true, currency, fxRates),                                    col: C.pink   },
    { label: 'Disc % of Net Rev', value: nr ? fmtPct((lk.total_discount || 0) / nr) : '—',                                  col: C.pink   },
    { label: 'Cancellations',     value: (lk.cancellations || 0).toLocaleString(),                                           col: C.red    },
    { label: 'Cancel Rate',       value: lk.total_invoices ? fmtPct((lk.cancellations || 0) / lk.total_invoices) : '—',      col: C.red    },
    { label: 'GST Collected',     value: fc(lk.total_gst, true, currency, fxRates),                                         col: C.cyan   },
    { label: 'Service Charge',    value: fc(lk.service_charge, true, currency, fxRates),                                    col: C.violet },
    { label: 'Net Revenue',       value: fc(lk.net_revenue, true, currency, fxRates),                                       col: C.purple },
    { label: 'Invoices',          value: (lk.total_invoices || 0).toLocaleString(),                                          col: C.blue   },
  ], y)

  // Monthly discount trend table
  if (months.length > 1) {
    y = secTitle(doc, 'Discount & Cancellation Trend', y)
    const rows = months.map(m => {
      const d = kpiData[m] || {}
      const nr2 = d.net_revenue || 0
      return [m, fc(d.total_discount, true, currency, fxRates), nr2 ? fmtPct((d.total_discount || 0) / nr2) : '—', (d.cancellations || 0).toString(), d.total_invoices ? fmtPct((d.cancellations || 0) / d.total_invoices) : '—']
    })
    drawTable(doc, ['Period', 'Total Discount', 'Disc % of NR', 'Cancellations', 'Cancel Rate'], rows, y, [28, 36, 32, 30, 28])
  }

  // ── Page 3 — Discount & Voids Charts ─────────────────────────
  doc.addPage()
  pageHeader(doc, 'Sales Analytics', 3, TOTAL)
  pageFooter(doc, "Sales Analytics  —  Pizza 4P's India")
  y = 24

  const dscCh = ld.by_channel || {}
  const dscChKeys = Object.keys(dscCh)
  if (dscChKeys.length) {
    const dscImg = await renderChart('bar', dscChKeys,
      [{ label: 'Discount', data: dscChKeys.map(k => dscCh[k]?.disc || dscCh[k] || 0), backgroundColor: 'rgba(236,72,153,0.82)', borderRadius: 7 }],
      { legend: false, w: 820, h: 300 }
    )
    y = addChart(doc, dscImg, ML, y, CW, 72, 'Discount Distribution by Ordering Channel')
  }

  const vdCh = lv.by_channel || {}
  const vdKeys = Object.keys(vdCh)
  if (vdKeys.length) {
    const vdImg = await renderChart('bar', vdKeys,
      [{ label: 'Cancellations', data: vdKeys.map(k => vdCh[k] || 0), backgroundColor: 'rgba(239,68,68,0.82)', borderRadius: 7 }],
      { legend: false, w: 820, h: 300 }
    )
    y = addChart(doc, vdImg, ML, y + 6, CW, 72, 'Cancellations by Ordering Channel')
  }

  if (!dscChKeys.length && !vdKeys.length) {
    txt(doc, 'Detailed discount and void data requires Discount & Voids modules to be uploaded.', ML, y + 16, { col: C.t2, sz: 9, maxW: CW })
  }

  // ── Page 4 — GST Summary ──────────────────────────────────────
  doc.addPage()
  pageHeader(doc, 'Sales Analytics', 4, TOTAL)
  pageFooter(doc, "Sales Analytics  —  Pizza 4P's India")
  y = 24
  y = secTitle(doc, 'GST Summary — Tax Liability Breakdown', y)

  const slabs = lg.slabs || lg.by_slab || []
  if (slabs.length) {
    const gstRows = slabs.map(s => {
      const rate  = s.rate != null ? (s.rate * 100).toFixed(0) : s.gst_rate != null ? (s.gst_rate * 100).toFixed(0) : '—'
      const tot   = s.gst || s.total_gst || 0
      return [`${rate}%`, fc(s.taxable || s.nr || 0, true, currency, fxRates), fc(tot, true, currency, fxRates), fc(tot / 2, true, currency, fxRates), fc(tot / 2, true, currency, fxRates), (s.qty || 0).toLocaleString()]
    })
    y = drawTable(doc, ['Slab', 'Taxable Value', 'Total GST', 'CGST', 'SGST', 'Qty'], gstRows, y, [22, 38, 28, 28, 28, 20])

    const gstImg = await renderChart('doughnut',
      slabs.map(s => `${s.rate != null ? s.rate * 100 : s.gst_rate != null ? s.gst_rate * 100 : 0}% Slab`),
      [{ data: slabs.map(s => s.gst || s.total_gst || 0), backgroundColor: ['rgba(6,182,212,0.85)', 'rgba(105,88,194,0.85)', 'rgba(34,197,94,0.85)'], borderWidth: 2, borderColor: '#fff' }],
      { legend: true, legendPos: 'right', w: 680, h: 290 }
    )
    addChart(doc, gstImg, ML, y + 4, 110, 68, 'GST Distribution by Tax Slab')
  } else {
    const kpigst = [
      { label: 'Total GST',      value: fc(lk.total_gst,      true, currency, fxRates), col: C.cyan   },
      { label: 'Service Charge', value: fc(lk.service_charge, true, currency, fxRates), col: C.violet },
      { label: 'Net Revenue',    value: fc(lk.net_revenue,    true, currency, fxRates), col: C.purple },
      { label: 'Effective GST%', value: lk.net_revenue ? fmtPct((lk.total_gst || 0) / lk.net_revenue) : '—', col: C.cyan },
    ]
    kpiGrid(doc, kpigst, y)
  }

  // ── Page 5 — Insights ─────────────────────────────────────────
  doc.addPage()
  pageHeader(doc, 'Sales Analytics', 5, TOTAL)
  pageFooter(doc, "Sales Analytics  —  Pizza 4P's India")
  y = 24
  y = secTitle(doc, 'Sales Analytics — Executive Insights', y)
  insightBox(doc, [
    `Discount % of Net Revenue: ${nr ? fmtPct((lk.total_discount || 0) / nr) : '—'} — sustained >5% warrants management review`,
    `Cancellation rate: ${lk.total_invoices ? fmtPct((lk.cancellations || 0) / lk.total_invoices) : '—'} — industry target is below 1.5%`,
    `GST collected: ${fc(lk.total_gst, true, currency, fxRates)} — statutory liability, must be remitted to GSTN`,
    `Service charge: ${fc(lk.service_charge, true, currency, fxRates)} at 10% of Net Revenue per outlet policy`,
    `High channel-specific discount may indicate unauthorized discounting — Handy/TTO channels warrant audit`,
    `End-of-shift cancellations (9 PM–11 PM) should be cross-checked with physical POS logs`,
    `GSTR-1 filing: export the GST Summary CSV from the dashboard for monthly filing`,
  ], y)

  doc.save(`Pizza4PS_Sales_Analytics_${latest}.pdf`)
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 5 — OPERATIONS ANALYTICS
═══════════════════════════════════════════════════════════════════ */
export async function exportOperationsPDF(currency = 'INR', fxRates = null, filters = {}) {
  const [kR, hR, tiR] = await Promise.all([
    apiFetch('/data/kpi',          filters),
    apiFetch('/data/hourly',       filters),
    apiFetch('/data/top-invoices', filters),
  ])
  const kpiData = kR.data || {}, hourlyData = hR.data || {}, topInvData = tiR.data || {}
  const months  = Object.keys(kpiData).sort()
  if (!months.length) { alert('No data uploaded.'); return }

  const TOTAL  = 4
  const latest = months[months.length - 1]
  const lk = kpiData[latest] || {}
  const period = filters?.months?.length
    ? filters.months.join('  ·  ')
    : months.length === 1 ? latest : `${months[0]}  —  ${months[months.length - 1]}`

  const hrAgg = {}
  months.forEach(m => {
    const d = hourlyData[m] || {}
    Object.entries(d).forEach(([h, v]) => hrAgg[h] = (hrAgg[h] || 0) + v)
  })
  const hours    = Array.from({ length: 13 }, (_, i) => i + 11)
  const peakHour = hours.reduce((best, h) => (hrAgg[h] || hrAgg[String(h)] || 0) > (hrAgg[best] || hrAgg[String(best)] || 0) ? h : best, 11)
  const lunchRev = [11, 12, 13, 14, 15].reduce((s, h) => s + (hrAgg[h] || hrAgg[String(h)] || 0), 0)
  const dinnerRev = [18, 19, 20, 21, 22, 23].reduce((s, h) => s + (hrAgg[h] || hrAgg[String(h)] || 0), 0)

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  drawCover(doc, {
    abbr: 'OP', title: 'Operations Analytics', subtitle: 'Peak Hours, Table Performance & Top Invoices',
    period,
    kpis: [
      { label: 'Invoices',      value: (lk.total_invoices || 0).toLocaleString(),  col: C.blue   },
      { label: 'Average Bill',  value: fc(lk.avg_bill, false, currency, fxRates), col: C.amber  },
      { label: 'Peak Hour',     value: fmt12h(peakHour),                           col: C.purple },
      { label: 'Cancellations', value: (lk.cancellations || 0).toLocaleString(),   col: C.red    },
    ],
  })

  // ── Page 2 — KPIs & Peak Hours Chart ─────────────────────────
  doc.addPage()
  pageHeader(doc, 'Operations Analytics', 2, TOTAL)
  pageFooter(doc, "Operations Analytics  —  Pizza 4P's India")
  let y = 24
  y = secTitle(doc, 'Operational KPIs', y)
  y = kpiGrid(doc, [
    { label: 'Total Invoices',  value: (lk.total_invoices || 0).toLocaleString(),  col: C.blue   },
    { label: 'Average Bill',    value: fc(lk.avg_bill, false, currency, fxRates), col: C.amber  },
    { label: 'Net Revenue',     value: fc(lk.net_revenue, true, currency, fxRates), col: C.purple },
    { label: 'Cancellations',   value: (lk.cancellations || 0).toLocaleString(),   col: C.red    },
    { label: 'Peak Hour',       value: fmt12h(peakHour),                            col: C.purple },
    { label: 'Lunch Revenue',   value: fc(lunchRev, true, currency, fxRates),      col: C.amber  },
    { label: 'Dinner Revenue',  value: fc(dinnerRev, true, currency, fxRates),     col: C.blue   },
    { label: 'Service Charge',  value: fc(lk.service_charge, true, currency, fxRates), col: C.violet },
  ], y)

  const hrLabels = hours.map(fmt12h)
  const hrVals   = hours.map(h => hrAgg[h] || hrAgg[String(h)] || 0)
  const hrImg = await renderChart('bar', hrLabels,
    [{
      data: hrVals,
      backgroundColor: hours.map(h => h >= 18 && h <= 21 ? 'rgba(105,88,194,0.9)' : h >= 12 && h <= 14 ? 'rgba(245,158,11,0.82)' : 'rgba(105,88,194,0.45)'),
      borderRadius: 5,
    }],
    { legend: false, w: 820, h: 310 }
  )
  y = addChart(doc, hrImg, ML, y + 5, CW, 76, `Peak Hours — Revenue by Hour (IST)  |  Peak Hour: ${fmt12h(peakHour)}  |  Purple = Evening, Amber = Lunch`)

  // ── Page 3 — Top Invoices ─────────────────────────────────────
  doc.addPage()
  pageHeader(doc, 'Operations Analytics', 3, TOTAL)
  pageFooter(doc, "Operations Analytics  —  Pizza 4P's India")
  y = 24
  y = secTitle(doc, 'Top 20 Invoices by Value — Highest Billing Transactions', y)

  const allInv = Object.values(topInvData).flat().sort((a, b) => (b.nr || b.net_revenue || 0) - (a.nr || a.net_revenue || 0)).slice(0, 20)
  if (allInv.length) {
    const invRows = allInv.map((inv, i) => [
      i + 1,
      inv.invoice_key || inv.date || '—',
      inv.date || '—',
      fmt12h(inv.ist_hour || 0),
      (inv.table || inv.table_name || '—').slice(0, 12),
      inv.channel || '—',
      fc(inv.nr || inv.net_revenue || 0, false, currency, fxRates),
    ])
    drawTable(doc, ['#', 'Invoice', 'Date', 'Time', 'Table', 'Channel', 'Net Rev'], invRows, y, [10, 34, 24, 16, 22, 20, 22], 7.5)
  } else {
    txt(doc, 'Top invoice data not available. Ensure revenue files are uploaded.', ML, y + 12, { col: C.t2, sz: 9 })
  }

  // Lunch vs Dinner comparison chart
  const ldImg = await renderChart('bar', ['Lunch (11AM–3PM)', 'Afternoon (3PM–6PM)', 'Dinner (6PM–11PM)'],
    [{ data: [lunchRev, hours.filter(h => h >= 15 && h < 18).reduce((s, h) => s + (hrAgg[h] || hrAgg[String(h)] || 0), 0), dinnerRev], backgroundColor: ['rgba(245,158,11,0.85)', 'rgba(59,130,246,0.65)', 'rgba(105,88,194,0.85)'], borderRadius: 8 }],
    { legend: false, w: 820, h: 290 }
  )
  const afterInvoices = y + (allInv.length > 0 ? allInv.length * 7.5 + 28 : 24)
  addChart(doc, ldImg, ML, Math.min(afterInvoices, PH - 100), CW, 72, 'Lunch vs Afternoon vs Dinner Revenue Split — All Months')

  // ── Page 4 — Insights ─────────────────────────────────────────
  doc.addPage()
  pageHeader(doc, 'Operations Analytics', 4, TOTAL)
  pageFooter(doc, "Operations Analytics  —  Pizza 4P's India")
  y = 24
  y = secTitle(doc, 'Operations Analytics — Executive Insights', y)
  insightBox(doc, [
    `Peak trading hour: ${fmt12h(peakHour)} — concentrate staff and service resources at this time`,
    `Total invoices processed: ${(lk.total_invoices || 0).toLocaleString()} | Average bill: ${fc(lk.avg_bill, false, currency, fxRates)}`,
    `Lunch revenue (11AM–3PM): ${fc(lunchRev, true, currency, fxRates)} | Dinner revenue (6PM–11PM): ${fc(dinnerRev, true, currency, fxRates)}`,
    `Lunch-to-Dinner revenue ratio: ${(lunchRev + dinnerRev) > 0 ? (lunchRev / (lunchRev + dinnerRev) * 100).toFixed(0) + '%' : '—'} lunch vs ${(lunchRev + dinnerRev) > 0 ? (dinnerRev / (lunchRev + dinnerRev) * 100).toFixed(0) + '%' : '—'} dinner`,
    `Cancellation count: ${lk.cancellations || 0} — review end-of-shift voids (9 PM–11 PM) for anomalies`,
    `Table turnover optimization: focus on ${fmt12h(peakHour)} ± 2 hours for maximum revenue per cover`,
    `Staff scheduling recommendation: build rosters around peak hour cluster for optimal service quality`,
  ], y)

  doc.save(`Pizza4PS_Operations_Analytics_${latest}.pdf`)
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 6 — FINANCIAL STATEMENTS  (P&L + Balance Sheet)
═══════════════════════════════════════════════════════════════════ */
export async function exportFinancialStatementsPDF(currency = 'INR', fxRates = null, filters = {}) {
  const [pnlR, bsR] = await Promise.all([
    api.get('/data/pnl-from-gl').catch(() => ({ data: null })),
    api.get('/data/bs-statement').catch(() => ({ data: null })),
  ])
  const pnl = pnlR.data || null
  const bs  = bsR.data  || null

  if (!pnl?.available && !bs?.available) {
    alert('No Financial Statement data uploaded. Please upload P&L and Balance Sheet files in Admin.')
    return
  }

  // ── Helpers ──────────────────────────────────────────────────────
  function getStoreVal(dataMap, store, code) {
    return (dataMap?.[store] || {})[String(code)] || 0
  }
  function getLevel(code) {
    const s = String(code)
    let t = 0
    for (let i = s.length - 1; i >= 0 && s[i] === '0'; i--) t++
    if (t >= 5) return 0
    if (t >= 4) return 1
    if (t >= 2) return 2
    return 3
  }

  const pnlHier    = pnl?.hierarchy || []
  const pnlStores  = pnl?.stores    || []
  const pnlActuals = pnl?.actuals   || {}
  const pnlPrior   = pnl?.prior     || {}
  const pnlPeriods = pnl?.available_periods || []

  const bsHier    = bs?.hierarchy || []
  const bsStores  = bs?.stores    || []
  const bsActuals = bs?.actuals   || {}
  const bsPeriods = bs?.available_periods || []

  // Consolidated store column (prefer "Total" column)
  const pnlStore = pnlStores.find(s => s.toLowerCase().includes('total')) || pnlStores[0] || ''
  const bsStore  = bsStores.find(s => s.toLowerCase().includes('total'))  || bsStores[0]  || ''

  // Key P&L values
  const nr        = getStoreVal(pnlActuals, pnlStore, 100000)
  const gp        = getStoreVal(pnlActuals, pnlStore, 300000)
  const ebitda    = getStoreVal(pnlActuals, pnlStore, 400000)
  const netProfit = getStoreVal(pnlActuals, pnlStore, 700000)
  const priorNr   = getStoreVal(pnlPrior,   pnlStore, 100000)

  const latestPnlPeriod = pnlPeriods.length
    ? `${pnlPeriods[pnlPeriods.length - 1].year}-${String(pnlPeriods[pnlPeriods.length - 1].month).padStart(2, '0')}`
    : '—'
  const period = pnlPeriods.length
    ? pnlPeriods.length === 1
      ? latestPnlPeriod
      : `${pnlPeriods[0].year}-${String(pnlPeriods[0].month).padStart(2,'0')}  —  ${latestPnlPeriod}`
    : '—'

  const TOTAL = 6
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  // ── Cover ─────────────────────────────────────────────────────
  drawCover(doc, {
    abbr: 'FS', title: 'Financial Statements', subtitle: 'Profit & Loss Statement and Balance Sheet',
    period,
    kpis: [
      { label: 'Net Revenue',  value: fc(nr,        true, currency, fxRates), col: C.purple },
      { label: 'Gross Profit', value: fc(gp,        true, currency, fxRates), col: C.green  },
      { label: 'EBITDA',       value: fc(ebitda,    true, currency, fxRates), col: C.blue   },
      { label: 'Net Profit',   value: fc(netProfit, true, currency, fxRates), col: netProfit >= 0 ? C.green : C.red },
    ],
  })

  // ── Page 2 — P&L KPI Cards ────────────────────────────────────
  doc.addPage()
  pageHeader(doc, 'Financial Statements', 2, TOTAL)
  pageFooter(doc, "Financial Statements  —  Pizza 4P's India")
  let y = 24
  y = secTitle(doc, 'Profit & Loss — Key Financial Metrics', y)
  y = kpiGrid(doc, [
    { label: 'Net Revenue',    value: fc(nr,        true, currency, fxRates), col: C.purple, trend: mom(nr, priorNr) },
    { label: 'Gross Profit',   value: fc(gp,        true, currency, fxRates), col: C.green,  trend: nr ? { label: fmtPct(gp / nr), positive: gp >= 0 } : null },
    { label: 'EBITDA',         value: fc(ebitda,    true, currency, fxRates), col: C.blue,   trend: nr ? { label: fmtPct(ebitda / nr), positive: ebitda >= 0 } : null },
    { label: 'Net Profit',     value: fc(netProfit, true, currency, fxRates), col: netProfit >= 0 ? C.green : C.red, trend: nr ? { label: fmtPct(netProfit / nr), positive: netProfit >= 0 } : null },
  ], y)

  // P&L summary chart (Net Rev → GP → EBITDA → Net Profit waterfall-style bar)
  if (nr || gp || ebitda || netProfit) {
    const pfImg = await renderChart('bar',
      ['Net Revenue', 'Gross Profit', 'EBITDA', 'Net Profit'],
      [{
        data: [nr, gp, ebitda, netProfit],
        backgroundColor: [
          'rgba(105,88,194,0.85)',
          'rgba(34,197,94,0.85)',
          'rgba(59,130,246,0.85)',
          netProfit >= 0 ? 'rgba(34,197,94,0.85)' : 'rgba(239,68,68,0.85)',
        ],
        borderRadius: 8,
      }],
      { legend: false, w: 820, h: 310 }
    )
    y = addChart(doc, pfImg, ML, y + 4, CW, 76, 'P&L Funnel — Revenue to Net Profit')
  }

  // MoM P&L summary if multi-period available
  if (pnlPeriods.length > 1) {
    y = secTitle(doc, 'Period-on-Period P&L Summary', y)
    const pRows = pnlPeriods.slice(-6).map(p => {
      const mk  = `${p.year}-${String(p.month).padStart(2,'0')}`
      const act = pnlActuals[mk] || pnlActuals
      const nr2   = getStoreVal({ [pnlStore]: act }, pnlStore, 100000)
      const gp2   = getStoreVal({ [pnlStore]: act }, pnlStore, 300000)
      const eb2   = getStoreVal({ [pnlStore]: act }, pnlStore, 400000)
      const np2   = getStoreVal({ [pnlStore]: act }, pnlStore, 700000)
      return [mk, fc(nr2, true, currency, fxRates), fc(gp2, true, currency, fxRates), nr2 ? fmtPct(gp2 / nr2) : '—', fc(eb2, true, currency, fxRates), fc(np2, true, currency, fxRates), nr2 ? fmtPct(np2 / nr2) : '—']
    })
    drawTable(doc, ['Period', 'Net Revenue', 'Gross Profit', 'GP %', 'EBITDA', 'Net Profit', 'NP %'], pRows, y, [24, 30, 28, 18, 28, 28, 18])
  }

  // ── Page 3 — Full P&L Statement ───────────────────────────────
  doc.addPage()
  pageHeader(doc, 'Financial Statements', 3, TOTAL)
  pageFooter(doc, "Financial Statements  —  Pizza 4P's India")
  y = 24
  y = secTitle(doc, `Profit & Loss Statement  —  ${latestPnlPeriod}  |  ${pnlStore || 'Consolidated'}`, y)

  if (pnlHier.length) {
    // Table header
    fill(doc, C.purple, ML, y, CW, 9)
    txt(doc, 'LINE ITEM', ML + 3, y + 6.5, { col: C.white, sz: 6.5, bold: true })
    txt(doc, 'AMOUNT', ML + CW - 30, y + 6.5, { col: C.white, sz: 6.5, bold: true, align: 'center' })
    txt(doc, '% OF NR', ML + CW - 3, y + 6.5, { col: C.white, sz: 6.5, bold: true, align: 'right' })
    y += 11

    const LEVEL_INDENT = [0, 3, 8, 14]
    const LEVEL_SZ     = [9.5, 8.5, 7.5, 7]
    const LEVEL_BOLD   = [true, true, false, false]
    const LEVEL_BG     = [C.dark, C.purpleBg, C.white, C.lightBg]
    const LEVEL_COL    = [C.white, C.t1, C.t1, C.t2]

    pnlHier.forEach(row => {
      if (y > PH - 26) return
      const level = getLevel(row.code)
      const val   = getStoreVal(pnlActuals, pnlStore, row.code)
      const pct   = nr ? val / nr : null
      const bgCol = LEVEL_BG[Math.min(level, 3)]
      const rowH  = level === 0 ? 9 : 7.5

      fill(doc, bgCol, ML, y, CW, rowH)

      const indent = LEVEL_INDENT[Math.min(level, 3)]
      const sz     = LEVEL_SZ[Math.min(level, 3)]
      const bold   = LEVEL_BOLD[Math.min(level, 3)]
      const col    = LEVEL_COL[Math.min(level, 3)]
      const label  = row.label || row.name || String(row.code)

      txt(doc, label.length > 44 ? label.slice(0, 44) + '…' : label, ML + indent, y + rowH - 2, { col, sz, bold })

      if (val !== 0) {
        txt(doc, fc(val, true, currency, fxRates), ML + CW - 32, y + rowH - 2, { col, sz, bold, align: 'right' })
      }
      if (pct !== null && level > 0) {
        txt(doc, fmtPct(pct), ML + CW - 2, y + rowH - 2, { col: C.t3, sz: 6.5, align: 'right' })
      }

      ln(doc, C.border, ML, y + rowH, ML + CW, y + rowH, 0.15)
      y += rowH
    })
  } else {
    txt(doc, 'P&L data not available. Upload P&L files in Admin → Data Upload.', ML, y + 14, { col: C.t2, sz: 9, maxW: CW })
  }

  // ── Page 4 — Balance Sheet ────────────────────────────────────
  doc.addPage()
  pageHeader(doc, 'Financial Statements', 4, TOTAL)
  pageFooter(doc, "Financial Statements  —  Pizza 4P's India")
  y = 24

  const latestBsPeriod = bsPeriods.length
    ? `${bsPeriods[bsPeriods.length - 1].year}-${String(bsPeriods[bsPeriods.length - 1].month).padStart(2, '0')}`
    : '—'

  y = secTitle(doc, `Balance Sheet  —  ${latestBsPeriod}  |  ${bsStore || 'Consolidated'}`, y)

  if (bsHier.length) {
    fill(doc, C.purple, ML, y, CW, 9)
    txt(doc, 'LINE ITEM', ML + 3, y + 6.5, { col: C.white, sz: 6.5, bold: true })
    txt(doc, 'AMOUNT', ML + CW - 3, y + 6.5, { col: C.white, sz: 6.5, bold: true, align: 'right' })
    y += 11

    const LEVEL_BG  = [C.dark, C.purpleBg, C.white, C.lightBg]
    const LEVEL_COL = [C.white, C.t1, C.t1, C.t2]
    const LEVEL_INDENT = [0, 3, 8, 14]

    bsHier.forEach(row => {
      if (y > PH - 26) return
      const level = getLevel(row.code)
      const val   = getStoreVal(bsActuals, bsStore, row.code)
      const bgCol = LEVEL_BG[Math.min(level, 3)]
      const rowH  = level === 0 ? 9 : 7.5

      fill(doc, bgCol, ML, y, CW, rowH)

      const indent = LEVEL_INDENT[Math.min(level, 3)]
      const sz     = [9.5, 8.5, 7.5, 7][Math.min(level, 3)]
      const bold   = level <= 1
      const col    = LEVEL_COL[Math.min(level, 3)]
      const label  = row.label || row.name || String(row.code)

      txt(doc, label.length > 50 ? label.slice(0, 50) + '…' : label, ML + indent, y + rowH - 2, { col, sz, bold })
      if (val !== 0) {
        txt(doc, fc(val, true, currency, fxRates), ML + CW - 2, y + rowH - 2, { col, sz, bold, align: 'right' })
      }
      ln(doc, C.border, ML, y + rowH, ML + CW, y + rowH, 0.15)
      y += rowH
    })
  } else {
    txt(doc, 'Balance Sheet data not available. Upload Balance Sheet files in Admin → Data Upload.', ML, y + 14, { col: C.t2, sz: 9, maxW: CW })
  }

  // ── Page 5 — P&L Trend Chart ──────────────────────────────────
  doc.addPage()
  pageHeader(doc, 'Financial Statements', 5, TOTAL)
  pageFooter(doc, "Financial Statements  —  Pizza 4P's India")
  y = 24

  if (pnlPeriods.length >= 2) {
    const mLabels = pnlPeriods.map(p => `${p.year}-${String(p.month).padStart(2,'0')}`)
    const trendImg = await renderChart('line', mLabels, [
      { label: 'Net Revenue', data: mLabels.map(mk => getStoreVal({ [pnlStore]: pnlActuals[mk] || pnlActuals }, pnlStore, 100000)), borderColor: '#6958C2', backgroundColor: 'rgba(105,88,194,0.1)', fill: true, tension: 0.4, pointRadius: 4 },
      { label: 'Gross Profit', data: mLabels.map(mk => getStoreVal({ [pnlStore]: pnlActuals[mk] || pnlActuals }, pnlStore, 300000)), borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', fill: true, tension: 0.4, pointRadius: 4 },
      { label: 'Net Profit',   data: mLabels.map(mk => getStoreVal({ [pnlStore]: pnlActuals[mk] || pnlActuals }, pnlStore, 700000)), borderColor: '#3b82f6', tension: 0.4, pointRadius: 4 },
    ], { legend: true, legendPos: 'bottom', w: 820, h: 320 })
    y = addChart(doc, trendImg, ML, y, CW, 78, 'P&L Trend — Net Revenue, Gross Profit & Net Profit')
  }

  // GP% and NP% margin trend
  if (pnlPeriods.length >= 2) {
    const mLabels = pnlPeriods.map(p => `${p.year}-${String(p.month).padStart(2,'0')}`)
    const marginImg = await renderChart('line', mLabels, [
      { label: 'GP %',  data: mLabels.map(mk => { const nr2 = getStoreVal({ [pnlStore]: pnlActuals[mk] || pnlActuals }, pnlStore, 100000); const gp2 = getStoreVal({ [pnlStore]: pnlActuals[mk] || pnlActuals }, pnlStore, 300000); return nr2 ? parseFloat((gp2/nr2*100).toFixed(2)) : 0 }), borderColor: '#22c55e', tension: 0.4, pointRadius: 4, pointBackgroundColor: '#22c55e' },
      { label: 'NP %',  data: mLabels.map(mk => { const nr2 = getStoreVal({ [pnlStore]: pnlActuals[mk] || pnlActuals }, pnlStore, 100000); const np2 = getStoreVal({ [pnlStore]: pnlActuals[mk] || pnlActuals }, pnlStore, 700000); return nr2 ? parseFloat((np2/nr2*100).toFixed(2)) : 0 }), borderColor: '#3b82f6', tension: 0.4, pointRadius: 4, pointBackgroundColor: '#3b82f6' },
    ], { legend: true, legendPos: 'bottom', w: 820, h: 290 })
    y = addChart(doc, marginImg, ML, y + 6, CW, 72, 'Margin % Trend — Gross Profit % and Net Profit %')
  }

  // ── Page 6 — Insights ─────────────────────────────────────────
  doc.addPage()
  pageHeader(doc, 'Financial Statements', 6, TOTAL)
  pageFooter(doc, "Financial Statements  —  Pizza 4P's India")
  y = 24
  y = secTitle(doc, 'Financial Statements — Executive Insights', y)
  insightBox(doc, [
    `Net Revenue: ${fc(nr, true, currency, fxRates)}${priorNr ? ` (${mom(nr, priorNr)?.label || '—'} vs prior period)` : ''}`,
    `Gross Profit: ${fc(gp, true, currency, fxRates)} | GP Margin: ${nr ? fmtPct(gp / nr) : '—'} of Net Revenue`,
    `EBITDA: ${fc(ebitda, true, currency, fxRates)} | EBITDA Margin: ${nr ? fmtPct(ebitda / nr) : '—'}`,
    `Net Profit: ${fc(netProfit, true, currency, fxRates)} | Net Margin: ${nr ? fmtPct(netProfit / nr) : '—'}`,
    `Available P&L periods: ${pnlPeriods.length} | Balance Sheet periods: ${bsPeriods.length}`,
    `Benchmark: Fine dining GP margin typically 60–70%, EBITDA margin 15–25%`,
    `Action: Review line items where % of Net Revenue has deteriorated month-on-month`,
  ], y)

  doc.save(`Pizza4PS_Financial_Statements_${latestPnlPeriod}.pdf`)
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 7 — INVENTORY & MENU ENGINEERING
═══════════════════════════════════════════════════════════════════ */
export async function exportInventoryMenuPDF(currency = 'INR', fxRates = null, filters = {}) {
  const [kR, cR, mR] = await Promise.all([
    apiFetch('/data/kpi',  filters),
    apiFetch('/data/cogs', filters),
    apiFetch('/data/menu', filters),
  ])
  const kpiData = kR.data || {}, cogsData = cR.data || {}
  const menuData = Array.isArray(mR.data) ? mR.data : []
  const months   = Object.keys(cogsData).sort()
  if (!months.length) { alert('No COGS data uploaded.'); return }

  const TOTAL  = 5
  const latest = months[months.length - 1]
  const lk = kpiData[latest] || {}, lc = cogsData[latest] || {}
  const period = filters?.months?.length
    ? filters.months.join('  ·  ')
    : months.length === 1 ? latest : `${months[0]}  —  ${months[months.length - 1]}`
  const nr = lk.net_revenue || 0
  const ingrs = lc.ingredients || []

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  drawCover(doc, {
    abbr: 'IM', title: 'Inventory & Menu Engineering', subtitle: 'Ingredient Variance, Wastage & Dish Profitability Analysis',
    period,
    kpis: [
      { label: 'Accounting COG', value: fc(lc.accounting_cog, true, currency, fxRates), col: C.red    },
      { label: 'Food Wastage',   value: fc(lc.wastage,        true, currency, fxRates), col: C.amber  },
      { label: 'Store Variance', value: fc(lc.store_variance, true, currency, fxRates), col: C.red    },
      { label: 'Menu Items',     value: menuData.length.toLocaleString(),                col: C.purple },
    ],
  })

  // ── Page 2 — Ingredient KPIs & Top Variance Table ─────────────
  doc.addPage()
  pageHeader(doc, 'Inventory & Menu Engineering', 2, TOTAL)
  pageFooter(doc, "Inventory & Menu Engineering  —  Pizza 4P's India")
  let y = 24
  y = secTitle(doc, 'Inventory KPIs & COGS Breakdown', y)
  y = kpiGrid(doc, [
    { label: 'Accounting COG',  value: fc(lc.accounting_cog, true, currency, fxRates),                           col: C.red    },
    { label: 'Standard COG',    value: fc(lc.standard_cog,   true, currency, fxRates),                           col: C.amber  },
    { label: 'COG Variance',    value: fc((lc.accounting_cog || 0) - (lc.standard_cog || 0), true, currency, fxRates), col: C.red  },
    { label: 'Food Wastage',    value: fc(lc.wastage,         true, currency, fxRates),                           col: C.amber  },
    { label: 'Store Variance',  value: fc(lc.store_variance,  true, currency, fxRates),                           col: C.red    },
    { label: 'Adjustments',     value: fc(lc.total_adj,       true, currency, fxRates),                           col: C.t2     },
    { label: 'Gross Margin',    value: fc(nr - (lc.accounting_cog || 0), true, currency, fxRates),                col: C.green  },
    { label: 'Gross Profit %',  value: nr ? fmtPct((nr - (lc.accounting_cog || 0)) / nr) : '—',                   col: C.green  },
  ], y)

  if (ingrs.length) {
    const topVar = [...ingrs].sort((a, b) => Math.abs(b.variance || 0) - Math.abs(a.variance || 0)).slice(0, 15)
    y = secTitle(doc, 'Top 15 Ingredients by Variance — Latest Month', y)
    const iRows = topVar.map(ing => {
      const varAmt = ing.variance || 0
      const flag = Math.abs(varAmt) > 0 && (ing.std_cog || ing.cog_std || 0) > 0 && Math.abs(varAmt) / (ing.std_cog || ing.cog_std || 1) > 0.1 ? 'REVIEW' : 'OK'
      return [
        (ing.item_desc || ing.name || '—').slice(0, 28),
        (ing.group || '—').slice(0, 14),
        ing.uom || '—',
        fc(ing.actual_cog || ing.amt_actual || 0, true, currency, fxRates),
        fc(ing.std_cog || ing.cog_std || 0, true, currency, fxRates),
        fc(varAmt, true, currency, fxRates),
        flag,
      ]
    })
    drawTable(doc, ['Ingredient', 'Group', 'UOM', 'Actual COG', 'Std COG', 'Variance', 'Flag'], iRows, y, [40, 22, 12, 26, 26, 26, 16], 7.5)
  }

  // ── Page 3 — Variance Charts ──────────────────────────────────
  doc.addPage()
  pageHeader(doc, 'Inventory & Menu Engineering', 3, TOTAL)
  pageFooter(doc, "Inventory & Menu Engineering  —  Pizza 4P's India")
  y = 24

  const groups = lc.groups || {}
  const gKeys  = Object.keys(groups)
  if (gKeys.length >= 2) {
    const gImg = await renderChart('bar', gKeys, [
      { label: 'Actual COG',   data: gKeys.map(g => groups[g]?.actual   || 0), backgroundColor: 'rgba(239,68,68,0.82)', borderRadius: 5 },
      { label: 'Standard COG', data: gKeys.map(g => groups[g]?.standard || 0), backgroundColor: 'rgba(245,158,11,0.80)', borderRadius: 5 },
    ], { legend: true, legendPos: 'bottom', w: 820, h: 320 })
    y = addChart(doc, gImg, ML, y, CW, 80, 'Actual vs Standard COG by Ingredient Group')
  }

  // COGS trend over months
  const cogsMonths = Object.keys(cogsData).sort()
  if (cogsMonths.length >= 2) {
    const ctImg = await renderChart('line', cogsMonths, [
      { label: 'Accounting COG', data: cogsMonths.map(m => cogsData[m]?.accounting_cog || 0), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.12)', fill: true, tension: 0.4, pointRadius: 5 },
      { label: 'Standard COG',   data: cogsMonths.map(m => cogsData[m]?.standard_cog   || 0), borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)',  fill: true, tension: 0.4, pointRadius: 5 },
    ], { legend: true, legendPos: 'bottom', w: 820, h: 290 })
    y = addChart(doc, ctImg, ML, y + 6, CW, 72, 'COG Trend — Accounting vs Standard Over Months')
  }

  // ── Page 4 — Menu Engineering ─────────────────────────────────
  doc.addPage()
  pageHeader(doc, 'Inventory & Menu Engineering', 4, TOTAL)
  pageFooter(doc, "Inventory & Menu Engineering  —  Pizza 4P's India")
  y = 24
  y = secTitle(doc, 'Menu Engineering — Dish Profitability Classification', y)

  if (menuData.length) {
    const avgGP  = menuData.reduce((s, d) => s + (d.gp_pct || 0), 0) / menuData.length
    const avgQty = menuData.reduce((s, d) => s + (d.qty     || 0), 0) / menuData.length
    const stars   = menuData.filter(d => (d.gp_pct || 0) >= avgGP && (d.qty || 0) >= avgQty)
    const plows   = menuData.filter(d => (d.gp_pct || 0) <  avgGP && (d.qty || 0) >= avgQty)
    const puzzles = menuData.filter(d => (d.gp_pct || 0) >= avgGP && (d.qty || 0) <  avgQty)
    const dogs    = menuData.filter(d => (d.gp_pct || 0) <  avgGP && (d.qty || 0) <  avgQty)

    y = kpiGrid(doc, [
      { label: 'Stars  (High GP, High Vol)',     value: stars.length.toString(),   col: C.green  },
      { label: 'Plow Horses (Low GP, High Vol)', value: plows.length.toString(),   col: C.amber  },
      { label: 'Puzzles (High GP, Low Vol)',     value: puzzles.length.toString(), col: C.blue   },
      { label: 'Dogs  (Low GP, Low Vol)',        value: dogs.length.toString(),    col: C.red    },
    ], y)

    if (stars.length) {
      y = secTitle(doc, 'Star Dishes — High Profit & High Volume  (Actively Promote)', y)
      const sRows = stars.slice(0, 12).map((d, i) => [
        i + 1,
        (d.item_name || d.item || '—').slice(0, 30),
        (d.category || d.cat || '—').slice(0, 14),
        fc(d.selling_price || d.price || 0, false, currency, fxRates),
        d.cog_pct != null ? fmtPct(d.cog_pct) : '—',
        d.gp_pct  != null ? fmtPct(d.gp_pct)  : '—',
        (d.qty || 0).toLocaleString(),
      ])
      drawTable(doc, ['#', 'Dish Name', 'Category', 'Price', 'COG %', 'GP %', 'Qty'], sRows, y, [10, 62, 24, 22, 18, 18, 18], 7.5)
    }
  } else {
    txt(doc, 'Menu Engineering data requires COGS file with Cost Decomposition sheet to be uploaded.', ML, y + 12, { col: C.t2, sz: 9, maxW: CW })
  }

  // ── Page 5 — Insights ─────────────────────────────────────────
  doc.addPage()
  pageHeader(doc, 'Inventory & Menu Engineering', 5, TOTAL)
  pageFooter(doc, "Inventory & Menu Engineering  —  Pizza 4P's India")
  y = 24
  y = secTitle(doc, 'Inventory & Menu Engineering — Executive Insights', y)

  const menu = menuData
  const avgGP2  = menu.length ? menu.reduce((s, d) => s + (d.gp_pct || 0), 0) / menu.length : 0
  const avgQty2 = menu.length ? menu.reduce((s, d) => s + (d.qty     || 0), 0) / menu.length : 0

  insightBox(doc, [
    `Food wastage: ${fc(lc.wastage, true, currency, fxRates)} (${nr ? fmtPct((lc.wastage || 0) / nr) : '—'} of Net Revenue) — review kitchen portioning SOPs`,
    `Ingredients with variance >10% above standard must be reviewed for theft, over-portioning, or spoilage`,
    `Store Variance: ${fc(lc.store_variance, true, currency, fxRates)} — difference between COG variance and wastage`,
    `Average menu GP%: ${menu.length ? fmtPct(avgGP2) : '—'} | Average qty sold per item: ${menu.length ? Math.round(avgQty2).toLocaleString() : '—'}`,
    `Star dishes: ${menu.filter(d => (d.gp_pct || 0) >= avgGP2 && (d.qty || 0) >= avgQty2).length} items — these are your highest-profit, highest-volume dishes. Feature prominently.`,
    `Dog dishes: ${menu.filter(d => (d.gp_pct || 0) < avgGP2 && (d.qty || 0) < avgQty2).length} items — candidates for repricing, repositioning, or removal`,
    `Recommended GP% target: 65%+ — reprice dishes below threshold using standard formula: Price = COG / (1 – Target GP%)`,
  ], y)

  doc.save(`Pizza4PS_Inventory_Menu_${latest}.pdf`)
}
