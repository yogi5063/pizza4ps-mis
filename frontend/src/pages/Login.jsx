import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'

export default function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('username', username)
      params.append('password', password)
      const res = await api.post('/auth/login', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      })
      localStorage.setItem('token', res.data.access_token)
      navigate('/daily-flash')
    } catch (err) {
      setError('Invalid credentials. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Left dark panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-1/2 p-14"
        style={{ background: 'linear-gradient(145deg, #0d0c18 60%, #1a1535)' }}
      >
        <div>
          <div className="flex items-center gap-3 mb-16">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
              style={{ background: 'linear-gradient(135deg, #6958C2, #8878D8)' }}
            >
              🍕
            </div>
            <span className="text-white font-sans font-semibold text-lg tracking-wide">
              Pizza 4P's
            </span>
          </div>
          <h1
            className="font-serif font-semibold leading-tight mb-6"
            style={{ fontSize: '3.2rem', color: '#fff' }}
          >
            Management<br />
            <span style={{ color: '#8878D8' }}>Intelligence</span><br />
            System
          </h1>
          <p className="text-gray-400 font-sans text-base leading-relaxed max-w-xs">
            Unified analytics and reporting dashboard for revenue, operations, and financial performance.
          </p>
        </div>
        <div>
          <div className="flex gap-6 mb-8">
            {['Revenue', 'Operations', 'Inventory'].map(label => (
              <div key={label} className="text-center">
                <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">{label}</div>
                <div className="w-8 h-0.5 mx-auto rounded" style={{ background: '#6958C2' }} />
              </div>
            ))}
          </div>
          <p className="text-gray-600 text-xs font-sans">
            © {new Date().getFullYear()} Pizza 4P's · MIS Dashboard v1.0
          </p>
        </div>
      </div>

      {/* Right light panel */}
      <div className="flex flex-col justify-center items-center w-full lg:w-1/2 bg-white px-8">
        <div className="w-full max-w-sm">
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
              style={{ background: 'linear-gradient(135deg, #6958C2, #8878D8)' }}
            >
              🍕
            </div>
            <span className="font-sans font-semibold text-lg text-t1">Pizza 4P's MIS</span>
          </div>

          <h2 className="font-sans font-bold text-2xl text-t1 mb-2">Welcome back</h2>
          <p className="text-t2 text-sm mb-8">Sign in to your dashboard</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-t2 mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                className="w-full px-4 py-3 rounded-xl border text-t1 text-sm font-sans outline-none transition-all"
                style={{ borderColor: '#e8e6f0', background: '#fafafa' }}
                onFocus={e => e.target.style.borderColor = '#6958C2'}
                onBlur={e => e.target.style.borderColor = '#e8e6f0'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-t2 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full px-4 py-3 rounded-xl border text-t1 text-sm font-sans outline-none transition-all"
                style={{ borderColor: '#e8e6f0', background: '#fafafa' }}
                onFocus={e => e.target.style.borderColor = '#6958C2'}
                onBlur={e => e.target.style.borderColor = '#e8e6f0'}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100">
                <span className="text-red-500 text-sm">⚠️</span>
                <span className="text-red-600 text-sm font-sans">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-white font-sans font-semibold text-sm transition-all"
              style={{
                background: loading ? '#a8a6c0' : 'linear-gradient(135deg, #6958C2, #8878D8)',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-t3 text-xs mt-8 font-sans">
            Pizza 4P's Internal System · Authorized Access Only
          </p>
        </div>
      </div>
    </div>
  )
}
