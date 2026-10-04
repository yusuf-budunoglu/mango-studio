import { usePlanStore } from '../store/planStore'
import type { PlanId } from './plans'

export type CheckoutResult = 'activated' | 'unavailable'

/**
 * Plan seçimi. Ödeme sağlayıcısı henüz bağlı değil: geliştirme modunda plan hemen
 * etkinleşir (sınırları denemek için), yayında "ödemeler yakında" döner.
 * Ödeme bağlanınca burası ödeme sayfasına yönlendirir; plan, ödeme onayından sonra
 * sunucudan gelir.
 */
export async function startCheckout(planId: PlanId): Promise<CheckoutResult> {
  if (planId === 'free' || import.meta.env.DEV) {
    usePlanStore.getState().setPlan(planId)
    return 'activated'
  }
  return 'unavailable'
}
