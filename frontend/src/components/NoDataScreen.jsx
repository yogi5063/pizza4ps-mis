import React from 'react'
import useFilterStore from '../store/filterStore'

export default function NoDataScreen({ storeCode }) {
  const s = useFilterStore()

  if (storeCode) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <span className="text-5xl">🏪</span>
        <h2 className="font-sans font-semibold text-t1 text-xl">No Data for This Outlet</h2>
        <p className="text-t2 font-sans text-sm text-center">
          Outlet <strong>{storeCode}</strong> has no data uploaded yet.
        </p>
        <button
          onClick={() => s.setGeo({ country: null, location: null, outlet: null })}
          className="px-5 py-2 rounded-xl text-white font-sans font-semibold text-sm"
          style={{ background: 'linear-gradient(135deg,#6958C2,#8878D8)', cursor: 'pointer' }}>
          ← Show All Outlets
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
      <span className="text-5xl">📊</span>
      <h2 className="font-sans font-semibold text-t1 text-xl">No Data Uploaded</h2>
      <p className="text-t2 font-sans text-sm">Upload revenue data in Admin to get started.</p>
      <a href="/admin" className="px-5 py-2 rounded-xl text-white font-sans font-semibold text-sm"
        style={{ background: 'linear-gradient(135deg,#6958C2,#8878D8)' }}>
        Go to Admin →
      </a>
    </div>
  )
}
