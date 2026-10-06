import { create } from 'zustand'

const SIDEBAR_KEY = 'motion-studio.sidebar-collapsed'
const FAVORITES_KEY = 'motion-studio.favorite-templates'
const THEME_KEY = 'motion-studio.theme'

export type Theme = 'dark' | 'light'

function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

/** Temayı belgeye yazar: tokenlar `:root[data-theme]` ile değişir (index.css). Editör her temada koyu. */
function applyTheme(theme: Theme) {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme
}

function readFavorites(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

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
  /** Kalple işaretlenen şablonlar (yalnızca bu tarayıcıda). */
  favorites: string[]
  toggleFavorite: (templateId: string) => void
  /** Site teması (yalnızca bu tarayıcıda); varsayılan koyu. */
  theme: Theme
  toggleTheme: () => void
}

applyTheme(readTheme())

export const useUiStore = create<UiStore>()((set) => ({
  theme: readTheme(),
  toggleTheme: () =>
    set((s) => {
      const theme: Theme = s.theme === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(THEME_KEY, theme)
      } catch {
        // tercih kaydedilemese de bu oturumda çalışır
      }
      applyTheme(theme)
      return { theme }
    }),
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
  favorites: readFavorites(),
  toggleFavorite: (templateId) =>
    set((s) => {
      const favorites = s.favorites.includes(templateId) ? s.favorites.filter((id) => id !== templateId) : [...s.favorites, templateId]
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites))
      } catch {
        // kaydedilemese de bu oturumda çalışır
      }
      return { favorites }
    }),
}))

/** Türkçe/İngilizce büyük-küçük harf ve aksan farkını yok sayarak arar. */
export function matchesSearch(text: string, query: string) {
  const norm = (s: string) => s.toLocaleLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i')
  return norm(text).includes(norm(query.trim()))
}
