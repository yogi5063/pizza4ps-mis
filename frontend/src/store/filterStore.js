import { create } from 'zustand'

// Shared filter state for all dashboard pages.
//
// Time is stored ABSTRACTLY (a preset, or a single year/month, or a range) so
// it survives page navigation and is re-resolved against each page's available
// months into `selectedMonths` (the list of "YYYY-MM" the pages actually read).
// Geography (country/location/outlet) is captured for outlet-scoped data.
const useFilterStore = create((set) => ({
  // ── time selection (abstract) ──────────────────────────────────────────────
  timeMode: 'single',            // 'single' | 'range'
  preset: 'latest',              // 'latest'|'l3'|'l6'|'ytd'|'lastyear'|'all'|null
  fYear: 'all',                  // single mode: 'all' | '2025' ...
  fMonth: 'all',                 // single mode: 'all' | '01'..'12'
  rFrom: null,                   // range mode: 'YYYY-MM'
  rTo: null,                     // range mode: 'YYYY-MM'

  // ── geography ──────────────────────────────────────────────────────────────
  geo: { country: null, location: null, outlet: null },

  // ── category / channel / status slicers ────────────────────────────────────
  selectedCategories: [],
  selectedChannels: [],
  selectedStatus: 'Active',

  // ── derived output the pages consume ───────────────────────────────────────
  selectedMonths: [],
  selectedYears: [],             // legacy back-compat (unused by new filter)

  filtersOpen: false,

  // setters
  setTime: (patch) => set(patch),
  setGeo: (geo) => set({ geo }),
  setSelectedMonths: (selectedMonths) => set({ selectedMonths }),
  setCategories: (selectedCategories) => set({ selectedCategories }),
  setChannels: (selectedChannels) => set({ selectedChannels }),
  setStatus: (selectedStatus) => set({ selectedStatus }),
  // legacy setters kept so any not-yet-migrated caller won't crash
  setMonths: (selectedMonths) => set({ selectedMonths }),
  setYears: (selectedYears) => set({ selectedYears }),
  toggleFilters: () => set((s) => ({ filtersOpen: !s.filtersOpen })),
  clearAll: () => set({
    timeMode: 'single', preset: 'latest', fYear: 'all', fMonth: 'all',
    rFrom: null, rTo: null, geo: { country: null, location: null, outlet: null },
    selectedCategories: [], selectedChannels: [], selectedStatus: 'Active',
  }),
}))

export default useFilterStore
