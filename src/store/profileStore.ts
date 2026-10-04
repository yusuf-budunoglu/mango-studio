import { create } from 'zustand'
import { supabase } from '../cloud/client'
import { fetchStorageStatus } from '../persistence/cloudAssets'

/**
 * Sunucudaki profil: yönetici mi (genel şablon yayınlama yetkisi) ve depolama kullanımı.
 * Arayüz bunlarla düğme gösterir/gizler; asıl sınır sunucuda (RLS ve kota tetikleyicisi).
 */
interface ProfileStore {
  isAdmin: boolean
  /** kullanılan / kota (bayt); bulut yoksa ya da henüz okunmadıysa `null` */
  storage: { used: number; quota: number } | null
  load: (userId: string) => Promise<void>
  refreshStorage: () => Promise<void>
  reset: () => void
}

export const useProfileStore = create<ProfileStore>()((set) => ({
  isAdmin: false,
  storage: null,
  async load(userId) {
    if (!supabase) return
    const [profile, storage] = await Promise.all([
      supabase.from('profiles').select('is_admin').eq('user_id', userId).maybeSingle(),
      fetchStorageStatus(supabase),
    ])
    set({ isAdmin: !!profile.data?.is_admin, storage: storage ?? null })
  },
  async refreshStorage() {
    if (!supabase) return
    const storage = await fetchStorageStatus(supabase)
    if (storage) set({ storage })
  },
  reset: () => set({ isAdmin: false, storage: null }),
}))
