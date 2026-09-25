import { describe, expect, it } from 'vitest'
import { createRepository, parseProjectFile, type KeyValue } from '../persistence/repository'
import { TEMPLATES } from '../project/templates'
import { evaluateLayer } from './evaluate'
import { migrateProject, NewerProjectVersionError } from './migrate'
import { PRESETS, resolveParams } from './presets'
import { PROJECT_VERSION, type Layer } from './types'

/** Sürüm alanı eklenmeden önce kaydedilmiş bir proje (sürüm 0). */
function legacyProject() {
  const { version: _drop, ...rest } = TEMPLATES[0].build()
  return rest
}

describe('sürüm geçişi', () => {
  it('sürümsüz eski projeyi güncel sürüme getirir, içeriğe dokunmaz', () => {
    const old = legacyProject()
    const migrated = migrateProject(old)
    expect(migrated.version).toBe(PROJECT_VERSION)
    expect({ ...migrated, version: undefined }).toEqual({ ...old, version: undefined })
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
    position: [0, 0, 0], rotation: [0, 0, 0], scale: 1, opacity: 1, blocks,
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
