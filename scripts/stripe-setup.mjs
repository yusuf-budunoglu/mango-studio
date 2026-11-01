// Stripe hesabını Mango Studio için kurar: planların ürün ve fiyatları, müşteri portalı ayarı, istenirse bildirim ucu.
//   node scripts/stripe-setup.mjs                      deneme kipi (sk_test_ anahtarı)
//   node scripts/stripe-setup.mjs --live               canlı kip (sk_live_ anahtarı; bayrak olmadan çalışmaz)
//   ... --webhook https://mangostudio.design/api/billing/webhook   bildirim ucunu da açar
//   ... --reprice                                      plans.ts'teki fiyat değiştiyse yeni fiyat açar (eski aboneler eski fiyatta kalır)
// Anahtar: STRIPE_SECRET_KEY ortam değişkeni, yoksa .dev.vars. Yeniden çalıştırılabilir: var olanı ikinci kez açmaz.
// Fiyatlar kimlikle değil arama anahtarıyla bulunur (`mango_<plan>_monthly`); Worker da öyle arar (src/billing/stripe.ts).
// Bildirim ucunun imza anahtarı ekrana yazılmaz: doğrudan `wrangler secret put STRIPE_WEBHOOK_SECRET`'a verilir.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { PLANS } from '../src/billing/plans.ts'

const SITE = 'https://mangostudio.design'
// src/billing/stripe.ts ile aynı olmalı (billing.test.ts denetler)
const PORTAL_APP = 'mango-studio'
const lookupKey = (plan) => `mango_${plan}_monthly`
const WEBHOOK_EVENTS = ['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'customer.subscription.paused', 'customer.subscription.resumed']
const NAMES = { starter: 'Starter', pro: 'Pro', unlimited: 'Unlimited' }
// Ürün vergi kodu: "Software as a service (SaaS) - business use". Managed Payments yalnızca uygun kodlu ürünleri
// satar (docs.stripe.com/payments/managed-payments/eligibility); iş / kişisel ayrımı yalnızca ABD satış vergisinde fark eder.
const TAX_CODE = 'txcd_10103001'

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)

function readKey() {
  if (process.env.STRIPE_SECRET_KEY) return process.env.STRIPE_SECRET_KEY.trim()
  if (!existsSync('.dev.vars')) return undefined
  return readFileSync('.dev.vars', 'utf8').match(/^STRIPE_SECRET_KEY\s*=\s*"?([^"\r\n]+)"?/m)?.[1]?.trim()
}

const key = readKey()
if (!key) {
  console.error('STRIPE_SECRET_KEY yok: ortam değişkeni olarak ver ya da .dev.vars dosyasına yaz.')
  process.exit(1)
}
const live = /^(sk|rk)_live_/.test(key)
if (live !== flag('--live')) {
  console.error(live ? 'Bu canlı anahtar: gerçek hesapta ürün açmak için --live ekle.' : '--live verildi ama anahtar deneme anahtarı (sk_test_).')
  process.exit(1)
}
console.log(`Stripe ${live ? 'CANLI' : 'deneme'} kipi`)

function encode(value) {
  const pairs = []
  const walk = (k, v) => {
    if (v === undefined || v === null) return
    if (Array.isArray(v)) v.forEach((item, i) => walk(`${k}[${i}]`, item))
    else if (typeof v === 'object') for (const [inner, x] of Object.entries(v)) walk(`${k}[${inner}]`, x)
    else pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  }
  for (const [k, v] of Object.entries(value)) walk(k, v)
  return pairs.join('&')
}

async function stripe(method, path, params) {
  const query = params && method === 'GET' ? `?${encode(params)}` : ''
  const res = await fetch(`https://api.stripe.com/v1${path}${query}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    ...(method === 'POST' ? { body: encode(params ?? {}) } : {}),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${body?.error?.message ?? ''}`)
  return body
}

// Hangi hesap: yanlış hesaba ürün açılmasın, canlıda ödeme alınabiliyor mu görülsün.
const account = await stripe('GET', '/account')
// Deneme ortamında bu iki bayrak hep kapalı görünür (deneme ödemeleri yine çalışır): yalnızca canlıda yazılır.
console.log(`Hesap: ${account.settings?.dashboard?.display_name ?? account.id} (${account.country})${live ? ` · ödeme alabiliyor: ${account.charges_enabled ? 'evet' : 'HAYIR'} · hesaba aktarım: ${account.payouts_enabled ? 'evet' : 'HAYIR'}` : ''}`)

