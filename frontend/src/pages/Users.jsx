import React, { useEffect, useState } from 'react'
import api from '../utils/api'
import { grantablePages } from '../utils/nav'

const PUR = '#6958C2'
const chip = (on) => ({
  background: on ? PUR : '#f5f4fb', color: on ? '#fff' : '#6b6890',
  border: on ? `1px solid ${PUR}` : '1px solid #e8e6f0', cursor: 'pointer',
})

function RightsPicker({ pages, outlets, selPages, selOutlets, setSelPages, setSelOutlets }) {
  const toggle = (arr, set, v) => set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v])
  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-xs font-sans font-semibold text-t2 uppercase tracking-wide mb-1.5">Pages this user can open</div>
        <div className="flex flex-wrap gap-1.5">
          {pages.map(p => (
            <button type="button" key={p.key} onClick={() => toggle(selPages, setSelPages, p.key)}
              className="px-2.5 py-1 rounded-lg text-xs font-sans font-medium" style={chip(selPages.includes(p.key))}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="text-xs font-sans font-semibold text-t2 uppercase tracking-wide mb-1.5">
          Outlets this user can see <span className="text-t3 normal-case">(none selected = all outlets)</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {outlets.map(o => (
            <button type="button" key={o.code} onClick={() => toggle(selOutlets, setSelOutlets, o.code)}
              className="px-2.5 py-1 rounded-lg text-xs font-sans font-medium" style={chip(selOutlets.includes(o.code))}>
              {o.name} <span style={{ opacity: 0.7 }}>({o.code})</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Users() {
  const pages = grantablePages()
  const [outlets, setOutlets] = useState([])
  const [users, setUsers] = useState([])
  const [msg, setMsg] = useState(null)

  // create form
  const [nu, setNu] = useState({ username: '', full_name: '', password: '', role: 'user' })
  const [cPages, setCPages] = useState([])
  const [cOutlets, setCOutlets] = useState([])
  const [editing, setEditing] = useState(null)   // user id being edited

  async function load() {
    try {
      const [u, t] = await Promise.all([api.get('/users'), api.get('/masters/tree')])
      setUsers(u.data)
      const outs = []
      for (const c of t.data.countries) for (const l of c.locations) for (const o of l.outlets) outs.push(o)
      setOutlets(outs)
    } catch (e) {
      setMsg({ t: 'error', m: e.response?.data?.detail || 'Failed to load (super-admin only).' })
    }
  }
  useEffect(() => { load() }, [])

  async function createUser(e) {
    e.preventDefault(); setMsg(null)
    if (!nu.username || !nu.password) { setMsg({ t: 'error', m: 'Username and password required.' }); return }
    try {
      await api.post('/users', {
        ...nu,
        allowed_pages: nu.role === 'super_admin' ? [] : cPages,
        allowed_outlets: nu.role === 'super_admin' ? [] : cOutlets,
      })
      setMsg({ t: 'success', m: `User '${nu.username}' created. They'll set their own password on first login.` })
      setNu({ username: '', full_name: '', password: '', role: 'user' }); setCPages([]); setCOutlets([])
      load()
    } catch (err) {
      setMsg({ t: 'error', m: err.response?.data?.detail || 'Create failed.' })
    }
  }

  async function saveRights(u, allowed_pages, allowed_outlets, role) {
    try {
      await api.patch(`/users/${u.id}`, { allowed_pages, allowed_outlets, role })
      setMsg({ t: 'success', m: `Updated rights for '${u.username}'.` }); setEditing(null); load()
    } catch (err) { setMsg({ t: 'error', m: err.response?.data?.detail || 'Update failed.' }) }
  }

  async function resetPwd(u) {
    const np = window.prompt(`Set a temporary password for '${u.username}'. They'll be forced to change it on next login.`)
    if (!np) return
    try {
      await api.post(`/users/${u.id}/reset-password`, { new_password: np })
      setMsg({ t: 'success', m: `Password reset for '${u.username}'. Temporary password: ${np}` })
    } catch (err) { setMsg({ t: 'error', m: err.response?.data?.detail || 'Reset failed.' }) }
  }

  async function toggleActive(u) {
    try {
      if (u.is_active) await api.delete(`/users/${u.id}`)
      else await api.patch(`/users/${u.id}`, { is_active: true })
      load()
    } catch (err) { setMsg({ t: 'error', m: err.response?.data?.detail || 'Failed.' }) }
  }

  const inp = { border: '1px solid #e8e6f0', color: '#1a1830' }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="font-serif font-semibold text-t1" style={{ fontSize: '1.8rem' }}>Users & Access</div>
        <div className="text-sm font-sans text-t3">Create logins for the team and control what each person can see.</div>
      </div>

      {msg && (
        <div className="text-sm font-sans px-3 py-2 rounded-lg" style={{
          background: msg.t === 'success' ? '#f0fdf4' : '#fef2f2', color: msg.t === 'success' ? '#16a34a' : '#dc2626',
          border: `1px solid ${msg.t === 'success' ? '#86efac' : '#fca5a5'}`,
        }}>{msg.m}</div>
      )}

      {/* Create user */}
      <form onSubmit={createUser} className="bg-white rounded-xl p-6 flex flex-col gap-4" style={{ border: '1px solid #f0eefb', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
        <div className="font-sans font-semibold text-t1">Create New User</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input placeholder="Username" value={nu.username} onChange={e => setNu({ ...nu, username: e.target.value })}
            className="px-3 py-2 rounded-lg text-sm font-sans outline-none" style={inp} />
          <input placeholder="Full name" value={nu.full_name} onChange={e => setNu({ ...nu, full_name: e.target.value })}
            className="px-3 py-2 rounded-lg text-sm font-sans outline-none" style={inp} />
          <input placeholder="Temporary password" value={nu.password} onChange={e => setNu({ ...nu, password: e.target.value })}
            className="px-3 py-2 rounded-lg text-sm font-sans outline-none" style={inp} />
          <select value={nu.role} onChange={e => setNu({ ...nu, role: e.target.value })}
            className="px-3 py-2 rounded-lg text-sm font-sans outline-none" style={inp}>
            <option value="user">User (limited)</option>
            <option value="super_admin">Super Admin (full access)</option>
          </select>
        </div>
        {nu.role === 'user' && (
          <RightsPicker pages={pages} outlets={outlets} selPages={cPages} selOutlets={cOutlets}
            setSelPages={setCPages} setSelOutlets={setCOutlets} />
        )}
        <button type="submit" className="self-start px-5 py-2 rounded-xl text-white font-sans font-semibold text-sm"
          style={{ background: 'linear-gradient(135deg,#6958C2,#8878D8)', cursor: 'pointer' }}>+ Create User</button>
      </form>

      {/* User list */}
      <div className="bg-white rounded-xl p-6 flex flex-col gap-3" style={{ border: '1px solid #f0eefb', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
        <div className="font-sans font-semibold text-t1">Users ({users.length})</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-sans">
            <thead>
              <tr className="text-t3 uppercase tracking-wide border-b text-xs" style={{ borderColor: '#f0eefb' }}>
                <th className="text-left py-2 pr-3">User</th><th className="text-left py-2 pr-3">Role</th>
                <th className="text-left py-2 pr-3">Pages</th><th className="text-left py-2 pr-3">Outlets</th>
                <th className="text-left py-2 pr-3">Status</th><th className="text-left py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <UserRow key={u.id} u={u} pages={pages} outlets={outlets}
                  editing={editing === u.id} setEditing={setEditing}
                  onSave={saveRights} onReset={resetPwd} onToggle={toggleActive} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function UserRow({ u, pages, outlets, editing, setEditing, onSave, onReset, onToggle }) {
  const [p, setP] = useState(u.allowed_pages || [])
  const [o, setO] = useState(u.allowed_outlets || [])
  useEffect(() => { setP(u.allowed_pages || []); setO(u.allowed_outlets || []) }, [u])
  return (
    <>
      <tr className="border-b" style={{ borderColor: '#f8f7fd' }}>
        <td className="py-2 pr-3 font-medium text-t1">{u.username}{u.full_name ? <span className="text-t3 font-normal"> · {u.full_name}</span> : ''}</td>
        <td className="py-2 pr-3">{u.role === 'super_admin' ? '⭐ Super Admin' : 'User'}</td>
        <td className="py-2 pr-3 text-t2">{u.role === 'super_admin' ? 'All' : (u.allowed_pages?.length || 0)}</td>
        <td className="py-2 pr-3 text-t2">{u.role === 'super_admin' ? 'All' : (u.allowed_outlets?.length ? u.allowed_outlets.join(', ') : 'All')}</td>
        <td className="py-2 pr-3">
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{
            background: u.is_active ? '#f0fdf4' : '#fef2f2', color: u.is_active ? '#16a34a' : '#dc2626',
            border: `1px solid ${u.is_active ? '#86efac' : '#fca5a5'}`,
          }}>{u.is_active ? 'Active' : 'Inactive'}{u.must_change_password ? ' · must reset' : ''}</span>
        </td>
        <td className="py-2 flex flex-wrap gap-2">
          {u.role !== 'super_admin' && (
            <button onClick={() => setEditing(editing ? null : u.id)} className="text-xs px-2 py-1 rounded-lg" style={{ background: '#f0eefb', color: PUR, cursor: 'pointer' }}>{editing ? 'Close' : 'Edit rights'}</button>
          )}
          <button onClick={() => onReset(u)} className="text-xs px-2 py-1 rounded-lg" style={{ background: '#fff7ed', color: '#d97706', border: '1px solid #fed7aa', cursor: 'pointer' }}>Reset password</button>
          <button onClick={() => onToggle(u)} className="text-xs px-2 py-1 rounded-lg" style={{ background: '#fff', color: '#6b6890', border: '1px solid #e8e6f0', cursor: 'pointer' }}>{u.is_active ? 'Deactivate' : 'Activate'}</button>
        </td>
      </tr>
      {editing && u.role !== 'super_admin' && (
        <tr><td colSpan={6} className="py-3 px-3" style={{ background: '#faf9fd' }}>
          <RightsPicker pages={pages} outlets={outlets} selPages={p} selOutlets={o} setSelPages={setP} setSelOutlets={setO} />
          <button onClick={() => onSave(u, p, o, u.role)} className="mt-3 px-4 py-1.5 rounded-lg text-white text-xs font-sans font-semibold" style={{ background: PUR, cursor: 'pointer' }}>Save rights</button>
        </td></tr>
      )}
    </>
  )
}
