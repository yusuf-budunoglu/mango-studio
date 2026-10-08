import { describe, expect, it } from 'vitest'
import { AI_COST, AI_DAILY_MESSAGES, PLANS } from '../billing/plans'
import { PRESETS } from '../engine/presets'
import type { Layer } from '../engine/types'
import { SAMPLE_TEMPLATE } from '../project/sampleTemplate'
import { buildEditRequest } from './client'
import { buildUserMessage, cleanLayer, cleanRequest, EDIT_SCHEMA, isEmptyEdit, sanitizeEdit, SYSTEM_PROMPT, type EditContext } from './edit'
import type { ModelAnswer } from './model'
import { handleAiRequest, isAiPath } from './server'
import limitsSql from '../../supabase/migrations/20261009000001_ai_message_limits.sql?raw'

const text: Layer = {
  id: 'l1',
  name: 'Başlık',
  kind: 'text',
  start: 1,
  duration: 4,
  text: 'Merhaba',
  color: '#ffffff',
  fontSize: 0.4,
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: 1,
  opacity: 1,
  blocks: [
    { id: 'b-in', preset: 'slide-up', start: 0, duration: 0.8 },
    { id: 'b-float', preset: 'float', start: 1, duration: 2, params: { amount: 0.1 } },
  ],
}

const context = (layer: Layer = text, design = false): EditContext => ({
  project: { name: 'Demo', duration: 8, fps: 60, width: 1920, height: 1080, design, camera: { position: [0, 0, 9], fov: 40 } },
  time: 2,
  layer,
  others: [],
})

const empty = { reply: '', numbers: [], strings: [], flags: [], add_blocks: [], update_blocks: [], remove_blocks: [] }

describe('yapay zekâ düzenlemesi: çıktının denetimi', () => {
  it('yalnızca değişen alanları alır, sayıları sınırlar', () => {
    const { reply, edit } = sanitizeEdit(
      {
        ...empty,
        reply: '  Yazıyı   turuncu yaptım. ',
        numbers: [{ field: 'x', value: 2 }, { field: 'opacity', value: 7 }, { field: 'scale', value: 1 }, { field: 'fontWeight', value: 700 }],
        strings: [{ field: 'color', value: '#FF7A00' }, { field: 'text', value: 'Selam' }, { field: 'fontFamily', value: 'comic-sans' }],
      },
      context(),
    )
    expect(reply).toBe('Yazıyı turuncu yaptım.')
    // opaklık zaten 1, ölçek aynı, font listede yok: hiçbiri yamaya girmez
    expect(edit.patch).toEqual({ position: [2, 0, 0], fontWeight: 700, color: '#ff7a00', text: 'Selam' })
  })

  it('katmanın türüne ait olmayan alanları atar', () => {
    const shape: Layer = { ...text, kind: 'shape', text: undefined, shape: 'rounded', shapeWidth: 2, shapeHeight: 1, blocks: [] }
    const { edit } = sanitizeEdit(
      { ...empty, numbers: [{ field: 'fontSize', value: 2 }, { field: 'shapeWidth', value: 3 }, { field: 'foldAngle', value: 90 }], strings: [{ field: 'text', value: 'x' }, { field: 'shape', value: 'circle' }], flags: [{ field: 'tint', value: true }] },
      context(shape),
    )
    expect(edit.patch).toEqual({ shapeWidth: 3, shape: 'circle' })
  })

  it('blok ekler, değiştirir, siler; bilinmeyen preset ve kimlikleri atar', () => {
    const { edit } = sanitizeEdit(
      {
        ...empty,
        add_blocks: [
          { preset: 'fade-out', start: 3.5, duration: 0.5, easing: 'default', params: [] },
          { preset: 'camera-push', start: 0, duration: 1, easing: 'default', params: [] },
          { preset: 'fold', start: 0, duration: 1, easing: 'default', params: [] },
          { preset: 'spin', start: 3.9, duration: 5, easing: 'ease-out', params: [{ key: 'nope', value: 1 }] },
        ],
        update_blocks: [
          { id: 'b-float', start: 1, duration: 2, easing: 'unchanged', params: [{ key: 'amount', value: 0.3 }] },
          { id: 'yok', start: 0, duration: 1, easing: 'unchanged', params: [] },
        ],
        remove_blocks: ['b-in', 'yok'],
      },
      context(),
    )
    expect(edit.removeBlockIds).toEqual(['b-in'])
    expect(edit.updateBlocks).toEqual([{ id: 'b-float', patch: { start: 1, duration: 2, params: { amount: 0.3 } } }])
    // kamera bloğu ve yalnızca katlanır telefona ait blok girmez; süre klibin içine sığdırılır
    expect(edit.addBlocks).toEqual([
      { preset: 'fade-out', start: 3.5, duration: 0.5 },
      { preset: 'spin', start: 3.9, duration: 0.1, easing: 'ease-out' },
    ])
  })

  it('blok ayarlarını preset sınırlarına çeker', () => {
    const spec = PRESETS.float.params!.find((p) => p.key === 'amount')!
    const { edit } = sanitizeEdit({ ...empty, add_blocks: [{ preset: 'float', start: 0, duration: 1, easing: 'default', params: [{ key: 'amount', value: 1e9 }] }] }, context())
    expect(edit.addBlocks[0].params).toEqual({ amount: spec.max })
  })

  it('klip aralığını videonun içine sığdırır; tasarımda klip ve blok değişmez', () => {
    const raw = { ...empty, numbers: [{ field: 'clipStart', value: 6 }, { field: 'clipDuration', value: 10 }], add_blocks: [{ preset: 'spin', start: 0, duration: 1, easing: 'default', params: [] }] }
    const video = sanitizeEdit(raw, context()).edit
    expect(video.clip).toEqual({ start: 6, end: 8 })
    expect(video.addBlocks).toHaveLength(1)
    const design = sanitizeEdit(raw, context(text, true)).edit
    expect(isEmptyEdit(design)).toBe(true)
  })

  it('bir şey değiştirmeyen ya da bozuk çıktı boş düzenlemedir', () => {
    expect(isEmptyEdit(sanitizeEdit({ ...empty, numbers: [{ field: 'scale', value: 1 }], strings: [{ field: 'color', value: '#FFFFFF' }] }, context()).edit)).toBe(true)
    for (const junk of [null, 'metin', [], { numbers: 'x', add_blocks: [null, 3], update_blocks: [{}], strings: [{ field: 'color', value: 'kırmızı' }] }]) {
      expect(isEmptyEdit(sanitizeEdit(junk, context()).edit)).toBe(true)
    }
  })
})

