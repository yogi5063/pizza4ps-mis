import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useFilterStore = create(
  persist(
    (set) => ({
      // ── time selection (abstract — persisted to localStorage) ─────────────
      timeMode: 'single',
      preset: 'latest',
      fYear: 'all',
      fMonth: 'all',
      rFrom: null,
      rTo: null,

      // ── geography (persisted) ─────────────────────────────────────────────
      geo: { country: null, location: null, outlet: null },

      // ── category / channel slicers ─────────────────────────────────────────
      selectedCategories: [],
      selectedChannels: [],
      selectedStatus: 'Active',

      // ── derived output (NOT persisted — re-resolved after each mount) ─────
      selectedMonths: [],
      selectedYears: [],

      filtersOpen: false,

      // setters
      setTime: (patch) => set(patch),
      setGeo: (geo) => set({ geo }),
      setSelectedMonths: (selectedMonths) => set({ selectedMonths }),
      setCategories: (selectedCategories) => set({ selectedCategories }),
      setChannels: (selectedChannels) => set({ selectedChannels }),
      setStatus: (selectedStatus) => set({ selectedStatus }),
      setMonths: (selectedMonths) => set({ selectedMonths }),
      setYears: (selectedYears) => set({ selectedYears }),
      toggleFilters: () => set((s) => ({ filtersOpen: !s.filtersOpen })),
      clearAll: () => set({
        timeMode: 'single', preset: 'latest', fYear: 'all', fMonth: 'all',
        rFrom: null, rTo: null, geo: { country: null, location: null, outlet: null },
        selectedCategories: [], selectedChannels: [], selectedStatus: 'Active',
      }),
    }),
    {
      name: 'pizza4ps-filters',
      // Only persist the abstract selection — not derived selectedMonths
      partialize: (s) => ({
        timeMode: s.timeMode,
        preset: s.preset,
        fYear: s.fYear,
        fMonth: s.fMonth,
        rFrom: s.rFrom,
        rTo: s.rTo,
        geo: s.geo,
        filtersOpen: s.filtersOpen,
      }),
    }
  )
)

export default useFilterStore
