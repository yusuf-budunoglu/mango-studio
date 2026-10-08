// Abonelik planları: fiyat, video çıktısı sınırları ve aylık yapay zekâ kredisi.
// Ödeme henüz bağlı değil; sınırlar ve krediler buradan okunur. Yapay zekâ kredisini sunucu da sayar (ai_usage göçü, aynı rakamlar).

export type Resolution = 720 | 1080 | 1440 | 2160
export type Fps = 30 | 60
export type PlanId = 'free' | 'starter' | 'pro' | 'unlimited'

export interface Plan {
  id: PlanId
  /** normal aylık fiyat (USD) */
  price: number
  /** çıkışa özel aylık fiyat (USD), normalin yarısı */
  launchPrice: number
  resolutions: Resolution[]
  fps: Fps[]
  /** aylık yapay zekâ kredisi (bir şey değiştiren düzenleme başına 1); 0 = planda kredi yok; null = sınırsız */
  aiCredits: number | null
  /**
   * aylık yapay zekâ mesajı üst sınırı: modele giden her istek sayılır (bir şey değiştirmeyenler de). Zarar sınırı:
   * en pahalı istekle bile plan fiyatının altında kalır (hesap: `AI_COST`). Sunucudaki `ai_message_limit` ile aynı olmalı.
   */
  aiMessages: number
  /** yüklenen dosyalar için depolama kotası (bayt, 1 GB = 10⁹); sunucudaki `storage_quota` ile aynı olmalı */
  storageBytes: number
}

/** Çıkışa özel indirim: tüm ücretli planlar yarı fiyatına. */
export const LAUNCH_DISCOUNT = 0.5

export const PLANS: Plan[] = [
  { id: 'free', price: 0, launchPrice: 0, resolutions: [1080], fps: [30], aiCredits: 0, aiMessages: 0, storageBytes: 500e6 },
  { id: 'starter', price: 9.99, launchPrice: 4.99, resolutions: [720, 1080, 1440], fps: [30, 60], aiCredits: 150, aiMessages: 300, storageBytes: 5e9 },
  { id: 'pro', price: 19.99, launchPrice: 9.99, resolutions: [720, 1080, 1440, 2160], fps: [30, 60], aiCredits: 500, aiMessages: 750, storageBytes: 20e9 },
  { id: 'unlimited', price: 39.99, launchPrice: 19.99, resolutions: [720, 1080, 1440, 2160], fps: [30, 60], aiCredits: null, aiMessages: 1500, storageBytes: 100e9 },
]

export const DEFAULT_PLAN: PlanId = 'free'

/** Bir üyenin günde gönderebileceği yapay zekâ mesajı (her planda; sunucudaki `ai_begin` ile aynı). */
export const AI_DAILY_MESSAGES = 150

/**
 * Yapay zekâ mesajının bize maliyeti (USD), 2026-10-09'da Claude Haiku 5.5 ile ölçüldü (0,10 $ / 0,50 $ milyon
 * token): `typical` önbellek sıcakken sıradan istek, `cold` önbellek soğukken (5 dakikadır istek yokken) sıradan
 * istek, `ceiling` olabilecek en pahalı istek (en büyük bağlam + çıktının tamamı). Mesaj sınırları `ceiling` ile
 * hesaplanır; model, fiyat ya da `max_tokens` değişirse yeniden ölç (`plans.test.ts` sınırı denetler).
 */
export const AI_COST = { typical: 0.0003, cold: 0.0009, ceiling: 0.004 }

export function getPlan(id: PlanId): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0]
}

export function isPlanId(value: unknown): value is PlanId {
  return PLANS.some((p) => p.id === value)
}

export const RESOLUTIONS: Resolution[] = [720, 1080, 1440, 2160]
export const RESOLUTION_LABEL: Record<Resolution, string> = { 720: '720p', 1080: '1080p', 1440: '2K (1440p)', 2160: '4K (2160p)' }

/** Bu çözünürlüğü / kare hızını açan en ucuz plan (kilitli seçeneklerin yanında gösterilir). */
export function cheapestPlanFor(option: { resolution?: Resolution; fps?: Fps }): Plan {
  return (
    PLANS.find((p) => (option.resolution === undefined || p.resolutions.includes(option.resolution)) && (option.fps === undefined || p.fps.includes(option.fps))) ??
    PLANS[PLANS.length - 1]
  )
}

/** Planın izin vermediği çıktı ayarlarını izin verilen en yakın değere indirir. */
export function clampExport<T extends { resolution: number; fps: number }>(plan: Plan, options: T): T & { resolution: Resolution; fps: Fps } {
  const allowed = [...plan.resolutions].sort((a, b) => a - b)
  const resolution = allowed.includes(options.resolution as Resolution)
    ? (options.resolution as Resolution)
    : ([...allowed].reverse().find((r) => r <= options.resolution) ?? allowed[0])
  const fps = plan.fps.includes(options.fps as Fps) ? (options.fps as Fps) : Math.max(...plan.fps.filter((f) => f <= options.fps), plan.fps[0]) as Fps
  return { ...options, resolution, fps }
}

export function exportAllowed(plan: Plan, options: { resolution: number; fps: number }) {
  return plan.resolutions.includes(options.resolution as Resolution) && plan.fps.includes(options.fps as Fps)
}

/** Kalan kredi; sınırsız planda Infinity. */
export function creditsLeft(plan: Plan, used: number) {
  return plan.aiCredits === null ? Infinity : Math.max(0, plan.aiCredits - used)
}

/** Abonelik başlangıcından `months` ay sonrası; kısa ayda ayın son günü (31 Ocak → 28 Şubat → 31 Mart). */
export function addMonths(anchor: number, months: number): number {
  const d = new Date(anchor)
  const next = new Date(d.getFullYear(), d.getMonth() + months, 1, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds())
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
  next.setDate(Math.min(d.getDate(), lastDay))
  return next.getTime()
}

/** Krediler her ay abonelik gününde yenilenir: `now` anının içinde olduğu dönemin başı ve sonu. */
export function creditPeriod(anchor: number, now: number): { start: number; end: number } {
  const d = new Date(anchor)
  const n = new Date(now)
  let k = Math.max(0, (n.getFullYear() - d.getFullYear()) * 12 + n.getMonth() - d.getMonth())
  while (k > 0 && addMonths(anchor, k) > now) k--
  return { start: addMonths(anchor, k), end: addMonths(anchor, k + 1) }
}

/** Bayt → "1.2 GB" / "350 MB" (10'luk birimler; kota rakamlarıyla aynı). */
export function formatBytes(bytes: number, locale?: string): string {
  const fmt = (v: number) => v.toLocaleString(locale, { maximumFractionDigits: v < 10 ? 1 : 0 })
  if (bytes >= 1e9) return `${fmt(bytes / 1e9)} GB`
  if (bytes >= 1e6) return `${fmt(bytes / 1e6)} MB`
  return `${fmt(Math.max(1, bytes / 1e3))} KB`
}