describe('yapay zekâ düzenlemesi: bağlam ve şema', () => {
  it('şema katı kipe uygun: her nesne kapalı, her alan zorunlu', () => {
    const walk = (node: unknown) => {
      if (!node || typeof node !== 'object') return
      const n = node as Record<string, unknown>
      if (n.type === 'object') {
        expect(n.additionalProperties).toBe(false)
        expect([...(n.required as string[])].sort()).toEqual(Object.keys(n.properties as object).sort())
      }
      Object.values(n).forEach(walk)
    }
    walk(EDIT_SCHEMA)
  })

  it('sistem istemi her katman bloğunu anlatır ve değişmez', () => {
    for (const [id, preset] of Object.entries(PRESETS)) expect(SYSTEM_PROMPT.includes(`\`${id}\``), id).toBe(preset.target === 'layer')
    // önbellek için istem sabit olmalı: tarih ya da saat içermesin
    expect(SYSTEM_PROMPT).not.toMatch(/20\d\d-\d\d/)
  })

  it('bağlam dosya referansı ve gömülü veri taşımaz', () => {
    const phone = { ...text, kind: 'phone', image: `data:image/png;base64,${'A'.repeat(5000)}`, media: 'asset:video1', locked: true }
    const clean = cleanLayer(phone)!
    expect(clean).not.toHaveProperty('image')
    expect(clean).not.toHaveProperty('media')
    expect(cleanLayer({ ...text, kind: 'banana' })).toBeNull()
    expect(cleanLayer({ ...text, position: [0, 'x', 0] })).toBeNull()
  })

  it('editördeki projeden istek kurar; sunucu aynı isteği kabul eder', () => {
    const project = SAMPLE_TEMPLATE.build()
    const request = buildEditRequest(project, project.layers[1], 1.5, '  daha büyük yap  ', [])!
    expect(request.message).toBe('daha büyük yap')
    expect(request.others).toHaveLength(project.layers.length - 1)
    const again = cleanRequest(JSON.parse(JSON.stringify(request)))!
    expect(again.layer.id).toBe(project.layers[1].id)
    const message = buildUserMessage(again)
    expect(message).toContain('Request: daha büyük yap')
    expect(message).toContain('"frame":{"width":11.647,"height":6.551}')
    expect(cleanRequest({ ...request, message: '   ' })).toBeNull()
    expect(cleanRequest({ ...request, layer: { id: 'x' } })).toBeNull()
  })

  it('kredi rakamları sunucudaki ai_credit_limit ile aynı', () => {
    // güncel rakamlar ikinci göçte (ilk göçteki işlevi değiştirir)
    const fn = limitsSql.slice(limitsSql.indexOf('function public.ai_credit_limit'), limitsSql.indexOf('function public.ai_begin'))
    for (const plan of PLANS) {
      const value = plan.id === 'free' ? fn.match(/else (\w+)/)?.[1] : fn.match(new RegExp(`when '${plan.id}' then (\\w+)`))?.[1]
      expect(value, plan.id).toBe(plan.aiCredits === null ? 'null' : String(plan.aiCredits))
    }
  })

  it('mesaj sınırları sunucudaki ai_message_limit ve günlük sınırla aynı', () => {
    const fn = limitsSql.slice(limitsSql.indexOf('function public.ai_message_limit'), limitsSql.indexOf('function public.ai_begin'))
    for (const plan of PLANS) {
      const value = plan.id === 'free' ? fn.match(/else (\d+)/)?.[1] : fn.match(new RegExp(`when '${plan.id}' then (\\d+)`))?.[1]
      expect(Number(value), plan.id).toBe(plan.aiMessages)
    }
    expect(Number(limitsSql.match(/if v_requests > (\d+) then/)?.[1])).toBe(AI_DAILY_MESSAGES)
  })

  it('zarar sınırı: en pahalı istekle bile aylık yapay zekâ maliyeti plan fiyatının altında', () => {
    // Tavan: en büyük bağlam (20 KB gövde ≈ 11 700 token) + önbelleğe yazılan sabit kısım (5 401 token) + çıktının tamamı.
    const ceiling = (11_700 * 0.1 + 5_401 * 0.125 + 4_096 * 0.5) / 1e6
    expect(ceiling).toBeLessThanOrEqual(AI_COST.ceiling)
    for (const plan of PLANS) {
      // kredisi olan planın mesaj sınırı kredisinden az olamaz; ücretsiz planda ikisi de 0
      expect(plan.aiMessages, plan.id).toBeGreaterThanOrEqual(plan.aiCredits ?? 0)
      if (plan.id === 'free') expect(plan.aiMessages).toBe(0)
      else expect(plan.aiMessages * AI_COST.ceiling, plan.id).toBeLessThan(plan.launchPrice * 0.65)
    }
  })
})

