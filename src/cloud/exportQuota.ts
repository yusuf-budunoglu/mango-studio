import { create } from 'zustand'
import { useAuthStore } from '../store/authStore'
import { supabase } from './client'

/** Üyenin bu dönemdeki çıktı sayısı ve planının sınırı (sunucudaki `export_status`); `limit: null` = sınırsız. */
export interface ExportQuota {
  used: number
  limit: number | null
  /** dönemin başı (ms); ücretsiz planda ayın ilk günü (UTC) */
  periodStart: number | null
}

/** Sınır dolmuş mu? Bilinmiyorsa (bulut kapalı, giriş yok, sunucu okunamadı) çıktı engellenmez. */
export const exportBlocked = (quota: ExportQuota | null) => !!quota && quota.limit !== null && quota.used >= quota.limit

interface ExportQuotaStore {
  quota: ExportQuota | null
  /** Sunucudan yeniden okur; okunamazsa `null` (sınır uygulanmaz). */
  refresh: () => Promise<ExportQuota | null>
  /** Başarılı çıktıdan sonra: sunucuya yazılan satırı beklemeden sayacı bir artırır. */
  count: () => void
}

/**
 * Aylık çıktı sınırı (ücretsiz planda; rakamlar `billing/plans.ts` `exportsPerMonth`). Çıktı tarayıcıda üretildiği
 * için sınır arayüzde uygulanır: çıktı düğmeleri pencere açılınca ve çıktıdan hemen önce buradan sorar.
 */
export const useExportQuotaStore = create<ExportQuotaStore>()((set, get) => ({
  quota: null,
  async refresh() {
    if (!supabase || useAuthStore.getState().status !== 'in') {
      set({ quota: null })
      return null
    }
    const { data, error } = await supabase.rpc('export_status')
    const row = error ? null : (data as { used?: number; limit?: number | null; period_start?: string } | null)
    const start = Date.parse(row?.period_start ?? '')
    const quota = row && typeof row.used === 'number' ? { used: row.used, limit: row.limit ?? null, periodStart: Number.isFinite(start) ? start : null } : null
    set({ quota })
    return quota
  },
  count() {
    const { quota } = get()
    if (quota) set({ quota: { ...quota, used: quota.used + 1 } })
  },
}))
