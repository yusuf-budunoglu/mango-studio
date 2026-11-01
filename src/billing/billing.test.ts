import { describe, expect, it } from 'vitest'
import billingSql from '../../supabase/migrations/20261014000001_billing.sql?raw'
import setupScript from '../../scripts/stripe-setup.mjs?raw'
import { AI_DAILY_MESSAGES, PLANS } from './plans'
import { handleBillingRequest, isBillingPath } from './server'
import { ACTIVE_STATUSES, encodeForm, PAID_PLANS, planFromLookupKey, PORTAL_APP, priceLookupKey, signPayload, verifySignature } from './stripe'

const SITE = 'https://mangostudio.design'
const USER = '6f1c2f0e-8a0b-4c0e-9f43-0d6c1a2b3c4d'
const ENV = {
  SUPABASE_URL: 'https://ref.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
  SUPABASE_SECRET_KEY: 'sb_secret_x',
  STRIPE_SECRET_KEY: 'sk_test_x',
  STRIPE_WEBHOOK_SECRET: 'whsec_x',
}
const NOW = 1_800_000_000

interface FakeSub {
  id: string
  status: string
  created: number
  plan?: string
  cancel_at_period_end?: boolean
  /** dönem aboneliğin üstünde (eski API sürümü) ya da kalemin üstünde (yeni) */
  period?: 'subscription' | 'item'
}

const sub = (s: FakeSub) => {
  const period = { current_period_start: s.created, current_period_end: s.created + 2_592_000 }
  return {
    id: s.id,
    status: s.status,
    created: s.created,
    customer: 'cus_1',
    cancel_at_period_end: !!s.cancel_at_period_end,
    metadata: { user_id: USER },
    ...(s.period === 'item' ? {} : period),
    items: { data: [{ id: `si_${s.id}`, ...(s.period === 'item' ? period : {}), price: { id: `price_${s.plan}`, lookup_key: s.plan ? `mango_${s.plan}_monthly` : 'other_product' } }] },
  }
}

/** Supabase ve Stripe'ı taklit eder; yapılan çağrıları ve Stripe'a giden form alanlarını kaydeder. */
function world(init: { customer?: string | null; subs?: FakeSub[]; prices?: boolean; flowFails?: boolean; unknownCustomer?: boolean; dbDown?: boolean } = {}) {
  const calls: string[] = []
  const forms: Record<string, Record<string, string>> = {}
  const headers: Record<string, Headers> = {}
  const applied: Record<string, unknown>[] = []
  const state = { customer: init.customer ?? null }
  const fetch: typeof globalThis.fetch = async (input, req) => {
    const url = new URL(String(input))
    const method = req?.method ?? 'GET'
    const head = new Headers(req?.headers)
    if (url.host === 'ref.supabase.co') {
      if (url.pathname === '/auth/v1/user') {
        return head.get('Authorization') === 'Bearer good' ? Response.json({ id: USER, email: 'a@test.invalid' }) : new Response('{}', { status: 401 })
      }
      const name = url.pathname.split('/').pop() as string
      expect([head.get('apikey'), head.get('Authorization')], name).toEqual(['sb_secret_x', 'Bearer sb_secret_x'])
      const args = JSON.parse(String(req?.body)) as Record<string, unknown>
      calls.push(name)
      if (init.dbDown) return new Response('{"message":"boom"}', { status: 500 })
      if (name === 'billing_customer') return Response.json(state.customer)
      if (name === 'billing_set_customer') {
        state.customer ??= args.p_customer as string
        return Response.json(state.customer)
      }
      if (name === 'billing_apply') {
        applied.push(args)
        return Response.json(init.unknownCustomer ? null : { user_id: USER, plan: ACTIVE_STATUSES.includes(args.p_status as string) ? args.p_plan : 'free' })
      }
      throw new Error(`unexpected rpc ${name}`)
    }
    if (url.host !== 'api.stripe.com') throw new Error(`unexpected fetch ${url}`)
    expect(head.get('Authorization')).toBe('Bearer sk_test_x')
    const path = url.pathname.replace('/v1', '')
    const call = `${method} ${path}`
    calls.push(call)
    forms[call] = Object.fromEntries(new URLSearchParams(method === 'GET' ? url.search : String(req?.body)))
    headers[call] = head
    if (call === 'GET /prices') {
      const plan = planFromLookupKey(forms[call]['lookup_keys[0]'])
      return Response.json({ data: init.prices === false || !plan ? [] : [{ id: `price_${plan}` }] })
    }
    if (call === 'POST /customers') return Response.json({ id: 'cus_new' })
    if (call === 'GET /subscriptions') return Response.json({ data: (init.subs ?? []).map(sub) })
    if (call === 'GET /billing_portal/configurations') return Response.json({ data: [{ id: 'bpc_other' }, { id: 'bpc_mango', metadata: { app: PORTAL_APP } }] })
    if (call === 'POST /billing_portal/sessions') {
      const flow = forms[call]['flow_data[type]']
      if (flow && init.flowFails) return Response.json({ error: { message: 'subscription update is disabled' } }, { status: 400 })
      return Response.json({ url: `https://billing.stripe.com/session${flow ? `?flow=${flow}` : ''}` })
    }
    if (call === 'POST /checkout/sessions') return Response.json({ url: 'https://checkout.stripe.com/pay' })
    throw new Error(`unexpected stripe call ${call}`)
  }
  return { fetch, calls, forms, headers, applied, state }
}

