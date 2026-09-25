import { describe, expect, it } from 'vitest'
import { TEMPLATES } from '../project/templates'
import { createRepository, parseProjectFile, type KeyValue } from './repository'

function memoryKv(): KeyValue {
  const data = new Map<string, unknown>()
  return {
    get: async <T,>(key: string) => structuredClone(data.get(key)) as T | undefined,
    set: async (key, value) => void data.set(key, structuredClone(value)),
    del: async (key) => void data.delete(key),
  }
}

describe('repository', () => {
  it('kaydeder, listeler, yükler ve siler', async () => {
    const repo = createRepository(memoryKv())
    const a = TEMPLATES[0].build()
    const b = TEMPLATES[1].build()
    await repo.save(a, 'data:thumb')
    await repo.save(b)
    expect((await repo.list()).map((p) => p.id)).toEqual([b.id, a.id])

    await repo.save({ ...a, name: 'Yeni ad' })
    const list = await repo.list()
    expect(list[0]).toMatchObject({ id: a.id, name: 'Yeni ad', thumbnail: 'data:thumb' })
    expect(await repo.load(a.id)).toMatchObject({ name: 'Yeni ad' })

    await repo.remove(a.id)
    expect((await repo.list()).map((p) => p.id)).toEqual([b.id])
    expect(await repo.load(a.id)).toBeUndefined()
  })
})

describe('proje dosyası', () => {
  it('dışa aktarılan projeyi yeni bir id ile geri okur', () => {
    const project = TEMPLATES[2].build()
    const parsed = parseProjectFile(JSON.stringify(project))
    expect(parsed.id).not.toBe(project.id)
    expect({ ...parsed, id: project.id }).toEqual(project)
  })

  it('bozuk dosyada anlaşılır hata verir', () => {
    expect(() => parseProjectFile('{nope')).toThrow(/JSON/)
    expect(() => parseProjectFile('{"name":"x"}')).toThrow(/proje bilgileri/)
    const project = TEMPLATES[0].build()
    project.layers[0].blocks[0].preset = 'uçan-halı'
    expect(() => parseProjectFile(JSON.stringify(project))).toThrow(/uçan-halı/)
  })
})
