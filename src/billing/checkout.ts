import { supabase } from '../cloud/client'
import { useAuthStore } from '../store/authStore'
import { usePlanStore } from '../store/planStore'
import { useProfileStore } from '../store/profileStore'
import type { PlanId } from './plans'
import type { BillingErrorCode } from './server'

/**
 * Tarayıcı tarafı: plan seçimi ve abonelik yönetimi. Ödeme Stripe'ın sayfasında alınır (Worker'daki
 * `/api/billing/*` uçları adresi verir, `server.ts`); plan ödeme onayından sonra sunucudan gelir (`profileStore`).
 * - `redirecting`: tarayıcı Stripe'a gidiyor · `signin`: önce giriş gerekli (giriş penceresi açıldı)
 * - `unavailable`: ödeme bu yayında kurulu değil · `none`: yönetilecek abonelik yok · `failed`: istek başarısız
 * - `activated`: bulutsuz geliştirme derlemesinde plan yerelde açıldı (sınırları denemek için, ödeme yok)
 */
export type CheckoutResult = 'redirecting' | 'signin' | 'unavailable' | 'none' | 'failed' | 'activated'

type Outcome = { url?: string; plan?: string | null; error?: BillingErrorCode | 'signin' | 'unavailable' }

async function call(path: 'checkout' | 'portal' | 'sync', body: Record<string, unknown> = {}): Promise<Outcome> {
  if (!supabase) return { error: 'unavailable' }
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return { error: 'signin' }
  try {
    // `origin`: Stripe'tan dönülecek adres (sunucu yalnızca kendi adreslerimizi kabul eder).
    const res = await fetch(`/api/billing/${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, origin: window.location.origin }) })
    // Uç yoksa (Worker çalışmıyor, eski yayın) site kendi sayfasını döndürür: JSON değilse "kurulmadı" say.
    const result = (await res.json().catch(() => null)) as Outcome | null
    if (!result) return { error: res.ok || res.status === 404 ? 'not_configured' : 'failed' }
    if (!res.ok) return { error: result.error ?? 'failed' }
    return result
  } catch {
    return { error: 'failed' }
  }
}

function leave(outcome: Outcome): CheckoutResult {
  if (outcome.url) {
    window.location.assign(outcome.url)
    return 'redirecting'
  }
  if (outcome.error === 'signin' || outcome.error === 'unauthorized') {
    useAuthStore.getState().openSignIn()
    return 'signin'
  }
  if (outcome.error === 'unavailable' || outcome.error === 'not_configured') return 'unavailable'
  return outcome.error === 'no_subscription' ? 'none' : 'failed'
}

/** Müşteri portalı: kart, faturalar, plan değişikliği, iptal. */
export async function openBillingPortal(): Promise<CheckoutResult> {
  return leave(await call('portal'))
}

/**
 * Plan seçimi: ücretli plan Stripe ödeme sayfasına (aboneliği olan üyede plan değişikliği onayına) götürür;
 * ücretsiz plana dönüş abonelik iptalidir, portaldan yapılır.
 */
export async function startCheckout(planId: PlanId): Promise<CheckoutResult> {
  if (!supabase) {
    if (planId !== 'free' && !import.meta.env.DEV) return 'unavailable'
    usePlanStore.getState().setPlan(planId)
    return 'activated'
  }
  return planId === 'free' ? openBillingPortal() : leave(await call('checkout', { plan: planId }))
}

/**
 * Ödeme sayfasından dönüşte: aboneliği Stripe'tan hemen okutur (bildirim gecikse de plan açılır) ve profili yeniler.
 * Plan açıldıysa `true`.
 */
export async function confirmCheckout(): Promise<boolean> {
  const outcome = await call('sync')
  await useProfileStore.getState().refreshBilling()
  return !!outcome.plan && outcome.plan !== 'free'
}
