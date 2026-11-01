import { isPlanId, PLANS, type PlanId } from './plans'

// Stripe ile ortak dil: Worker (`server.ts`) ve kurulum betiği (`scripts/stripe-setup.mjs`) aynı adları kullanır.
// SDK yok: Worker'da yalnızca `fetch` ve Web Crypto gerekir. Saf modül, tarayıcıya bağlı hiçbir şey içe aktarmaz.

export const STRIPE_API = 'https://api.stripe.com/v1'

/** Müşteri portalı ayarının `metadata.app` değeri: Worker ayarı bununla bulur (deneme ve canlı kipte kimlik farklı). */
export const PORTAL_APP = 'mango-studio'

/** Erişimin sürdüğü abonelik durumları (`past_due`: Stripe ödemeyi yeniden denerken); SQL'deki `billing_apply` ile aynı. */
export const ACTIVE_STATUSES = ['active', 'trialing', 'past_due']

export type PaidPlanId = Exclude<PlanId, 'free'>

export const PAID_PLANS = PLANS.filter((p) => p.price > 0).map((p) => p.id as PaidPlanId)

/**
 * Planın Stripe'taki fiyatı kimlikle değil arama anahtarıyla bulunur: deneme ve canlı kipte aynı ad, koda fiyat
 * kimliği yazılmaz. Fiyat değişirse yeni fiyat aynı anahtarı devralır (`transfer_lookup_key`).
 */
export const priceLookupKey = (plan: PaidPlanId) => `mango_${plan}_monthly`

export function planFromLookupKey(key: string | null | undefined): PaidPlanId | undefined {
  const plan = key?.match(/^mango_(\w+)_monthly$/)?.[1]
  return isPlanId(plan) && plan !== 'free' ? plan : undefined
}

/** Stripe'ın form gövdesi: iç içe alanlar `a[b][0]=1` biçiminde; `undefined` ve `null` atlanır. */
export function encodeForm(value: Record<string, unknown>): string {
  const pairs: string[] = []
  const walk = (key: string, v: unknown) => {
    if (v === undefined || v === null) return
    if (Array.isArray(v)) v.forEach((item, i) => walk(`${key}[${i}]`, item))
    else if (typeof v === 'object') for (const [k, inner] of Object.entries(v)) walk(`${key}[${k}]`, inner)
    else pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`)
  }
  for (const [k, v] of Object.entries(value)) walk(k, v)
  return pairs.join('&')
}

const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')

/** Stripe imzasının hesabı: `t.gövde` üstünde HMAC-SHA256 (testler de geçerli imza üretmek için kullanır). */
export async function signPayload(payload: string, secret: string, timestamp: number): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`)))
}

function sameText(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * `Stripe-Signature` başlığını doğrular (`t=...,v1=...`; anahtar değişiminde birden çok `v1` gelebilir). Gövde
 * ham metin olmalı: yeniden yazılmış JSON'un imzası tutmaz. Beş dakikadan eski imza kabul edilmez (tekrar oynatma).
 */
export async function verifySignature(payload: string, header: string | null, secret: string, now = Date.now() / 1000, tolerance = 300): Promise<boolean> {
  if (!header || !secret) return false
  const parts = header.split(',').map((part) => part.trim().split('='))
  const timestamp = Number(parts.find(([k]) => k === 't')?.[1])
  const signatures = parts.filter(([k]) => k === 'v1').map(([, v]) => v)
  if (!Number.isFinite(timestamp) || !signatures.length || Math.abs(now - timestamp) > tolerance) return false
  const expected = await signPayload(payload, secret, timestamp)
  return signatures.some((s) => sameText(s, expected))
}
