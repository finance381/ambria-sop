import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Station, StaffMember } from '../lib/types'
import { getLang, setLang as setLangFn } from '../lib/i18n'

interface AppState {
  station: Station | null
  setStation: (s: Station | null) => void
  staff: StaffMember | null
  setStaff: (s: StaffMember | null) => void
  isAdmin: boolean
  setIsAdmin: (v: boolean) => void
  lang: 'hi' | 'en'
  toggleLang: () => void
  isOnline: boolean
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      station: null,
      setStation: (station) => set({ station }),
      staff: null,
      setStaff: (staff) => set({ staff }),
      isAdmin: false,
      setIsAdmin: (isAdmin) => set({ isAdmin }),
      lang: getLang(),
      toggleLang: () => {
        const next = get().lang === 'hi' ? 'en' : 'hi'
        setLangFn(next)
        set({ lang: next })
      },
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    }),
    {
      name: 'ambria-session',
      partialize: (state) => ({
        station: state.station,
        staff: state.staff,
        lang: state.lang,
      }),
    }
  )
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => useStore.setState({ isOnline: true }))
  window.addEventListener('offline', () => useStore.setState({ isOnline: false }))
}