describe('yapay zekâ ucu (/api/ai/edit)', () => {
  const ENV = { SUPABASE_URL: 'https://ref.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'pk' }
  const body = () => buildEditRequest(SAMPLE_TEMPLATE.build(), { ...text }, 2, 'turuncu yap', [])
  const post = (init: { token?: string; body?: unknown } = {}) =>
    new Request('https://mangostudio.design/api/ai/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(init.token === '' ? {} : { Authorization: `Bearer ${init.token ?? 'user-token'}` }) },
      body: JSON.stringify(init.body ?? body()),
    })

  /** Sahte Supabase: `ai_begin` / `ai_spend` çağrılarını kaydeder. */
  function supabase(begin: { status: number; body: unknown } = { status: 200, body: { plan: 'pro', used: 3, limit: 1000 } }) {
    const calls: string[] = []
    const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const name = String(input).split('/rpc/')[1]
      calls.push(name)
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer user-token')
      if (name === 'ai_begin') return new Response(JSON.stringify(begin.body), { status: begin.status })
      return new Response(JSON.stringify({ used: 4, limit: 1000 }), { status: 200 })
    }) as typeof globalThis.fetch
    return { fetch, calls }
  }
  const answers = (output: unknown) => async (): Promise<ModelAnswer> => ({ ok: true, output })

  it('yalnızca /api/ yollarını üstlenir', () => {
    expect(isAiPath('/api/ai/edit')).toBe(true)
    expect(isAiPath('/mcp')).toBe(false)
    expect(isAiPath('/apix')).toBe(false)
  })

  it('düzenlemeyi döndürür ve bir kredi düşer', async () => {
    const db = supabase()
    let seen = ''
    const res = await handleAiRequest(post(), ENV, {
      fetch: db.fetch,
      ask: async (message) => {
        seen = message
        return { ok: true, output: { ...empty, reply: 'Turuncu yaptım.', strings: [{ field: 'color', value: '#ff7a00' }] } }
      },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ reply: 'Turuncu yaptım.', edit: { patch: { color: '#ff7a00' }, addBlocks: [], updateBlocks: [], removeBlockIds: [] }, credits: { used: 4, limit: 1000 } })
    expect(db.calls).toEqual(['ai_begin', 'ai_spend'])
    expect(seen).toContain('Request: turuncu yap')
  })

  it('bir şey değişmediyse kredi düşmez', async () => {
    const db = supabase()
    const res = await handleAiRequest(post(), ENV, { fetch: db.fetch, ask: answers({ ...empty, reply: 'Buradan görsel değiştiremem.' }) })
    expect(await res.json()).toEqual({ reply: 'Buradan görsel değiştiremem.', edit: null, credits: { used: 3, limit: 1000 } })
    expect(db.calls).toEqual(['ai_begin'])
  })

  it('plan, kredi ve istek sınırı hatalarında modeli çağırmaz', async () => {
    const cases: [number, string, number, string][] = [
      [400, 'ai_plan_required', 402, 'plan_required'],
      [400, 'ai_credits_exhausted', 402, 'no_credits'],
      [400, 'ai_message_limit_reached', 429, 'message_limit'],
      [400, 'ai_rate_limited', 429, 'rate_limited'],
      [401, 'JWT expired', 401, 'unauthorized'],
      [404, 'PGRST202', 503, 'not_configured'],
    ]
    for (const [status, message, expected, error] of cases) {
      const db = supabase({ status, body: { message } })
      let asked = false
      const res = await handleAiRequest(post(), ENV, {
        fetch: db.fetch,
        ask: async () => {
          asked = true
          return { ok: true, output: empty }
        },
      })
      expect([res.status, await res.json()], message).toEqual([expected, { error }])
      expect(asked).toBe(false)
    }
  })

  it('girişsiz, bozuk ya da çok büyük isteği reddeder; anahtar yoksa "kurulmadı" der', async () => {
    const db = supabase()
    const ask = answers(empty)
    expect((await handleAiRequest(post({ token: '' }), ENV, { fetch: db.fetch, ask })).status).toBe(401)
    expect((await handleAiRequest(post({ body: { message: 'x' } }), ENV, { fetch: db.fetch, ask })).status).toBe(400)
    expect((await handleAiRequest(post({ body: { ...body(), pad: 'x'.repeat(70_000) } }), ENV, { fetch: db.fetch, ask })).status).toBe(413)
    expect((await handleAiRequest(new Request('https://mangostudio.design/api/ai/edit'), ENV, { fetch: db.fetch, ask })).status).toBe(405)
    expect((await handleAiRequest(new Request('https://mangostudio.design/api/other', { method: 'POST' }), ENV, { fetch: db.fetch, ask })).status).toBe(404)
    expect(db.calls).toEqual([])
    const res = await handleAiRequest(post(), ENV, { fetch: db.fetch })
    expect([res.status, await res.json()]).toEqual([503, { error: 'not_configured' }])
  })

  it('modelin reddi ve hataları hata adına çevrilir, kredi düşmez', async () => {
    for (const [reason, status] of [['refused', 422], ['busy', 503], ['failed', 502]] as const) {
      const db = supabase()
      const res = await handleAiRequest(post(), ENV, { fetch: db.fetch, ask: async () => ({ ok: false, reason }) })
      expect([res.status, await res.json()]).toEqual([status, { error: reason }])
      expect(db.calls).toEqual(['ai_begin'])
    }
  })
})
