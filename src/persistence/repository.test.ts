import { describe, expect, it } from 'vitest'
import { SAMPLE_TEMPLATE } from '../project/sampleTemplate'
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
    const a = SAMPLE_TEMPLATE.build()
    const b = SAMPLE_TEMPLATE.build()
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

describe('klasörler', () => {
  it('proje klasöre taşınır; kaydetmek klasörü korur, sıralamaya dokunmaz', async () => {
    const repo = createRepository(memoryKv())
    const a = SAMPLE_TEMPLATE.build()
    const b = SAMPLE_TEMPLATE.build()
    await repo.save(a)
    await repo.save(b)
    const folder = await repo.createFolder('Müşteri A')
    expect(await repo.listFolders()).toEqual([folder])

    await repo.moveToFolder(a.id, folder.id)
    expect((await repo.list()).map((p) => p.id)).toEqual([b.id, a.id])
    await repo.save({ ...a, name: 'düzenlendi' })
    expect((await repo.list()).find((p) => p.id === a.id)).toMatchObject({ folderId: folder.id, width: a.width, height: a.height })

    await repo.moveToFolder(a.id, undefined)
    expect((await repo.list()).find((p) => p.id === a.id)?.folderId).toBeUndefined()
  })

  it('klasör silinince içindeki projeler silinmez, klasörsüz kalır', async () => {
    const repo = createRepository(memoryKv())
    const a = SAMPLE_TEMPLATE.build()
    await repo.save(a)
    const folder = await repo.createFolder('Eski')
    await repo.moveToFolder(a.id, folder.id)
    await repo.renameFolder(folder.id, 'Arşiv')
    expect((await repo.listFolders())[0].name).toBe('Arşiv')

    await repo.removeFolder(folder.id)
    expect(await repo.listFolders()).toEqual([])
    expect(await repo.list()).toMatchObject([{ id: a.id, folderId: undefined }])
  })

  it('yeniden adlandırma hem listeye hem projeye yazılır', async () => {
    const repo = createRepository(memoryKv())
    const a = SAMPLE_TEMPLATE.build()
    await repo.save(a)
    await repo.rename(a.id, 'Yeni ad')
    expect((await repo.list())[0].name).toBe('Yeni ad')
    expect((await repo.load(a.id))?.name).toBe('Yeni ad')
  })
})

describe('proje dosyası', () => {
  it('dışa aktarılan projeyi yeni bir id ile geri okur', () => {
    const project = SAMPLE_TEMPLATE.build()
    const parsed = parseProjectFile(JSON.stringify(project))
    expect(parsed.id).not.toBe(project.id)
    expect({ ...parsed, id: project.id }).toEqual(project)
  })

  it('bozuk dosyada anlaşılır hata verir', () => {
    expect(() => parseProjectFile('{nope')).toThrow(/JSON/)
    expect(() => parseProjectFile('{"name":"x"}')).toThrow(/project details/)
    const project = SAMPLE_TEMPLATE.build()
    project.layers[0].blocks[0].preset = 'uçan-halı'
    expect(() => parseProjectFile(JSON.stringify(project))).toThrow(/uçan-halı/)
  })
})
