import { ACTIVE_STATUSES, encodeForm, PAID_PLANS, planFromLookupKey, PORTAL_APP, priceLookupKey, STRIPE_API, verifySignature, type PaidPlanId } from './stripe'

/**
 * Ödeme uçları (`/api/billing/*`, Worker). Ödeme Stripe'ın kendi sayfasında alınır; kart bilgisi bize gelmez.
 * Managed Payments açıkken (`STRIPE_MANAGED_PAYMENTS`) satıcı Stripe / Link'tir: oturuma vergi, ödeme yöntemi ve fatura
 * ayarı eklenmez (Stripe reddeder; liste: docs.stripe.com/payments/managed-payments/update-checkout).
 * - `POST /api/billing/checkout` `{ plan }`: üyeyi Stripe ödeme sayfasına gönderecek adresi verir. Üyenin zaten
 *   aboneliği varsa ikinci abonelik açmaz: plan değişikliği için müşteri portalının onay ekranını döndürür.
 * - `POST /api/billing/portal`: müşteri portalı (kart, fatura, iptal).
 * - `POST /api/billing/sync`: üyenin aboneliğini Stripe'tan okuyup yazar; ödeme dönüşünde bildirim beklenmesin diye.
 * - `POST /api/billing/webhook`: Stripe bildirimi (imzası doğrulanır). Bildirimin içeriğine güvenilmez, sırası da
 *   garanti değildir: her bildirimde müşterinin abonelikleri Stripe'tan yeniden okunur ve güncel hali yazılır.
 * Plan `profiles.plan`'a gizli anahtarla, `billing_apply` işleviyle yazılır (göç: `20261014000001_billing.sql`).
 */
export interface BillingEnv {
  SUPABASE_URL: string
  SUPABASE_PUBLISHABLE_KEY: string
  /** Supabase gizli anahtarı (`sb_secret_...` ya da eski service_role): planı yazmak için. `wrangler secret put` */
  SUPABASE_SECRET_KEY?: string
  /** `wrangler secret put STRIPE_SECRET_KEY`; yoksa uçlar "kurulmadı" der */
  STRIPE_SECRET_KEY?: string
  /** Bildirim ucunun imza anahtarı (`whsec_...`) */
  STRIPE_WEBHOOK_SECRET?: string
  /**
   * `'true'`: ödeme oturumları Managed Payments ile açılır (satıcı Stripe / Link olur; vergiyi, itirazları ve ödeme
   * desteğini Stripe üstlenir, işlem başına ek ücret alır). Gizli değil: `wrangler.jsonc` `vars`. Hesapta Managed
   * Payments açık değilse Stripe oturumu reddeder; sessizce normal ödemeye düşülmez (vergi sahipsiz kalmasın).
   */
  STRIPE_MANAGED_PAYMENTS?: string
}

interface Deps {
  fetch?: typeof fetch
  /** testler için: imza zaman denetiminin "şimdi"si (saniye) */
  now?: number
}

/** Tarayıcıya dönen hata adları. */
export type BillingErrorCode = 'unauthorized' | 'bad_request' | 'not_configured' | 'no_subscription' | 'failed'

const BILLING_PREFIX = '/api/billing/'
const MAX_BODY = 2_000
// Stripe bildirimleri birkaç KB; sınır yalnızca kötü niyetli gövdeyi imza hesabından önce kesmek için.
const MAX_WEBHOOK_BODY = 500_000

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
const fail = (error: BillingErrorCode, status: number) => json({ error }, status)

export const isBillingPath = (pathname: string) => pathname.startsWith(BILLING_PREFIX)

class BillingError extends Error {
  readonly code: BillingErrorCode
  readonly status: number
  constructor(code: BillingErrorCode, status: number, detail = '') {
    super(detail || code)
    this.code = code
    this.status = status
  }
}

interface StripeSubscription {
  id: string
  status: string
  created: number
  cancel_at_period_end?: boolean
  cancel_at?: number | null
  // 2025-03-31 öncesi API sürümlerinde dönem aboneliğin, sonrasında kalemin üstünde
  current_period_start?: number
  current_period_end?: number
  metadata?: Record<string, string>
  items: { data: { id: string; current_period_start?: number; current_period_end?: number; price: { id: string; lookup_key?: string | null; metadata?: Record<string, string> } }[] }
}

