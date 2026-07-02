import { create } from 'zustand'
import api from '../utils/api'

// Holds the logged-in user (role + view rights + must_change_password),
// loaded from /auth/me. Used for route gating, the sidebar, and forcing a
// password change.
const useAuthStore = create((set) => ({
  me: null,
  loaded: false,
  async loadMe() {
    const token = localStorage.getItem('token')
    if (!token) {
      set({ me: null, loaded: true })
      return null
    }
    try {
      const res = await api.get('/auth/me')
      set({ me: res.data, loaded: true })
      return res.data
    } catch (e) {
      set({ me: null, loaded: true })
      return null
    }
  },
  setMe: (me) => set({ me }),
  clear: () => set({ me: null, loaded: true }),
}))

export default useAuthStore
