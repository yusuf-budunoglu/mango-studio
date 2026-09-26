import { describe, expect, it } from 'vitest'
import { createRepository, parseProjectFile, type KeyValue } from '../persistence/repository'
import { buildUnfitted, TEMPLATES } from '../project/templates'
import { evaluateLayer } from './evaluate'
import { migrateProject, NewerProjectVersionError } from './migrate'
import { PRESETS, resolveParams } from './presets'
import { PROJECT_VERSION, type Layer } from './types'

/**
 * Sürüm alanı eklenmeden önce kaydedilmiş bir proje (sürüm 0): katmanların klibi yok, blok
 * zamanları videoya göre.
 */
function legacyProject() {
  const { version: _drop, ...rest } = buildUnfitted(TEMPLATES[0])
  return { ...rest, layers: rest.layers.map(({ start: _s, duration: _d, ...l }) => l) }
}

describe('sürüm geçişi', () => {
  it('sürümsüz eski projeyi güncel sürüme getirir; video aynı görünür', () => {
    const old = legacyProject()
    const migrated = migrateProject(old)
    expect(migrated.version).toBe(PROJECT_VERSION)
    const original = TEMPLATES[0].build()
    // Aynı şablonun yeni hali ile taşınmış eski hali her anda aynı kareyi vermeli.
    for (let i = 0; i < original.duration * 4; i++) {
      const t = i / 4
      migrated.layers.forEach((layer, i) => {
        const a = evaluateLayer(layer, t)
        const b = evaluateLayer({ ...original.layers[i], blocks: original.layers[i].blocks.map((x, j) => ({ ...x, id: layer.blocks[j].id })) }, t)
        expect(a.opacity, `${layer.name} @${t}`).toBeCloseTo(b.opacity, 5)
        expect(a.x).toBeCloseTo(b.x, 5)
        expect(a.y).toBeCloseTo(b.y, 5)
      })
    }
  })

  it('1 → 2: video katmanının klibi eski başlangıcından başlar', () => {
    const v1 = { version: 1, duration: 10, layers: [{ id: 'v', kind: 'video', mediaStart: 3, blocks: [{ id: 'b', preset: 'fade-in', start: 3, duration: 1 }] }] }
    const layer = migrateProject(v1).layers[0]
    expect(layer).toMatchObject({ start: 3, duration: 7, blocks: [{ start: 0 }] })
    expect('mediaStart' in layer).toBe(false)
  })

  it('güncel projeyi olduğu gibi bırakır', () => {
    const project = TEMPLATES[1].build()
    expect(migrateProject(project)).toEqual(project)
  })

  it('daha yeni sürümü reddeder', () => {
    expect(() => migrateProject({ ...TEMPLATES[0].build(), version: PROJECT_VERSION + 1 })).toThrow(NewerProjectVersionError)
    expect(() => parseProjectFile(JSON.stringify({ ...TEMPLATES[0].build(), version: 99 }))).toThrow(/newer version/)
  })

  it('kayıttan ve dosyadan açılan eski projeler güncellenir', async () => {
    const data = new Map<string, unknown>()
    const kv: KeyValue = {
      get: async <T,>(k: string) => structuredClone(data.get(k)) as T | undefined,
      set: async (k, v) => void data.set(k, structuredClone(v)),
      del: async (k) => void data.delete(k),
    }
    const old = legacyProject()
    data.set(`project:${old.id}`, old)
    expect((await createRepository(kv).load(old.id))?.version).toBe(PROJECT_VERSION)
    expect(parseProjectFile(JSON.stringify(old)).version).toBe(PROJECT_VERSION)
  })
})

describe('blok ayarları', () => {
  const layer = (blocks: Layer['blocks']): Layer => ({
    id: 'l', name: 'x', kind: 'text', text: 'a', color: '#fff',
    position: [0, 0, 0], rotation: [0, 0, 0], scale: 1, opacity: 1, start: 0, duration: 100, blocks,
  })

  it('kaydedilmemiş ayarlar varsayılanlarla doldurulur', () => {
    expect(resolveParams(PRESETS['count-up'], undefined)).toEqual({ from: 0, to: 100, decimals: 0 })
    expect(resolveParams(PRESETS['count-up'], { to: 5 })).toEqual({ from: 0, to: 5, decimals: 0 })
  })

  it('her ayarın varsayılanı kendi aralığında', () => {
    for (const [id, preset] of Object.entries(PRESETS)) {
      for (const spec of preset.params ?? []) {
        expect(spec.default, `${id}.${spec.key}`).toBeGreaterThanOrEqual(spec.min ?? -Infinity)
        expect(spec.default, `${id}.${spec.key}`).toBeLessThanOrEqual(spec.max ?? Infinity)
      }
    }
  })

  it('motor ayar değişikliğini kullanır', () => {
    const base = evaluateLayer(layer([{ id: 'b', preset: 'slide-up', start: 0, duration: 1, easing: 'linear' }]), 0)
    const far = evaluateLayer(layer([{ id: 'b', preset: 'slide-up', start: 0, duration: 1, easing: 'linear', params: { distance: 3 } }]), 0)
    expect(base.y).toBeCloseTo(-1.2)
    expect(far.y).toBeCloseTo(-3)
  })
})