interface Context {
  env: BillingEnv
  doFetch: typeof fetch
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function stripe<T>(ctx: Context, method: 'GET' | 'POST', path: string, params?: Record<string, unknown>, idempotencyKey?: string): Promise<T> {
  const query = params && method === 'GET' ? `?${encodeForm(params)}` : ''
  const res = await ctx.doFetch(`${STRIPE_API}${path}${query}`, {
    method,
    headers: {
      Authorization: `Bearer ${ctx.env.STRIPE_SECRET_KEY}`,
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    ...(method === 'POST' ? { body: encodeForm(params ?? {}) } : {}),
  })
  const body = (await res.json().catch(() => null)) as (T & { error?: { message?: string; code?: string } }) | null
  if (!res.ok || !body) throw new BillingError('failed', 502, `stripe ${method} ${path} ${res.status} ${body?.error?.code ?? ''} ${body?.error?.message ?? ''}`)
  return body
}

/** Gizli anahtarla Supabase işlevi (RLS'yi aşar): yalnızca `billing_*` işlevleri için. */
async function admin<T>(ctx: Context, name: string, args: Record<string, unknown>): Promise<T> {
  const key = ctx.env.SUPABASE_SECRET_KEY as string
  const res = await ctx.doFetch(`${ctx.env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  const raw = await res.text()
  // 404: işlev yok (göç uygulanmamış)
  if (!res.ok) throw new BillingError(res.status === 404 ? 'not_configured' : 'failed', res.status === 404 ? 503 : 502, `supabase ${name} ${res.status} ${raw.slice(0, 300)}`)
  return (raw ? JSON.parse(raw) : null) as T
}

/** Oturum anahtarını Supabase'e doğrulatır (MCP sunucusuyla aynı yol). */
async function signedInUser(ctx: Context, request: Request): Promise<{ id: string; email?: string }> {
  const accessToken = request.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1]
  if (!accessToken) throw new BillingError('unauthorized', 401)
  const res = await ctx.doFetch(`${ctx.env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ctx.env.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}` } })
  const user = res.ok ? ((await res.json().catch(() => null)) as { id?: string; email?: string } | null) : null
  if (!user?.id || !UUID.test(user.id)) throw new BillingError('unauthorized', 401)
  return { id: user.id, email: user.email }
}

const isOurOrigin = (origin: unknown): origin is string =>
  typeof origin === 'string' && (/^https:\/\/(www\.)?mangostudio\.design$/.test(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))

/**
 * Stripe'tan dönülecek site adresi; yalnızca bizim adreslerimizden biri olabilir. Önce tarayıcının bildirdiği adres
 * (`origin` alanı): `wrangler dev` `Origin` başlığını yayın adresine çevirdiği için başlığa bakmak yerelde ödemeyi
 * canlı siteye döndürüyordu. Sonra `Origin` başlığı, o da yoksa isteğin kendi adresi.
 */
function siteOrigin(request: Request, claimed?: unknown): string {
  if (isOurOrigin(claimed)) return claimed
  const header = request.headers.get('Origin')
  return isOurOrigin(header) ? header : new URL(request.url).origin
}

/** İstek gövdesi (küçük JSON nesnesi); boş gövde boş nesnedir. */
async function readBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text()
  if (text.length > MAX_BODY) throw new BillingError('bad_request', 413)
  if (!text.trim()) return {}
  try {
    const body: unknown = JSON.parse(text)
    if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>
  } catch {
    // aşağıda reddedilir
  }
  throw new BillingError('bad_request', 400)
}

const planOf = (sub: StripeSubscription): PaidPlanId | undefined => {
  const price = sub.items.data[0]?.price
  const fromMeta = price?.metadata?.plan as PaidPlanId | undefined
  return planFromLookupKey(price?.lookup_key) ?? (fromMeta && PAID_PLANS.includes(fromMeta) ? fromMeta : undefined)
}

const isActive = (sub: StripeSubscription) => ACTIVE_STATUSES.includes(sub.status)

/** Müşterinin bizim planlarımızdan birine ait abonelikleri; önce erişimi sürenler, sonra en yenisi. */
async function subscriptionsOf(ctx: Context, customer: string): Promise<StripeSubscription[]> {
  const list = await stripe<{ data: StripeSubscription[] }>(ctx, 'GET', '/subscriptions', { customer, status: 'all', limit: 20 })
  return list.data.filter((sub) => planOf(sub)).sort((a, b) => Number(isActive(b)) - Number(isActive(a)) || b.created - a.created)
}

const iso = (seconds: number | undefined) => (seconds ? new Date(seconds * 1000).toISOString() : null)

/**
 * Müşterinin güncel aboneliğini Stripe'tan okuyup veritabanına yazar. Tanınmayan müşteride (başka bir ürünün
 * bildirimi) `null`.
 */
async function syncCustomer(ctx: Context, customer: string): Promise<{ user_id: string; plan: string } | null> {
  const sub = (await subscriptionsOf(ctx, customer))[0]
  const item = sub?.items.data[0]
  const hint = sub?.metadata?.user_id
  return admin(ctx, 'billing_apply', {
    p_customer: customer,
    p_user: hint && UUID.test(hint) ? hint : null,
    p_subscription: sub?.id ?? null,
    p_plan: sub ? planOf(sub) : 'free',
    p_status: sub?.status ?? 'none',
    p_period_start: iso(sub?.current_period_start ?? item?.current_period_start),
    p_period_end: iso(sub?.current_period_end ?? item?.current_period_end),
    p_cancel: !!sub && (!!sub.cancel_at_period_end || sub.cancel_at != null),
  })
}

async function ensureCustomer(ctx: Context, user: { id: string; email?: string }): Promise<string> {
  const existing = await admin<string | null>(ctx, 'billing_customer', { p_user: user.id })
  if (existing) return existing
  // Aynı üye için tekrarlanan istek (çift tıklama, iki sekme) Stripe'ta tek müşteri açar.
  const created = await stripe<{ id: string }>(ctx, 'POST', '/customers', { email: user.email, metadata: { user_id: user.id } }, `mango-customer-${user.id}`)
  return admin<string>(ctx, 'billing_set_customer', { p_user: user.id, p_customer: created.id })
}

async function portalSession(ctx: Context, customer: string, returnUrl: string, flow?: Record<string, unknown>): Promise<string> {
  // Kurulum betiğinin açtığı portal ayarı; yoksa hesabın varsayılan ayarı kullanılır.
  const configs = await stripe<{ data: { id: string; metadata?: Record<string, string> }[] }>(ctx, 'GET', '/billing_portal/configurations', { active: true, limit: 100 })
  const configuration = configs.data.find((c) => c.metadata?.app === PORTAL_APP)?.id
  const session = await stripe<{ url: string }>(ctx, 'POST', '/billing_portal/sessions', { customer, return_url: returnUrl, configuration, flow_data: flow })
  return session.url
}

async function checkout(ctx: Context, request: Request): Promise<Response> {
  const user = await signedInUser(ctx, request)
  const body = await readBody(request)
  const plan = body.plan
  if (!PAID_PLANS.includes(plan as PaidPlanId)) throw new BillingError('bad_request', 400)
  const planId = plan as PaidPlanId

  const prices = await stripe<{ data: { id: string }[] }>(ctx, 'GET', '/prices', { lookup_keys: [priceLookupKey(planId)], active: true, limit: 1 })
  const price = prices.data[0]?.id
  // Fiyat yok: kurulum betiği (`scripts/stripe-setup.mjs`) bu Stripe hesabında çalıştırılmamış.
  if (!price) throw new BillingError('not_configured', 503, `stripe price ${priceLookupKey(planId)} missing`)

  const customer = await ensureCustomer(ctx, user)
  const origin = siteOrigin(request, body.origin)
  const done = `${origin}/pricing?checkout=success`
  const current = (await subscriptionsOf(ctx, customer)).find(isActive)
  if (current) {
    const back = `${origin}/pricing`
    if (planOf(current) === planId) return json({ url: await portalSession(ctx, customer, back) })
    const confirm = {
      type: 'subscription_update_confirm',
      subscription_update_confirm: { subscription: current.id, items: [{ id: current.items.data[0].id, price, quantity: 1 }] },
      after_completion: { type: 'redirect', redirect: { return_url: done } },
    }
    // Onay ekranı açılamazsa (portal ayarında plan değişikliği kapalı, iptali bekleyen abonelik) düz portal.
    const url = await portalSession(ctx, customer, back, confirm).catch((err: unknown) => {
      console.error('billing: plan change flow failed', err)
      return portalSession(ctx, customer, back)
    })
    return json({ url })
  }

  const session = await stripe<{ url: string }>(ctx, 'POST', '/checkout/sessions', {
    mode: 'subscription',
    customer,
    client_reference_id: user.id,
    line_items: [{ price, quantity: 1 }],
    subscription_data: { metadata: { user_id: user.id } },
    allow_promotion_codes: true,
    managed_payments: ctx.env.STRIPE_MANAGED_PAYMENTS === 'true' ? { enabled: true } : undefined,
    success_url: done,
    cancel_url: `${origin}/pricing`,
  })
  return json({ url: session.url })
}

async function portal(ctx: Context, request: Request): Promise<Response> {
  const user = await signedInUser(ctx, request)
  const body = await readBody(request)
  const customer = await admin<string | null>(ctx, 'billing_customer', { p_user: user.id })
  if (!customer) throw new BillingError('no_subscription', 404)
  return json({ url: await portalSession(ctx, customer, `${siteOrigin(request, body.origin)}/profile`) })
}

async function sync(ctx: Context, request: Request): Promise<Response> {
  const user = await signedInUser(ctx, request)
  const customer = await admin<string | null>(ctx, 'billing_customer', { p_user: user.id })
  if (!customer) return json({ plan: null })
  const applied = await syncCustomer(ctx, customer)
  return json({ plan: applied?.plan ?? null })
}

const WEBHOOK_EVENTS = /^(checkout\.session\.completed$|customer\.subscription\.)/

async function webhook(ctx: Context, request: Request, now?: number): Promise<Response> {
  if (!ctx.env.STRIPE_WEBHOOK_SECRET) throw new BillingError('not_configured', 503)
  const payload = await request.text()
  if (payload.length > MAX_WEBHOOK_BODY) throw new BillingError('bad_request', 413)
  if (!(await verifySignature(payload, request.headers.get('Stripe-Signature'), ctx.env.STRIPE_WEBHOOK_SECRET, now))) throw new BillingError('bad_request', 400, 'bad signature')
  const event = JSON.parse(payload) as { type?: string; data?: { object?: { customer?: string | { id?: string } | null } } }
  const ref = event.data?.object?.customer
  const customer = typeof ref === 'string' ? ref : ref?.id
  if (!event.type || !WEBHOOK_EVENTS.test(event.type) || !customer) return json({ received: true, ignored: true })
  // Yazılamazsa 5xx döner: Stripe bildirimi sonra yeniden gönderir.
  const applied = await syncCustomer(ctx, customer)
  return json({ received: true, ...(applied ? {} : { ignored: true }) })
}

export async function handleBillingRequest(request: Request, env: BillingEnv, deps: Deps = {}): Promise<Response> {
  const route = new URL(request.url).pathname.slice(BILLING_PREFIX.length)
  if (!['checkout', 'portal', 'sync', 'webhook'].includes(route)) return json({ error: 'not_found' }, 404)
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', Allow: 'POST' } })
  if (!env.STRIPE_SECRET_KEY || !env.SUPABASE_SECRET_KEY) return fail('not_configured', 503)
  // Worker'da `fetch` başka bir nesnenin yöntemi gibi çağrılamaz ("Illegal invocation"): sarmalanır.
  const ctx: Context = { env, doFetch: deps.fetch ?? ((input, init) => fetch(input, init)) }
  try {
    if (route === 'checkout') return await checkout(ctx, request)
    if (route === 'portal') return await portal(ctx, request)
    if (route === 'sync') return await sync(ctx, request)
    return await webhook(ctx, request, deps.now)
  } catch (err) {
    if (err instanceof BillingError) {
      if (err.status >= 500 || err.message !== err.code) console.error('billing:', route, err.message)
      return fail(err.code, err.status)
    }
    console.error('billing:', route, err)
    return fail('failed', 502)
  }
}
