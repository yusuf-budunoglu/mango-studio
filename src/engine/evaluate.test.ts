import { describe, expect, it } from 'vitest'
import { DEFAULT_TEMPLATE } from '../project/templates'
import { EASINGS } from './easing'
import { displayText, evaluate, evaluateLayer } from './evaluate'
import type { Layer } from './types'

const layer = (blocks: Layer['blocks'], extra: Partial<Layer> = {}): Layer => ({
  id: 'l',
  name: 'Test',
  start: 0,
  duration: 100,
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

const sampleProject = DEFAULT_TEMPLATE.build()

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

  it('kelime kelime belirme, soldan açılma ve harf aralığı', () => {
    const words = layer([{ id: 'b', preset: 'word-reveal', start: 0, duration: 1, easing: 'linear' }], { text: 'bir iki üç dört' })
    expect(displayText(words, evaluateLayer(words, 0))).toBe('')
    expect(displayText(words, evaluateLayer(words, 0.5))).toBe('bir iki')
    expect(displayText(words, evaluateLayer(words, 1))).toBe('bir iki üç dört')

    const wipe = layer([{ id: 'b', preset: 'wipe-in', start: 0, duration: 1, easing: 'linear' }])
    expect(evaluateLayer(wipe, 0.25).wipe).toBeCloseTo(0.25)
    expect(evaluateLayer(wipe, 2).wipe).toBe(1)
    const soft = layer([{ id: 'b', preset: 'soft-reveal', start: 0, duration: 1, easing: 'linear', params: { softness: 0.5 } }])
    expect(evaluateLayer(soft, -1).softReveal).toBe(0)
    expect(evaluateLayer(soft, 0.5).softReveal).toBeCloseTo(0.5)
    expect(evaluateLayer(soft, 0.5).revealSoftness).toBe(0.5)
    expect(evaluateLayer(soft, 2).softReveal).toBe(1)

    const tracking = layer([{ id: 'b', preset: 'tracking-in', start: 0, duration: 1, easing: 'linear' }])
    expect(evaluateLayer(tracking, 0).letterSpacing).toBeCloseTo(0.4)
    expect(evaluateLayer(tracking, 1).letterSpacing).toBeCloseTo(0)
  })

  it('kamera push-in kamerayı öne taşır', () => {
    const start = evaluate(sampleProject, 0).camera.z
    const end = evaluate(sampleProject, 8).camera.z
    expect(end).toBeCloseTo(start - 2)
  })
})

describe('easing', () => {
  it('tüm eğriler 0 da başlar, 1 de biter', () => {
    for (const [name, fn] of Object.entries(EASINGS)) {
      expect(fn(0), name).toBeCloseTo(0, 2)
      expect(fn(1), name).toBeCloseTo(1, 2)
    }
  })
})

describe('şablon klipleri', () => {
  it('klibe oturtulan her şablon katmanı, tüm videoya yayılmış haliyle aynı görünür', async () => {
    const { TEMPLATES, buildUnfitted } = await import('../project/templates')
    for (const template of TEMPLATES) {
      const project = template.build()
      const original = buildUnfitted(template)
      project.layers.forEach((l, i) => {
        const full = original.layers[i]
        for (let i = 0; i < project.duration * 10; i++) {
          const t = i / 10
          const a = evaluateLayer(l, t)
          const b = evaluateLayer(full, t)
          const label = `${template.id}/${l.name} @${t.toFixed(1)}`
          expect(a.opacity, label).toBeCloseTo(b.opacity, 4)
          if (b.opacity > 0.001) expect(a.x, label).toBeCloseTo(b.x, 4)
        }
      })
    }
  })
})

describe('videonun sonu', () => {
  it('sona kadar süren klip, oynatma kafası tam sondayken de görünür', () => {
    const base = DEFAULT_TEMPLATE.build()
    const last = { ...layer([]), start: 2, duration: base.duration - 2 }
    const project = { ...base, layers: [last] }
    expect(evaluate(project, project.duration - 0.01).layers[last.id].opacity).toBe(1)
    expect(evaluate(project, project.duration).layers[last.id].opacity).toBe(1)
    // videonun içinde klip sonu hariç kalır
    const short = { ...last, duration: 3 }
    expect(evaluate({ ...base, layers: [short] }, 5).layers[short.id].opacity).toBe(0)
  })
})

describe('özel eğri çözücüsü', () => {
  it('CSS cubic-bezier ile aynı sonucu hassas verir, uçlara çok yakın anlarda sapmaz', async () => {
    const { preciseCubicBezier } = await import('./easing')
    // ease (0.25, 0.1, 0.25, 1): x = 0.5 için bilinen değer ≈ 0.8024033877
    expect(preciseCubicBezier(0.25, 0.1, 0.25, 1)(0.5)).toBeCloseTo(0.8024033877, 8)
    const fn = preciseCubicBezier(0.32, 0, 0.67, 0)
    expect(fn(1 - 4e-7)).toBeCloseTo(1, 5)
    expect(fn(4e-7)).toBeCloseTo(0, 6)
    // tek yönlü artan
    let prev = 0
    for (let i = 1; i <= 100; i++) {
      const v = fn(i / 100)
      expect(v).toBeGreaterThanOrEqual(prev - 1e-12)
      prev = v
    }
  })
})
