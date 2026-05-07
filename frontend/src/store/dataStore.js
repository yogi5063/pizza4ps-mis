import { create } from 'zustand'

const useDataStore = create((set, get) => ({
  uploadedMonths: [],  // [{module, month_key, status}]
  kpiData: {},
  dailyData: {},
  hourlyData: {},
  catChData: {},
  itemsData: {},
  heatmapData: {},
  tablePerfData: {},
  cogsData: {},
  discountData: {},
  voidsData: {},
  gstData: {},
  topInvoicesData: {},
  menuData: [],
  isLoading: false,
  error: null,
  setUploadedMonths: (m) => set({ uploadedMonths: m }),
  setKpi: (d) => set({ kpiData: d }),
  setDaily: (d) => set({ dailyData: d }),
  setHourly: (d) => set({ hourlyData: d }),
  setCatCh: (d) => set({ catChData: d }),
  setItems: (d) => set({ itemsData: d }),
  setHeatmap: (d) => set({ heatmapData: d }),
  setTablePerf: (d) => set({ tablePerfData: d }),
  setCogs: (d) => set({ cogsData: d }),
  setDiscount: (d) => set({ discountData: d }),
  setVoids: (d) => set({ voidsData: d }),
  setGst: (d) => set({ gstData: d }),
  setTopInvoices: (d) => set({ topInvoicesData: d }),
  setMenu: (d) => set({ menuData: d }),
  setLoading: (b) => set({ isLoading: b }),
  setError: (e) => set({ error: e }),
}))

export default useDataStore