// 1. Ürünler ve fiyatlar -----------------------------------------------------------------------------------------
const catalog = []
for (const plan of PLANS.filter((p) => p.price > 0)) {
  const cents = Math.round(plan.launchPrice * 100)
  const priceParams = (product) => ({
    product,
    currency: 'usd',
    unit_amount: cents,
    recurring: { interval: 'month' },
    lookup_key: lookupKey(plan.id),
    transfer_lookup_key: true,
    metadata: { app: PORTAL_APP, plan: plan.id },
  })
  let price = (await stripe('GET', '/prices', { lookup_keys: [lookupKey(plan.id)], active: true, limit: 1, expand: ['data.product'] })).data[0]
  if (price) {
    // Önceki kurulumdan kalan üründe vergi kodu yoksa ya da farklıysa düzeltilir.
    const taxCode = typeof price.product.tax_code === 'string' ? price.product.tax_code : price.product.tax_code?.id
    if (taxCode !== TAX_CODE) await stripe('POST', `/products/${price.product.id}`, { tax_code: TAX_CODE })
    price = { ...price, product: price.product.id }
  }
  if (!price) {
    const product = await stripe('POST', '/products', { name: `Mango Studio ${NAMES[plan.id]}`, tax_code: TAX_CODE, metadata: { app: PORTAL_APP, plan: plan.id } })
    price = await stripe('POST', '/prices', priceParams(product.id))
    console.log(`+ ${plan.id}: ürün ve fiyat açıldı (${(cents / 100).toFixed(2)} $ / ay)`)
  } else if (price.unit_amount !== cents) {
    if (flag('--reprice')) {
      price = await stripe('POST', '/prices', priceParams(price.product))
      console.log(`~ ${plan.id}: yeni fiyat açıldı (${(cents / 100).toFixed(2)} $ / ay); eski aboneler eski fiyatta kalır`)
    } else {
      console.log(`! ${plan.id}: Stripe'ta ${(price.unit_amount / 100).toFixed(2)} $, plans.ts'te ${(cents / 100).toFixed(2)} $. Güncellemek için --reprice`)
    }
  } else {
    console.log(`= ${plan.id}: hazır (${(cents / 100).toFixed(2)} $ / ay)`)
  }
  catalog.push({ product: price.product, prices: [price.id] })
}

// 2. Müşteri portalı: kart, faturalar, plan değişikliği, dönem sonunda iptal ----------------------------------------
const portalParams = {
  business_profile: { headline: 'Mango Studio', privacy_policy_url: `${SITE}/privacy`, terms_of_service_url: `${SITE}/terms` },
  default_return_url: `${SITE}/profile`,
  features: {
    payment_method_update: { enabled: true },
    invoice_history: { enabled: true },
    subscription_cancel: { enabled: true, mode: 'at_period_end' },
    // Plan değişince fark hemen faturalanır (yükseltmede üst planın farkı o an alınır).
    subscription_update: { enabled: true, default_allowed_updates: ['price'], proration_behavior: 'always_invoice', products: catalog },
  },
  metadata: { app: PORTAL_APP },
}
const configs = (await stripe('GET', '/billing_portal/configurations', { active: true, limit: 100 })).data
const existing = configs.find((c) => c.metadata?.app === PORTAL_APP)
if (existing) {
  await stripe('POST', `/billing_portal/configurations/${existing.id}`, portalParams)
  console.log('= müşteri portalı ayarı güncellendi')
} else {
  await stripe('POST', '/billing_portal/configurations', portalParams)
  console.log('+ müşteri portalı ayarı açıldı')
}

// 3. Bildirim ucu ------------------------------------------------------------------------------------------------
const webhookUrl = option('--webhook')
if (webhookUrl) {
  const endpoints = (await stripe('GET', '/webhook_endpoints', { limit: 100 })).data
  if (endpoints.some((e) => e.url === webhookUrl)) {
    console.log('= bildirim ucu zaten var (imza anahtarı yalnızca açılırken okunur; yenilemek için Stripe panelinden ucu silip betiği yeniden çalıştır)')
  } else {
    const endpoint = await stripe('POST', '/webhook_endpoints', { url: webhookUrl, enabled_events: WEBHOOK_EVENTS, description: 'Mango Studio abonelikleri' })
    const put = spawnSync('npx wrangler secret put STRIPE_WEBHOOK_SECRET', { input: endpoint.secret, shell: true, stdio: ['pipe', 'inherit', 'inherit'] })
    if (put.status === 0) {
      console.log('+ bildirim ucu açıldı, imza anahtarı Worker gizli değişkenine yazıldı')
    } else {
      // .dev.vars* git'e girmez; anahtar buradan elle `wrangler secret put STRIPE_WEBHOOK_SECRET` ile verilir, sonra dosya silinir.
      writeFileSync('.dev.vars.stripe-webhook', `STRIPE_WEBHOOK_SECRET=${endpoint.secret}\n`)
      console.log('+ bildirim ucu açıldı; wrangler çalışmadı, imza anahtarı .dev.vars.stripe-webhook dosyasına yazıldı')
    }
  }
}
console.log('Bitti.')
