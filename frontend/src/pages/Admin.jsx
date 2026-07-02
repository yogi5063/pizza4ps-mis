import React, { useEffect, useState, useRef } from 'react'
import api from '../utils/api'
import useSettingsStore from '../store/settingsStore'
import { FX_RATES, FX_SYMBOLS } from '../utils/formatters'

function useOutlets() {
  const [outlets, setOutlets] = useState([])
  useEffect(() => {
    api.get('/masters/tree').then(r => {
      const all = []
      for (const c of (r.data?.countries || [])) {
        for (const l of (c.locations || [])) {
          for (const o of (l.outlets || [])) {
            if (o.active) all.push({ code: o.code, name: o.name })
          }
        }
      }
      setOutlets(all)
    }).catch(() => {})
  }, [])
  return outlets
}

const MONTH_OPTIONS = []
for (let y = 2023; y <= 2026; y++) {
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0')
    MONTH_OPTIONS.push(`${y}-${mm}`)
  }
}

function UploadCard({ type, label, icon, onUpload, loadedMonths = [] }) {
  const [selectedMonth, setSelectedMonth] = useState('')
  const [storeCode, setStoreCode] = useState('')
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState(null)
  const fileRef = useRef()
  const outlets = useOutlets()

  async function handleFile(file) {
    if (!file || !selectedMonth) {
      setMessage({ type: 'error', text: 'Please select a month first.' })
      return
    }
    setUploading(true)
    setMessage(null)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('month_key', selectedMonth)
    if (storeCode) formData.append('store_code', storeCode)
    try {
      await api.post(`/upload/${type}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      const outletLabel = storeCode ? ` (${storeCode})` : ' (Combined)'
      setMessage({ type: 'success', text: `${label} data uploaded for ${selectedMonth}${outletLabel}` })
      onUpload()
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Upload failed. Check file format.' })
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div className="bg-white rounded-xl p-6 flex flex-col gap-4" style={{ border: '1px solid #f0eefb', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <div className="font-sans font-semibold text-t1">{label}</div>
          <div className="text-xs font-sans text-t3 mt-0.5">Excel (.xlsx) format</div>
        </div>
      </div>

      {/* Month selector */}
      <div>
        <label className="text-xs font-sans font-medium text-t2 mb-1.5 block uppercase tracking-wide">Select Month</label>
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
          style={{ border: '1px solid #e8e6f0', color: '#1a1830' }}
        >
          <option value="">-- Select Month --</option>
          {MONTH_OPTIONS.map(m => {
              const [y, mo] = m.split('-')
              const label = new Date(+y, +mo - 1).toLocaleString('en', { month: 'short', year: 'numeric' })
              return <option key={m} value={m}>{label}</option>
            })}
        </select>
      </div>

      {/* Outlet selector */}
      <div>
        <label className="text-xs font-sans font-medium text-t2 mb-1.5 block uppercase tracking-wide">
          Outlet <span style={{ color: '#a8a6c0', fontWeight: 400 }}>(leave blank = combined all outlets)</span>
        </label>
        <select
          value={storeCode}
          onChange={e => setStoreCode(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
          style={{ border: '1px solid #e8e6f0', color: '#1a1830' }}
        >
          <option value="">All Outlets (Combined)</option>
          {outlets.map(o => <option key={o.code} value={o.code}>{o.name} ({o.code})</option>)}
        </select>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all"
        style={{
          borderColor: dragging ? '#6958C2' : '#d4cef0',
          background: dragging ? '#f0eefb' : '#faf9fd',
          minHeight: 100,
          padding: 20,
        }}
      >
        <span className="text-3xl">{uploading ? '⏳' : '📁'}</span>
        <div className="text-sm font-sans text-t2 text-center">
          {uploading ? 'Uploading...' : 'Drag & drop file here, or click to browse'}
        </div>
        <div className="text-xs font-sans text-t3">Supported: .xlsx, .xls</div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.xlsb"
        className="hidden"
        onChange={e => handleFile(e.target.files[0])}
      />

      {message && (
        <div
          className="text-sm font-sans px-3 py-2 rounded-lg"
          style={{
            background: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
            color: message.type === 'success' ? '#16a34a' : '#dc2626',
            border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}`,
          }}
        >
          {message.type === 'success' ? '✅ ' : '❌ '}{message.text}
        </div>
      )}

      {/* Loaded months */}
      {loadedMonths.length > 0 && (
        <div>
          <div className="text-xs font-sans font-semibold text-t2 uppercase tracking-wide mb-2">Loaded Months:</div>
          <div className="flex flex-wrap gap-1.5">
            {loadedMonths.map(m => (
              <span key={m} className="text-xs font-sans font-medium px-2 py-0.5 rounded-full"
                style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac' }}>
                ✓ {m}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs font-sans text-t3 mt-1">
        File naming: <code className="bg-gray-100 px-1 rounded">{type === 'revenue' ? 'Revenue_MM-YYYY.xlsx' : 'COGS_MM-YYYY.xlsx'}</code>
      </div>
    </div>
  )
}

function BSUploadCard({ onUpload }) {
  const [mode, setMode] = useState('full')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState(null)
  const fileRef = useRef()

  async function handleFile(file) {
    if (!file) return
    if (mode === 'month' && !selectedMonth) {
      setMessage({ type: 'error', text: 'Please select a month first.' })
      return
    }
    setUploading(true)
    setMessage(null)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('mode', mode)
    if (mode === 'month') formData.append('month_key', selectedMonth)
    try {
      await api.post('/upload/bs', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setMessage({ type: 'success', text: `Balance Sheet uploaded (${mode === 'full' ? 'Full History' : selectedMonth}).` })
      onUpload()
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Upload failed. Check file format (.xlsb).' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl p-6 flex flex-col gap-4" style={{ border: '1px solid #f0eefb', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">⚖️</span>
        <div>
          <div className="font-sans font-semibold text-t1">Balance Sheet</div>
          <div className="text-xs font-sans text-t3 mt-0.5">Excel Binary (.xlsb) format — Dataworking + BS sheets</div>
        </div>
      </div>

      {/* Mode toggle */}
      <div>
        <label className="text-xs font-sans font-medium text-t2 mb-1.5 block uppercase tracking-wide">Upload Mode</label>
        <div className="flex gap-2">
          {[{ v: 'full', label: 'Full History' }, { v: 'month', label: 'Single Month' }].map(m => (
            <button
              key={m.v}
              onClick={() => setMode(m.v)}
              className="text-xs font-sans font-medium px-3 py-1.5 rounded-lg"
              style={{
                background: mode === m.v ? '#6958C2' : '#f0eefb',
                color: mode === m.v ? '#fff' : '#6958C2',
                border: mode === m.v ? '1px solid #6958C2' : '1px solid #d4cef0',
                cursor: 'pointer',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="text-xs font-sans text-t3 mt-1.5">
          {mode === 'full'
            ? '✓ Full History: uploads all monthly data from one file (recommended)'
            : '✓ Single Month: upload one month at a time and accumulate history'}
        </div>
      </div>

      {/* Month selector — only for month mode */}
      {mode === 'month' && (
        <div>
          <label className="text-xs font-sans font-medium text-t2 mb-1.5 block uppercase tracking-wide">Select Month</label>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none"
            style={{ border: '1px solid #e8e6f0', color: '#1a1830' }}
          >
            <option value="">-- Select Month --</option>
            {MONTH_OPTIONS.map(m => {
              const [y, mo] = m.split('-')
              const label = new Date(+y, +mo - 1).toLocaleString('en', { month: 'short', year: 'numeric' })
              return <option key={m} value={m}>{label}</option>
            })}
          </select>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all"
        style={{
          borderColor: dragging ? '#6958C2' : '#d4cef0',
          background: dragging ? '#f0eefb' : '#faf9fd',
          minHeight: 90, padding: 16,
        }}
      >
        <span className="text-3xl">{uploading ? '⏳' : '📁'}</span>
        <div className="text-sm font-sans text-t2 text-center">
          {uploading ? 'Uploading & parsing...' : 'Drag & drop .xlsb file, or click to browse'}
        </div>
        <div className="text-xs font-sans text-t3">Supported: .xlsb (Excel Binary)</div>
      </div>
      <input ref={fileRef} type="file" accept=".xlsb,.xlsx,.xls" className="hidden"
        onChange={e => handleFile(e.target.files[0])} />

      {message && (
        <div className="text-sm font-sans px-3 py-2 rounded-lg"
          style={{ background: message.type === 'success' ? '#f0fdf4' : '#fef2f2', color: message.type === 'success' ? '#16a34a' : '#dc2626', border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}` }}>
          {message.type === 'success' ? '✅ ' : '❌ '}{message.text}
        </div>
      )}
    </div>
  )
}

function BudgetUploadCard({ onUpload }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState(null)
  const fileRef = useRef()

  async function handleFile(file) {
    if (!file) return
    setUploading(true)
    setMessage(null)
    const formData = new FormData()
    formData.append('file', file)
    try {
      await api.post('/upload/pnl-budget', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setMessage({ type: 'success', text: 'Budget file uploaded and processing started.' })
      onUpload()
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Upload failed.' })
    } finally {
      setUploading(false)
    }
  }

  async function downloadTemplate() {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/upload/pnl-budget-template', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'pnl_budget_template.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Template download failed', e)
    }
  }

  return (
    <div className="bg-white rounded-xl p-6 flex flex-col gap-4" style={{ border: '1px solid #f0eefb', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎯</span>
          <div>
            <div className="font-sans font-semibold text-t1">P&L Budget</div>
            <div className="text-xs font-sans text-t3 mt-0.5">CSV or Excel format — covers all months</div>
          </div>
        </div>
        <button onClick={downloadTemplate}
          className="text-xs font-sans font-medium px-3 py-1.5 rounded-lg"
          style={{ background: '#f0eefb', color: '#6958C2', border: '1px solid #c4b8ff', cursor: 'pointer' }}>
          Download Template
        </button>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer"
        style={{ borderColor: dragging ? '#6958C2' : '#d4cef0', background: dragging ? '#f0eefb' : '#faf9fd', minHeight: 80, padding: 16 }}>
        <span className="text-2xl">{uploading ? '⏳' : '📁'}</span>
        <div className="text-sm font-sans text-t2 text-center">
          {uploading ? 'Uploading...' : 'Drag & drop budget file, or click to browse'}
        </div>
      </div>
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
        onChange={e => handleFile(e.target.files[0])} />

      {message && (
        <div className="text-sm font-sans px-3 py-2 rounded-lg"
          style={{ background: message.type === 'success' ? '#f0fdf4' : '#fef2f2', color: message.type === 'success' ? '#16a34a' : '#dc2626', border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}` }}>
          {message.type === 'success' ? '✅ ' : '❌ '}{message.text}
        </div>
      )}
    </div>
  )
}

export default function Admin() {
  const { fxRates, updateRate } = useSettingsStore()
  const [loadedMonths, setLoadedMonths] = useState({ revenue: [], cogs: [], pnl: [], all: [] })
  const [savingRates, setSavingRates] = useState(false)
  const [ratesSaved, setRatesSaved] = useState(false)

  async function fetchStatus() {
    try {
      const res = await api.get('/upload/status')
      const records = Array.isArray(res.data) ? res.data : []
      setLoadedMonths({
        revenue: records.filter(m => m.module === 'revenue' && m.status === 'done').map(m => m.month_key),
        cogs: records.filter(m => m.module === 'cogs' && m.status === 'done').map(m => m.month_key),
        pnl: records.filter(m => m.module === 'pnl' && m.status === 'done').map(m => m.month_key),
        all: records,
      })
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => { fetchStatus() }, [])

  async function saveRates() {
    setSavingRates(true)
    try {
      await api.post('/settings/fx-rates', fxRates)
      setRatesSaved(true)
      setTimeout(() => setRatesSaved(false), 3000)
    } catch (e) {
      console.error(e)
    } finally {
      setSavingRates(false)
    }
  }

  const currencies = Object.keys(FX_RATES)

  return (
    <div className="flex flex-col gap-6">
      {/* Upload cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <UploadCard type="revenue" label="Revenue Data" icon="💰" onUpload={fetchStatus} loadedMonths={loadedMonths.revenue} />
        <UploadCard type="cogs" label="COGS Data" icon="📦" onUpload={fetchStatus} loadedMonths={loadedMonths.cogs} />
        <UploadCard type="pnl" label="P&L Statement" icon="📄" onUpload={fetchStatus} loadedMonths={loadedMonths.pnl} />
        <BudgetUploadCard onUpload={fetchStatus} />
        <BSUploadCard onUpload={fetchStatus} />
      </div>

      {/* Exchange Rates */}
      <div className="bg-white rounded-xl p-6 flex flex-col gap-4" style={{ border: '1px solid #f0eefb', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-sans font-semibold text-t1">Exchange Rates</div>
            <div className="text-xs font-sans text-t3 mt-0.5">Base currency: INR = 1. All other rates = how many INR per 1 unit of foreign currency.</div>
          </div>
          <button
            onClick={saveRates}
            disabled={savingRates}
            className="px-5 py-2 rounded-xl text-white font-sans font-semibold text-sm"
            style={{ background: ratesSaved ? '#22c55e' : savingRates ? '#a8a6c0' : 'linear-gradient(135deg,#6958C2,#8878D8)', cursor: savingRates ? 'not-allowed' : 'pointer' }}
          >
            {ratesSaved ? '✓ Saved' : savingRates ? 'Saving...' : 'Save Rates'}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {currencies.map(cur => (
            <div key={cur} className="flex flex-col gap-1.5">
              <label className="text-xs font-sans font-semibold text-t2 uppercase tracking-wide">
                {FX_SYMBOLS[cur]}{cur}
              </label>
              <input
                type="number"
                value={fxRates[cur] || ''}
                onChange={e => updateRate(cur, parseFloat(e.target.value) || 0)}
                step="0.001"
                min="0"
                className="w-full px-3 py-2 rounded-lg text-sm font-mono outline-none"
                style={{ border: '1px solid #e8e6f0', color: '#1a1830' }}
                readOnly={cur === 'INR'}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Upload Status Table */}
      {loadedMonths.all.length > 0 && (
        <div className="bg-white rounded-xl p-6 flex flex-col gap-3" style={{ border: '1px solid #f0eefb', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <div className="font-sans font-semibold text-t1">Upload Status</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-sans">
              <thead>
                <tr className="text-t3 uppercase tracking-wide border-b" style={{ borderColor: '#f0eefb' }}>
                  <th className="text-left py-2 pr-4">Module</th>
                  <th className="text-left py-2 pr-4">Month</th>
                  <th className="text-left py-2 pr-4">Outlet</th>
                  <th className="text-left py-2 pr-4">Status</th>
                  <th className="text-left py-2 pr-4">Message</th>
                  <th className="text-left py-2">File</th>
                </tr>
              </thead>
              <tbody>
                {loadedMonths.all.map(r => {
                  const sc = r.store_code ? `?store_code=${encodeURIComponent(r.store_code)}` : ''
                  const dlUrl = `/api/upload/file/${r.module}/${r.month_key}${sc}`
                  return (
                    <tr key={r.id} className="border-b" style={{ borderColor: '#f8f7fd' }}>
                      <td className="py-2 pr-4 font-medium text-t1 capitalize">{r.module}</td>
                      <td className="py-2 pr-4 font-mono text-t1">{r.month_key}</td>
                      <td className="py-2 pr-4 font-mono text-t2 text-xs">{r.store_code || '—'}</td>
                      <td className="py-2 pr-4">
                        <span className="px-2 py-0.5 rounded-full font-semibold" style={{
                          background: r.status === 'done' ? '#f0fdf4' : r.status === 'error' ? '#fef2f2' : '#fffbeb',
                          color: r.status === 'done' ? '#16a34a' : r.status === 'error' ? '#dc2626' : '#d97706',
                          border: `1px solid ${r.status === 'done' ? '#86efac' : r.status === 'error' ? '#fca5a5' : '#fde68a'}`,
                        }}>
                          {r.status === 'done' ? '✓ Done' : r.status === 'error' ? '✗ Error' : '⏳ Processing'}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-t2 max-w-xs truncate">{r.message || '—'}</td>
                      <td className="py-2">
                        {r.has_file
                          ? <a href={dlUrl} download className="px-2 py-1 rounded-lg text-xs font-medium font-sans"
                              style={{ background: '#f0eefb', color: '#6958C2', border: '1px solid #c4b8ff', textDecoration: 'none' }}>
                              Download
                            </a>
                          : <span className="text-t3 text-xs">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <button onClick={fetchStatus} className="self-start text-xs font-sans font-medium px-3 py-1.5 rounded-lg" style={{ background: '#f0eefb', color: '#6958C2' }}>
            ↻ Refresh Status
          </button>
        </div>
      )}

      {/* File format help */}
      <div className="bg-white rounded-xl p-6 flex flex-col gap-4" style={{ border: '1px solid #f0eefb', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
        <div className="font-sans font-semibold text-t1">File Format Guide</div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <div className="text-sm font-sans font-semibold text-t1 mb-3">Revenue File (Revenue_MM-YYYY.xlsx)</div>
            <div className="rounded-lg p-3 text-xs font-mono space-y-1" style={{ background: '#faf9fd', border: '1px solid #e8e6f0' }}>
              {['Date', 'Day', 'Item Name', 'Category', 'Channel', 'Qty', 'Gross Revenue', 'Discount', 'Net Revenue', 'Service Charge', 'GST', 'Invoice No', 'Table No', 'Hour'].map(col => (
                <div key={col} className="text-t2">• {col}</div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-sans font-semibold text-t1 mb-3">COGS File (COGS_MM-YYYY.xlsx)</div>
            <div className="rounded-lg p-3 text-xs font-mono space-y-1" style={{ background: '#faf9fd', border: '1px solid #e8e6f0' }}>
              {['Ingredient Group', 'Ingredient Name', 'Unit', 'Opening Stock', 'Purchased', 'Closing Stock', 'Standard Consumption', 'Actual Consumption', 'Waste', 'Unit Cost', 'Total Cost'].map(col => (
                <div key={col} className="text-t2">• {col}</div>
              ))}
            </div>
          </div>
        </div>

        <div className="text-xs font-sans text-t3">
          ⚠️ Ensure date formats are consistent (DD-MM-YYYY or YYYY-MM-DD). All monetary values should be in INR without currency symbols.
        </div>
      </div>
    </div>
  )
}
