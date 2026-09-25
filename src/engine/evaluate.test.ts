import { describe, expect, it } from 'vitest'
import { sampleProject } from '../project/sampleProject'
import { EASINGS } from './easing'
import { displayText, evaluate, evaluateLayer } from './evaluate'
import type { Layer } from './types'

const layer = (blocks: Layer['blocks'], extra: Partial<Layer> = {}): Layer => ({
  id: 'l',
  name: 'Test',
  kind: 'text',
  text: 'Merhaba',
  color: '#fff',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: 1,
  opacity: 1,
  blocks,
  ...extra,
})

describe('evaluate', () => {
  it('aynı zaman için her seferinde aynı sonucu verir', () => {
    for (const t of [0, 0.37, 1.5, 4.2, 8]) {
      expect(evaluate(sampleProject, t)).toEqual(evaluate(sampleProject, t))
    }
  })

  it('giriş bloğu başlamadan önce katmanı gizler, bitince tam gösterir', () => {
    const l = layer([{ id: 'b', preset: 'fade-in', start: 1, duration: 1, easing: 'linear' }])
    expect(evaluateLayer(l, 0).opacity).toBe(0)
    expect(evaluateLayer(l, 1.5).opacity).toBeCloseTo(0.5)
    expect(evaluateLayer(l, 3).opacity).toBe(1)
  })

  it('çıkış bloğu başlamadan önce katmana dokunmaz', () => {
    const l = layer([{ id: 'b', preset: 'fade-out', start: 2, duration: 1, easing: 'linear' }])
    expect(evaluateLayer(l, 1).opacity).toBe(1)
    expect(evaluateLayer(l, 3).opacity).toBe(0)
  })

  it('slide-up blok bitince katmanı kendi yerine getirir', () => {
    const l = layer([{ id: 'b', preset: 'slide-up', start: 0, duration: 1 }], { position: [1, 2, 0] })
    const end = evaluateLayer(l, 1)
    expect(end.x).toBe(1)
    expect(end.y).toBeCloseTo(2)
    expect(evaluateLayer(l, 0).y).toBeLessThan(2)
  })

  it('typewriter metni zamanla açar, count-up sayıyı sayar', () => {
    const typed = layer([{ id: 'b', preset: 'typewriter', start: 0, duration: 1, easing: 'linear' }])
    expect(displayText(typed, evaluateLayer(typed, 0))).toBe('')
    expect(displayText(typed, evaluateLayer(typed, 1))).toBe('Merhaba')

    const counter = layer([{ id: 'b', preset: 'count-up', start: 0, duration: 1, easing: 'linear', params: { from: 0, to: 200 } }])
    expect(displayText(counter, evaluateLayer(counter, 0.5))).toBe('100')
  })

  it('kamera push-in kamerayı öne taşır', () => {
    const start = evaluate(sampleProject, 0).camera.z
    const end = evaluate(sampleProject, 8).camera.z
    expect(end).toBeCloseTo(start - 2)
  })
})

describe('easing', () => {
  it('tüm eğriler 0 da başlar, 1 de biter', () => {
    for (const [name, { fn }] of Object.entries(EASINGS)) {
      expect(fn(0), name).toBeCloseTo(0, 2)
      expect(fn(1), name).toBeCloseTo(1, 2)
    }
  })
})
