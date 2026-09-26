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
    // bloklar klibe göre tutulur; mutlak zamanları oynatma kafası
    expect(pasted.map((b) => b.start + titleLayer().start)).toEqual([5, 5])
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

describe('katman yönetimi', () => {
  it('katmanı listede taşır', () => {
    const ids = store().project.layers.map((l) => l.id)
    store().moveLayer(ids[3], 0)
    expect(store().project.layers.map((l) => l.id)).toEqual([ids[3], ids[0], ids[1], ids[2]])
    store().moveLayer(ids[3], 99)
    expect(store().project.layers.at(-1)!.id).toBe(ids[3])
  })

  it('katmanı yeni kimliklerle, hemen üstüne çoğaltır', () => {
    const source = titleLayer()
    store().duplicateLayer(source.id)
    const layers = store().project.layers
    const copy = layers[1]
    expect(layers[2].id).toBe(source.id)
    expect(copy.id).not.toBe(source.id)
    expect(copy.text).toBe(source.text)
    expect(copy.blocks.map((b) => b.preset)).toEqual(source.blocks.map((b) => b.preset))
    expect(copy.blocks.some((b) => source.blocks.some((o) => o.id === b.id))).toBe(false)
    expect(store().selectedTrackId).toBe(copy.id)
  })

  it('bloğu başka katmana taşır, kamera bloğunu katmana taşımaz', () => {
    const [slide] = titleLayer().blocks
    const logo = store().project.layers[0]
    store().moveBlockToTrack(slide.id, logo.id)
    expect(findBlock(store().project, slide.id)!.track.id).toBe(logo.id)
    expect(titleLayer().blocks.some((b) => b.id === slide.id)).toBe(false)

    const cameraBlock = store().project.camera.blocks[0]
    store().moveBlockToTrack(cameraBlock.id, logo.id)
    expect(findBlock(store().project, cameraBlock.id)!.track.id).toBe('camera')
  })

  it('bloğu oynatma kafasından böler, kenardaysa bölmez', () => {
    const typewriter = titleLayer().blocks[1]
    const end = typewriter.start + typewriter.duration
    store().splitBlocks([typewriter.id], titleLayer().start + typewriter.start + 0.4)
    const parts = titleLayer().blocks.filter((b) => b.preset === 'typewriter').sort((a, b) => a.start - b.start)
    expect(parts).toHaveLength(2)
    expect(parts[0].duration).toBeCloseTo(0.4)
    expect(parts[1].start).toBeCloseTo(typewriter.start + 0.4)
    expect(parts[1].start + parts[1].duration).toBeCloseTo(end)

    store().splitBlocks([parts[0].id], titleLayer().start + parts[0].start)
    expect(titleLayer().blocks.filter((b) => b.preset === 'typewriter')).toHaveLength(2)
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

describe('klipler', () => {
  const clip = () => ({ layer: titleLayer(), abs: (b: { start: number }) => b.start + titleLayer().start })

  it('taşıyınca animasyonlar klible birlikte gider', () => {
    const before = titleLayer()
    const absBefore = before.blocks.map((b) => b.start + before.start)
    store().setClipTimes({ [before.id]: { start: before.start + 2, end: before.start + before.duration + 2 } })
    expect(titleLayer().start).toBeCloseTo(before.start + 2)
    expect(titleLayer().blocks.map(clip().abs)).toEqual(absBefore.map((t) => expect.closeTo(t + 2)))
  })

  it('soldan kırpınca bloklar yerinde kalır, kenardaki giriş animasyonu kenarla gider', () => {
    const l = titleLayer()
    l.blocks.forEach((b) => expect(b.start).toBeGreaterThanOrEqual(0))
    store().updateBlock(l.blocks[1].id, { start: 1 }) // typewriter klibin içinde, 1. saniyede
    const typewriterAbs = l.start + 1
    store().setClipTimes({ [l.id]: { start: l.start + 0.5, end: l.start + l.duration } })
    const [slide, typewriter] = titleLayer().blocks
    expect(slide.start).toBe(0)
    expect(clip().abs(typewriter)).toBeCloseTo(typewriterAbs)
    expect(titleLayer().start + titleLayer().duration).toBeCloseTo(l.start + l.duration)
  })

  it('sağdan kırpınca sondaki çıkış animasyonu yeni sona taşınır', () => {
    const l = titleLayer()
    store().addBlock(l.id, 'fade-out', l.start + l.duration - 0.5)
    const out = findBlock(store().project, store().selectedBlockIds[0])!.block
    expect(out.start + out.duration).toBeCloseTo(l.duration)
    store().setClipTimes({ [l.id]: { start: l.start, end: l.start + l.duration - 1 } })
    const moved = findBlock(store().project, out.id)!.block
    expect(moved.start + moved.duration).toBeCloseTo(titleLayer().duration)
  })

  it('klip dışında katman çizilmez', async () => {
    const { evaluateLayer } = await import('../engine/evaluate')
    const l = titleLayer()
    store().setClipTimes({ [l.id]: { start: 2, end: 3 } })
    expect(evaluateLayer(titleLayer(), 1.9).opacity).toBe(0)
    expect(evaluateLayer(titleLayer(), 3.1).opacity).toBe(0)
    expect(evaluateLayer(titleLayer(), 2.9).opacity).toBeGreaterThan(0)
  })

  it('klibi oynatma kafasından böler; ikinci parça üstte yeni katman', () => {
    const l = titleLayer()
    const count = store().project.layers.length
    const at = l.start + 2
    store().splitClip(l.id, at)
    expect(store().project.layers).toHaveLength(count + 1)
    const [second, first] = [store().project.layers[1], store().project.layers[2]]
    expect(first.id).toBe(l.id)
    expect(first.start + first.duration).toBeCloseTo(at)
    expect(second.start).toBeCloseTo(at)
    expect(second.start + second.duration).toBeCloseTo(l.start + l.duration)
    // bitmiş giriş animasyonu ikinci parçaya geçmez
    expect(second.blocks.some((b) => b.preset === 'slide-up')).toBe(false)
    // kenarda bölmez
    store().splitClip(first.id, first.start)
    expect(store().project.layers).toHaveLength(count + 1)
  })

  it('yeni katman oynatma kafasında 5 sn klip olarak eklenir, video sonunu aşmaz', () => {
    const total = store().project.duration
    const id = store().addLayer('text', total - 1)
    const layer = store().project.layers.find((l) => l.id === id)!
    expect(layer.duration).toBe(5)
    expect(layer.start + layer.duration).toBeLessThanOrEqual(total)
  })
})
