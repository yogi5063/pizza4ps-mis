import React, { useEffect, useState } from 'react'
import api from '../utils/api'

const PUR = '#6958C2'
const inp = {
  border: '1px solid #e8e6f0', borderRadius: 8, padding: '7px 10px',
  fontSize: 13, outline: 'none', background: '#fff', color: '#1a1830', fontFamily: 'DM Sans',
}

function Badge({ active }) {
  return (
    <span className="font-sans" style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
      background: active ? '#dcfce7' : '#fee2e2', color: active ? '#16a34a' : '#dc2626',
    }}>
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function AddForm({ fields, onSave, onCancel, saving }) {
  const [v, setV] = useState(() => Object.fromEntries(fields.map(f => [f.key, ''])))
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-lg"
      style={{ background: '#f5f4fb', border: '1px dashed #c8c4e0' }}>
      {fields.map(f => (
        <input key={f.key} value={v[f.key]}
          onChange={e => setV(x => ({ ...x, [f.key]: e.target.value }))}
          placeholder={f.label} style={{ ...inp, width: f.width || 150 }} />
      ))}
      <button onClick={() => onSave(v)} disabled={saving}
        className="font-sans font-semibold text-xs px-3 py-1.5 rounded-lg"
        style={{ background: PUR, color: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
        {saving ? 'Saving…' : 'Add'}
      </button>
      <button onClick={onCancel}
        className="font-sans font-semibold text-xs px-3 py-1.5 rounded-lg"
        style={{ background: '#fff', color: '#6b6890', border: '1px solid #e8e6f0', cursor: 'pointer' }}>
        Cancel
      </button>
    </div>
  )
}

const COUNTRY_FIELDS = [
  { key: 'name', label: 'Country name *', width: 160 },
  { key: 'code', label: 'Code (IN)', width: 90 },
  { key: 'currency', label: 'Currency (INR)', width: 120 },
]
const LOC_FIELDS = [
  { key: 'name', label: 'Location name *', width: 200 },
]
const OUTLET_FIELDS = [
  { key: 'code', label: 'Code (BGL-XYZ) *', width: 140 },
  { key: 'name', label: 'Outlet name *', width: 180 },
  { key: 'currency', label: 'Currency', width: 100 },
  { key: 'open_date', label: 'Open date YYYY-MM-DD', width: 175 },
]

export default function Masters() {
  const [tree, setTree] = useState({ countries: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(null) // { type, parentId }
  const [openC, setOpenC] = useState(new Set())
  const [openL, setOpenL] = useState(new Set())
  const [err, setErr] = useState(null)

  async function reload(autoExpand = false) {
    try {
      const r = await api.get('/masters/tree?include_inactive=true')
      const data = r.data || { countries: [] }
      setTree(data)
      if (autoExpand) {
        setOpenC(new Set(data.countries.map(c => c.id)))
        setOpenL(new Set(data.countries.flatMap(c => (c.locations || []).map(l => l.id))))
      }
    } catch {}
  }

  useEffect(() => { reload(true).finally(() => setLoading(false)) }, [])

  function toggleC(id) {
    setOpenC(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleL(id) {
    setOpenL(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function addItem(type, parentId, vals) {
    if (!vals.name && type !== 'outlet') { setErr('Name is required'); return }
    if (type === 'outlet' && (!vals.code || !vals.name)) { setErr('Code and name are required'); return }
    setErr(null); setSaving(true)
    try {
      const body = type === 'country'
        ? { name: vals.name, code: vals.code || null, currency: vals.currency || null }
        : type === 'location'
        ? { country_id: parentId, name: vals.name }
        : { location_id: parentId, code: vals.code, name: vals.name, currency: vals.currency || null, open_date: vals.open_date || null }
      await api.post(`/masters/${type}s`, body)
      await reload()
      setAdding(null)
    } catch (e) {
      setErr(e.response?.data?.detail || 'Error saving')
    } finally { setSaving(false) }
  }

  async function toggleActive(type, item, parentId) {
    setSaving(true); setErr(null)
    try {
      const patch = type === 'country'
        ? { name: item.name, code: item.code, currency: item.currency, active: !item.active }
        : type === 'location'
        ? { country_id: parentId, name: item.name, active: !item.active }
        : { location_id: parentId, code: item.code, name: item.name, currency: item.currency, active: !item.active }
      await api.patch(`/masters/${type}s/${item.id}`, patch)
      await reload()
    } catch (e) {
      setErr(e.response?.data?.detail || 'Error updating')
    } finally { setSaving(false) }
  }

  if (loading) {
    return <div className="p-10 text-t3 font-sans text-sm">Loading masters…</div>
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-sans font-bold text-2xl text-t1">Geography Masters</h1>
        <p className="font-sans text-sm text-t2 mt-1">
          Manage countries, locations and outlets. New outlets appear in filters immediately — no redevelopment needed.
        </p>
      </div>

      {err && (
        <div className="px-4 py-3 rounded-xl text-sm font-sans"
          style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}>
          {err}
        </div>
      )}

      {/* Countries */}
      <div className="flex flex-col gap-4">
        {tree.countries.map(country => (
          <div key={country.id} className="rounded-xl overflow-hidden"
            style={{ border: '1px solid #e8e6f0', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>

            {/* Country header */}
            <div className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50 select-none"
              onClick={() => toggleC(country.id)}>
              <span className="text-t3 text-xs w-3">{openC.has(country.id) ? '▼' : '▶'}</span>
              <span className="font-sans font-bold text-t1">{country.name}</span>
              {country.code && <span className="text-xs font-mono text-t3">{country.code}</span>}
              {country.currency && (
                <span className="text-xs font-sans text-t2 px-2 py-0.5 rounded-md" style={{ background: '#f0eefb' }}>
                  {country.currency}
                </span>
              )}
              <Badge active={country.active} />
              <div className="ml-auto flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <button onClick={() => toggleActive('country', country, null)} disabled={saving}
                  className="font-sans font-semibold text-xs px-3 py-1 rounded-lg"
                  style={{ background: '#f5f4fb', color: '#6b6890', border: '1px solid #e8e6f0', cursor: 'pointer' }}>
                  {country.active ? 'Deactivate' : 'Reactivate'}
                </button>
              </div>
            </div>

            {openC.has(country.id) && (
              <div className="px-5 pb-4 pt-3 flex flex-col gap-3"
                style={{ borderTop: '1px solid #f0eefb', background: '#faf9fd' }}>

                {/* Locations */}
                {(country.locations || []).map(loc => (
                  <div key={loc.id} className="rounded-lg overflow-hidden"
                    style={{ border: '1px solid #e8e6f0', background: '#fff' }}>

                    {/* Location header */}
                    <div className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 select-none"
                      onClick={() => toggleL(loc.id)}>
                      <span className="text-t3 text-xs w-3">{openL.has(loc.id) ? '▼' : '▶'}</span>
                      <span className="font-sans font-semibold text-sm text-t1">{loc.name}</span>
                      <Badge active={loc.active} />
                      <div className="ml-auto flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <button onClick={() => toggleActive('location', loc, country.id)} disabled={saving}
                          className="font-sans font-semibold text-xs px-3 py-1 rounded-lg"
                          style={{ background: '#f5f4fb', color: '#6b6890', border: '1px solid #e8e6f0', cursor: 'pointer' }}>
                          {loc.active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </div>
                    </div>

                    {openL.has(loc.id) && (
                      <div className="px-4 pb-3 pt-1"
                        style={{ borderTop: '1px solid #f0eefb', background: '#faf9fd' }}>

                        {/* Outlets table */}
                        {(loc.outlets || []).length > 0 && (
                          <table className="w-full text-sm font-sans mb-3">
                            <thead>
                              <tr style={{ borderBottom: '1px solid #f0eefb' }}>
                                <th className="py-2 text-left text-xs font-semibold text-t2 uppercase tracking-wide pr-4">Code</th>
                                <th className="py-2 text-left text-xs font-semibold text-t2 uppercase tracking-wide pr-4">Name</th>
                                <th className="py-2 text-left text-xs font-semibold text-t2 uppercase tracking-wide pr-4">Currency</th>
                                <th className="py-2 text-left text-xs font-semibold text-t2 uppercase tracking-wide pr-4">Status</th>
                                <th className="py-2 text-right text-xs font-semibold text-t2 uppercase tracking-wide">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(loc.outlets || []).map(o => (
                                <tr key={o.id} style={{ borderBottom: '1px solid #f9f8fc' }}>
                                  <td className="py-2 font-mono text-xs text-t1 pr-4">{o.code}</td>
                                  <td className="py-2 text-t1 pr-4">{o.name}</td>
                                  <td className="py-2 text-t2 pr-4">{o.currency || '—'}</td>
                                  <td className="py-2 pr-4"><Badge active={o.active} /></td>
                                  <td className="py-2 text-right">
                                    <button onClick={() => toggleActive('outlet', o, loc.id)} disabled={saving}
                                      className="font-sans font-semibold text-xs px-3 py-1 rounded-lg"
                                      style={{ background: '#f5f4fb', color: '#6b6890', border: '1px solid #e8e6f0', cursor: 'pointer' }}>
                                      {o.active ? 'Deactivate' : 'Reactivate'}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}

                        {/* Add outlet form or button */}
                        {adding?.type === 'outlet' && adding.parentId === loc.id ? (
                          <AddForm fields={OUTLET_FIELDS}
                            onSave={v => addItem('outlet', loc.id, v)}
                            onCancel={() => setAdding(null)} saving={saving} />
                        ) : (
                          <button onClick={() => setAdding({ type: 'outlet', parentId: loc.id })}
                            className="font-sans font-semibold text-xs px-3 py-1.5 rounded-lg"
                            style={{ background: PUR, color: '#fff', border: 'none', cursor: 'pointer' }}>
                            + Add Outlet
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Add location form or button */}
                {adding?.type === 'location' && adding.parentId === country.id ? (
                  <AddForm fields={LOC_FIELDS}
                    onSave={v => addItem('location', country.id, v)}
                    onCancel={() => setAdding(null)} saving={saving} />
                ) : (
                  <button onClick={() => setAdding({ type: 'location', parentId: country.id })}
                    className="font-sans font-semibold text-xs px-3 py-1.5 rounded-lg self-start"
                    style={{ background: '#fff', color: PUR, border: `1px solid ${PUR}`, cursor: 'pointer' }}>
                    + Add Location
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add country form or button */}
      {adding?.type === 'country' ? (
        <AddForm fields={COUNTRY_FIELDS}
          onSave={v => addItem('country', null, v)}
          onCancel={() => setAdding(null)} saving={saving} />
      ) : (
        <button onClick={() => setAdding({ type: 'country', parentId: null })}
          className="font-sans font-semibold text-sm px-4 py-2 rounded-xl self-start"
          style={{ background: PUR, color: '#fff', border: 'none', cursor: 'pointer' }}>
          + Add Country
        </button>
      )}
    </div>
  )
}
