import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEMPLATES } from '../project/templates'
import { findBlock, useProjectStore } from './projectStore'

const store = () => useProjectStore.getState()
// Uygulama lansmanı şablonunda 2. katman başlıktır.
const titleLayer = () => store().project.layers[1]
const allBlocks = () => [store().project.camera, ...store().project.layers].flatMap((t) => t.blocks)

let clock = new Date('2026-09-25T10:00:00Z').getTime()

beforeEach(() => {
  vi.useFakeTimers()
  // Her test bir öncekinden bir dakika sonra başlar; geri alma birleştirme penceresi karışmasın.
  clock += 60_000
  vi.setSystemTime(clock)
  store().loadProject(TEMPLATES[0].build())
})

afterEach(() => vi.useRealTimers())

describe('blok işlemleri', () => {
  it('kopyala + yapıştır blokları kendi satırlarına, oynatma kafasına göre ekler', () => {
    const [slide, typewriter] = titleLayer().blocks
    expect(store().copyBlocks([slide.id, typewriter.id])).toBe(2)
    store().pasteBlocks(5)
    const blocks = titleLayer().blocks
    expect(blocks).toHaveLength(4)
    const pasted = blocks.filter((b) => store().selectedBlockIds.includes(b.id))
    expect(pasted.map((b) => b.start)).toEqual([5, 5])
    expect(new Set(allBlocks().map((b) => b.id)).size).toBe(allBlocks().length)
  })

  it('çoğalt, seçimi grubun hemen arkasına kopyalar', () => {
    const [slide] = titleLayer().blocks
    store().duplicateBlocks([slide.id])
    const copy = findBlock(store().project, store().selectedBlockIds[0])!.block
    expect(copy.preset).toBe(slide.preset)
    expect(copy.start).toBeCloseTo(slide.start + slide.duration)
  })

  it('kaydırma bloğu 0 saniyenin altına indirmez', () => {
    const [slide] = titleLayer().blocks
    store().nudgeBlocks([slide.id], -10)
    expect(findBlock(store().project, slide.id)!.block.start).toBe(0)
  })

  it('çoklu silme', () => {
    const ids = titleLayer().blocks.map((b) => b.id)
    store().selectBlock(ids[0])
    store().selectBlock(ids[1], true)
    expect(store().selectedBlockIds).toHaveLength(2)
    store().removeBlocks(store().selectedBlockIds)
    expect(titleLayer().blocks).toHaveLength(0)
    expect(store().selectedBlockIds).toHaveLength(0)
  })
})

describe('videonun sınırları', () => {
  it('bitişe yakın eklenen blok videonun içinde kalır', () => {
    const duration = store().project.duration
    store().addBlock(titleLayer().id, 'float', duration + 5)
    const added = findBlock(store().project, store().selectedBlockIds[0])!.block
    expect(added.start).toBeLessThan(duration)
    expect(added.start + added.duration).toBeLessThanOrEqual(duration + 1e-9)
  })
})

describe('geri alma', () => {
  it('hızlı yazılan harfleri tek adımda geri alır, ayrı değişiklikleri ayrı adımda', () => {
    const id = titleLayer().id
    const original = titleLayer().text
    for (const text of ['Y', 'Ye', 'Yen', 'Yeni']) {
      store().updateLayer(id, { text })
      vi.advanceTimersByTime(100)
    }
    vi.advanceTimersByTime(1000)
    store().updateLayer(id, { color: '#ff0000' })

    useProjectStore.temporal.getState().undo()
    expect(titleLayer().text).toBe('Yeni')
    expect(titleLayer().color).not.toBe('#ff0000')

    useProjectStore.temporal.getState().undo()
    expect(titleLayer().text).toBe(original)
  })

  it('proje açınca geçmiş sıfırlanır', () => {
    store().updateProject({ name: 'değişti' })
    store().loadProject(TEMPLATES[1].build())
    expect(useProjectStore.temporal.getState().pastStates).toHaveLength(0)
  })
})

describe('şablonlar', () => {
  it.each(TEMPLATES.map((t) => [t.id, t] as const))('%s geçerli bir proje üretir', (_id, template) => {
    const project = template.build()
    const tracks = [project.camera, ...project.layers]
    const blocks = tracks.flatMap((t) => t.blocks)
    const ids = [...project.layers.map((l) => l.id), ...blocks.map((b) => b.id)]
    expect(new Set(ids).size).toBe(ids.length)
    for (const block of blocks) {
      expect(block.start + block.duration).toBeLessThanOrEqual(project.duration + 1e-6)
    }
    // Her şablon her seferinde yeni id'lerle üretilir.
    expect(template.build().id).not.toBe(project.id)
  })
})