const post = (route: string, body: unknown = {}, { token = 'good', origin = SITE }: { token?: string; origin?: string } = {}) =>
  new Request(`${SITE}/api/billing/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })

const run = async (request: Request, w: ReturnType<typeof world>, env: Partial<typeof ENV> & { STRIPE_MANAGED_PAYMENTS?: string } = ENV) => {
  const res = await handleBillingRequest(request, env as typeof ENV, { fetch: w.fetch, now: NOW })
  return [res.status, await res.json()] as [number, Record<string, unknown>]
}

async function event(type: string, object: Record<string, unknown>, { secret = 'whsec_x', at = NOW }: { secret?: string; at?: number } = {}) {
  const payload = JSON.stringify({ id: 'evt_1', type, data: { object } })
  return new Request(`${SITE}/api/billing/webhook`, { method: 'POST', headers: { 'Stripe-Signature': `t=${at},v1=${await signPayload(payload, secret, at)}` }, body: payload })
}

describe('ödeme: Stripe yardımcıları', () => {
  it('form gövdesi iç içe alanları Stripe biçiminde yazar, boşları atlar', () => {
    const form = encodeForm({ mode: 'subscription', line_items: [{ price: 'p_1', quantity: 1 }], metadata: { user_id: 'u 1' }, skip: undefined, none: null, on: true })
    expect(decodeURIComponent(form)).toBe('mode=subscription&line_items[0][price]=p_1&line_items[0][quantity]=1&metadata[user_id]=u 1&on=true')
  })

  it('fiyat anahtarı ↔ plan: yalnızca ücretli planlar', () => {
    expect(PAID_PLANS).toEqual(['starter', 'pro', 'unlimited'])
    for (const plan of PAID_PLANS) expect(planFromLookupKey(priceLookupKey(plan))).toBe(plan)
    for (const key of ['mango_free_monthly', 'mango_gold_monthly', 'other_product', '', null, undefined]) expect(planFromLookupKey(key)).toBeUndefined()
  })

  it('imza: doğru anahtar ve taze zaman damgası geçer; başka anahtar, değişmiş gövde ve eski imza geçmez', async () => {
    const good = await signPayload('{"a":1}', 'whsec_x', NOW)
    expect(await verifySignature('{"a":1}', `t=${NOW},v1=${good}`, 'whsec_x', NOW)).toBe(true)
    // anahtar değişiminde iki imza gelir: biri tutarsa yeter
    expect(await verifySignature('{"a":1}', `t=${NOW},v1=${'0'.repeat(64)},v1=${good}`, 'whsec_x', NOW + 200)).toBe(true)
    expect(await verifySignature('{"a":2}', `t=${NOW},v1=${good}`, 'whsec_x', NOW)).toBe(false)
    expect(await verifySignature('{"a":1}', `t=${NOW},v1=${good}`, 'whsec_other', NOW)).toBe(false)
    expect(await verifySignature('{"a":1}', `t=${NOW},v1=${good}`, 'whsec_x', NOW + 301)).toBe(false)
    for (const header of [null, '', 'v1=abc', `t=${NOW}`, 'garbage']) expect(await verifySignature('{"a":1}', header, 'whsec_x', NOW)).toBe(false)
  })
})

describe('ödeme uçları (/api/billing/*)', () => {
  it('yalnızca kendi yollarını üstlenir; bilinmeyen yol 404, POST dışı 405, anahtar yoksa "kurulmadı"', async () => {
    expect(isBillingPath('/api/billing/checkout')).toBe(true)
    expect(isBillingPath('/api/ai/edit')).toBe(false)
    const w = world()
    expect(await run(post('other'), w)).toEqual([404, { error: 'not_found' }])
    expect((await handleBillingRequest(new Request(`${SITE}/api/billing/checkout`), ENV, { fetch: w.fetch })).status).toBe(405)
    expect(await run(post('checkout', { plan: 'pro' }), w, { ...ENV, STRIPE_SECRET_KEY: undefined })).toEqual([503, { error: 'not_configured' }])
    expect(await run(post('checkout', { plan: 'pro' }), w, { ...ENV, SUPABASE_SECRET_KEY: undefined })).toEqual([503, { error: 'not_configured' }])
    expect(w.calls).toEqual([])
  })

  it('yeni üye: Stripe müşterisi açılır, kaydedilir ve ödeme sayfası adresi döner', async () => {
    const w = world()
    expect(await run(post('checkout', { plan: 'pro' }), w)).toEqual([200, { url: 'https://checkout.stripe.com/pay' }])
    expect(w.calls).toEqual(['GET /prices', 'billing_customer', 'POST /customers', 'billing_set_customer', 'GET /subscriptions', 'POST /checkout/sessions'])
    expect(w.forms['POST /customers']).toEqual({ email: 'a@test.invalid', 'metadata[user_id]': USER })
    expect(w.headers['POST /customers'].get('Idempotency-Key')).toBe(`mango-customer-${USER}`)
    expect(w.forms['POST /checkout/sessions']).toEqual({
      mode: 'subscription',
      customer: 'cus_new',
      client_reference_id: USER,
      'line_items[0][price]': 'price_pro',
      'line_items[0][quantity]': '1',
      'subscription_data[metadata][user_id]': USER,
      allow_promotion_codes: 'true',
      success_url: `${SITE}/pricing?checkout=success`,
      cancel_url: `${SITE}/pricing`,
    })
  })

  it("Managed Payments açıkken oturum bayrakla açılır ve Stripe'ın reddettiği alanları taşımaz", async () => {
    const w = world()
    expect(await run(post('checkout', { plan: 'starter' }), w, { ...ENV, STRIPE_MANAGED_PAYMENTS: 'true' })).toEqual([200, { url: 'https://checkout.stripe.com/pay' }])
    const form = w.forms['POST /checkout/sessions']
    expect(form['managed_payments[enabled]']).toBe('true')
    const banned = /^(adaptive_pricing|automatic_tax|tax_id_collection|payment_method_types|payment_method_configuration|customer_update|shipping_|invoice_creation|subscription_data\[(default_tax_rates|invoice_settings|application_fee_percent|on_behalf_of|transfer_data)\])/
    expect(Object.keys(form).filter((key) => banned.test(key))).toEqual([])
    // kapalıyken (ya da "false") bayrak hiç gönderilmez
    const off = world()
    await run(post('checkout', { plan: 'starter' }), off, { ...ENV, STRIPE_MANAGED_PAYMENTS: 'false' })
    expect(Object.keys(off.forms['POST /checkout/sessions']).some((key) => key.startsWith('managed_payments'))).toBe(false)
  })

  it('müşterisi olan üyeye yeni müşteri açılmaz; dönüş adresi yalnızca bizim adreslerimizden biri olur', async () => {
    const w = world({ customer: 'cus_1' })
    await run(post('checkout', { plan: 'starter' }, { origin: 'http://localhost:5173' }), w)
    expect(w.calls).not.toContain('POST /customers')
    expect(w.forms['POST /checkout/sessions']).toMatchObject({ customer: 'cus_1', success_url: 'http://localhost:5173/pricing?checkout=success' })
    const evil = world({ customer: 'cus_1' })
    await run(post('checkout', { plan: 'starter' }, { origin: 'https://evil.example' }), evil)
    expect(evil.forms['POST /checkout/sessions'].success_url).toBe(`${SITE}/pricing?checkout=success`)

    // wrangler dev `Origin` başlığını yayın adresine çevirir: tarayıcının gövdede bildirdiği adres önce gelir
    const local = world({ customer: 'cus_1' })
    await run(post('checkout', { plan: 'starter', origin: 'http://localhost:8787' }), local)
    expect(local.forms['POST /checkout/sessions']).toMatchObject({ success_url: 'http://localhost:8787/pricing?checkout=success', cancel_url: 'http://localhost:8787/pricing' })
    const spoofed = world({ customer: 'cus_1' })
    await run(post('checkout', { plan: 'starter', origin: 'https://evil.example' }), spoofed)
    expect(spoofed.forms['POST /checkout/sessions'].success_url).toBe(`${SITE}/pricing?checkout=success`)
    const portal = world({ customer: 'cus_1' })
    await run(post('portal', { origin: 'http://127.0.0.1:5173' }), portal)
    expect(portal.forms['POST /billing_portal/sessions'].return_url).toBe('http://127.0.0.1:5173/profile')
  })

  it('girişsiz, geçersiz plan ve Stripe\'ta fiyatı olmayan plan reddedilir', async () => {
    const w = world()
    expect(await run(post('checkout', { plan: 'pro' }, { token: '' }), w)).toEqual([401, { error: 'unauthorized' }])
    expect(await run(post('checkout', { plan: 'pro' }, { token: 'bad' }), w)).toEqual([401, { error: 'unauthorized' }])
    for (const plan of ['free', 'gold', 7, undefined]) expect(await run(post('checkout', { plan }), w), String(plan)).toEqual([400, { error: 'bad_request' }])
    expect(w.calls).toEqual([])
    expect(await run(post('checkout', { plan: 'pro' }), world({ prices: false }))).toEqual([503, { error: 'not_configured' }])
  })

  it('aboneliği olan üyede ikinci abonelik açılmaz: plan değişikliği portalın onay ekranına gider', async () => {
    const w = world({ customer: 'cus_1', subs: [{ id: 'sub_1', status: 'active', created: NOW, plan: 'starter' }] })
    expect(await run(post('checkout', { plan: 'pro' }), w)).toEqual([200, { url: 'https://billing.stripe.com/session?flow=subscription_update_confirm' }])
    expect(w.calls).not.toContain('POST /checkout/sessions')
    expect(w.forms['POST /billing_portal/sessions']).toMatchObject({
      customer: 'cus_1',
      configuration: 'bpc_mango',
      'flow_data[subscription_update_confirm][subscription]': 'sub_1',
      'flow_data[subscription_update_confirm][items][0][id]': 'si_sub_1',
      'flow_data[subscription_update_confirm][items][0][price]': 'price_pro',
      'flow_data[after_completion][redirect][return_url]': `${SITE}/pricing?checkout=success`,
    })

    // aynı plan: düz portal
    const same = world({ customer: 'cus_1', subs: [{ id: 'sub_1', status: 'past_due', created: NOW, plan: 'pro' }] })
    expect(await run(post('checkout', { plan: 'pro' }), same)).toEqual([200, { url: 'https://billing.stripe.com/session' }])

    // onay ekranı açılamazsa düz portala düşer
    const closed = world({ customer: 'cus_1', subs: [{ id: 'sub_1', status: 'active', created: NOW, plan: 'starter' }], flowFails: true })
    expect(await run(post('checkout', { plan: 'pro' }), closed)).toEqual([200, { url: 'https://billing.stripe.com/session' }])

    // bitmiş abonelik engel değil: yeniden ödeme sayfası
    const ended = world({ customer: 'cus_1', subs: [{ id: 'sub_0', status: 'canceled', created: NOW, plan: 'pro' }] })
    expect(await run(post('checkout', { plan: 'pro' }), ended)).toEqual([200, { url: 'https://checkout.stripe.com/pay' }])
  })

  it('portal: müşterisi olmayana "abonelik yok", olana portal adresi', async () => {
    expect(await run(post('portal'), world())).toEqual([404, { error: 'no_subscription' }])
    const w = world({ customer: 'cus_1' })
    expect(await run(post('portal'), w)).toEqual([200, { url: 'https://billing.stripe.com/session' }])
    expect(w.forms['POST /billing_portal/sessions']).toEqual({ customer: 'cus_1', return_url: `${SITE}/profile`, configuration: 'bpc_mango' })
    expect(await run(post('portal', {}, { token: '' }), w)).toEqual([401, { error: 'unauthorized' }])
  })

  it('eşitleme: erişimi süren abonelik yazılır; yeni ama bitmiş olan ya da başka ürünün aboneliği sayılmaz', async () => {
    const w = world({
      customer: 'cus_1',
      subs: [
        { id: 'sub_other', status: 'active', created: NOW + 50 },
        { id: 'sub_old', status: 'canceled', created: NOW + 10, plan: 'unlimited' },
        { id: 'sub_live', status: 'active', created: NOW, plan: 'pro', cancel_at_period_end: true, period: 'item' },
      ],
    })
    expect(await run(post('sync'), w)).toEqual([200, { plan: 'pro' }])
    expect(w.applied).toEqual([
      {
        p_customer: 'cus_1',
        p_user: USER,
        p_subscription: 'sub_live',
        p_plan: 'pro',
        p_status: 'active',
        p_period_start: new Date(NOW * 1000).toISOString(),
        p_period_end: new Date((NOW + 2_592_000) * 1000).toISOString(),
        p_cancel: true,
      },
    ])
  })

  it('eşitleme: abonelik bittiyse ya da hiç yoksa plan ücretsize döner; müşterisi olmayana dokunulmaz', async () => {
    const ended = world({ customer: 'cus_1', subs: [{ id: 'sub_1', status: 'canceled', created: NOW, plan: 'pro' }] })
    expect(await run(post('sync'), ended)).toEqual([200, { plan: 'free' }])
    expect(ended.applied[0]).toMatchObject({ p_subscription: 'sub_1', p_plan: 'pro', p_status: 'canceled' })

    const none = world({ customer: 'cus_1' })
    expect(await run(post('sync'), none)).toEqual([200, { plan: 'free' }])
    expect(none.applied[0]).toMatchObject({ p_subscription: null, p_plan: 'free', p_status: 'none', p_period_start: null, p_cancel: false })

    const stranger = world()
    expect(await run(post('sync'), stranger)).toEqual([200, { plan: null }])
    expect(stranger.calls).toEqual(['billing_customer'])
  })

  it('bildirim: imzası geçerliyse abonelik Stripe\'tan yeniden okunup yazılır (bildirimin içeriğine güvenilmez)', async () => {
    const w = world({ subs: [{ id: 'sub_1', status: 'active', created: NOW, plan: 'starter' }] })
    // bildirim "canceled" dese de Stripe'taki güncel durum yazılır
    expect(await run(await event('customer.subscription.deleted', { id: 'sub_1', customer: 'cus_1', status: 'canceled' }), w)).toEqual([200, { received: true }])
    expect(w.calls).toEqual(['GET /subscriptions', 'billing_apply'])
    expect(w.forms['GET /subscriptions']).toEqual({ customer: 'cus_1', status: 'all', limit: '20' })
    expect(w.applied[0]).toMatchObject({ p_customer: 'cus_1', p_plan: 'starter', p_status: 'active' })

    const done = world({ subs: [{ id: 'sub_1', status: 'active', created: NOW, plan: 'pro' }] })
    expect(await run(await event('checkout.session.completed', { id: 'cs_1', customer: { id: 'cus_1' } }), done)).toEqual([200, { received: true }])
    expect(done.applied[0]).toMatchObject({ p_customer: 'cus_1', p_plan: 'pro' })
  })

  it('bildirim: sahte ya da eski imza reddedilir, ilgisiz olay ve tanınmayan müşteri yok sayılır', async () => {
    const w = world()
    expect(await run(await event('customer.subscription.updated', { customer: 'cus_1' }, { secret: 'whsec_fake' }), w)).toEqual([400, { error: 'bad_request' }])
    expect(await run(await event('customer.subscription.updated', { customer: 'cus_1' }, { at: NOW - 3600 }), w)).toEqual([400, { error: 'bad_request' }])
    expect(await run(new Request(`${SITE}/api/billing/webhook`, { method: 'POST', body: '{}' }), w)).toEqual([400, { error: 'bad_request' }])
    expect(await run(await event('invoice.paid', { customer: 'cus_1' }), w)).toEqual([200, { received: true, ignored: true }])
    expect(await run(await event('customer.subscription.updated', {}), w)).toEqual([200, { received: true, ignored: true }])
    expect(w.calls).toEqual([])
    expect(await run(await event('customer.subscription.updated', { customer: 'cus_1' }), w, { ...ENV, STRIPE_WEBHOOK_SECRET: undefined })).toEqual([503, { error: 'not_configured' }])

    // aynı Stripe hesabındaki başka ürünün müşterisi: 200 (Stripe yeniden denemesin), plan yazılmaz
    const other = world({ unknownCustomer: true })
    expect(await run(await event('customer.subscription.created', { customer: 'cus_other' }), other)).toEqual([200, { received: true, ignored: true }])
  })

  it('bildirim yazılamazsa 5xx döner: Stripe sonra yeniden gönderir', async () => {
    const w = world({ dbDown: true, subs: [{ id: 'sub_1', status: 'active', created: NOW, plan: 'pro' }] })
    const [status, body] = await run(await event('customer.subscription.updated', { customer: 'cus_1' }), w)
    expect(status).toBeGreaterThanOrEqual(500)
    expect(body).toEqual({ error: 'failed' })
  })
})

describe('ödeme: kod, göç ve kurulum betiği aynı şeyi söyler', () => {
  it('erişimi süren abonelik durumları sunucudaki billing_apply / ai_period_start / billing_status ile aynı', () => {
    const list = `(${ACTIVE_STATUSES.map((s) => `'${s}'`).join(', ')})`
    expect(billingSql.split(`status in ${list}`).length - 1).toBe(3)
    expect(billingSql.match(/status in \(/g)?.length).toBe(3)
  })

  it('göçteki plan adları ve günlük mesaj sınırı plans.ts ile aynı', () => {
    const plans = `(${PLANS.map((p) => `'${p.id}'`).join(', ')})`
    expect(billingSql).toContain(`check (plan in ${plans})`)
    expect(billingSql).toContain(`p_plan not in ${plans}`)
    expect(Number(billingSql.match(/v_requests > (\d+)/)?.[1])).toBe(AI_DAILY_MESSAGES)
  })

  it('kurulum betiği aynı fiyat anahtarını ve portal etiketini kullanır', () => {
    expect(setupScript).toContain(`const PORTAL_APP = '${PORTAL_APP}'`)
    expect(setupScript).toContain('`mango_${plan}_monthly`')
    // Managed Payments için uygun vergi kodu (SaaS)
    expect(setupScript).toMatch(/const TAX_CODE = 'txcd_101030\d\d'/)
    expect(priceLookupKey('pro')).toBe('mango_pro_monthly')
  })
})
