import { describe, expect, it } from 'vitest'
import type { Layer, Project } from '../engine/types'
import { BackendError, createSupabaseBackend } from '../mcp/backend'
import { brandPatch, cleanBrandKit, isAccentColor, isEmptyBrandKit, type BrandKit } from './brandKit'
import { SAMPLE_TEMPLATE } from './sampleTemplate'

const layer = (id: string, patch: Partial<Layer>): Layer => ({
  id,
  name: id,
  kind: 'text',
  start: 0,
  duration: 5,
  color: '#ffffff',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: 1,
  opacity: 1,
  blocks: [],
  ...patch,
})

const project = (layers: Layer[]): Project => ({ ...SAMPLE_TEMPLATE.build(), layers })

const kit: BrandKit = { name: 'Acme', website: 'acme.com', colors: ['#2244ff', '#ff2266'], fontFamily: 'roboto', logo: 'asset:a-logo' }

describe('marka kiti', () => {
  it('kaydı temizler: bozuk renk, tekrar, fazla renk, uzun metin ve dosya olmayan logo atılır', () => {
    const clean = cleanBrandKit({ name: ' Acme ', website: 'acme.com', colors: ['#FF0000', 'red', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff'], fontFamily: 'roboto', logo: 'https://evil.example/x.png', extra: 1 })
    expect(clean).toEqual({ name: 'Acme', website: 'acme.com', colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00'], fontFamily: 'roboto' })
    expect(cleanBrandKit(null)).toEqual({ name: '', website: '', colors: [] })
    expect(cleanBrandKit({ name: 'x'.repeat(200) }).name).toHaveLength(60)
    expect(isEmptyBrandKit(cleanBrandKit({}))).toBe(true)
    expect(isEmptyBrandKit(kit)).toBe(false)
  })

  it('vurgu rengi: doygun renkler evet; beyaz, siyah, gri ve çok açık tonlar hayır', () => {
    for (const c of ['#ff7a00', '#46a83f', '#2244ff', '#e2361b']) expect(isAccentColor(c), c).toBe(true)
    for (const c of ['#ffffff', '#000000', '#808080', '#131109', '#f5f2ec', 'orange']) expect(isAccentColor(c), c).toBe(false)
  })

  it('en çok kullanılan vurgu rengi ana renge, sonraki ikinci renge döner; nötr renkler ve boyanmayan görseller kalır', () => {
    const p = project([
      layer('t1', { color: '#ff7a00' }),
      layer('t2', { color: '#ff7a00' }),
      layer('s1', { kind: 'shape', color: '#46a83f' }),
      layer('s2', { kind: 'shape', color: '#ffb21e' }),
      layer('t3', { color: '#ffffff' }),
      layer('i1', { kind: 'image', color: '#ff7a00', image: 'asset:photo' }),
      layer('v1', { kind: 'svg', color: '#ff7a00', tint: true }),
    ])
    const patch = brandPatch(p, { ...kit, fontFamily: undefined, logo: undefined })
    expect(patch.t1).toEqual({ color: '#2244ff' })
    expect(patch.v1).toEqual({ color: '#2244ff' })
    expect(patch.s1?.color).toBe('#ff2266')
    expect(patch.s2?.color).toBe('#ff2266')
    expect(patch.t3).toBeUndefined()
    expect(patch.i1).toBeUndefined()
  })

  it('yazı tipi, örnek marka adı ve site adresi, Mango logosu değişir; harf harf başlıklar ve diğer görseller kalır', () => {
    const p = project([
      layer('name', { text: 'Mango Studio' }),
      layer('site', { text: ' mangostudio.design ' }),
      layer('letter', { text: 'M' }),
      layer('logo1', { kind: 'image', name: 'Logo', image: 'asset:old' }),
      layer('logo2', { kind: 'image', name: 'Mark', image: '/brand/mango-logo-2048.png' }),
      layer('photo', { kind: 'image', name: 'Ekran', image: 'asset:screen' }),
    ])
    const patch = brandPatch(p, kit)
    expect(patch.name).toEqual({ fontFamily: 'roboto', text: 'Acme' })
    expect(patch.site).toEqual({ fontFamily: 'roboto', text: 'acme.com' })
    expect(patch.letter).toEqual({ fontFamily: 'roboto' })
    expect(patch.logo1).toEqual({ image: 'asset:a-logo' })
    expect(patch.logo2).toEqual({ image: 'asset:a-logo' })
    expect(patch.photo).toBeUndefined()
  })

  it('boş kit ve zaten markalı proje hiçbir şeyi değiştirmez', () => {
    const p = project([layer('t1', { color: '#2244ff', fontFamily: 'roboto', text: 'Acme' }), layer('logo', { kind: 'image', image: 'asset:a-logo' })])
    expect(brandPatch(p, cleanBrandKit({}))).toEqual({})
    expect(brandPatch(p, kit)).toEqual({})
  })
})

describe('Claude projesi sınırı (MCP veri katmanı)', () => {
  it('sunucunun sınır hatası Claude için okunur bir mesaja çevrilir', async () => {
    const backend = createSupabaseBackend({
      url: 'https://ref.supabase.co',
      publishableKey: 'pk',
      accessToken: 'tok',
      userId: 'u1',
      fetch: async (input, init) => {
        if (String(input).includes('select=id')) return new Response('[]')
        expect(init?.method).toBe('POST')
        return new Response('{"code":"P0001","message":"mcp_project_limit_reached"}', { status: 400 })
      },
    })
    const error = await backend.saveProject(SAMPLE_TEMPLATE.build()).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(BackendError)
    expect((error as Error).message).toMatch(/3 new Claude-built projects per month.*Do not retry.*mangostudio\.design\/pricing/)
  })
})
