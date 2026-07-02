import React, { useEffect, useState, useMemo } from 'react'
import api from '../utils/api'
import KpiCard from '../components/KpiCard'
import DataTable from '../components/DataTable'
import PageFilters from '../components/PageFilters'
import { fc, exportCSV } from '../utils/formatters'
import useSettingsStore from '../store/settingsStore'
import useFilterStore from '../store/filterStore'

export default function GstSummary() {
  const { currency, fxRates } = useSettingsStore()
  const { selectedMonths, geo } = useFilterStore()
  const storeCode = geo.outlet || undefined
  const [gstData, setGstData] = useState({})
  const [kpiData, setKpiData] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [gRes, kRes] = await Promise.all([
          api.get('/data/gst', { params: storeCode ? { store_code: storeCode } : {} }).catch(() => ({ data: {} })),
          api.get('/data/kpi', { params: storeCode ? { store_code: storeCode } : {} }).catch(() => ({ data: {} })),
        ])
        setGstData(gRes.data || {})
        setKpiData(kRes.data || {})
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [storeCode])

  const months = Object.keys(kpiData).sort()
  const filteredMonths = selectedMonths.length > 0 ? months.filter(m => selectedMonths.includes(m)) : months

  const totalGst = filteredMonths.reduce((s, m) => s + (kpiData[m]?.total_gst || 0), 0)
  const totalTaxable = filteredMonths.reduce((s, m) => s + (kpiData[m]?.net_revenue || 0), 0)

  // GST slabs table
  const slabTable = useMemo(() => {
    const slabs = {}
    filteredMonths.forEach(m => {
      const d = gstData[m]?.slabs || {}
      Object.entries(d).forEach(([slab, info]) => {
        if (!slabs[slab]) slabs[slab] = { slab, taxable: 0, gst: 0, qty: 0 }
        slabs[slab].taxable += info.taxable || 0
        slabs[slab].gst += info.gst || 0
        slabs[slab].qty += info.qty || 0
      })
    })
    return Object.values(slabs).map(s => ({
      slab: s.slab,
      taxable_value: fc(s.taxable, false, currency, fxRates),
      total_gst: fc(s.gst, false, currency, fxRates),
      cgst: fc(s.gst / 2, false, currency, fxRates),
      sgst: fc(s.gst / 2, false, currency, fxRates),
      qty: s.qty?.toLocaleString(),
      _taxable_raw: s.taxable,
      _gst_raw: s.gst,
    })).sort((a, b) => b._taxable_raw - a._taxable_raw)
  }, [gstData, filteredMonths, currency, fxRates])

  function handleGSTR1Export() {
    const data = slabTable.map(r => ({
      'GST Slab': r.slab,
      'Taxable Value': r._taxable_raw,
      'Total GST': r._gst_raw,
      'CGST': r._gst_raw / 2,
      'SGST': r._gst_raw / 2,
      'Qty': r.qty,
    }))
    exportCSV(data, `GSTR1_${filteredMonths.join('_')}.csv`)
  }

  if (!loading && months.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <span className="text-5xl">🧾</span>
        <h2 className="font-sans font-semibold text-t1 text-xl">No Data Uploaded</h2>
        <p className="text-t2 font-sans text-sm">Upload revenue data in Admin to get started.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageFilters months={months} categories={[]} channels={[]} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Total GST" value={fc(totalGst, true, currency, fxRates)}
          icon="🧾" color="#6958C2" loading={loading} />
        <KpiCard title="CGST" value={fc(totalGst / 2, true, currency, fxRates)}
          subtitle="Central GST" icon="🏛️" color="#22c55e" loading={loading} />
        <KpiCard title="SGST" value={fc(totalGst / 2, true, currency, fxRates)}
          subtitle="State GST" icon="🏢" color="#3b82f6" loading={loading} />
        <KpiCard title="Taxable Turnover" value={fc(totalTaxable, true, currency, fxRates)}
          subtitle="net of discounts" icon="💰" color="#f59e0b" loading={loading} />
      </div>

      {/* GSTR-1 Export button */}
      <div className="flex justify-end">
        <button
          onClick={handleGSTR1Export}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-sans font-semibold text-sm transition-all"
          style={{ background: 'linear-gradient(135deg,#6958C2,#8878D8)', cursor: 'pointer' }}
        >
          📄 GSTR-1 Export
        </button>
      </div>

      {/* GST Slabs Table */}
      <DataTable
        title="GST Summary by Slab"
        columns={[
          { key: 'slab', label: 'Slab' },
          { key: 'taxable_value', label: 'Taxable Value', align: 'right', mono: true },
          { key: 'total_gst', label: 'Total GST', align: 'right', mono: true },
          { key: 'cgst', label: 'CGST (50%)', align: 'right', mono: true },
          { key: 'sgst', label: 'SGST (50%)', align: 'right', mono: true },
          { key: 'qty', label: 'Qty', align: 'right', mono: true },
        ]}
        data={slabTable}
        csvFilename="gst_summary.csv"
        loading={loading}
        searchable={false}
      />

      {/* Note */}
      <p className="text-xs font-sans text-t3">
        Note: CGST and SGST are each 50% of total GST collected. Verify with your CA before filing returns.
      </p>
    </div>
  )
}
