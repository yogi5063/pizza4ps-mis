import React, { useState, useEffect } from 'react'

const CHECKLIST_ITEMS = [
  { id: 'revenue_reconciled', label: 'Revenue Reconciled', desc: 'Verify POS totals match uploaded revenue data', icon: '💰' },
  { id: 'cogs_uploaded', label: 'COGS Uploaded', desc: 'All ingredient costs uploaded and variance checked', icon: '📦' },
  { id: 'gst_exported', label: 'GST Exported', desc: 'GSTR-1 exported and filed with CA', icon: '🧾' },
  { id: 'inventory_done', label: 'Inventory Count Done', desc: 'Physical inventory count completed and variance approved', icon: '🔍' },
  { id: 'pl_uploaded', label: 'P&L Uploaded', desc: 'Monthly P&L statement reviewed and uploaded', icon: '📄' },
  { id: 'report_sent', label: 'Report Sent to Management', desc: 'MIS report sent to management team', icon: '📧' },
]

const STORAGE_KEY = 'mis_month_end_checklist'

export default function MonthEndClose() {
  const [checked, setChecked] = useState({})
  const [currentMonth, setCurrentMonth] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    const now = new Date()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const yyyy = now.getFullYear()
    const key = `${mm}-${yyyy}`
    setCurrentMonth(key)

    // Load from localStorage
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const data = JSON.parse(saved)
        if (data[key]) setChecked(data[key].checked || {})
        if (data[key]?.note) setNote(data[key].note || '')
      } catch (e) {}
    }
  }, [])

  function saveToStorage(newChecked, newNote) {
    const saved = localStorage.getItem(STORAGE_KEY)
    let data = {}
    try { data = saved ? JSON.parse(saved) : {} } catch {}
    data[currentMonth] = { checked: newChecked, note: newNote, updatedAt: new Date().toISOString() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  function toggleItem(id) {
    const newChecked = { ...checked, [id]: !checked[id] }
    setChecked(newChecked)
    saveToStorage(newChecked, note)
  }

  function handleNoteChange(e) {
    setNote(e.target.value)
    saveToStorage(checked, e.target.value)
  }

  function resetAll() {
    if (window.confirm('Reset all checklist items for this month?')) {
      setChecked({})
      setNote('')
      saveToStorage({}, '')
    }
  }

  const completedCount = Object.values(checked).filter(Boolean).length
  const totalCount = CHECKLIST_ITEMS.length
  const progress = totalCount > 0 ? completedCount / totalCount : 0
  const allDone = completedCount === totalCount

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      {/* Header card */}
      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #f0eefb', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="font-sans font-bold text-t1 text-xl">Month-End Close</h2>
            <p className="text-t2 font-sans text-sm mt-1">{currentMonth} — Monthly closing checklist</p>
          </div>
          <div className="text-right">
            <div className="font-mono font-bold text-3xl" style={{ color: allDone ? '#22c55e' : '#6958C2' }}>
              {completedCount}/{totalCount}
            </div>
            <div className="text-xs font-sans text-t3 mt-0.5">tasks complete</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-sans text-t2">
            <span>Progress</span>
            <span style={{ color: allDone ? '#22c55e' : '#6958C2', fontWeight: 600 }}>
              {(progress * 100).toFixed(0)}%
            </span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: '#f0eefb' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress * 100}%`,
                background: allDone
                  ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                  : 'linear-gradient(90deg, #6958C2, #8878D8)',
              }}
            />
          </div>
        </div>

        {allDone && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-xl"
            style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
            <span className="text-lg">🎉</span>
            <span className="text-sm font-sans font-semibold text-green-700">
              Month-end close complete! All tasks done for {currentMonth}.
            </span>
          </div>
        )}
      </div>

      {/* Checklist */}
      <div className="flex flex-col gap-3">
        {CHECKLIST_ITEMS.map(item => {
          const isDone = !!checked[item.id]
          return (
            <div
              key={item.id}
              className="flex items-center gap-4 bg-white rounded-xl p-4 cursor-pointer transition-all"
              style={{
                border: `1px solid ${isDone ? '#86efac' : '#f0eefb'}`,
                background: isDone ? '#f0fdf4' : '#fff',
                boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
              }}
              onClick={() => toggleItem(item.id)}
            >
              {/* Checkbox */}
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
                style={{
                  background: isDone ? '#22c55e' : '#f0eefb',
                  border: `2px solid ${isDone ? '#22c55e' : '#d4cef0'}`,
                }}
              >
                {isDone && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>

              {/* Icon */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: isDone ? '#dcfce7' : '#f0eefb' }}
              >
                {item.icon}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="font-sans font-semibold text-sm" style={{ color: isDone ? '#16a34a' : '#1a1830', textDecoration: isDone ? 'line-through' : 'none' }}>
                  {item.label}
                </div>
                <div className="text-xs font-sans text-t3 mt-0.5">{item.desc}</div>
              </div>

              {/* Status */}
              <div className="flex-shrink-0">
                {isDone ? (
                  <span className="text-xs font-sans font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: '#dcfce7', color: '#16a34a' }}>Done</span>
                ) : (
                  <span className="text-xs font-sans font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: '#f0eefb', color: '#a8a6c0' }}>Pending</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl p-5" style={{ border: '1px solid #f0eefb', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
        <label className="text-sm font-sans font-semibold text-t1 block mb-2">Month-End Notes</label>
        <textarea
          value={note}
          onChange={handleNoteChange}
          placeholder="Add any month-end notes, observations, or action items..."
          rows={4}
          className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none resize-none"
          style={{ border: '1px solid #e8e6f0', color: '#1a1830', background: '#fafafa' }}
        />
      </div>

      {/* Reset button */}
      <div className="flex justify-end">
        <button
          onClick={resetAll}
          className="px-4 py-2 rounded-xl text-sm font-sans font-medium transition-colors"
          style={{ border: '1px solid #e8e6f0', color: '#6b6890', background: '#fff', cursor: 'pointer' }}
        >
          Reset Checklist
        </button>
      </div>
    </div>
  )
}
