import { create } from 'zustand'

const SIDEBAR_KEY = 'motion-studio.sidebar-collapsed'

function readCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1'
  } catch {
    return false
  }
}

interface UiStore {
  /** Üst çubuktaki arama; Videos ve Templates listelerini süzer. */
  search: string
  setSearch: (q: string) => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void
}

export const useUiStore = create<UiStore>()((set) => ({
  search: '',
  setSearch: (search) => set({ search }),
  sidebarCollapsed: readCollapsed(),
  toggleSidebar: () =>
    set((s) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, s.sidebarCollapsed ? '0' : '1')
      } catch {
        // tercih kaydedilemese de bu oturumda çalışır
      }
      return { sidebarCollapsed: !s.sidebarCollapsed }
    }),
}))

/** Türkçe/İngilizce büyük-küçük harf ve aksan farkını yok sayarak arar. */
export function matchesSearch(text: string, query: string) {
  const norm = (s: string) => s.toLocaleLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i')
  return norm(text).includes(norm(query.trim()))
}
