import { create } from 'zustand'
import { cleanBrandKit, EMPTY_BRAND_KIT, type BrandKit } from '../project/brandKit'
import { useAuthStore } from '../store/authStore'
import { supabase } from './client'

const LOCAL_KEY = 'motion-studio.brand-kit'

interface BrandKitStore {
  kit: BrandKit
  /** sunucudan (bulutsuz derlemede tarayıcıdan) okundu mu */
  loaded: boolean
  load: () => Promise<void>
  /** Kaydeder; plan izin vermiyorsa ya da yazılamazsa `false`. */
  save: (kit: BrandKit) => Promise<boolean>
}

const signedIn = () => !!supabase && useAuthStore.getState().status === 'in'

/**
 * Üyenin marka kiti (`brand_kits` tablosu, üye başına bir satır; yazmayı sunucu yalnızca Pro ve Unlimited planda
 * kabul eder). Bulut kapalıyken bu tarayıcıda tutulur.
 */
export const useBrandKitStore = create<BrandKitStore>()((set) => ({
  kit: EMPTY_BRAND_KIT,
  loaded: false,
  async load() {
    if (!supabase) {
      let stored: unknown = null
      try {
        stored = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? 'null')
      } catch {
        // bozuk kayıt: boş kit
      }
      set({ kit: cleanBrandKit(stored), loaded: true })
      return
    }
    if (!signedIn()) {
      set({ kit: EMPTY_BRAND_KIT, loaded: false })
      return
    }
    const { data, error } = await supabase.from('brand_kits').select('data').maybeSingle()
    // Tablo yoksa (göç uygulanmamış) boş kit: özellik kapalı gibi davranır.
    set({ kit: cleanBrandKit(error ? null : data?.data), loaded: !error })
  },
  async save(next) {
    const kit = cleanBrandKit(next)
    if (!supabase) {
      try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(kit))
      } catch {
        return false
      }
      set({ kit, loaded: true })
      return true
    }
    const userId = useAuthStore.getState().user?.id
    if (!signedIn() || !userId) return false
    const { error } = await supabase.from('brand_kits').upsert({ user_id: userId, data: kit, updated_at: new Date().toISOString() })
    if (error) return false
    set({ kit, loaded: true })
    return true
  },
}))
