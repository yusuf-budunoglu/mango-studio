import { create } from 'zustand'
import { isPlanId } from '../billing/plans'
import { supabase } from '../cloud/client'
import { fetchStorageStatus } from '../persistence/cloudAssets'
import { usePlanStore } from './planStore'

/** Üyenin Stripe aboneliği (sunucudaki `billing_status`); aboneliği hiç olmamışsa `status: 'none'`. */
export interface Subscription {
  status: string
  /** erişim sürüyor mu (active, trialing, past_due) */
  subscribed: boolean
  /** içinde bulunulan dönemin sonu (ms); yenileme ya da bitiş günü */
  periodEnd: number | null
  /** iptal edilmiş, dönem sonunda bitecek */
  cancelAtPeriodEnd: boolean
}

interface BillingStatus {
  plan?: unknown
  status?: string
  subscribed?: boolean
  period_start?: string
  period_end?: string | null
  cancel_at_period_end?: boolean
  ai_used?: number
}

/**
 * Sunucudaki profil: yönetici mi (genel şablon yayınlama yetkisi), depolama kullanımı, plan ve abonelik.
 * Arayüz bunlarla düğme gösterir/gizler; asıl sınır sunucuda (RLS, kota tetikleyicisi, yapay zekâ sayaçları).
 * Plan `usePlanStore`'a yazılır: girişli üyede plan yalnızca buradan gelir.
 */
interface ProfileStore {
  isAdmin: boolean
  /** kullanılan / kota (bayt); bulut yoksa ya da henüz okunmadıysa `null` */
  storage: { used: number; quota: number } | null
  /** bulut yoksa, henüz okunmadıysa ya da ödeme göçü uygulanmamışsa `null` */
  subscription: Subscription | null
  load: (userId: string) => Promise<void>
  refreshStorage: () => Promise<void>
  /** Planı, aboneliği ve harcanan krediyi sunucudan yeniden okur (ödeme dönüşünde, portaldan dönünce). */
  refreshBilling: (fallbackPlan?: unknown) => Promise<void>
  reset: () => void
}

export const useProfileStore = create<ProfileStore>()((set, get) => ({
  isAdmin: false,
  storage: null,
  subscription: null,
  async load(userId) {
    if (!supabase) return
    const [profile, storage] = await Promise.all([
      supabase.from('profiles').select('is_admin, plan').eq('user_id', userId).maybeSingle(),
      fetchStorageStatus(supabase),
    ])
    set({ isAdmin: !!profile.data?.is_admin, storage: storage ?? null })
    await get().refreshBilling(profile.data?.plan)
  },
  async refreshStorage() {
    if (!supabase) return
    const storage = await fetchStorageStatus(supabase)
    if (storage) set({ storage })
  },
  async refreshBilling(fallbackPlan) {
    if (!supabase) return
    const { data, error } = await supabase.rpc('billing_status')
    const status = error ? null : (data as BillingStatus | null)
    if (!status || !isPlanId(status.plan)) {
      // Ödeme göçü uygulanmamış: plan profilden, dönem takvim ayı (sunucudaki eski sayım).
      const now = new Date()
      if (isPlanId(fallbackPlan)) usePlanStore.getState().applyServer({ planId: fallbackPlan, anchor: Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1), used: 0 })
      return
    }
    const periodEnd = status.period_end ? Date.parse(status.period_end) : NaN
    set({
      subscription: {
        status: status.status ?? 'none',
        subscribed: !!status.subscribed,
        periodEnd: Number.isFinite(periodEnd) ? periodEnd : null,
        cancelAtPeriodEnd: !!status.cancel_at_period_end,
      },
    })
    const anchor = Date.parse(status.period_start ?? '')
    usePlanStore.getState().applyServer({ planId: status.plan, anchor: Number.isFinite(anchor) ? anchor : Date.now(), used: status.ai_used ?? 0 })
  },
  reset: () => {
    set({ isAdmin: false, storage: null, subscription: null })
    // Çıkış yapınca üyenin planı bu tarayıcıda kalmaz.
    usePlanStore.getState().setPlan('free')
  },
}))
