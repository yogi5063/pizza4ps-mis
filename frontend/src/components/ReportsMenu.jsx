import React, { useState, useRef, useEffect } from 'react'
import useSettingsStore from '../store/settingsStore'
import useFilterStore from '../store/filterStore'
import {
  exportOverviewPDF,
  exportRevenueIntelPDF,
  exportCOGSMarginPDF,
  exportSalesAnalyticsPDF,
  exportOperationsPDF,
  exportInventoryMenuPDF,
  exportFinancialStatementsPDF,
} from '../utils/pdfExport'

const REPORTS = [
  {
    id: 'overview',
    label: 'Executive Overview',
    desc: 'Daily Flash & Revenue Snapshot',
    abbr: 'OV',
    col: '#6958C2',
    fn: exportOverviewPDF,
  },
  {
    id: 'revenue',
    label: 'Revenue Intelligence',
    desc: 'Deep-Dive Revenue & Item Analysis',
    abbr: 'RI',
    col: '#22c55e',
    fn: exportRevenueIntelPDF,
  },
  {
    id: 'cogs',
    label: 'COGS & Margin',
    desc: 'Cost, Variance & Gross Profit',
    abbr: 'CM',
    col: '#ef4444',
    fn: exportCOGSMarginPDF,
  },
  {
    id: 'sales',
    label: 'Sales Analytics',
    desc: 'Discount, Voids & GST Summary',
    abbr: 'SA',
    col: '#ec4899',
    fn: exportSalesAnalyticsPDF,
  },
  {
    id: 'ops',
    label: 'Operations Analytics',
    desc: 'Peak Hours & Top Invoices',
    abbr: 'OP',
    col: '#3b82f6',
    fn: exportOperationsPDF,
  },
  {
    id: 'inventory',
    label: 'Inventory & Menu',
    desc: 'Variance & Dish Profitability',
    abbr: 'IM',
    col: '#f59e0b',
    fn: exportInventoryMenuPDF,
  },
  {
    id: 'financial',
    label: 'Financial Statements',
    desc: 'P&L Statement & Balance Sheet',
    abbr: 'FS',
    col: '#0ea5e9',
    fn: exportFinancialStatementsPDF,
  },
]

export default function ReportsMenu() {
  const { currency, fxRates }                                        = useSettingsStore()
  const { selectedMonths, selectedCategories, selectedChannels, selectedStatus } = useFilterStore()
  const [open, setOpen] = useState(false)
  const [busy, setBusy]       = useState(null)   // report id being generated
  const ref                   = useRef(null)

  // Close on outside click
  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  async function generate(report) {
    if (busy) return
    setOpen(false)
    setBusy(report.id)
    const filters = {
      months:     selectedMonths,
      categories: selectedCategories,
      channels:   selectedChannels,
      status:     selectedStatus,
    }
    try {
      await report.fn(currency, fxRates, filters)
    } catch (err) {
      console.error('PDF generation error:', err)
      alert(`Failed to generate report: ${err?.message || 'Unknown error'}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        disabled={!!busy}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 14px',
          borderRadius: 8,
          border: '1px solid #d4cef0',
          background: open ? 'linear-gradient(135deg,#6958C2,#8878D8)' : '#f0eefb',
          color: open ? '#fff' : '#6958C2',
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 13,
          fontWeight: 600,
          cursor: busy ? 'not-allowed' : 'pointer',
          opacity: busy ? 0.7 : 1,
          transition: 'all 0.15s',
          whiteSpace: 'nowrap',
        }}
      >
        {busy ? (
          <>
            <span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid', borderColor: open ? '#fff4' : '#6958C244', borderTopColor: open ? '#fff' : '#6958C2', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            Generating…
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 11h10M7 2v7M4 6l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Download Reports
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 2 }}>
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: 300,
          background: '#fff',
          borderRadius: 12,
          border: '1px solid #e8e6f0',
          boxShadow: '0 8px 32px rgba(13,12,24,0.14)',
          zIndex: 999,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid #f0eefb', background: '#faf9fe' }}>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 12, color: '#1a1830', letterSpacing: '0.04em' }}>
              EXECUTIVE PDF REPORTS
            </div>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: '#a8a6c0', marginTop: 2 }}>
              MIS Reports · Executive Grade · Branded
            </div>
          </div>

          {/* Active filter context */}
          <div style={{ padding: '8px 16px', borderBottom: '1px solid #f0eefb', background: '#fffdf7' }}>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: '#6b6890' }}>
              <span style={{ fontWeight: 600, color: '#1a1830' }}>Data scope: </span>
              {selectedMonths.length
                ? selectedMonths.join(', ')
                : 'All available months'}
              {selectedCategories.length ? ` · ${selectedCategories.join(', ')}` : ''}
              {selectedChannels.length   ? ` · ${selectedChannels.join(', ')}` : ''}
            </div>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 10, color: '#a8a6c0', marginTop: 2 }}>
              {selectedMonths.length || selectedCategories.length || selectedChannels.length
                ? 'Filters active — PDF will match dashboard view'
                : 'No filters — PDF will include all data'}
            </div>
          </div>

          {/* Report list */}
          <div style={{ padding: '6px 0' }}>
            {REPORTS.map(r => (
              <button
                key={r.id}
                onClick={() => generate(r)}
                disabled={!!busy}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: '9px 16px',
                  background: 'transparent',
                  border: 'none',
                  cursor: busy ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f7f5fd'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* Icon circle */}
                <div style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: r.col + '18',
                  border: `1.5px solid ${r.col}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  fontFamily: 'DM Mono, monospace', fontSize: 10, fontWeight: 700, color: r.col,
                }}>
                  {busy === r.id ? (
                    <span style={{ width: 12, height: 12, border: '2px solid', borderColor: r.col + '44', borderTopColor: r.col, borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                  ) : r.abbr}
                </div>

                {/* Labels */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 12.5, color: '#1a1830', marginBottom: 1 }}>
                    {r.label}
                  </div>
                  <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: '#a8a6c0' }}>
                    {r.desc}
                  </div>
                </div>

                {/* PDF badge */}
                <div style={{ fontSize: 9, fontWeight: 700, color: r.col, background: r.col + '18', padding: '2px 6px', borderRadius: 4, fontFamily: 'DM Mono, monospace', flexShrink: 0 }}>
                  PDF
                </div>
              </button>
            ))}
          </div>

          {/* Footer note */}
          <div style={{ padding: '8px 16px 10px', borderTop: '1px solid #f0eefb', background: '#faf9fe' }}>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 10.5, color: '#a8a6c0', lineHeight: 1.5 }}>
              Reports use live data. Generation takes 5–15 seconds per report.
            </div>
          </div>
        </div>
      )}

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
