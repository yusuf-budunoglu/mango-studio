import { buildUserMessage, cleanRequest, isEmptyEdit, sanitizeEdit, type LayerEdit } from './edit'
import { askModel, type ModelAnswer } from './model'

/**
 * Yapay zekâyla düzenleme ucu (`POST /api/ai/edit`, Worker): editördeki seçim kutusunun sohbet satırı buraya yazar.
 * Anthropic anahtarı yalnızca burada durur (Worker gizli değişkeni), tarayıcıya gitmez. İstek üyenin Supabase
 * oturum anahtarıyla gelir; plan ve kredi sunucuda, o anahtarla çağrılan `ai_begin` / `ai_spend` işlevleriyle
 * denetlenir (göçler: `20261008000001_ai_usage.sql`, `20261009000001_ai_message_limits.sql`). Kredi yalnızca bir şey
 * değiştiren yanıtta düşer; aylık ve günlük mesaj sınırına modele giden her istek sayılır.
 */
export interface AiEnv {
  SUPABASE_URL: string
  SUPABASE_PUBLISHABLE_KEY: string
  /** `wrangler secret put ANTHROPIC_API_KEY`; yoksa uç "kurulmadı" yanıtı verir */
  ANTHROPIC_API_KEY?: string
}

interface Deps {
  fetch?: typeof fetch
  /** testler için: Anthropic yerine sahte model */
  ask?: (userMessage: string) => Promise<ModelAnswer>
}

/** Tarayıcıya dönen hata adları; metinleri `aiEdit.errors.<ad>` çevirilerinde. */
export type AiErrorCode = 'unauthorized' | 'plan_required' | 'no_credits' | 'message_limit' | 'rate_limited' | 'not_configured' | 'refused' | 'busy' | 'failed' | 'bad_request'

export interface AiCredits {
  used: number
  /** aylık kredi; `null` = sınırsız */
  limit: number | null
}

export interface AiEditResponse {
  reply: string
  /** `null`: model bir şey değiştirmedi (yapılamayan ya da anlaşılmayan istek); kredi düşmedi */
  edit: LayerEdit | null
  credits?: AiCredits
}

const AI_PATH = '/api/ai/edit'
// Hazır şablonlardaki en büyük istek 11 KB (ortanca 5 KB). Sınır, tek isteğin maliyet tavanını (`plans.ts`
// `AI_COST.ceiling`) belirleyenlerden biri: büyütürsen tavanı yeniden ölç.
const MAX_BODY = 20_000

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
const fail = (error: AiErrorCode, status: number) => json({ error }, status)

/** Worker'ın yanıtladığı `/api/...` adresi mi? Uç yoksa da 404'ü Worker verir (sitenin `index.html`'i dönmesin). */
export const isAiPath = (pathname: string) => pathname.startsWith('/api/')

const FAILURES: Record<Exclude<ModelAnswer, { ok: true }>['reason'], [AiErrorCode, number]> = {
  refused: ['refused', 422],
  busy: ['busy', 503],
  not_configured: ['not_configured', 503],
  failed: ['failed', 502],
}

export async function handleAiRequest(request: Request, env: AiEnv, deps: Deps = {}): Promise<Response> {
  if (new URL(request.url).pathname !== AI_PATH) return json({ error: 'not_found' }, 404)
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', Allow: 'POST' } })
  const doFetch = deps.fetch ?? fetch

  const accessToken = request.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1]
  if (!accessToken) return fail('unauthorized', 401)

  const text = await request.text()
  if (text.length > MAX_BODY) return fail('bad_request', 413)
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return fail('bad_request', 400)
  }
  const input = cleanRequest(body)
  if (!input) return fail('bad_request', 400)

  // Üyenin kendi anahtarıyla: geçersiz anahtarı Supabase reddeder, plan ve sınırlar işlevin içinde.
  const rpc = async (name: string): Promise<{ ok: true; credits: AiCredits } | { ok: false; error: AiErrorCode; status: number }> => {
    const res = await doFetch(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: '{}',
    })
    const raw = await res.text()
    if (res.ok) {
      const row = JSON.parse(raw) as { used?: number; limit?: number | null }
      return { ok: true, credits: { used: row.used ?? 0, limit: row.limit ?? null } }
    }
    if (res.status === 401 || raw.includes('not_signed_in')) return { ok: false, error: 'unauthorized', status: 401 }
    if (raw.includes('ai_plan_required')) return { ok: false, error: 'plan_required', status: 402 }
    if (raw.includes('ai_credits_exhausted')) return { ok: false, error: 'no_credits', status: 402 }
    if (raw.includes('ai_message_limit_reached')) return { ok: false, error: 'message_limit', status: 429 }
    if (raw.includes('ai_rate_limited')) return { ok: false, error: 'rate_limited', status: 429 }
    // İşlev yok (göç uygulanmamış) ya da beklenmeyen hata: sınır denetlenemiyorsa model çağrılmaz.
    console.error('ai:', name, res.status, raw.slice(0, 300))
    return { ok: false, error: res.status === 404 ? 'not_configured' : 'failed', status: res.status === 404 ? 503 : 502 }
  }

  const begin = await rpc('ai_begin').catch((err: unknown) => {
    console.error('ai: ai_begin failed', err)
    return { ok: false as const, error: 'failed' as const, status: 502 }
  })
  if (!begin.ok) return fail(begin.error, begin.status)
  if (!deps.ask && !env.ANTHROPIC_API_KEY) return fail('not_configured', 503)

  const ask = deps.ask ?? ((message: string) => askModel(env.ANTHROPIC_API_KEY as string, message))
  let answer: ModelAnswer
  try {
    answer = await ask(buildUserMessage(input))
  } catch (err) {
    console.error('ai: model call failed', err)
    return fail('failed', 502)
  }
  if (!answer.ok) return fail(...FAILURES[answer.reason])

  const result = sanitizeEdit(answer.output, input)
  if (isEmptyEdit(result.edit)) return json({ reply: result.reply, edit: null, credits: begin.credits } satisfies AiEditResponse)

  // Kredi düşülemezse (ağ hatası gibi) düzenleme yine de verilir: iş yapıldı, kullanıcı cezalandırılmasın.
  const spend = await rpc('ai_spend').catch(() => undefined)
  return json({ reply: result.reply, edit: result.edit, credits: spend?.ok ? spend.credits : begin.credits } satisfies AiEditResponse)
}
