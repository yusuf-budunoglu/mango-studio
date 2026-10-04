import { beforeEach, describe, expect, it } from 'vitest'
import type { AudioClip } from '../engine/types'
import { createAssetStore } from '../persistence/assets'
import type { KeyValue } from '../persistence/repository'
import { SAMPLE_TEMPLATE } from '../project/sampleTemplate'
import { findAudio, useProjectStore } from '../store/projectStore'
import { clipGainAt, computePeaks, planClip } from './schedule'

const clip = (extra: Partial<AudioClip> = {}): AudioClip => ({
  id: 'c', name: 'music', asset: 'asset:x', start: 2, offset: 1, duration: 4, sourceDuration: 10,
  volume: 0.8, fadeIn: 1, fadeOut: 1, ...extra,
})

describe('ses zamanlaması', () => {
  it('parça başlamadan oynatınca bekler, kaynağın ofsetinden başlar', () => {
    const plan = planClip(clip(), 0)!
    expect(plan.delay).toBe(2)
    expect(plan.sourceOffset).toBe(1)
    expect(plan.length).toBe(4)
    expect(plan.envelope[0]).toEqual({ at: 0, gain: 0 })
    expect(plan.envelope.at(-1)).toEqual({ at: 4, gain: 0 })
  })

  it('parçanın ortasından oynatınca kaynakta da ileri gider', () => {
    const plan = planClip(clip(), 3.5)!
    expect(plan.delay).toBe(0)
    expect(plan.sourceOffset).toBeCloseTo(2.5)
    expect(plan.length).toBeCloseTo(2.5)
    expect(plan.envelope[0].gain).toBeCloseTo(0.8)
  })

  it('bitmiş parçayı çalmaz', () => {
    expect(planClip(clip(), 6)).toBeNull()
    expect(planClip(clip(), 10)).toBeNull()
  })

  it('açılış ve kapanış seviyesi', () => {
    const c = clip()
    expect(clipGainAt(c, 0)).toBe(0)
    expect(clipGainAt(c, 0.5)).toBeCloseTo(0.4)
    expect(clipGainAt(c, 2)).toBeCloseTo(0.8)
    expect(clipGainAt(c, 3.5)).toBeCloseTo(0.4)
  })

  it('dalga görüntüsü en yüksek genliği alır', () => {
    const data = new Float32Array(800)
    data[400] = -0.9
    const peaks = computePeaks([data], 2)
    expect(peaks[0]).toBe(0)
    expect(peaks[1]).toBeCloseTo(0.9)
  })
})

describe('ses parçası işlemleri', () => {
  const store = () => useProjectStore.getState()
  beforeEach(() => store().loadProject(SAMPLE_TEMPLATE.build()))

  it('eklenen parça videoya sığacak kadar kısaltılır', () => {
    const id = store().addAudioClip('asset:a', 'song', 30, 2)
    const c = findAudio(store().project, id)!
    expect(c.start).toBe(2)
    expect(c.duration).toBe(store().project.duration - 2)
    expect(store().selectedTrackId).toBe('audio')
  })

  it('soldan kırpınca kaynak ofseti kayar, sağdan kırpınca kaymaz', () => {
    const id = store().addAudioClip('asset:a', 'song', 30, 0)
    const c = findAudio(store().project, id)!
    store().setAudioTimes({ [id]: { start: 1.5, end: c.start + c.duration } })
    let now = findAudio(store().project, id)!
    expect(now.offset).toBeCloseTo(1.5)
    expect(now.start + now.duration).toBeCloseTo(c.start + c.duration)
    store().setAudioTimes({ [id]: { start: now.start, end: now.start + 2 } })
    now = findAudio(store().project, id)!
    expect(now.offset).toBeCloseTo(1.5)
    expect(now.duration).toBeCloseTo(2)
  })

  it('bölünen parçanın ikincisi kaynağın kaldığı yerden devam eder', () => {
    const id = store().addAudioClip('asset:a', 'song', 30, 1)
    store().splitBlocks([id], 3)
    const clips = [...(store().project.audio ?? [])].sort((a, b) => a.start - b.start)
    expect(clips).toHaveLength(2)
    expect(clips[0].duration).toBeCloseTo(2)
    expect(clips[1].start).toBe(3)
    expect(clips[1].offset).toBeCloseTo(2)
  })

  it('silme ve kaydırma ses parçalarını da kapsar', () => {
    const id = store().addAudioClip('asset:a', 'song', 3, 2)
    store().nudgeBlocks([id], 0.5)
    expect(findAudio(store().project, id)!.start).toBeCloseTo(2.5)
    store().removeBlocks([id])
    expect(store().project.audio).toHaveLength(0)
  })
})

describe('dosya deposu', () => {
  it('dosyayı saklar, listeler, siler', async () => {
    const data = new Map<string, unknown>()
    const kv: KeyValue = {
      get: async <T,>(k: string) => data.get(k) as T | undefined,
      set: async (k, v) => void data.set(k, v),
      del: async (k) => void data.delete(k),
    }
    const store = createAssetStore(kv)
    const meta = await store.put(new Blob(['abc'], { type: 'audio/wav' }), { name: 'beep.wav', kind: 'audio', duration: 1 })
    expect(meta).toMatchObject({ name: 'beep.wav', kind: 'audio', size: 3, type: 'audio/wav' })
    expect((await store.list()).map((a) => a.id)).toEqual([meta.id])
    expect(await (await store.getBlob(meta.id))!.text()).toBe('abc')
    await store.remove(meta.id)
    expect(await store.list()).toEqual([])
  })
})
