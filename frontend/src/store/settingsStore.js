import { create } from 'zustand'
import { FX_RATES } from '../utils/formatters'

const useSettingsStore = create((set) => ({
  currency: 'INR',
  fxRates: { ...FX_RATES },
  targets: {},
  setCurrency: (c) => set({ currency: c }),
  setFxRates: (rates) => set({ fxRates: rates }),
  setTargets: (t) => set({ targets: t }),
  updateRate: (cur, rate) => set(s => ({ fxRates: { ...s.fxRates, [cur]: rate } })),
}))

export default useSettingsStore
