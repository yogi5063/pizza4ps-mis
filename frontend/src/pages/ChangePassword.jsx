import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import useAuthStore from '../store/authStore'

export default function ChangePassword() {
  const navigate = useNavigate()
  const { me, loadMe } = useAuthStore()
  const forced = !!me?.must_change_password
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setMsg(null)
    if (next.length < 4) { setMsg({ t: 'error', m: 'New password must be at least 4 characters.' }); return }
    if (next !== confirm) { setMsg({ t: 'error', m: 'New passwords do not match.' }); return }
    setBusy(true)
    try {
      await api.post('/auth/change-password', { current_password: cur, new_password: next })
      await loadMe()
      setMsg({ t: 'success', m: 'Password changed. Redirecting…' })
      setTimeout(() => navigate('/daily-flash'), 900)
    } catch (err) {
      setMsg({ t: 'error', m: err.response?.data?.detail || 'Could not change password.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10">
      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e8e6f0', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
        <div className="font-sans font-semibold text-t1 text-lg mb-1">Change Password</div>
        {forced && (
          <div className="text-sm font-sans px-3 py-2 rounded-lg mb-3" style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}>
            Please set a new password to continue.
          </div>
        )}
        <form onSubmit={submit} className="flex flex-col gap-3 mt-2">
          <input type="password" placeholder="Current password" value={cur} onChange={e => setCur(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm font-sans outline-none" style={{ border: '1px solid #e8e6f0' }} required />
          <input type="password" placeholder="New password" value={next} onChange={e => setNext(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm font-sans outline-none" style={{ border: '1px solid #e8e6f0' }} required />
          <input type="password" placeholder="Confirm new password" value={confirm} onChange={e => setConfirm(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm font-sans outline-none" style={{ border: '1px solid #e8e6f0' }} required />
          {msg && (
            <div className="text-sm font-sans px-3 py-2 rounded-lg" style={{
              background: msg.t === 'success' ? '#f0fdf4' : '#fef2f2',
              color: msg.t === 'success' ? '#16a34a' : '#dc2626',
              border: `1px solid ${msg.t === 'success' ? '#86efac' : '#fca5a5'}`,
            }}>{msg.m}</div>
          )}
          <button type="submit" disabled={busy}
            className="px-5 py-2 rounded-xl text-white font-sans font-semibold text-sm"
            style={{ background: busy ? '#a8a6c0' : 'linear-gradient(135deg,#6958C2,#8878D8)', cursor: busy ? 'not-allowed' : 'pointer' }}>
            {busy ? 'Saving…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
