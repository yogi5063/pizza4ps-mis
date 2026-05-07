import { create } from 'zustand'

const useFilterStore = create((set) => ({
  selectedMonths: [],
  selectedYears: [],
  selectedCategories: [],
  selectedChannels: [],
  selectedStatus: 'Active',
  filtersOpen: false,
  setMonths: (months) => set({ selectedMonths: months }),
  setYears: (years) => set({ selectedYears: years }),
  setCategories: (cats) => set({ selectedCategories: cats }),
  setChannels: (chs) => set({ selectedChannels: chs }),
  setStatus: (s) => set({ selectedStatus: s }),
  toggleFilters: () => set(s => ({ filtersOpen: !s.filtersOpen })),
  clearAll: () => set({ selectedMonths: [], selectedYears: [], selectedCategories: [], selectedChannels: [], selectedStatus: 'Active' }),
}))

export default useFilterStore
